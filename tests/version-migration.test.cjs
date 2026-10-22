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
