'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {fixture, metadata} = require('./helpers/inspection-fixture.cjs');
const {buildInspection, queryInspection} = require('../scripts/editor-inspection.cjs');
const {analyzeEntry} = require('../scripts/editor-scope.cjs');
const {run, parseArguments} = require('../scripts/inspect-editor.cjs');

test('lexical references exclude local shadowing, properties, comments and labels', t => {
  const f = fixture(t, {core: `(() => {
    function helper(){return 1;}
    function actual(){return helper();}
    function shadows(helper){return helper();}
    function block(){ {let helper=()=>0;helper();} return {helper:0}.helper; }
    function patterns({helper}, [other=1]){try{throw 0;}catch(helper){helper;} return helper;}
    function loops(){for(let helper of [])helper();for(var helper=()=>0;false;)helper();return helper;}
    function label(){helper: for(;;)break helper; return 'helper';} // helper()
    globalThis.SaveCore={read:actual};
  })();`});
  const index = buildInspection({root: f.root});
  assert.deepEqual(index.diagnostics, []);
  const references = index.references.filter(r => r.to === 'core:helper' && r.from);
  assert.deepEqual(references.map(r => r.from), ['core:actual']);
  assert.equal(queryInspection(index, {symbol: 'read'}).definitions[0].name, 'actual');
});

test('default/computed patterns, class static var and named class scopes resolve correctly', t => {
  const f = fixture(t, {core: `(() => {
    function helper(){return 1;}
    function read(x=helper()){
      const {[helper()]: value}={};
      class Temp{static{var helper=()=>0;helper();}}
      const Named=class helper{method(){return helper;}};
      return helper()+value;
    }
    globalThis.SaveCore={read};
  })();`});
  const index = buildInspection({root: f.root});
  assert.deepEqual(index.diagnostics, []);
  assert.equal(index.references.filter(r => r.from === 'core:read' && r.to === 'core:helper').length, 3);
});

test('public aliases and static computed members resolve, local C parameters do not', t => {
  const f = fixture(t, {core: '(()=>{function read(){return 1;}globalThis.SaveCore={alias:read};})();', ui: `(()=>{
    const C=SaveCore, Alias=C;
    function show(){return Alias['alias']();}
    function local(C){return C.notAPublicMethod();}
  })();`});
  const data = metadata(); data.coreRoots.sample = ['alias'];
  const index = buildInspection({root: f.root, metadata: data});
  assert.deepEqual(index.diagnostics, []);
  assert.ok(index.references.some(r => r.from === 'ui:show' && r.to === 'core:read' && r.publicName === 'alias'));
});

test('dynamic selections, mutable aliases and escaping core objects are explicit limitations', t => {
  const f = fixture(t, {ui: `(()=>{const C=SaveCore;let Mutable=SaveCore;function show(name){return C[name]();}function escape(){return ()=>C;}function pass(){use(C);}})();`});
  const index = buildInspection({root: f.root});
  assert.deepEqual(index.diagnostics, []);
  assert.ok(index.limitations.some(l => l.code === 'DYNAMIC_CORE_MEMBER'));
  assert.ok(index.limitations.filter(l => l.code === 'CORE_ALIAS_ESCAPE').length >= 3);
});

test('core purity follows global aliases and excludes local environment-shaped names', t => {
  const safe = fixture(t, {core: '(()=>{function read(window,require){return {document:window.document,require};}globalThis.SaveCore={read};})();'});
  assert.deepEqual(buildInspection({root: safe.root}).diagnostics, []);
  const unsafe = fixture(t, {core: `(()=>{const G=globalThis;function read(){G.fetch('/');switch(window.x){case 1:let window=0;break;}}globalThis.SaveCore={read};})();`});
  const errors = buildInspection({root: unsafe.root}).diagnostics;
  assert.ok(errors.some(e => e.code === 'CORE_ENVIRONMENT' && e.message.includes('fetch')));
  assert.ok(errors.some(e => e.code === 'CORE_ENVIRONMENT' && e.message.includes('window')));
});

test('unresolved exports, duplicate ownership, unknown public calls and missing registrations fail', t => {
  const f = fixture(t, {core: '(()=>{function read(){}function read(){}globalThis.SaveCore={read,missing};})();', ui: '(()=>{const C=SaveCore;C.notExported();})();'});
  const data = metadata(); data.verification.unmapped = true; data.coreRoots.sample.push('typo');
  f.write('src/unregistered.js', 'const future=1;');
  const codes = buildInspection({root: f.root, metadata: data}).diagnostics.map(e => e.code);
  for (const code of ['DUPLICATE_DEFINITION', 'UNRESOLVED_EXPORT', 'UNKNOWN_CORE_MEMBER', 'UNMAPPED_GROUP', 'UNKNOWN_CORE_ROOT', 'UNREGISTERED_SOURCE']) assert.ok(codes.includes(code), code);
});

