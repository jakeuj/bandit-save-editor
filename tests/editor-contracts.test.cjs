'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {fixture} = require('./helpers/inspection-fixture.cjs');
const {buildInspection, queryInspection} = require('../scripts/editor-inspection.cjs');
const {run} = require('../scripts/inspect-editor.cjs');

test('JSDoc attaches to adjacent declarations, not typedefs or intervening code', t => {
  const f = fixture(t, {core: `(()=>{
    /** @typedef {{quoted:'}', nested:{n:number}}} Nested */
    function undocumented(){}
    /** Read contract.
     * @param {Nested} options
     * @returns {number}
     */
    function read(options){return 1;}
    /** Arrow contract. @returns {number} */
    const arrow=()=>2;
    /** This comment is separated by executable code. */
    void 0;function later(){}
    globalThis.SaveCore={read,arrow};
  })();`});
  const index = buildInspection({root: f.root});
  assert.deepEqual(index.diagnostics, []);
  assert.equal(queryInspection(index, {symbol: 'undocumented'}).definitions[0].contract, undefined);
  assert.equal(queryInspection(index, {symbol: 'later'}).definitions[0].contract, undefined);
  const read = queryInspection(index, {symbol: 'read'});
  assert.match(read.definitions[0].contract.text, /Read contract/);
  assert.equal(read.definitions[0].contract.file, 'src/core.js');
  assert.ok(read.definitions[0].contract.line < read.definitions[0].line);
  assert.equal(read.contractTypes[0].name, 'Nested');
  assert.match(queryInspection(index, {symbol: 'arrow'}).definitions[0].contract.text, /Arrow contract/);
});

test('recursive typedef references terminate and type-only/file queries expose original definitions', t => {
  const f = fixture(t, {core: `(()=>{
    /** @typedef {B} A */
    /** @typedef {A} B */
    /** @returns {A} */
    function read(){return 1;}globalThis.SaveCore={read};
  })();`});
  const index = buildInspection({root: f.root});
  assert.deepEqual(new Set(queryInspection(index, {symbol: 'read'}).contractTypes.map(t => t.name)), new Set(['A', 'B']));
  assert.equal(queryInspection(index, {symbol: 'A'}).definitions.length, 0);
  assert.equal(queryInspection(index, {file: 'src/core.js'}).contractTypes.length, 2);
});

test('pilot contracts are discoverable without changing runtime names or requiring all APIs to be annotated', () => {
  const index = buildInspection();
  const methods = ['parse','serialize','transaction','undo','restore','restoreAll','skillCapAptitudeWitness','skillCapCombinations','randomCharacterSkillCapsInfo','randomCharacterSkillCapsAdvancedInfo','previewCharacterSkillCaps','previewCharacterSkillCapsAdvanced','setCharacterSkillCaps','setCharacterSkillCapsAdvanced'];
  for (const symbol of methods) {
    const result = queryInspection(index, {symbol});
    assert.ok(result.definitions[0].contract, symbol);
    assert.match(result.definitions[0].contract.text, /@param/);
    assert.match(result.definitions[0].contract.text, /@returns/);
  }
  const result = queryInspection(index, {symbol: 'setCharacterSkillCaps'});
  for (const name of ['SaveModel','SkillCapsRequest','SkillCapsApplyContext','SkillCapsPreview','SkillCapValues']) assert.ok(result.contractTypes.some(t => t.name === name), name);
  assert.equal(queryInspection(index, {symbol: 'get'}).definitions[0].contract, undefined);
  assert.deepEqual(index.diagnostics, []);
});

test('type-only CLI is readable JSON and does not invent a runtime test recommendation', () => {
  let text;
  assert.equal(run(['--symbol','SkillCapsRequest','--json'], {stdout: value => text = value}), 0);
  const result = JSON.parse(text);
  assert.deepEqual(result.definitions, []);
  assert.deepEqual(result.suggestedChecks, []);
  assert.equal(result.contractTypes.length, 1);
  assert.match(result.contractTypes[0].text, /完整九項安全整數/);
});

test('private aptitude module exposes its source and host contracts through the same inspection entry', () => {
  const result = queryInspection(buildInspection(), {symbol: 'createCharacterAptitudeSource'});
  assert.equal(result.definitions[0].file, 'src/core/character-aptitude-source.js');
  assert.deepEqual(result.definitions[0].publicExports, []);
  assert.deepEqual(result.dependencies, []);
  for (const name of ['CharacterAptitudeServices', 'CharacterAptitudeReader', 'CharacterAptitudeContext', 'CharacterAscensionRecord', 'SaveModel']) {
    assert.ok(result.contractTypes.some(type => type.name === name), name);
  }
});
