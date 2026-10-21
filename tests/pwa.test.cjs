'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const {webcrypto, createHash} = require('node:crypto');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const origin = 'https://example.test';
const scope = origin + '/bandit-save-editor/';
const prefix = `bandit-save-editor:${encodeURIComponent(scope)}:`;

function worker(options = {}) {
  const listeners = {}, stores = options.stores || new Map(), network = [];
  let writes = 0;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        put: async (url, response) => {
          if (++writes === options.failWrite) throw Error('quota');
          entries.set(url, response.clone());
        },
        match: async url => entries.get(url)?.clone()
      };
    }
  };
  const context = {
    URL, Uint8Array, crypto: webcrypto, caches,
    self: {registration: {scope}, addEventListener: (type, fn) => { listeners[type] = fn; }},
    fetch: async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      network.push({url, init});
      if (options.failFetch) return new Response('unavailable', {status: 503});
      const file = new URL(url).pathname.slice('/bandit-save-editor/'.length);
      const bytes = options.corrupt ? 'wrong release' : fs.readFileSync(path.join(root, file));
      return new Response(bytes);
    }
  };
  vm.runInNewContext(options.source || source, context);
  const value = expression => vm.runInNewContext(expression, context);
  return {
    stores, network, value,
    async run(type, extra = {}) {
      let completion;
      listeners[type]({waitUntil: promise => { completion = promise; }, ...extra});
      await completion;
    },
    async request(url, method = 'GET', mode = 'navigate') {
      let response;
      listeners.fetch({request: {url, method, mode}, respondWith: promise => { response = promise; }});
      return response;
    },
    async ready(repair = false) {
      let result;
      await this.run('message', {data: {type: 'PWA_STATUS', repair}, ports: [{postMessage: data => { result = data.ready; }}]});
      return result;
    }
  };
}

test('manifest and generated assets work beneath a project path and are content pinned', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest')));
  assert.equal(manifest.name, '山寨帳房');
  assert.equal(manifest.display, 'standalone');
  // Manifest id resolves against the origin, unlike start_url/scope. Omit it so
  // the browser uses start_url as the app identity, including the project path.
  assert.equal(manifest.id, undefined);
  for (const field of ['start_url', 'scope']) assert.equal(new URL(manifest[field], scope).href, scope);
  const sw = worker();
  for (const asset of sw.value('ASSETS')) {
    assert.equal(asset.sha256, createHash('sha256').update(fs.readFileSync(path.join(root, asset.path))).digest('hex'));
    assert.ok(new URL(asset.path, scope).href.startsWith(scope));
    assert.doesNotMatch(asset.path, /mac\.html|launcher|\.dat|knowledge\//);
  }
  for (const icon of [...manifest.icons, {src: './assets/apple-touch-icon.png', sizes: '180x180'}]) {
    const png = fs.readFileSync(path.join(root, icon.src));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});

test('verified installation caches only the app assets and reports actual readiness', async () => {
  const sw = worker();
  assert.equal(await sw.ready(), false);
  await sw.run('install');
  assert.equal(await sw.ready(), true);
  assert.equal(sw.network.length, sw.value('ASSETS.length'));
  assert.ok(sw.network.every(request => request.init.cache === 'no-store' && request.init.redirect === 'error'));
  sw.stores.get(sw.value('CACHE')).delete(scope + 'manifest.webmanifest');
  assert.equal(await sw.ready(), false);
  assert.equal(await sw.ready(true), true);
  sw.stores.clear();
  assert.equal(await sw.ready(true), true);
});

test('evicted cache cannot be repaired with bytes from another release', async () => {
  const sw = worker({corrupt: true});
  assert.equal(await sw.ready(true), false);
  assert.equal(sw.stores.get(sw.value('CACHE')).size, 0);
});

test('both homepage URLs share the pinned offline response; other routes and methods are untouched', async () => {
  const sw = worker();
  await sw.run('install');
  const expected = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const url of [scope, scope + 'index.html', scope + '?source=app', scope + 'index.html?download=1']) {
    assert.equal(await (await sw.request(url)).text(), expected);
  }
  for (const url of [scope + 'mac.html', scope + 'missing.html', scope + 'launcher/prepare-macos.py', scope + 'save.dat', origin + '/other/', 'https://elsewhere.test/']) {
    assert.equal(await sw.request(url), undefined);
  }
  assert.equal(await sw.request(scope, 'POST'), undefined);
  assert.equal(await sw.request(scope + 'assets/icon-512.png?unknown=1'), undefined);
  assert.ok(await sw.request(scope + 'assets/icon-512.png', 'GET', 'no-cors'));
  assert.equal(sw.network.length, sw.value('ASSETS.length'));
});

test('failed upgrades preserve the previous cache and never cache a partial release', async () => {
  const old = worker();
  await old.run('install');
  const oldCache = old.value('CACHE');
  const nextSource = source.replace(old.value('VERSION'), 'next-release');
  for (const failure of [{failFetch: true}, {corrupt: true}, {failWrite: 2}]) {
    const next = worker({...failure, source: nextSource, stores: old.stores});
    await assert.rejects(next.run('install'));
    assert.ok(old.stores.has(oldCache));
    assert.equal(old.stores.has(next.value('CACHE')), false);
    assert.equal(await old.ready(), true);
  }
});

