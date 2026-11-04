'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const acorn = require('./vendor/acorn.cjs');
const {walk, memberName} = require('./editor-scope.cjs');
const {buildInspection, queryInspection, reachable} = require('./editor-inspection.cjs');

const product = file => /^(src\/|knowledge\/|assets\/)/.test(file) || ['index.html', 'sw.js', 'manifest.webmanifest'].includes(file);
const broad = file => ['scripts/editor-source.cjs', 'src/core.js', 'src/ui.js', 'src/core/shared.js', 'src/core/fields-transactions.js', 'src/core/serialization.js'].includes(file);
const documents = file => file.endsWith('.md') || /^\.(agents|claude)\//.test(file);
const command = (name, args, reason, coverage) => ({command: name, args, reason, coverage});
const fullChecks = (browser, reason) => [command('npm', ['test'], reason, 'full'), ...(browser ? [command('npm', ['run', 'test:browser'], '產品來源或共用流程需瀏覽器回歸', 'full')] : [])];
const git = (root, args, options = {}) => execFileSync('git', ['-C', root, ...args], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...options});

function testCandidates(index, names, limitations = []) {
  const folder = path.join(index.root, 'tests');
  if (!fs.existsSync(folder)) return [];
  const cache = new Map();
  function uses(file) {
    if (cache.has(file)) return cache.get(file);
    const result = {methods: new Set(), imports: new Set()}, imports = [];
    cache.set(file, result);
    try {
      const ast = acorn.parse(fs.readFileSync(file, 'utf8'), {ecmaVersion: 2024, allowHashBang: true, allowReturnOutsideFunction: true});
      walk(ast, node => {
        if (node.type === 'MemberExpression') {
          const object = node.object;
          if ((object.type === 'Identifier' && ['C', 'SaveCore'].includes(object.name)) || (object.type === 'MemberExpression' && ['C', 'SaveCore'].includes(memberName(object)))) {
            const name = memberName(node); if (names.has(name)) result.methods.add(name);
          }
        }
        if (node.type === 'CallExpression' && node.callee.name === 'require') {
          if (typeof node.arguments[0]?.value !== 'string') limitations.push({code: 'TEST_DYNAMIC_IMPORT', file: path.relative(index.root, file).replaceAll('\\', '/'), line: 1, column: 1, message: '動態測試 helper 無法完整追蹤'});
          else if (node.arguments[0].value.startsWith('.')) imports.push(node.arguments[0].value);
        }
      });
      for (const relative of imports) {
        const target = path.resolve(path.dirname(file), relative);
        if (!target.startsWith(folder + path.sep)) continue;
        const resolved = [target, target + '.cjs', target + '.js'].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
        if (resolved) { result.imports.add(resolved); uses(resolved); }
        else limitations.push({code: 'TEST_IMPORT', file: path.relative(index.root, file).replaceAll('\\', '/'), line: 1, column: 1, message: '測試 helper 無法定位：' + relative});
      }
    } catch (error) { limitations.push({code: 'TEST_PARSE', file: path.relative(index.root, file).replaceAll('\\', '/'), line: error.loc?.line || 1, column: (error.loc?.column || 0) + 1, message: '測試候選無法完整解析：' + error.message}); }
    return result;
  }
  const entries = fs.readdirSync(folder).filter(file => file.endsWith('.test.cjs'));
  entries.forEach(file => uses(path.join(folder, file)));
  const imports = new Map([...cache].map(([file, data]) => [file, data.imports]));
  return entries.filter(file => [...reachable([path.join(folder, file)], imports)].some(f => cache.get(f)?.methods.size)).map(file => 'tests/' + file).sort();
}

