/* Generated as sw.js by build-editor.cjs. Only public app assets enter this cache. */
'use strict';
const VERSION = 'fbc4abb133cd3a5bcd28384322767bbd2a3267ea207c10d8d070cc7c2c0dc95d';
const ASSETS = [{"path":"index.html","sha256":"f6e72d1715c76fb5b9de9a4de6e36aca7c5d6c5128e8ff7c6658416668d1ccc4"},{"path":"manifest.webmanifest","sha256":"00d4b7566e2dc0960d98e8da8358b3425b31a391f595aed0f927a84285e273b4"},{"path":"assets/favicon.svg","sha256":"89133e03936a6316de246ec49aa1ac2c523a1a879d089806d9729ec9cb5c38ae"},{"path":"assets/icon-192.png","sha256":"a21be695e45999cce506a34d0f97989ac906220f15b620f9e944f6daf9dfb18d"},{"path":"assets/icon-512.png","sha256":"ec4c276b64c611cb468b1c1b95ed31a2b327ca0719154b376b1322998c503ece"},{"path":"assets/icon-maskable-512.png","sha256":"f2c1755211c0f1a90f2ac2d5d459f8a5491cb248a808c52cafa49558d559418c"},{"path":"assets/apple-touch-icon.png","sha256":"6b5f3759349dd6c5ffed9dad4e7e26eea2a4f2ebbae57008d26e0662ad88c13a"}];
const PREFIX = `bandit-save-editor:${encodeURIComponent(self.registration.scope)}:`;
const CACHE = PREFIX + VERSION;
const ROOT = new URL('./', self.registration.scope);
const HOME = new URL('index.html', ROOT).href;
const URLS = ASSETS.map(asset => new URL(asset.path, ROOT).href);

async function populateCache() {
  // Verify the entire release before writing: a partial Pages rollout must not mix versions.
  const responses = await Promise.all(ASSETS.map(async asset => {
    const response = await fetch(new URL(asset.path, ROOT).href, {cache: 'no-store', redirect: 'error'});
    if (!response.ok || response.type === 'opaque') throw new Error('PWA asset unavailable');
    const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== asset.sha256) throw new Error('PWA asset version mismatch');
    return response;
  }));
  try {
    const cache = await caches.open(CACHE);
    await Promise.all(responses.map((response, i) => cache.put(URLS[i], response)));
  } catch (error) {
    await caches.delete(CACHE);
    throw error;
  }
}

self.addEventListener('install', event => {
  // Do not skipWaiting: existing windows may contain unexported edits.
  event.waitUntil(populateCache());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
    // Do not claim existing windows or reload them.
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== ROOT.origin) return;
  const isHome = url.pathname === ROOT.pathname || url.pathname === new URL(HOME).pathname;
  const key = isHome ? HOME : url.href;
  if (!URLS.includes(key)) return;
  // Unknown pages, files and external links always use their real network response.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(key) || fetch(event.request);
  })());
});

let repairPromise;
self.addEventListener('message', event => {
  if (event.data?.type !== 'PWA_STATUS' || !event.ports[0]) return;
  event.waitUntil((async () => {
    // Cache eviction must not leave a misleading ready indicator.
    const cache = await caches.open(CACHE);
    let ready = (await Promise.all(URLS.map(url => cache.match(url)))).every(Boolean);
    if (!ready && event.data.repair === true) {
      try {
        if (!repairPromise) repairPromise = populateCache().finally(() => { repairPromise = null; });
        await repairPromise;
        ready = true;
      } catch { /* Offline or a different release is online; never cache unverified bytes. */ }
    }
    event.ports[0].postMessage({type: 'PWA_STATUS', ready});
  })());
});