test('activation removes only this scope’s old caches and never forces a window update', async () => {
  const sw = worker();
  await sw.run('install');
  sw.stores.set(prefix + 'old-release', new Map());
  sw.stores.set('another-app:cache', new Map());
  sw.stores.set('bandit-save-editor:https%3A%2F%2Fexample.test%2Fother%2F:old', new Map());
  await sw.run('activate');
  assert.deepEqual([...sw.stores.keys()].sort(), [sw.value('CACHE'), 'another-app:cache', 'bandit-save-editor:https%3A%2F%2Fexample.test%2Fother%2F:old'].sort());
  assert.doesNotMatch(source, /\bskipWaiting\s*\(|\bclients\.claim\s*\(/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'src/pwa.js'), 'utf8'), /location\.reload\s*\(/);
});

test('build check catches stale releases; changes to icons, HTML and worker code change the version', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bandit-pwa-build-'));
  try {
    for (const file of ['scripts', 'src', 'knowledge', 'assets', 'index.html', 'sw.js', 'manifest.webmanifest']) {
      fs.cpSync(path.join(root, file), path.join(dir, file), {recursive: true});
    }
    const build = (...args) => spawnSync(process.execPath, ['scripts/build-editor.cjs', ...args], {cwd: dir, encoding: 'utf8'});
    assert.equal(build('--check').status, 0);
    let previous = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
    for (const file of ['manifest.webmanifest', 'assets/icon-192.png', 'index.html', 'src/service-worker.js', 'src/pwa.js']) {
      fs.appendFileSync(path.join(dir, file), '\n');
      // pwa.js is trimmed during embedding; use a meaningful code edit for it.
      if (file === 'src/pwa.js') fs.appendFileSync(path.join(dir, file), '// changed build\n');
      assert.notEqual(build('--check').status, 0, file);
      assert.equal(build().status, 0, file);
      const next = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
      assert.notEqual(next.match(/const VERSION = '(.*?)'/)[1], previous.match(/const VERSION = '(.*?)'/)[1], file);
      assert.equal(build('--check').status, 0, file);
      previous = next;
    }
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('replacement gate rejects missing or stale independent proof', () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bandit-affix-proof-'));
 try{
  for(const file of ['scripts','src','knowledge','assets','index.html','sw.js','manifest.webmanifest'])fs.cpSync(path.join(root,file),path.join(dir,file),{recursive:true});
  const catalogPath=path.join(dir,'knowledge/catalog.json'),proofPath=path.join(dir,'knowledge/verification.json');
  const k=JSON.parse(fs.readFileSync(catalogPath)),p=JSON.parse(fs.readFileSync(proofPath));k.verification.equipmentAffixReplacement=true;p.groups.equipmentAffixReplacement=true;
  fs.writeFileSync(catalogPath,JSON.stringify(k));delete p.affixReplacement;fs.writeFileSync(proofPath,JSON.stringify(p));
  const run=()=>spawnSync(process.execPath,['scripts/build-editor.cjs'],{cwd:dir,encoding:'utf8'});
  assert.match(run().stderr,/精準洗練/);
  p.affixReplacement={checks:{nativeEffects:true,load:true,save:true,restart:true,originalHashes:true,equipmentCycle:true,nativeWash:true},fingerprints:{...k.fingerprints,...k.batch2Fingerprints},limits:k.affixReplacementLimits,dataHash:'wrong'};
  fs.writeFileSync(proofPath,JSON.stringify(p));assert.match(run().stderr,/精準洗練/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});


test('equipment workflow independently rejects stale rules and first-selection without native UI evidence',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bandit-workflow-proof-'));
 try{
  for(const file of ['scripts','src','knowledge','assets','index.html','sw.js','manifest.webmanifest'])fs.cpSync(path.join(root,file),path.join(dir,file),{recursive:true});
  const catalogPath=path.join(dir,'knowledge/catalog.json'),proofPath=path.join(dir,'knowledge/verification.json');
  const k=JSON.parse(fs.readFileSync(catalogPath)),p=JSON.parse(fs.readFileSync(proofPath));
  const run=()=>spawnSync(process.execPath,['scripts/build-editor.cjs'],{cwd:dir,encoding:'utf8'});
  const validHash=p.equipmentWorkflow.dataHash;k.verification.backpackEquipmentLevel=true;p.groups.backpackEquipmentLevel=true;
  p.equipmentWorkflow.dataHash='stale';fs.writeFileSync(catalogPath,JSON.stringify(k));fs.writeFileSync(proofPath,JSON.stringify(p));assert.match(run().stderr,/裝備操作/);
  p.equipmentWorkflow.dataHash=validHash;p.equipmentWorkflow.groups.backpackEquipmentLevel.checks.restart=false;fs.writeFileSync(proofPath,JSON.stringify(p));assert.match(run().stderr,/裝備操作/);
  p.equipmentWorkflow.groups.backpackEquipmentLevel.checks.restart=true;k.verification.equipmentAffixInitialSelection=true;p.groups.equipmentAffixInitialSelection=true;
  p.equipmentWorkflow.groups.equipmentAffixInitialSelection.checks.selectionUi=false;
  fs.writeFileSync(catalogPath,JSON.stringify(k));fs.writeFileSync(proofPath,JSON.stringify(p));assert.match(run().stderr,/equipmentAffixInitialSelection/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
