'use strict';
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('./vendor/acorn.cjs');

function walk(node, visit, parent = null, key = null) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const child of node) walk(child, visit, parent, key); return; }
  if (!node.type) return;
  visit(node, parent, key);
  for (const [name, child] of Object.entries(node)) if (!['start', 'end', 'loc'].includes(name)) walk(child, visit, node, name);
}

function memberName(node) {
  if (!node?.computed && node?.property?.type === 'Identifier') return node.property.name;
  if (node?.computed && node.property?.type === 'Literal' && ['string', 'number'].includes(typeof node.property.value)) return String(node.property.value);
  return null;
}

function locator(details, root) {
  const lines = new Map();
  return position => {
    const index = Math.max(0, Math.min(position, details.source.length - 1));
    let low = 0, high = details.segments.length - 1, segment;
    while (low <= high) {
      const mid = (low + high) >> 1, candidate = details.segments[mid];
      if (index < candidate.outputStart) high = mid - 1;
      else if (index >= candidate.outputStart + candidate.length) low = mid + 1;
      else { segment = candidate; break; }
    }
    if (!segment) throw Error('來源位置沒有對應片段：' + position);
    if (!lines.has(segment.file)) {
      const text = fs.readFileSync(path.join(root, segment.file), 'utf8'), starts = [0];
      for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
      lines.set(segment.file, starts);
    }
    const offset = segment.sourceStart + index - segment.outputStart, starts = lines.get(segment.file);
    let left = 0, right = starts.length;
    while (left < right) { const mid = (left + right) >> 1; if (starts[mid] <= offset) left = mid + 1; else right = mid; }
    return {file: segment.file, line: left, column: offset - starts[left - 1] + 1};
  };
}

