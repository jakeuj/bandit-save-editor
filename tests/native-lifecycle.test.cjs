'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {createNativeLifecycle} = require('../scripts/native-lifecycle/index.cjs');
const createRunner = require('../scripts/native-lifecycle/runner.cjs');
const {prefix} = require('../scripts/native-lifecycle/runtime.cjs');
const {inputIdentity} = require('../scripts/migration-cli.cjs');
const root = path.resolve(__dirname, '..');
const actionNames = [
  'ascend', 'followup', 'pillsAndRebirth', 'pillOverLimit', 'backpackOverLimit', 'armory', 'armoryEdited',
  'relicPlacement', 'relicTakeOff', 'relicStandPrepare', 'placedRelicAura', 'wallUpgrade', 'cityLayer',
  'ascensionQuality', 'innerPillPrepare', 'innerPillLevel', 'soulUpgrade', 'talentEffects', 'ascendedInnerPillLevel',
  'basicTechnology', 'outfitSwap', 'buildingLevel', 'recruitTechnology', 'affixPrepare', 'affixOverLimit', 'sixthAffix', 'relicCrafting'
];
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bandit-native-test-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const statePath = path.join(dir, 'state.json'), scenarioPath = path.join(dir, 'scenario.json');
  const state = {dir, game: path.join(dir, 'game'), cells: [[0, 0, 0]], expected: [-1]};
  const write = (scenario, value = state) => {
    fs.writeFileSync(statePath, JSON.stringify(value)); fs.writeFileSync(scenarioPath, JSON.stringify(scenario));
  };
  return {dir, statePath, scenarioPath, state, write, read: name => JSON.parse(fs.readFileSync(path.join(dir, name)))};
}
function harness({fail} = {}) {
  const events = [], logs = [];
  const actions = Object.fromEntries(actionNames.map(name => [name, async state => {
    events.push(name);
    if (name === fail) throw Error('Synthetic native failure');
    state.cells.push([events.length, 2, 3]);
    return {method: name};
  }]));
  const run = createRunner({actions, prefix, scriptDir: path.join(root, 'scripts'), log: value => logs.push(value),
    waitMain: async () => events.push('wait'),
    evaluate: async (state, expression) => {
      new Function('return ' + expression);
      events.push('observe'); return state.cells.map(([x, y, z]) => x + y + z);
    }
  });
  return {run, events, logs};
}

test('legacy entry keeps 27 action exports and fresh factories do not bind another game adapter', async () => {
  assert.deepEqual(Object.keys(require('../scripts/verify-native-lifecycle.cjs')), actionNames);
  const calls = [];
  const adapter = id => createNativeLifecycle({
    evaluate: async (state, expression) => {
      new Function('return ' + expression); calls.push([id, state]);
      return {character: 1, native: {104: 5}, slots: []};
    },
    waitMain: async () => { throw Error('No eager wait'); }, pause: async () => { throw Error('No eager pause'); }
  });
  const first = adapter('first'), second = adapter('second');
  assert.deepEqual(calls, []);
  const state = {cells: []}, scenario = {talentEffects: [{character: 1, expected: {104: 5}}]};
  await first.actions.talentEffects(state, scenario); await second.actions.talentEffects(state, scenario);
  assert.deepEqual(calls, [['first', state], ['second', state]]);
  assert.deepEqual(state.cells, []);
});

test('runner preserves every dispatch label and order, suppresses ascend during pills, then persists observations', async t => {
  const f = fixture(t), h = harness();
  const labels = ['followup', 'pills', 'pillOverLimit', 'backpackOverLimit', 'armory', 'armoryEdited', 'relics',
    'relicStandPrepare', 'placedRelicAura', 'relicTakeOff', 'wall', 'city', 'ascensionQuality', 'innerPillPrepare',
    'innerPillLevel', 'soulUpgrade', 'talentEffects', 'ascendedInnerPillLevel', 'basicTechnology', 'outfitSwap',
    'recruitTechnology', 'affixPrepare', 'affixOverLimit', 'sixthAffix', 'buildingLevel', 'relicCrafting'];
  f.write(Object.fromEntries(['ascend', ...labels].map(name => [name, true])));
  await h.run(f.statePath, f.scenarioPath);
  const aliases = {pills: 'pillsAndRebirth', relics: 'relicPlacement', wall: 'wallUpgrade', city: 'cityLayer'};
  assert.deepEqual(h.events, ['wait', ...labels.map(name => aliases[name] || name), 'observe']);
  const result = f.read('native-lifecycle.json');
  assert.deepEqual(Object.keys(result), labels);
  for (const label of labels) assert.deepEqual(result[label], {method: aliases[label] || label});
  const saved = f.read('state.json');
  assert.equal(saved.cells.length, 27); assert.deepEqual(saved.cells[0], [0, 0, 0]);
  assert.deepEqual(saved.expected, saved.cells.map(([x, y, z]) => x + y + z));
  assert.deepEqual(h.logs, ['PASS: native ' + labels.join(' and ') + ' follow-up actions']);
});

