'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {analyzeEntry, walk, locator} = require('./editor-scope.cjs');
const {referencedTypes} = require('./editor-jsdoc.cjs');

const projectRoot = path.resolve(__dirname, '..');
const unique = rows => [...new Map(rows.map(row => [JSON.stringify(row), row])).values()];
const sortLocations = rows => rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);
function requireFresh(file, root) {
  const visited = new Set();
  function clear(id) {
    if (visited.has(id) || !id.startsWith(path.resolve(root) + path.sep)) return;
    visited.add(id);
    for (const child of require.cache[id]?.children || []) clear(child.id);
    delete require.cache[id];
  }
  clear(require.resolve(file));
  return require(file);
}
function sourceReader(root) {
  const reader = requireFresh(path.join(root, 'scripts/editor-source.cjs'), root);
  if (typeof reader.readEditorSourceDetails !== 'function') throw Error('此快照的組裝工具沒有來源位置介面，無法精確定位；請採完整驗證');
  return reader;
}
function registries(root) {
  return {
    families: requireFresh(path.join(root, 'scripts/verification-suite.cjs'), root).families,
    sections: requireFresh(path.join(root, 'scripts/verification-requirements.cjs'), root).sections,
    ...(({coreRoots, sharedCoreRoots}) => ({coreRoots, sharedCoreRoots}))(requireFresh(path.join(root, 'scripts/migration-analysis.cjs'), root)),
    verification: JSON.parse(fs.readFileSync(path.join(root, 'knowledge/catalog.json'), 'utf8')).verification
  };
}
function reachable(seeds, dependencies) {
  const found = new Set(seeds), queue = [...seeds];
  for (let i = 0; i < queue.length; i++) for (const next of dependencies.get(queue[i]) || []) if (!found.has(next)) { found.add(next); queue.push(next); }
  return found;
}
function cycles(edges) {
  const nodes = new Set([...edges.keys(), ...[...edges.values()].flatMap(v => [...v])]);
  const used = new Set(), result = [];
  for (const node of nodes) {
    if (used.has(node)) continue;
    const forward = reachable([node], edges), component = [...nodes].filter(other => forward.has(other) && reachable([other], edges).has(node)).sort();
    component.forEach(n => used.add(n));
    if (component.length > 1) result.push(component);
  }
  return result;
}
function jsFiles(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, {withFileTypes: true}).flatMap(item => item.isDirectory() ? jsFiles(path.join(folder, item.name)) : item.isFile() && item.name.endsWith('.js') ? [path.join(folder, item.name)] : []);
}

