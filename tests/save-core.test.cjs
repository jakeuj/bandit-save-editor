const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const context = {};
vm.runInNewContext(source.match(/<script id="save-core">([\s\S]*?)<\/script>/)[1], context);
const C = context.SaveCore;
function fixture() {
  const data = Array.from({ length: 221 }, () => Array.from({ length: 60 }, () => Array(22).fill(0)));
  data[0][0][1] = 'szmnqea';
  data[1][1][0] = '測試山寨';
  data[1][2][0] = 35254;
  data[2][2][0] = 209688;
  data[11][6][0] = 183416;
  return JSON.stringify({ note: 'data', c2array: true, size: [221, 60, 22], data })
    .replace('{', '{"untouched":987654321098765432109876543210,\n  ');
}

test('export preserves every unedited source character, including large integer literals', () => {
  const raw = fixture(), model = C.parse(raw);
  assert.equal(C.serialize(model), raw);
  C.transaction(model, () => {
    C.set(model, { x: 1, y: 2, z: 0 }, 999999);
    C.set(model, { x: 2, y: 2, z: 0 }, 9999999);
    C.set(model, { x: 11, y: 6, z: 0 }, 888888);
  });
  const output = C.serialize(model);
  assert.equal(output, raw.replace('[35254,', '[999999,').replace('[209688,', '[9999999,').replace('[183416,', '[888888,'));
  const reloaded = C.parse(output);
  assert.equal(C.diff(model.original, reloaded.original).length, 3);
  C.undo(model);
  assert.equal(C.serialize(model), raw);
});

test('invalid edits roll back as a single transaction', () => {
  const model = C.parse(fixture()), coins = { x: 1, y: 2, z: 0 };
  assert.throws(() => C.transaction(model, () => {
    C.set(model, coins, 999999);
    C.set(model, { x: 11, y: 6, z: 0 }, -1);
  }));
  assert.equal(model.changes.size, 0);
  for (const value of [NaN, Infinity, 1.5, 9007199254740992, -1]) assert.throws(() => C.set(model, coins, value));
  assert.throws(() => C.set(model, { x: 221, y: 2, z: 0 }, 1));
  assert.throws(() => C.set(model, { x: 1, y: 1, z: 0 }, 1));
});

test('malformed and unrelated save files are rejected; catalog has 220 unique coordinates', () => {
  for (const text of ['', '{broken', '{}', '{"c2array":true,"size":[1,1,1],"data":[[[0]]]}']) assert.throws(() => C.parse(text));
  assert.equal(C.MATERIALS.length, 220);
  assert.equal(new Set(C.MATERIALS.map(C.key)).size, 220);
});
