/* Generated as sw.js by build-editor.cjs. Only public app assets enter this cache. */
'use strict';
const VERSION = '__PWA_VERSION__';
const ASSETS = /*__PWA_ASSETS__*/[];
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
