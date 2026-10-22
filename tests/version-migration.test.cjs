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
  }finally{fs.rmSync(dir, {recursive: true, force: true});}
});