function suggestChecks(index, {ids = [], files = [], incomplete = false, reasons = []} = {}) {
  if (!index && !files.length) return [];
  if (files.length && files.every(documents)) return [
    command('git', ['diff', '--check'], '文件變更：檢查差異', 'documents'),
    {kind: 'manual', instruction: '核對本次文件連結、技能路由與規則一致性', coverage: 'documents'}
  ];
  const browser = files.some(product), shared = files.some(broad);
  const reverse = new Map();
  for (const [from, targets] of index?.dependencies || []) for (const to of targets) { if (!reverse.has(to)) reverse.set(to, new Set()); reverse.get(to).add(from); }
  const impacted = reachable(ids, reverse), names = new Set(Object.entries(index?.publicExports || {}).filter(([, id]) => impacted.has(id)).map(([name]) => name));
  const testLimitations = [], candidates = index ? testCandidates(index, names, testLimitations) : [];
  const impactedFiles = new Set([...(index?.definitions || []).filter(d => impacted.has(d.id)).map(d => d.file), ...files]);
  const uncertain = index?.limitations.some(item => item.code !== 'SOURCE_CYCLE' && impactedFiles.has(item.file));
  const testReason = testLimitations.length ? ['測試候選有 ' + testLimitations.length + ' 項無法完整解析的相依，例如 ' + testLimitations[0].file + '：' + testLimitations[0].message] : [];
  if (!index || incomplete || shared || uncertain || index.diagnostics.length || testLimitations.length || !candidates.length) return fullChecks(browser || shared, [...reasons, ...testReason].join('；') || '共用、動態或尚無可定位測試的影響，採完整 Node 驗證');
  return [command('node', ['--test', ...candidates], '由公開名稱與測試／helper 靜態引用找到的候選，未宣稱完整覆蓋', 'static-candidates'), ...(browser ? [command('npm', ['run', 'test:browser'], '產品功能變更需瀏覽器回歸', 'full')] : [])];
}

function declaredNames(source) {
  const ast = acorn.parse(source, {ecmaVersion: 2024, allowHashBang: true, allowReturnOutsideFunction: true});
  const expression = ast.body.length === 1 ? ast.body[0].expression : null;
  const body = expression?.type === 'CallExpression' && ['FunctionExpression', 'ArrowFunctionExpression'].includes(expression.callee.type) && expression.callee.body.type === 'BlockStatement' ? expression.callee.body.body : ast.body;
  const names = new Set();
  function pattern(node) {
    if (!node) return;
    if (node.type === 'Identifier') names.add(node.name);
    else if (node.type === 'ArrayPattern') node.elements.forEach(pattern);
    else if (node.type === 'ObjectPattern') node.properties.forEach(p => pattern(p.type === 'RestElement' ? p.argument : p.value));
    else if (node.type === 'RestElement') pattern(node.argument);
    else if (node.type === 'AssignmentPattern') pattern(node.left);
  }
  for (const node of body) {
    if (['FunctionDeclaration', 'ClassDeclaration'].includes(node.type)) pattern(node.id);
    if (node.type === 'VariableDeclaration') node.declarations.forEach(d => pattern(d.id));
  }
  return names;
}

// Copy exact Git blobs; checkout filters and unstaged files cannot affect this view.
function withIndexSnapshot(root, callback, expectedTree) {
  const tree = git(root, ['write-tree']).trim();
  if (expectedTree && tree !== expectedTree) throw Error('Index 已改變，請重新執行查詢');
  const entries = git(root, ['ls-files', '--stage', '-z']).split('\0').filter(Boolean).map(row => {
    const match = /^(\d+) ([a-f0-9]+) (\d)\t([\s\S]+)$/.exec(row);
    if (!match || match[3] !== '0' || !['100644', '100755'].includes(match[1])) throw Error('暫存快照含尚未支援的項目：' + row);
    return {hash: match[2], file: match[4]};
  });
  const output = git(root, ['cat-file', '--batch'], {encoding: null, input: entries.map(e => e.hash).join('\n') + '\n'});
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bandit-inspect-index-'));
  try {
    let offset = 0;
    for (const entry of entries) {
      const end = output.indexOf(10, offset), header = output.subarray(offset, end).toString('ascii'), match = /^([a-f0-9]+) blob (\d+)$/.exec(header);
      if (!match || match[1] !== entry.hash) throw Error('Git blob 回應不完整');
      const size = Number(match[2]), start = end + 1, file = path.resolve(temporary, entry.file);
      if (!file.startsWith(temporary + path.sep) || start + size >= output.length || output[start + size] !== 10) throw Error('Git 快照路徑或 blob 長度無效');
      fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, output.subarray(start, start + size));
      offset = start + size + 1;
    }
    if (tree !== git(root, ['write-tree']).trim()) throw Error('Index 已改變，請重新執行查詢');
    const result = callback(temporary);
    if (tree !== git(root, ['write-tree']).trim()) throw Error('Index 已改變，請重新執行查詢');
    return {...result, snapshotTree: tree};
  } finally {
    // This is the exact absolute directory created above, never a repo-derived path.
    fs.rmSync(temporary, {recursive: true, force: true});
  }
}