// Resolve lexical bindings before collecting references, including hoisted functions,
// destructuring, loop/catch scopes and local names shadowing the shared closure.
function analyzeEntry(entry, details, root) {
  const ast = acorn.parse(details.source, {ecmaVersion: 2024, sourceType: 'script'});
  const locate = locator(details, root), nodeScopes = new WeakMap(), bound = new WeakSet(), records = new WeakMap();
  const scope = (parent, kind) => ({parent, kind, names: new Map()});
  const program = scope(null, 'function'), diagnostics = [], limitations = [];
  const report = (list, code, node, message) => list.push({code, ...locate(node.start), message});
  function declare(pattern, target, node, kind, init = null) {
    if (!pattern) return;
    if (pattern.type === 'Identifier') {
      const binding = {name: pattern.name, scope: target, node, kind, init, written: false};
      bound.add(pattern); records.set(pattern, binding); target.names.set(pattern.name, binding);
    } else if (pattern.type === 'RestElement') declare(pattern.argument, target, node, kind, init);
    else if (pattern.type === 'AssignmentPattern') declare(pattern.left, target, node, kind, init);
    else if (pattern.type === 'ArrayPattern') for (const part of pattern.elements) declare(part, target, node, kind, init);
    else if (pattern.type === 'ObjectPattern') for (const part of pattern.properties) declare(part.type === 'RestElement' ? part.argument : part.value, target, node, kind, init);
  }
  const functionScope = current => current.kind === 'function' ? current : functionScope(current.parent);
  function build(node, current) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const child of node) build(child, current); return; }
    if (!node.type) return;
    if (node.type === 'FunctionDeclaration') declare(node.id, current, node, 'function');
    if (node.type === 'ClassDeclaration') declare(node.id, current, node, 'class');
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
      const inner = scope(current, 'function'); nodeScopes.set(node, inner);
      if (node.type === 'FunctionExpression' && node.id) declare(node.id, inner, node, 'self');
      if (node.id) nodeScopes.set(node.id, inner);
      for (const param of node.params) declare(param, inner, param, 'parameter');
      build(node.params, inner); build(node.body, inner); return;
    }
    if (['ClassDeclaration', 'ClassExpression'].includes(node.type)) {
      const inner = scope(current, 'block'); nodeScopes.set(node, inner);
      if (node.id) { if (node.type === 'ClassExpression') declare(node.id, inner, node, 'self'); nodeScopes.set(node.id, inner); }
      build(node.superClass, node.type === 'ClassExpression' ? inner : current);
      build(node.body, inner); return;
    }
    if (node.type === 'SwitchStatement') {
      nodeScopes.set(node, current); build(node.discriminant, current); build(node.cases, scope(current, 'block')); return;
    }
    if (['BlockStatement', 'StaticBlock', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'CatchClause'].includes(node.type)) current = scope(current, node.type === 'StaticBlock' ? 'function' : 'block');
    nodeScopes.set(node, current);
    if (node.type === 'CatchClause') declare(node.param, current, node.param, 'parameter');
    if (node.type === 'VariableDeclaration') for (const declaration of node.declarations) declare(declaration.id, node.kind === 'var' ? functionScope(current) : current, declaration, node.kind, declaration.init);
    for (const [key, child] of Object.entries(node)) if (!['start', 'end', 'loc'].includes(key)) build(child, current);
  }
  build(ast, program);
  const resolve = (name, current) => !current ? null : current.names.get(name) || resolve(name, current.parent);
  const resolveNode = node => node?.type === 'Identifier' ? resolve(node.name, nodeScopes.get(node)) : null;
  const expression = ast.body.length === 1 && ast.body[0].type === 'ExpressionStatement' ? ast.body[0].expression : null;
  const body = expression?.type === 'CallExpression' && ['FunctionExpression', 'ArrowFunctionExpression'].includes(expression.callee.type) && expression.callee.body.type === 'BlockStatement' ? expression.callee.body.body : ast.body;
  const top = new Set();
  for (const statement of body) {
    const patterns = statement.type === 'VariableDeclaration' ? statement.declarations.map(d => d.id) : ['FunctionDeclaration', 'ClassDeclaration'].includes(statement.type) ? [statement.id] : [];
    for (const pattern of patterns) walk(pattern, node => { if (records.has(node)) top.add(records.get(node)); });
  }
  const definitions = [], names = new Set();
  for (const binding of top) {
    if (names.has(binding.name)) report(diagnostics, 'DUPLICATE_DEFINITION', binding.node, '頂層名稱有多個擁有位置：' + binding.name);
    names.add(binding.name);
    const start = locate(binding.node.start), end = locate(Math.max(binding.node.start, binding.node.end - 1));
    const definition = {id: entry + ':' + binding.name, entry, name: binding.name, kind: binding.kind, ...start, endLine: end.file === start.file ? end.line : start.line, start: binding.node.start, end: binding.node.end, publicExports: []};
    binding.definition = definition; definitions.push(definition);
  }
  walk(ast, node => {
    if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
      const target = node.type === 'AssignmentExpression' ? node.left : node.argument;
      if (target.type === 'Identifier') { const binding = resolveNode(target); if (binding) binding.written = true; }
    }
  });
  function globalObject(node, visited = new Set()) {
    if (node?.type !== 'Identifier') return false;
    const binding = resolveNode(node);
    if (!binding) return ['globalThis', 'window'].includes(node.name);
    if (visited.has(binding) || binding.kind !== 'const' || binding.written || binding.node.id?.type !== 'Identifier') return false;
    visited.add(binding); return globalObject(binding.init, visited);
  }
  function coreObject(node, visited = new Set()) {
    if (node?.type === 'ChainExpression') return coreObject(node.expression, visited);
    if (node?.type === 'MemberExpression') return memberName(node) === 'SaveCore' && globalObject(node.object);
    if (node?.type !== 'Identifier') return false;
    const binding = resolveNode(node);
    if (!binding) return node.name === 'SaveCore';
    if (visited.has(binding) || binding.kind !== 'const' || binding.node.id?.type !== 'Identifier' || binding.written || !binding.init) return false;
    visited.add(binding); return coreObject(binding.init, visited);
  }
  const ownerAt = node => definitions.find(d => node.start >= d.start && node.end <= d.end) || null;
  const references = [], members = [], exportAssignments = [];
  const environment = new Set(['window', 'document', 'navigator', 'location', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'require', 'module', 'process', '__dirname', '__filename', 'Buffer', 'Deno', 'Bun']);
  walk(ast, (node, parent, key) => {
    if (node.type === 'Identifier') {
      const property = parent && ((parent.type === 'MemberExpression' && key === 'property' && !parent.computed) || ((parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && key === 'key' && !parent.computed));
      if (bound.has(node) || property || parent?.type === 'MetaProperty' || (['LabeledStatement', 'BreakStatement', 'ContinueStatement'].includes(parent?.type) && key === 'label')) return;
      const binding = resolveNode(node), owner = ownerAt(node);
      if (binding?.definition) references.push({from: owner?.id || null, to: binding.definition.id, start: node.start, ...locate(node.start)});
      if (entry === 'core' && !binding && environment.has(node.name)) report(diagnostics, 'CORE_ENVIRONMENT', node, '核心使用環境 I/O：' + node.name);
      if (!binding && ['eval', 'Function'].includes(node.name)) report(limitations, 'DYNAMIC_CODE', node, '動態程式碼無法完整追蹤');
      if (entry === 'ui' && coreObject(node)) {
        const memberObject = parent?.type === 'MemberExpression' && key === 'object';
        const alias = parent?.type === 'VariableDeclarator' && key === 'init' && parent.id.type === 'Identifier' && records.get(parent.id)?.kind === 'const' && !records.get(parent.id)?.written;
        if (!memberObject && !alias) report(limitations, 'CORE_ALIAS_ESCAPE', node, 'SaveCore 物件傳遞到間接位置，需人工核對呼叫者');
      }
      if (entry === 'core' && globalObject(node)) {
        const memberObject = parent?.type === 'MemberExpression' && key === 'object';
        const alias = parent?.type === 'VariableDeclarator' && key === 'init' && parent.id.type === 'Identifier' && records.get(parent.id)?.kind === 'const' && !records.get(parent.id)?.written;
        if (!memberObject && !alias) report(limitations, 'GLOBAL_ALIAS_ESCAPE', node, '全域物件傳遞到間接位置，需人工核對核心純度');
      }
    }
    if (node.type === 'MemberExpression') {
      if (entry === 'core' && globalObject(node.object) && environment.has(memberName(node))) report(diagnostics, 'CORE_ENVIRONMENT', node, '核心使用環境 I/O：' + memberName(node));
      if (entry === 'core' && globalObject(node.object) && memberName(node) === null) report(limitations, 'DYNAMIC_GLOBAL_MEMBER', node, '動態全域成員需人工核對核心純度');
      if (entry === 'ui' && coreObject(node.object)) {
        const name = memberName(node), owner = ownerAt(node);
        if (name === null) report(limitations, 'DYNAMIC_CORE_MEMBER', node, '動態 SaveCore 方法選取需人工核對');
        else members.push({name, from: owner?.id || null, start: node.start, ...locate(node.start)});
      }
    }
    if (node.type === 'ImportExpression') {
      report(entry === 'core' ? diagnostics : limitations, 'DYNAMIC_IMPORT', node, '動態載入超出靜態相依範圍');
    }
    if (entry === 'core' && node.type === 'AssignmentExpression' && node.operator === '=' && ((node.left.type === 'MemberExpression' && memberName(node.left) === 'SaveCore' && globalObject(node.left.object)) || (node.left.type === 'Identifier' && node.left.name === 'SaveCore' && !resolveNode(node.left)))) exportAssignments.push(node);
    if (node.type === 'VariableDeclarator' && node.id.type !== 'Identifier' && coreObject(node.init)) report(limitations, 'CORE_DESTRUCTURING', node, 'SaveCore 解構別名需人工核對');
  });
  return {entry, ast, definitions, references, members, exportAssignments, diagnostics, limitations, locate, resolveNode, ownerAt};
}

module.exports = {analyzeEntry, walk, memberName, locator};