test('ascend alone runs before following actions and failures stop before observation or file writes', async t => {
  const f = fixture(t), h = harness(); f.write({ascend: {}, followup: {}});
  await h.run(f.statePath, f.scenarioPath);
  assert.deepEqual(h.events, ['wait', 'ascend', 'followup', 'observe']);
  assert.deepEqual(Object.keys(f.read('native-lifecycle.json')), ['ascend', 'followup']);
  fs.unlinkSync(path.join(f.dir, 'native-lifecycle.json')); f.write({ascend: {}, followup: {}, city: {}});
  const before = fs.readFileSync(f.statePath), failing = harness({fail: 'followup'});
  await assert.rejects(failing.run(f.statePath, f.scenarioPath), /Synthetic native failure/);
  assert.deepEqual(failing.events, ['wait', 'ascend', 'followup']);
  assert.deepEqual(fs.readFileSync(f.statePath), before);
  assert.equal(fs.existsSync(path.join(f.dir, 'native-lifecycle.json')), false);
  assert.deepEqual(failing.logs, []);
});

test('runner rejects invalid disposable paths and empty scenarios before any native call', async t => {
  const f = fixture(t), h = harness();
  for (const state of [
    {...f.state, dir: root, game: path.join(root, 'game')},
    {...f.state, dir: path.join(root, 'internal-copy'), game: path.join(root, 'internal-copy/game')},
    {...f.state, game: f.dir}, {...f.state, game: path.dirname(f.dir)}
  ]) {
    f.write({city: {}}, state);
    await assert.rejects(h.run(f.statePath, f.scenarioPath), /External disposable state required/);
  }
  f.write({}); await assert.rejects(h.run(f.statePath, f.scenarioPath), /no native follow-up actions/);
  assert.deepEqual(h.events, []); assert.deepEqual(h.logs, []);
});

test('relocated soul upgrades resolve the catalog from the original script directory', async t => {
  const f = fixture(t), scriptDir = path.join(f.dir, 'scripts');
  fs.mkdirSync(scriptDir); fs.mkdirSync(path.join(f.dir, 'knowledge'));
  fs.writeFileSync(path.join(f.dir, 'knowledge/catalog.json'), JSON.stringify({treasureLevel: {cost: {growth: 1.1}}}));
  const v = {tier: 1, before: 1, after: 2, souls: 100, cost: 14, soulsAfter: 86};
  const {actions} = createNativeLifecycle({scriptDir, pause: async () => {}, waitMain: async () => {},
    evaluate: async (state, expression) => { new Function('return ' + expression); return v; }
  });
  const state = {cells: []};
  assert.deepEqual(await actions.soulUpgrade(state, {soulUpgrade: [{id: 2, character: 1, type: '宝物'}]}), [v]);
  assert.deepEqual(state.cells, [[2, 6, 9], [3, 2, 0]]);
});

test('resume identity includes nested action/helper bytes and ignores unrelated documentation', t => {
  const f = fixture(t), scripts = path.join(f.dir, 'scripts'), nested = path.join(scripts, 'native-lifecycle/helpers');
  fs.mkdirSync(nested, {recursive: true}); fs.mkdirSync(path.join(f.dir, 'src'));
  fs.writeFileSync(path.join(f.dir, 'src/core.js'), 'const KNOWLEDGE=/*__KNOWLEDGE__*/null;globalThis.SaveCore={};');
  fs.writeFileSync(path.join(scripts, 'entry.cjs'), 'module.exports={};');
  const helper = path.join(nested, 'observe.cjs'); fs.writeFileSync(helper, 'module.exports=1;');
  const runtime = path.join(f.dir, 'Runtime.app/Contents/MacOS/nw');
  fs.mkdirSync(path.dirname(runtime), {recursive: true}); fs.writeFileSync(runtime, 'synthetic runtime');
  const identity = () => inputIdentity({dir: f.dir, catalog: {}, copies: [], runtime, saveText: 'synthetic save', plan: {}});
  const before = identity(); assert.equal(identity(), before);
  fs.writeFileSync(path.join(nested, 'notes.md'), 'unrelated text'); assert.equal(identity(), before);
  fs.writeFileSync(helper, 'module.exports=2;'); assert.notEqual(identity(), before);
  fs.unlinkSync(helper); assert.notEqual(identity(), before);
});