test('inline exports are located and marked as incomplete indirect dependency analysis', t => {
  const f = fixture(t, {core: '(()=>{globalThis.SaveCore={read:()=>1};})();'});
  const index = buildInspection({root: f.root});
  assert.deepEqual(index.diagnostics, []);
  assert.equal(queryInspection(index, {symbol: 'read'}).definitions[0].kind, 'inline-export');
  assert.ok(index.limitations.some(l => l.code === 'INLINE_EXPORT'));
});

test('dynamic exports and escaping global aliases remain limitations instead of invented violations', t => {
  const f = fixture(t, {core: '(()=>{const existing={read(){}};let Mutable=globalThis;globalThis.SaveCore={...existing};})();'});
  const index = buildInspection({root: f.root});
  assert.deepEqual(index.diagnostics, []);
  for (const code of ['DYNAMIC_EXPORT', 'UNKNOWN_CORE_ROOT', 'UNKNOWN_CORE_MEMBER', 'GLOBAL_ALIAS_ESCAPE']) assert.ok(index.limitations.some(l => l.code === code), code);
});

test('Unicode offsets and cross-fragment cycles map to original files without executing code', t => {
  const f = fixture(t);
  const prefix = '(()=>{\n', suffix = 'throw Error("never execute");globalThis.SaveCore={read:a};})();';
  const a = 'const 中文="😀";\nfunction a(){return b();}\n', b = 'function b(){return a();}\n';
  f.write('src/core.js', prefix + suffix); f.write('src/a.js', a); f.write('src/b.js', b);
  const reader = {readEditorSourceDetails(entry) {
    if (entry === 'ui') { const source = fs.readFileSync(path.join(f.root, 'src/ui.js'), 'utf8'); return {source, segments: [{file: 'src/ui.js', sourceStart: 0, outputStart: 0, length: source.length}]}; }
    const parts = [['src/core.js', 0, prefix], ['src/a.js', 0, a], ['src/b.js', 0, b], ['src/core.js', prefix.length, suffix]];
    let outputStart = 0;
    const segments = parts.map(([file, sourceStart, text]) => { const segment = {file, sourceStart, outputStart, length: text.length}; outputStart += text.length; return segment; });
    return {source: parts.map(p => p[2]).join(''), segments};
  }};
  const index = buildInspection({root: f.root, reader});
  assert.deepEqual(index.diagnostics, []);
  assert.equal(queryInspection(index, {symbol: 'a'}).definitions[0].line, 2);
  assert.equal(queryInspection(index, {symbol: 'a'}).definitions[0].file, 'src/a.js');
  assert.ok(index.limitations.some(l => l.code === 'SOURCE_CYCLE'));
});

test('current skill-cap queries use live source positions and retain distinct group/section/family meanings', () => {
  const index = buildInspection(), result = queryInspection(index, {symbol: 'setCharacterSkillCaps'});
  assert.deepEqual(index.diagnostics, []);
  assert.equal(result.definitions[0].file, 'src/core/skill-caps-talents.js');
  assert.deepEqual(result.families.map(f => f.name), ['randomCharacterSkillCaps']);
  assert.ok(result.groups.some(g => g.name === 'randomCharacterSkillCapsAdvanced'));
  assert.equal(queryInspection(index, {group: 'equipmentLevel'}).groups.find(g => g.name === 'equipmentLevel').sections[0], 'base');
  assert.deepEqual(queryInspection(index, {family: 'advanced'}).families.map(f => f.name), ['advanced']);
});

test('parser diagnostics use source locations, and CLI errors/architecture status have meaningful exit codes', t => {
  const f = fixture(t, {ui: '(()=>{const C=SaveCore;C.noSuchMethod();})();'});
  let output;
  assert.equal(run(['--verify', '--json'], {root: f.root, stdout: s => output = s}), 1);
  assert.equal(JSON.parse(output).status, 'failed');
  assert.ok(JSON.parse(output).diagnostics.some(d => d.code === 'UNKNOWN_CORE_MEMBER'));
  f.write('src/ui.js', '(()=>{const broken=;})();');
  assert.ok(buildInspection({root: f.root}).diagnostics.some(d => d.code === 'SOURCE_PARSE' && d.file === 'src/ui.js' && d.line === 1));
  assert.equal(run(['--symbol', 'notFound', '--json'], {root: f.root, stdout: s => output = s}), 1);
  assert.match(JSON.parse(output).error, /查無/);
  for (const args of [[], ['--symbol'], ['--file', 'x', '--family', 'y'], ['--changed', '--staged', '--base', 'HEAD'], ['--base', 'HEAD'], ['--unknown']]) assert.throws(() => parseArguments(args));
});