function buildInspection({root = projectRoot, reader, metadata} = {}) {
  root = path.resolve(root);
  const diagnostics = [], limitations = [], analyses = [], sources = new Set();
  reader ||= sourceReader(root);
  for (const entry of ['core', 'ui']) {
    let details;
    try {
      details = reader.readEditorSourceDetails(entry, {root});
      details.segments.forEach(segment => sources.add(segment.file));
      const analysis = analyzeEntry(entry, details, root);
      analyses.push(analysis); diagnostics.push(...analysis.diagnostics); limitations.push(...analysis.limitations);
    } catch (error) {
      const location = details?.source.length && Number.isInteger(error.pos) ? locator(details, root)(error.pos) : {file: 'src/' + entry + '.js', line: 1, column: 1};
      diagnostics.push({code: 'SOURCE_PARSE', ...location, message: error.message});
    }
  }
  const core = analyses.find(a => a.entry === 'core'), ui = analyses.find(a => a.entry === 'ui');
  const definitions = analyses.flatMap(a => a.definitions), exports = new Map();
  let exportsComplete = true;
  const issue = (list, code, node, message) => list.push({code, ...core.locate(node.start), message});
  if (core) {
    if (core.exportAssignments.length !== 1) diagnostics.push({code: 'EXPORT_ASSIGNMENT', file: 'src/core.js', line: 1, column: 1, message: '核心需要一個可辨識的 SaveCore 匯出物件'});
    for (const assignment of core.exportAssignments) {
      if (assignment.right.type !== 'ObjectExpression') { exportsComplete = false; issue(limitations, 'DYNAMIC_EXPORT', assignment, 'SaveCore 匯出不是靜態物件'); continue; }
      for (const property of assignment.right.properties) {
        if (property.type !== 'Property') { exportsComplete = false; issue(limitations, 'DYNAMIC_EXPORT', property, '展開式匯出無法完整列舉'); continue; }
        const name = !property.computed && property.key.type === 'Identifier' ? property.key.name : property.key.type === 'Literal' ? String(property.key.value) : null;
        if (name === null) { exportsComplete = false; issue(limitations, 'DYNAMIC_EXPORT', property, '動態匯出名稱無法完整列舉'); continue; }
        const binding = core.resolveNode(property.value);
        let definition = binding?.definition;
        if (!definition && property.value.type === 'Identifier' && !binding) { issue(diagnostics, 'UNRESOLVED_EXPORT', property.value, '匯出實作未宣告：' + name); continue; }
        if (!definition) {
          const location = core.locate(property.value.start);
          definition = {id: 'core:@' + name, entry: 'core', name, kind: 'inline-export', ...location, endLine: core.locate(property.value.end - 1).line, start: property.value.start, end: property.value.end, publicExports: []};
          definitions.push(definition);
          issue(limitations, 'INLINE_EXPORT', property.value, '行內或內層匯出的間接相依需人工核對：' + name);
        }
        if (exports.has(name)) issue(diagnostics, 'DUPLICATE_EXPORT', property, '公開名稱重複：' + name);
        exports.set(name, definition.id); definition.publicExports.push(name);
      }
    }
  }
  const byId = new Map(definitions.map(d => [d.id, d]));
  const references = analyses.flatMap(a => a.references).map(({start, ...reference}) => reference);
  for (const member of ui?.members || []) {
    const target = exports.get(member.name);
    if (target) references.push({from: member.from, to: target, file: member.file, line: member.line, column: member.column, publicName: member.name});
    else (exportsComplete && core ? diagnostics : limitations).push({code: 'UNKNOWN_CORE_MEMBER', file: member.file, line: member.line, column: member.column, message: 'SaveCore 沒有可辨識的公開名稱：' + member.name});
  }
  const dependencies = new Map(), fileEdges = new Map();
  for (const reference of references) {
    if (!reference.from) continue;
    if (!dependencies.has(reference.from)) dependencies.set(reference.from, new Set());
    dependencies.get(reference.from).add(reference.to);
    const from = byId.get(reference.from)?.file, to = byId.get(reference.to)?.file;
    if (from && to && from !== to) {
      if (!fileEdges.has(from)) fileEdges.set(from, new Set());
      fileEdges.get(from).add(to);
    }
  }
  for (const component of cycles(fileEdges)) limitations.push({code: 'SOURCE_CYCLE', file: component[0], line: 1, column: 1, files: component, message: '片段循環（導覽資訊）：' + component.length + ' 個片段，完整清單見 JSON files'});
  for (const file of jsFiles(path.join(root, 'src'))) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    if (!sources.has(relative) && !['src/pwa.js', 'src/service-worker.js'].includes(relative)) diagnostics.push({code: 'UNREGISTERED_SOURCE', file: relative, line: 1, column: 1, message: '來源未登記在 core／ui 組裝入口'});
  }
  try { metadata ||= registries(root); }
  catch (error) { diagnostics.push({code: 'REGISTRY_LOAD', file: 'scripts/verification-suite.cjs', line: 1, column: 1, message: error.message}); metadata = {families: {}, sections: {}, coreRoots: {}, sharedCoreRoots: [], verification: {}}; }
  const families = [], groups = [], familyReach = new Map();
  for (const [name, family] of Object.entries(metadata.families)) {
    const roots = Array.isArray(metadata.coreRoots[name]) ? metadata.coreRoots[name] : [];
    if (!Array.isArray(metadata.coreRoots[name])) diagnostics.push({code: 'MISSING_CORE_ROOTS', file: 'scripts/migration-analysis.cjs', line: 1, column: 1, message: 'family 缺少 core roots：' + name});
    for (const method of roots) if (!exports.has(method)) (exportsComplete && core ? diagnostics : limitations).push({code: 'UNKNOWN_CORE_ROOT', file: 'scripts/migration-analysis.cjs', line: 1, column: 1, message: name + ' 的公開根無法解析：' + method});
    for (const method of metadata.sharedCoreRoots || []) if (!roots.includes(method)) diagnostics.push({code: 'MISSING_SHARED_ROOT', file: 'scripts/migration-analysis.cjs', line: 1, column: 1, message: name + ' 缺少共用根：' + method});
    families.push({name, groups: family.groups, coreRoots: roots});
    familyReach.set(name, reachable(roots.map(method => exports.get(method)).filter(Boolean), dependencies));
  }
  for (const name of Object.keys(metadata.coreRoots)) if (!metadata.families[name]) diagnostics.push({code: 'UNKNOWN_ROOT_FAMILY', file: 'scripts/migration-analysis.cjs', line: 1, column: 1, message: 'core roots 沒有對應 family：' + name});
  for (const [name, enabled] of Object.entries(metadata.verification)) {
    const owners = families.filter(f => f.groups.includes(name)).map(f => f.name), sections = Object.entries(metadata.sections).filter(([, spec]) => spec.groups.includes(name)).map(([section]) => section);
    if (!owners.length || !sections.length) diagnostics.push({code: 'UNMAPPED_GROUP', file: 'knowledge/catalog.json', line: 1, column: 1, message: '旗標缺少 family／需求 section：' + name});
    groups.push({name, enabled, families: owners, sections});
  }
  return {root, definitions, types: analyses.flatMap(a => a.types), references: unique(references), publicExports: Object.fromEntries(exports), families, groups, diagnostics: sortLocations(unique(diagnostics)), limitations: sortLocations(unique(limitations)), dependencies, familyReach, sources: [...sources].sort(), sharedCoreRoots: metadata.sharedCoreRoots || []};
}

