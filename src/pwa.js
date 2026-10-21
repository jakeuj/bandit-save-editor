(() => {
  'use strict';
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (!window.isSecureContext || !('serviceWorker' in navigator) ||
      !(location.protocol === 'https:' || (location.protocol === 'http:' && localHost))) return;

  const button = document.getElementById('installBtn');
  const status = document.getElementById('pwaStatus');
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let promptEvent = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvent = event;
    button.hidden = standalone();
  });
  window.addEventListener('appinstalled', () => { promptEvent = null; button.hidden = true; });
  button.addEventListener('click', async () => {
    if (!promptEvent) return;
    const event = promptEvent;
    promptEvent = null;
    button.hidden = true;
    try { await event.prompt(); await event.userChoice; } catch { /* Browser installation is optional. */ }
  });

  status.hidden = false;
  status.textContent = '正在準備離線使用…';
  const base = new URL('./', location.href);
  navigator.serviceWorker.register(new URL('sw.js', base).href, {scope: base.href, updateViaCache: 'none'}).then(registration => {
    let check = 0;
    async function refreshStatus() {
      const current = ++check;
      const worker = registration.active;
      if (!worker) return;
      const ready = await new Promise(resolve => {
        const channel = new MessageChannel();
        const finish = value => { clearTimeout(timer); channel.port1.close(); resolve(value); };
        const timer = setTimeout(() => finish(false), 15000);
        channel.port1.onmessage = event => finish(event.data?.type === 'PWA_STATUS' && event.data.ready === true);
        try { worker.postMessage({type: 'PWA_STATUS', repair: navigator.onLine}, [channel.port2]); } catch { finish(false); }
      });
      if (current !== check) return;
      status.textContent = ready ? '可離線使用' : '離線快取尚未就緒，請先匯出並關閉所有帳房視窗，再連線開啟';
      if (registration.waiting) status.textContent += ' · 新版已備妥，關閉所有帳房視窗後更新';
    }
    function watch(worker) {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' || worker.state === 'activated') refreshStatus();
        if (worker.state === 'redundant') {
          if (registration.active) refreshStatus();
          else status.textContent = '離線準備失敗，目前仍可使用編輯器；請連線後重試';
        }
      });
    }
    watch(registration.installing);
    registration.addEventListener('updatefound', () => watch(registration.installing));
    refreshStatus();
    navigator.serviceWorker.ready.then(refreshStatus);
    window.addEventListener('online', refreshStatus);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshStatus(); });
  }).catch(() => {
    status.textContent = '此環境無法準備離線快取，仍可下載單檔 HTML';
  });
})();
