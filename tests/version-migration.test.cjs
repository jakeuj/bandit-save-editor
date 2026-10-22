'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/catalog.json'), 'utf8'));

test('Mac preparation tool reviews the runtime the catalog was built from',()=>{
  const tool = fs.readFileSync(path.join(root, 'launcher/prepare-macos.py'), 'utf8');
  const reviewed = tool.match(/SCRIPT_SHA256 = \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(reviewed, 'reviewed script table missing');
  const entries = Object.fromEntries([...reviewed.matchAll(/"([0-9a-f]{64})": "([^"]+)"/g)].map(m => [m[1], m[2]]));
  assert.equal(entries[catalog.fingerprints['scripts/c3runtime.js']], catalog.gameVersion);
});

test('isolated setup accepts a patched Mac runtime only when it derives from the catalog runtime',()=>{
  const os = require('node:os'), {createHash} = require('node:crypto'), {checkSource} = require('../scripts/verify-game.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bandit-source-'));
  const hash = text => createHash('sha256').update(text).digest('hex');
  try{
    fs.mkdirSync(path.join(dir, 'scripts'));
    fs.writeFileSync(path.join(dir, 'data.json'), 'events');
    fs.writeFileSync(path.join(dir, 'scripts/c3runtime.js'), 'patched');
    const fingerprints = {'data.json': hash('events'), 'scripts/c3runtime.js': hash('original')};
    const proof = {original_c3runtime_sha256: hash('original'), patched_c3runtime_sha256: hash('patched')};
    const darwin = {platform: 'darwin', packageDir: '/package', verifyRuntime: () => proof};
    assert.deepEqual(checkSource(dir, fingerprints, darwin), {hashes: {'data.json': hash('events'), 'scripts/c3runtime.js': hash('patched')}, runtimePatch: proof});
    assert.throws(() => checkSource(dir, fingerprints, {...darwin, platform: 'win32'}), /does not match catalog fingerprint: scripts\/c3runtime\.js/);
    assert.throws(() => checkSource(dir, fingerprints, {...darwin, packageDir: undefined}), /requires --package/);
    assert.throws(() => checkSource(dir, fingerprints, {...darwin, verifyRuntime: () => ({...proof, original_c3runtime_sha256: hash('other')})}), /does not derive/);
    assert.throws(() => checkSource(dir, fingerprints, {...darwin, verifyRuntime: () => ({...proof, patched_c3runtime_sha256: hash('other')})}), /does not derive/);
    assert.throws(() => checkSource(dir, {...fingerprints, 'data.json': hash('changed')}, darwin), /does not match catalog fingerprint: data\.json/);
    fs.writeFileSync(path.join(dir, 'scripts/c3runtime.js'), 'original');
    assert.equal(checkSource(dir, fingerprints, {platform: 'win32'}).runtimePatch, null);
  }finally{fs.rmSync(dir, {recursive: true, force: true});}
});

test('migration suite proves every required check of every catalog write group',()=>{
  const R = require('../scripts/verification-requirements.cjs'), S = require('../scripts/verification-suite.cjs');
  const groups = Object.keys(catalog.verification);
  assert.deepEqual(S.uncovered(groups), []);
  for (const group of groups) assert.ok(R.sectionOf(group), 'requirement section missing: ' + group);
  const listed = Object.values(S.families).flatMap(f => f.groups);
  assert.equal(new Set(listed).size, listed.length, 'a group belongs to more than one family');
  assert.deepEqual([...listed].sort(), [...groups].sort());
  assert.deepEqual(Object.values(R.sections).flatMap(s => s.groups).sort(), [...groups].sort());
  assert.deepEqual(S.uncovered(['futureGroup']), ['futureGroup: no family']);
  const lifecycle = S.families.batch2.lifecycle;
  try{
    delete S.families.batch2.lifecycle;
    assert.ok(S.uncovered(['equipmentAffixCoefficient']).includes('equipmentAffixCoefficient: nativeRewash'));
  }finally{S.families.batch2.lifecycle = lifecycle;}
  assert.throws(() => R.requiredChecks('futureGroup'), /缺少驗證需求定義/);
});

test('build gating rejects an enabled group without requirements and proofs missing a required check',()=>{
  const os = require('node:os'), {spawnSync} = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bandit-build-'));
  try{
    fs.cpSync(root, dir, {recursive: true, filter: source => !/[\\/](\.git|graphify-out|node_modules)([\\/]|$)/.test(source)});
    const catalogPath = path.join(dir, 'knowledge/catalog.json'), proofPath = path.join(dir, 'knowledge/verification.json');
    const build = () => spawnSync(process.execPath, ['scripts/build-editor.cjs'], {cwd: dir, encoding: 'utf8'});
    const k = JSON.parse(fs.readFileSync(catalogPath, 'utf8')), p = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
    fs.writeFileSync(catalogPath, JSON.stringify({...k, verification: {...k.verification, futureGroup: true}}));
    assert.match(build().stderr, /缺少驗證需求定義：futureGroup/);
    fs.writeFileSync(catalogPath, JSON.stringify(k));
    const {rebirthClears, ...batch2Checks} = p.batch2.checks;
    fs.writeFileSync(proofPath, JSON.stringify({...p, batch2: {...p.batch2, checks: batch2Checks}}));
    assert.match(build().stderr, /第二批來源、規則或值域缺少相符驗證/);
    const {subsequentResearchAndTrainingStartStop, ...baseChecks} = p.checks;
    fs.writeFileSync(proofPath, JSON.stringify({...p, checks: baseChecks}));
    assert.match(build().stderr, /基礎與進階修改缺少必要的遊戲驗證項目/);
    const quality = structuredClone(p.equipmentQuality);
    delete quality.groups.equipmentQualityDowngrade.uiEvidence;
    fs.writeFileSync(proofPath, JSON.stringify({...p, equipmentQuality: quality}));
    assert.match(build().stderr, /UI 證據缺少相符的事件摘要：equipmentQualityDowngrade/);
  }finally{fs.rmSync(dir, {recursive: true, force: true});}
});

test('event digest ignores renumbering between builds but changes with logic',()=>{
  const {eventDigest} = require('../scripts/extract-game.cjs');
  const objects = Array.from({length: 13}, (_, i) => [i === 12 ? 'save' : 'object' + i]);
  const factories = {zero: () => 0, two: () => 2, five: () => 5};
  // Event: [type, head, flags, flags, sid, position, conditions, actions, children]
  const build = ({position = 10, shift = 0, operator = 4, constant = 'two', variableIndex = 633, sid = 501} = {}) => {
    const expressions = [];
    const index = name => { expressions[shift + Object.keys(factories).indexOf(name)] = factories[name]; return shift + Object.keys(factories).indexOf(name); };
    const condition = [12, 52, null, 0, false, false, false, 9001, null, [[0, [index('zero')]], [0, [index(constant)]], [8, operator]]];
    const action = [-1, 121, null, 9002, 0, null, [[7, [index('five'), [3, 777], [1, 12, 3]]]]];
    const head = ['fn', 1, [[1, 'quality', 0, 0, false, false, 777, false, variableIndex]], true];
    const event = [4, head, false, null, sid, position, [condition], [action], [[0, 0, false, null, 502, position + 1, [], [], []]]];
    const refs = Array.from({length: 122}, (_, i) => 'C3.ref' + i);
    return {project: [, , , objects, , , [['sheet', [event]]]], expressions, refs};
  };
  const base = eventDigest(build(), [501]);
  assert.match(base, /^[0-9a-f]{64}$/);
  assert.equal(eventDigest(build({position: 99, shift: 7, variableIndex: 1308}), [501]), base);
  assert.notEqual(eventDigest(build({operator: 2}), [501]), base);
  assert.notEqual(eventDigest(build({constant: 'five'}), [501]), base);
  assert.notEqual(eventDigest(build(), [502]), base);
  assert.throws(() => eventDigest(build(), [404]), /事件不存在：404/);
});

test('UI proofs are accepted natively or carried only with an unchanged event digest',()=>{
  const R = require('../scripts/verification-requirements.cjs');
  const digest = 'a'.repeat(64), sids = R.uiEvents.qualityUi;
  const native = {uiEvidence: {source: 'native', gameVersion: 'V2', eventSids: sids, eventDigest: digest}};
  const carried = {uiEvidence: {source: 'carried', gameVersion: 'V2', eventSids: sids, eventDigest: digest, carriedFrom: {gameVersion: 'V1', eventDigest: digest}}};
  assert.equal(R.uiEvidenceProblem('equipmentQualityUpgrade', native, 'V2'), null);
  assert.equal(R.uiEvidenceProblem('equipmentQualityUpgrade', carried, 'V2'), null);
  assert.equal(R.uiEvidenceProblem('names', {}, 'V2'), null);
  assert.match(R.uiEvidenceProblem('equipmentQualityUpgrade', native, 'V3'), /事件摘要/);
  assert.match(R.uiEvidenceProblem('equipmentAffixInitialSelection', native, 'V2'), /事件摘要/);
  assert.match(R.uiEvidenceProblem('equipmentQualityUpgrade', {}, 'V2'), /事件摘要/);
  assert.match(R.uiEvidenceProblem('equipmentQualityUpgrade', {uiEvidence: {...carried.uiEvidence, carriedFrom: {gameVersion: 'V1', eventDigest: 'b'.repeat(64)}}}, 'V2'), /來源無效/);
  assert.match(R.uiEvidenceProblem('equipmentQualityUpgrade', {uiEvidence: {...carried.uiEvidence, carriedFrom: {gameVersion: 'V2', eventDigest: digest}}}, 'V2'), /來源無效/);
  assert.match(R.uiEvidenceProblem('equipmentQualityUpgrade', {uiEvidence: {...native.uiEvidence, source: 'assumed'}}, 'V2'), /來源無效/);
  const proof = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/verification.json'), 'utf8'));
  for (const group of Object.keys(R.uiChecks)) {
    const record = proof.equipmentQuality.groups[group] || proof.equipmentWorkflow.groups[group];
    assert.equal(R.uiEvidenceProblem(group, record, catalog.gameVersion), null, group);
  }
});

test('representative scenarios replay on the base save and together cover every write group',()=>{
  const {buildScenarios} = require('../scripts/migration-scenarios.cjs'), S = require('../scripts/verification-suite.cjs');
  const data = Array.from({length: 2501}, () => Array.from({length: 60}, () => Array(22).fill(0)));
  data[0][0][1] = 'szmnqea'; data[1][1][0] = '山寨'; data[1][0][2] = 1; data[1][1][2] = '驗證甲'; data[1][3][2] = 1;
  for (const y of [10, 11, 12]) data[1][y][2] = 50;
  // A placed academy (5) and drill ground (6) that have not finished their first build.
  for (const [x, template] of [[4, 5], [12, 6]]) { data[x][0][1] = x; data[x][1][1] = template; }
  const saveText = JSON.stringify({c2array: true, size: [2501, 60, 22], data});
  const copies = buildScenarios({catalog, saveText});
  const covered = copies.flatMap(c => c.groups || S.families[c.family].groups);
  assert.deepEqual([...new Set(covered)].sort(), Object.keys(catalog.verification).sort());
  const byName = Object.fromEntries(copies.map(c => [c.name, c]));
  const level = (c, x, y, z) => c.scenario.baseline.filter(([a, b, d]) => a === x && b === y && d === z).at(-1)?.[3];
  assert.equal(level(byName['advanced-normal'], 4, 5, 1), 1);
  assert.equal(level(byName['advanced-normal'], 12, 5, 1), 1);
  assert.deepEqual(byName['advanced-normal'].scenario.operations.find(o => o.method === 'setAdvancedTechnologyLevel').options, {technologyId: 31, level: 119, advanced: false});
  assert.equal(byName['advanced-overcap'].scenario.operations.find(o => o.options.technologyId === 33).options.level, 299);
  assert.deepEqual(byName['advanced-followup'].scenario.followup, {equipment: {id: 3, slot: byName['advanced-followup'].scenario.followup.equipment.slot}, profession: 3, technology: 31, drillGround: 12, academy: 4});
  assert.deepEqual(copies.filter(c => c.lifecycle).map(c => c.name), ['advanced-followup', 'batch2', 'affix-replacement', 'equipment-workflow', 'quality-7-Upgrade', 'quality-7-Downgrade', 'quality-9-Upgrade', 'quality-9-Downgrade']);
  assert.deepEqual(byName['batch2'].scenario.pills.map(p => p.aptitude), [1, 2, 3]);
  assert.deepEqual(byName['batch2'].scenario.operations.filter(o => o.method === 'setEquipmentAffixCoefficient').map(o => o.options.coefficient), [10.01, 80, 10, 80, 50, 120, 50, 119.99]);
  assert.deepEqual(byName['equipment-workflow'].scenario.operations.filter(o => o.options.selectUnwashedSlot).map(o => o.options.plane), [7, 9]);
  for (const name of ['quality-7-Upgrade', 'quality-9-Downgrade']) assert.ok(byName[name].scenario.items.some(i => i.options.quality === 2), name);
  for (const c of copies.filter(c => c.scenario)) assert.ok(c.scenario.operations.length > 0 && c.scenario.observe.length >= 10, c.name);
  data[12][1][1] = 7;
  assert.throws(() => buildScenarios({catalog, saveText: JSON.stringify({c2array: true, size: [2501, 60, 22], data})}), /基準存檔需要已放置的校場/);
});

test('native follow-up actions send compilable page code and check each native result',async()=>{
  const gamePath = require.resolve('../scripts/verify-game.cjs'), lifecyclePath = require.resolve('../scripts/verify-native-lifecycle.cjs');
  const real = require(gamePath), sent = [], answers = [];
  const fake = {...real, waitMain: async () => {}, evaluate: async (state, expression) => { new Function('return ' + expression); sent.push(expression); return answers.shift()(expression); }};
  delete require.cache[lifecyclePath]; require.cache[gamePath] = {...require.cache[gamePath], exports: fake};
  try{
    const {followup, pillsAndRebirth} = require(lifecyclePath);
    const record = Array.from({length: 50}, (_, y) => y === 7 ? 1 : y + 100);
    const state = {cells: []}, scenario = {followup: {equipment: {id: 3, slot: 2}, profession: 3, technology: 31, academy: 4, drillGround: 12}, pills: [{aptitude: 1, pillId: 64}, {aptitude: 2, pillId: 70}, {aptitude: 3, pillId: 76}]};
    answers.push(() => record, () => 9, () => true, () => ({id: 5, record}),
      () => ({from: 1, calls: 2, prerequisite: 5, job: 3, before: [1, 0], after: [1, 10], capBefore: 10, capAfter: 10}),
      () => ({f: 1, started: [1, 31], stopped: [0, 0]}), () => ({f: 5, started: [1, 3], stopped: [0, 0]}));
    await followup(state, scenario);
    assert.ok(sent[5].includes("call('科技研究',31,a.At(4,5,1))") && sent[6].includes("call('职业操练',3,a.At(12,5,1))"));
    assert.ok(state.cells.some(([x, y, z]) => x === 31 && y === 13 && z === 0));
    answers.push(() => [{aptitude: 1, pillId: 64, count: [5, 5], bonus: [80, 80]}, {aptitude: 2, pillId: 70, count: [5, 4], bonus: [1, 33]}, {aptitude: 3, pillId: 76, count: [5, 4], bonus: [0, 32]}], () => true, () => [0, 0, 0]);
    await pillsAndRebirth(state, scenario);
    answers.push(() => [{aptitude: 1, pillId: 64, count: [5, 5], bonus: [80, 80]}, {aptitude: 2, pillId: 70, count: [5, 5], bonus: [1, 1]}, {aptitude: 3, pillId: 76, count: [5, 4], bonus: [0, 32]}]);
    await assert.rejects(pillsAndRebirth(state, scenario), /Pill not consumed/);
    answers.push(() => record, () => 9, () => true, () => ({id: 5, record: record.map((v, y) => y === 6 ? 1 : v)}));
    await assert.rejects(followup(state, scenario), /Equip cycle field 6/);
  }finally{require.cache[gamePath].exports = real; delete require.cache[lifecyclePath];}
});

test('every suite oracle and lifecycle script exists and marked copies run each family lifecycle',()=>{
  const S = require('../scripts/verification-suite.cjs');
  for (const [name, family] of Object.entries(S.families)) for (const script of [family.oracle, ...(family.lifecycle || [])].filter(Boolean)) assert.ok(fs.existsSync(path.join(root, 'scripts', script)), name + ': ' + script);
  const generator = fs.readFileSync(path.join(root, 'scripts/migration-scenarios.cjs'), 'utf8');
  assert.match(generator, /lifecycle: mode === 'followup'/);
  assert.match(generator, /extra\.followup = \{equipment: \{id: 3, slot: t\.slot\}, profession: 3, technology: 31, drillGround, academy\}/);
});

test('migration runner replays each copy in order, stops on failure and derives proven checks',async()=>{
  const os = require('node:os'), M = require('../scripts/verify-migration.cjs'), R = require('../scripts/verification-requirements.cjs'), S = require('../scripts/verification-suite.cjs');
  const workflow = M.steps({name: 'w', family: 'equipmentWorkflow', oracleArgs: [], lifecycle: true, scenarioFile: '/x/w.json'}, ['--source', 's']);
  assert.deepEqual(workflow.map(s => s.step), ['setup', 'load', 'oracle', 'save', 'assert', 'stop', 'restart', 'restartLoad', 'reload', 'oracleCompare', 'lifecycle', 'lifecycle', 'lifecycle', 'stop', 'restart', 'restartLoad', 'lifecycle', 'lifecycle', 'stop']);
  assert.deepEqual(workflow.at(-2).args, ['--state', '{state}', '--compare']);
  assert.deepEqual(M.steps({name: 'b', family: 'batch2', oracleArgs: ['--character', '1'], lifecycle: true, scenarioFile: '/x/b.json'}, []).filter(s => s.step === 'lifecycle' && s.script !== 'verify-game.cjs').map(s => s.script), ['verify-affix-lifecycle.cjs', 'verify-native-lifecycle.cjs']);
  assert.deepEqual(M.steps({name: 'g', family: 'growth', oracleArgs: [], lifecycle: false}, []).map(s => s.step), ['setup', 'load', 'save', 'assert', 'stop', 'restart', 'restartLoad', 'reload', 'stop']);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bandit-migration-'));
  try{
    const statePath = path.join(dir, 'state.json'); fs.writeFileSync(statePath, JSON.stringify({game: dir}));
    const proof = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/verification.json'), 'utf8'));
    const digests = {selectionUi: proof.equipmentWorkflow.groups.equipmentAffixInitialSelection.uiEvidence.eventDigest, qualityUi: 'f'.repeat(64)};
    const digest = (gameDir, sids) => sids === R.uiEvents.selectionUi ? digests.selectionUi : digests.qualityUi;
    const copies = () => Object.keys(S.families).map(family => ({name: family, family, oracleArgs: [], lifecycle: family !== 'growth', cases: 1, scenario: family === 'growth' ? null : {items: []}}));
    const calls = [], sleeps = [];
    let failLoads = 2;
    const exec = (script, args) => {
      calls.push([script, ...args]);
      if (args.includes('--load') && failLoads > 0) { failLoads--; return {status: 1, stderr: 'Main layout did not become ready'}; }
      return {status: 0, stdout: args[0] === '--setup' ? 'STATE ' + statePath + '\n' : ''};
    };
    const quiet = () => {}, sleep = async ms => { sleeps.push(ms); };
    const run = await M.runMigration({catalog, proof, copies: copies(), runDir: dir, setupArgs: ['--source', 's'], exec, sleep, log: quiet, digest});
    assert.equal(run.completed, true);
    assert.deepEqual(sleeps, [5000, 5000]);
    assert.equal(run.ui.selectionUi.source, 'native');
    assert.equal(run.ui.qualityUi.source, 'pending');
    for (const group of Object.keys(catalog.verification)) for (const [check, ok] of Object.entries(run.checks[group])) assert.equal(ok, check !== 'qualityUi', group + ': ' + check);
    assert.ok(JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8')).completed);
    assert.ok(!JSON.stringify(run).includes(statePath));

    calls.length = 0;
    let setups = 0;
    const failing = (script, args) => { if (args[0] === '--setup') setups++; if (args.includes('--save') && setups === 2) { calls.push([script, ...args]); return {status: 1, stderr: 'Native manual-save file was not created'}; } return exec(script, args); };
    const failed = await M.runMigration({catalog, proof, copies: copies(), runDir: dir, setupArgs: ['--source', 's'], exec: failing, sleep, log: quiet, digest});
    assert.equal(failed.completed, false);
    assert.equal(failed.copies.length, 2);
    assert.match(failed.copies[1].steps.at(-1).error, /manual-save/);
    assert.deepEqual(calls.at(-1), ['verify-game.cjs', '--state', statePath, '--stop']);
    assert.deepEqual(failed.ui, {});
    assert.ok(Object.values(failed.checks.equipmentAffixCoefficient ?? {}).some(ok => !ok) || !failed.checks.equipmentAffixCoefficient);
  }finally{fs.rmSync(dir, {recursive: true, force: true});}
});
