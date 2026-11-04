'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {saveFixture} = require('./helpers/save-fixture.cjs');

// Load only the factory. Every game/core capability must arrive through services.
const createReader = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/core/character-aptitude-source.js'), 'utf8') + '\ncreateCharacterAptitudeSource;');
const plain = value => JSON.parse(JSON.stringify(value));
function readOnly(model, action) {
  const before = structuredClone(model);
  try { return action(); } finally { assert.deepEqual(model, before); }
}
function fixture() {
  const {data, raw} = saveFixture({size: 8, characters: 1, layers: 24});
  const model = {original: {size: [8, 60, 24], data}, text: raw, changes: new Map(), history: []};
  const knowledge = {
    verification: {backupSetAptitude: true},
    batch2Data: {
      characters: {}, talents: {801: {attributes: [104, 0, 0], coefficients: [5, 0, 0]}},
      items: {101: {mainAttributes: [], setLink: 0}, 102: {mainAttributes: [], setLink: 0}, 201: {mainAttributes: []}, 202: {mainAttributes: []}}
    },
    setEquipmentLevel: {sets: {10: {effects: [{attributeId: 101}]}}}
  };
  const items = new Map([[101, {slot: 1}], [102, {slot: 2}], [201, {kind: '内丹'}], [202, {kind: '内丹'}]]);
  const state = {reads: 0, overLimit: false, sixth: false, backup: []};
  const get = (m, {x, y, z}) => { state.reads++; return m.original.data[x][y][z]; };
  const services = {
    KNOWLEDGE: knowledge, get, C: (x, y, z) => ({x, y, z}), catalogMaps: {items},
    backupSetAptitudeRows: () => knowledge.verification.backupSetAptitude ? state.backup : [],
    inBackupSet: (m, row) => state.backup.some(([, id]) => id === row),
    backupSetAptitudeReason: '合成備用套裝尚未開放',
    activeCharacter: (m, id) => id === 1,
    ordinaryEquipment: () => ({rules: {mainAttributes: []}}),
    affixOverLimitAccepted: () => state.overLimit,
    sixthAffixAccepted: () => state.sixth,
    // Deliberately independent of the game's coefficient formula.
    ascensionCoefficient: (quality, round) => round === 1 ? 0.4 : 0.7,
    aptitudeAttribute: id => id >= 104 && id <= 106
  };
  function wear(row, templateId, slot, backup = false) {
    data[row][0][9] = row; data[row][1][9] = templateId; data[row][7][9] = 1;
    if (backup) state.backup.push([slot, row]); else data[1][15 + slot][2] = row;
  }
  function ascend() {
    data[1][50][2] = 2;
    for (const [round, row, template, coefficient] of [[1, 4, 201, 0.4], [2, 5, 202, 0.7]]) {
      data[1][2 * round - 1][16] = round; data[1][2 * round][16] = row;
      data[row][1][17] = template; data[row][7][17] = 1;
      for (let i = 0; i < 3; i++) { data[row][9 + i][17] = 107 + i; data[row][15 + i][17] = coefficient; }
    }
  }
  return {model, data, knowledge, state, services, wear, ascend};
}

test('aptitude reader has no eager reads, model ownership or cached source values', () => {
  const f = fixture(), reader = createReader(f.services);
  assert.equal(f.state.reads, 0);
  assert.deepEqual(Object.keys(reader).sort(), ['record', 'source']);
  const first = readOnly(f.model, () => reader.source(f.model, 1, 1));
  assert.equal(first.base, 3); assert.equal(first.ascension, null);
  const other = fixture(); other.data[1][10][2] = 40;
  assert.equal(readOnly(other.model, () => reader.source(other.model, 1, 1)).base, 4);
  f.data[1][1][12] = 801; f.data[1][21][12] = 2;
  assert.equal(readOnly(f.model, () => reader.source(f.model, 1, 1)).base, 4);
  assert.equal(readOnly(f.model, () => reader.source(f.model, 1, 1, [40, 30, 30])).base, 5);
  f.knowledge.batch2Data.talents[801].coefficients[0] = 10;
  assert.equal(readOnly(f.model, () => reader.source(f.model, 1, 1)).base, 5);
});

