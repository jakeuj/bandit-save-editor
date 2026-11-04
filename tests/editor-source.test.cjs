'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const {readEditorSource, embedKnowledge} = require('../scripts/editor-source.cjs');

function copy(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bandit-source-test-'));
  fs.cpSync(path.join(__dirname, '../src'), path.join(root, 'src'), {recursive: true});
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  return root;
}

test('an explicit root supplies every fragment, and edits are read without a stale cache', t => {
  const root = copy(t), file = path.join(root, 'src/core/serialization.js');
  const before = readEditorSource('core', {root});
  fs.appendFileSync(file, '\nfunction temporaryRootOnly(){return 73;}\n');
  const source = readEditorSource('core', {root}), context = {};
  vm.runInNewContext(embedKnowledge(source, require('../knowledge/catalog.json')), context);
  assert.equal(typeof context.SaveCore.serialize, 'function');
  assert.match(source, /function temporaryRootOnly/);
  assert.doesNotMatch(before, /function temporaryRootOnly/);
  assert.doesNotMatch(readEditorSource('core'), /function temporaryRootOnly/);
  assert.doesNotMatch(readEditorSource('ui', {root}), /\/\*__[A-Z_]+__\*\//);
  assert.match(readEditorSource('knowledge-ui', {root}), /function renderEditing/);
});

test('a missing nested source fails instead of silently omitting a feature', t => {
  const root = copy(t);
  fs.unlinkSync(path.join(root, 'src/ui/knowledge/affixes.js'));
  assert.throws(() => readEditorSource('ui', {root}), /ENOENT/);
});

test('missing, duplicate, reordered and unregistered assembly markers fail', t => {
  const root = copy(t), file = path.join(root, 'src/core.js');
  const source = fs.readFileSync(file, 'utf8'), token = '/*__CORE_BATCH__*/';
  fs.writeFileSync(file, source.replace(token, ''));
  assert.throws(() => readEditorSource('core', {root}), /CORE_BATCH.*恰好出現一次/);
  fs.writeFileSync(file, source + token);
  assert.throws(() => readEditorSource('core', {root}), /CORE_BATCH.*恰好出現一次/);
  // Exchange the first and last fragment without dropping or duplicating either marker.
  const reordered = source.replace('/*__CORE_SHARED__*/', '__FIRST__').replace(token, '/*__CORE_SHARED__*/').replace('__FIRST__', token);
  fs.writeFileSync(file, reordered);
  assert.throws(() => readEditorSource('core', {root}), /組裝順序與清單不符/);
  fs.writeFileSync(file, source + '\n/*__UNREGISTERED__*/');
  assert.throws(() => readEditorSource('core', {root}), /殘留組裝標記/);
  for (const entry of ['unknown', 'toString', '__proto__']) {
    assert.throws(() => readEditorSource(entry, {root}), /未知的編輯器來源入口/);
  }
});

test('a frozen standalone core stays byte-identical and ignores current fragments', t => {
  const root = copy(t), legacy = fs.readFileSync(path.join(__dirname, 'fixtures/legacy-release/core.js'), 'utf8');
  fs.writeFileSync(path.join(root, 'src/core.js'), legacy);
  fs.unlinkSync(path.join(root, 'src/core/shared.js'));
  assert.equal(readEditorSource('core', {root}), legacy);
});

test('knowledge embedding preserves replacement metacharacters and cannot close its script', () => {
  const knowledge = {name: "</script><b>$& $` $' 九項技藝"};
  const source = embedKnowledge('globalThis.value=/*__KNOWLEDGE__*/null;', knowledge), context = {};
  vm.runInNewContext(source, context);
  assert.equal(context.value.name, knowledge.name);
  assert.doesNotMatch(source, /</);
  assert.throws(() => embedKnowledge('null', knowledge), /恰好出現一次/);
  assert.throws(() => embedKnowledge('/*__KNOWLEDGE__*/null;/*__KNOWLEDGE__*/null', knowledge), /恰好出現一次/);
});