function queryInspection(index, query) {
  const {symbol, family, group, file} = query;
  const selectedTypes = symbol ? index.types.filter(type => type.name === symbol) : file ? index.types.filter(type => type.file === file.replaceAll('\\', '/').replace(/^\.\//, '')) : [];
  let selected;
  if (symbol) selected = index.definitions.filter(d => d.name === symbol || d.publicExports.includes(symbol));
  if (family || group) {
    const names = family ? [family] : index.groups.find(g => g.name === group)?.families || [];
    const matching = index.families.filter(f => names.includes(f.name));
    const roots = matching.flatMap(f => { const privateRoots = f.coreRoots.filter(n => !index.sharedCoreRoots.includes(n)); return privateRoots.length ? privateRoots : f.coreRoots; });
    const ids = new Set(roots.map(name => index.publicExports[name]));
    selected = index.definitions.filter(d => ids.has(d.id));
  }
  if (file) {
    const relative = file.replaceAll('\\', '/').replace(/^\.\//, '');
    if (!index.sources.includes(relative)) throw Error('檔案不在目前組裝來源：' + file);
    selected = index.definitions.filter(d => d.file === relative);
  }
  if (!selected || (!selected.length && !file && !selectedTypes.length)) throw Error('查無符號、family、旗標或契約型別：' + (symbol || family || group));
  const ids = new Set(selected.map(d => d.id));
  const outgoing = index.references.filter(r => ids.has(r.from) || (file && r.file === file.replaceAll('\\', '/').replace(/^\.\//, '')));
  const coreTargets = new Set(selected.filter(d => d.entry === 'core').map(d => d.id));
  const uiIds = reachable(selected.filter(d => d.entry === 'ui').map(d => d.id), new Map([...index.dependencies].filter(([id]) => id.startsWith('ui:'))));
  const uiCoreTargets = index.references.filter(r => uiIds.has(r.from) && r.to.startsWith('core:')).map(r => r.to);
  const sharedIds = new Set(index.sharedCoreRoots.map(name => index.publicExports[name]));
  const specificTargets = uiCoreTargets.filter(id => !sharedIds.has(id));
  (specificTargets.length ? specificTargets : uiCoreTargets).forEach(id => coreTargets.add(id));
  const requestedFamilies = family ? [family] : group ? index.groups.find(g => g.name === group)?.families || [] : null;
  const selectedFamilies = index.families.filter(f => requestedFamilies ? requestedFamilies.includes(f.name) : [...coreTargets].some(id => index.familyReach.get(f.name).has(id)));
  const incoming = index.references.filter(r => ids.has(r.to) && !ids.has(r.from));
  return {
    query, definitions: selected.map(({start, end, ...definition}) => definition), dependencies: outgoing, dependents: incoming,
    publicExports: selected.flatMap(d => d.publicExports), contractTypes: referencedTypes(index.types, selected.map(d => d.contract).filter(Boolean), selectedTypes), families: selectedFamilies,
    groups: index.groups.filter(g => selectedFamilies.some(f => g.families.includes(f.name))),
    suggestedChecks: [], limitations: [...index.limitations], diagnostics: [...index.diagnostics],
    guides: ['.agents/skills/bandit-save-editor/references/feature-guide.md', 'docs/testing.md', 'docs/maintenance/core.md#來源組裝與責任分檔']
  };
}

module.exports = {buildInspection, queryInspection, sourceReader, reachable, walk};