test('record validates referenced rounds through host coefficients and ignores unreferenced rebirth residue', () => {
  const f = fixture(), reader = createReader(f.services);
  f.ascend();
  assert.deepEqual(plain(readOnly(f.model, () => reader.record(f.model, 1))), {
    count: 2, multiplier: 2.6,
    records: [{round: 1, quality: 1, row: 4, templateId: 201, coefficient: 0.4}, {round: 2, quality: 2, row: 5, templateId: 202, coefficient: 0.7}]
  });
  f.data[6][7][17] = 1; f.data[6][1][17] = 201;
  assert.equal(readOnly(f.model, () => reader.record(f.model, 1)).multiplier, 2.6);
  f.data[4][7][17] = 2;
  assert.throws(() => readOnly(f.model, () => reader.record(f.model, 1)), /owner/);
  f.data[4][7][17] = 1; f.data[5][15][17] = 0.8;
  assert.throws(() => readOnly(f.model, () => reader.record(f.model, 1)), /係數/);
});

test('plain source delegates equipment rules and reads current host flags and backup-set permission', () => {
  const f = fixture(); f.wear(2, 101, 1);
  f.services.ordinaryEquipment = (m, row, plane, level, affix, sixth) => {
    if (!affix || !sixth) throw Error('合成裝備旗標未開');
    return {rules: {mainAttributes: []}};
  };
  const reader = createReader(f.services);
  assert.throws(() => readOnly(f.model, () => reader.source(f.model, 1, 1)), /合成裝備旗標未開/);
  f.state.overLimit = true; f.state.sixth = true;
  assert.equal(readOnly(f.model, () => reader.source(f.model, 1, 1)).base, 3);
  f.wear(3, 102, 2, true); f.knowledge.verification.backupSetAptitude = false;
  assert.throws(() => readOnly(f.model, () => reader.source(f.model, 1, 1)), /合成備用套裝尚未開放/);
  f.knowledge.verification.backupSetAptitude = true;
  assert.equal(readOnly(f.model, () => reader.source(f.model, 1, 1)).base, 3);
});

test('ascended source checks worn and backup aptitude effects without using ordinary equipment validation', () => {
  const f = fixture(); f.ascend(); f.wear(2, 101, 1); f.wear(3, 102, 2, true);
  f.services.ordinaryEquipment = () => { throw Error('ordinary equipment must not be required here'); };
  const reader = createReader(f.services);
  assert.equal(readOnly(f.model, () => reader.source(f.model, 1, 1, undefined, true)).ascension.count, 2);
  f.knowledge.batch2Data.items[102].setLink = 10;
  f.knowledge.setEquipmentLevel.sets[10].effects[0].attributeId = 104;
  assert.throws(() => readOnly(f.model, () => reader.source(f.model, 1, 1, undefined, true)), /資質加成/);
  f.knowledge.setEquipmentLevel.sets[10].effects[0].attributeId = 101; f.data[2][9][9] = 105;
  assert.throws(() => readOnly(f.model, () => reader.source(f.model, 1, 1, undefined, true)), /資質加成/);
  f.data[2][9][9] = 0; f.data[1][16][2] = 0;
  assert.throws(() => readOnly(f.model, () => reader.source(f.model, 1, 1, undefined, true)), /未穿戴/);
});

test('named source uses current template data and rejects mismatched or unrecognised models without changes', () => {
  const f = fixture(); f.data[1][2][2] = 901;
  f.knowledge.batch2Data.characters[901] = {base: [30, 30, 30], talents: [0, 0, 0], talentLevels: [0, 0, 0]};
  const reader = createReader(f.services);
  assert.equal(readOnly(f.model, () => reader.source(f.model, 1, 1)).base, 3);
  f.knowledge.batch2Data.characters[901].base[0] = 40;
  assert.throws(() => readOnly(f.model, () => reader.source(f.model, 1, 1)), /與載入範本不一致/);
  assert.throws(() => readOnly(f.model, () => reader.source(f.model, 2, 1)), /有效角色/);
  delete f.knowledge.batch2Data.characters[901];
  assert.throws(() => readOnly(f.model, () => reader.source(f.model, 1, 1)), /尚未辨識/);
});