function changedReport({root = path.resolve(__dirname, '..'), base, staged = false} = {}) {
  if (staged && base !== undefined) throw Error('--base 與 --staged 不能一起使用');
  root = path.resolve(root);
  const initialTree = staged ? git(root, ['write-tree']).trim() : null;
  const revision = git(root, ['rev-parse', '--verify', '--end-of-options', (base || 'HEAD') + '^{commit}']).trim();
  const diffArgs = staged ? ['--cached'] : [revision];
  const tracked = git(root, ['diff', '--name-only', '--no-renames', '-z', ...diffArgs, '--']).split('\0').filter(Boolean);
  const untracked = staged ? [] : git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  const deleted = new Set(git(root, ['diff', '--diff-filter=D', '--name-only', '--no-renames', '-z', ...diffArgs, '--']).split('\0').filter(Boolean));
  const files = [...new Set([...tracked, ...untracked])].sort();
  if (staged && initialTree !== git(root, ['write-tree']).trim()) throw Error('Index 已改變，請重新執行查詢');
  const build = viewRoot => {
    const result = {query: {changed: true, staged, base: staged ? 'HEAD' : base || 'HEAD'}, files, definitions: [], dependencies: [], dependents: [], publicExports: [], contractTypes: [], families: [], groups: [], suggestedChecks: [], limitations: [], diagnostics: [], guides: ['docs/testing.md', 'docs/maintenance/lightweight.md']};
    if (!files.length || files.every(documents)) { result.suggestedChecks = suggestChecks(null, {files}); return result; }
    const reasons = [], ids = new Set(); let index, incomplete = false;
    try { index = buildInspection({root: viewRoot}); }
    catch (error) { incomplete = true; reasons.push(error.message); }
    for (const file of files) {
      if (deleted.has(file) || untracked.includes(file)) { incomplete = true; reasons.push((deleted.has(file) ? '刪除：' : '未追蹤新檔：') + file); }
      if (index?.sources.includes(file)) {
        const query = queryInspection(index, {file});
        query.definitions.forEach(d => ids.add(d.id));
        for (const name of ['definitions', 'dependencies', 'dependents', 'publicExports', 'contractTypes', 'families', 'groups']) result[name].push(...query[name]);
      } else if (product(file)) { incomplete = true; reasons.push('未能定位組裝來源：' + file); }
      if (/\.(js|cjs)$/.test(file) && !deleted.has(file) && !untracked.includes(file)) {
        try {
          const old = git(root, ['show', revision + ':' + file]), current = fs.readFileSync(path.join(viewRoot, file), 'utf8');
          const currentNames = declaredNames(current), removed = [...declaredNames(old)].filter(name => !currentNames.has(name));
          if (removed.length) { incomplete = true; reasons.push(file + ' 刪除／更名宣告：' + removed.join('、')); }
        } catch (error) { incomplete = true; reasons.push(file + ' 的前後宣告無法完整比對：' + error.message.split('\n')[0]); }
      }
    }
    for (const name of ['definitions', 'dependencies', 'dependents', 'publicExports', 'contractTypes', 'families', 'groups']) result[name] = [...new Map(result[name].map(row => [JSON.stringify(row), row])).values()];
    result.diagnostics = index?.diagnostics || [];
    result.limitations = [...(index?.limitations || []), ...reasons.map(message => ({code: 'INCOMPLETE_CHANGE_COVERAGE', message}))];
    result.suggestedChecks = suggestChecks(index, {ids: [...ids], files, incomplete, reasons});
    return result;
  };
  if (!staged) return build(root);
  if (!files.length || files.every(documents)) {
    const result = build(root);
    if (initialTree !== git(root, ['write-tree']).trim()) throw Error('Index 已改變，請重新執行查詢');
    return {...result, snapshotTree: initialTree};
  }
  try { return withIndexSnapshot(root, build, initialTree); }
  catch (error) {
    return {query: {changed: true, staged: true}, files, definitions: [], dependencies: [], dependents: [], publicExports: [], families: [], groups: [], suggestedChecks: fullChecks(files.some(product) || files.some(broad), '暫存快照無法完整分析'), limitations: [{code: 'INDEX_SNAPSHOT', message: error.message}], diagnostics: []};
  }
}

module.exports = {testCandidates, suggestChecks, changedReport};
