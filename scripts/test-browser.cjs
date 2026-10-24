'use strict';
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');
const {configuredPort, listenLoopback} = require('../tests/browser/loopback.cjs');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const check = spawnSync(process.execPath, ['scripts/build-editor.cjs', '--check'], {cwd: root, encoding: 'utf8'});
if (check.status !== 0) { console.error(check.stderr || check.stdout || check.error?.message); process.exit(1); }

// A local filter (for example AdGuard) can rewrite HTML on loopback ports. The PWA hashes then never match and every offline
// case fails as 「離線準備失敗」, so serve index.html once on the port the tests will use and stop before running them.
async function loopbackServesExactBytes() {
  const port = configuredPort();
  const bytes = fs.readFileSync(path.join(root, 'index.html'));
  const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'});
    res.end(bytes);
  });
  const bound = await listenLoopback(server, port);
  try {
    const url = `http://127.0.0.1:${bound}/index.html`, rewritten = [];
    // A page navigation and a subresource fetch, like the page load and the service worker install.
    for (const [kind, headers] of [['頁面導覽', {accept: 'text/html,application/xhtml+xml', 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate'}], ['子資源請求', {accept: '*/*'}]]) {
      const served = Buffer.from(await (await fetch(url, {headers})).arrayBuffer());
      if (!served.equals(bytes)) rewritten.push(`${kind}（${served.length} bytes，原檔 ${bytes.length} bytes）`);
    }
    return {port: bound, fixed: port !== 0, rewritten};
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
}

(async () => {
const probe = await loopbackServesExactBytes();
if (probe.rewritten.length) {
  console.error(`本機 127.0.0.1:${probe.port}${probe.fixed ? '' : '（隨機埠）'} 回傳的 index.html 被改寫：${probe.rewritten.join('、')}。`);
  console.error('通常是本機內容過濾器（例如 AdGuard）注入腳本；PWA 雜湊會對不上，離線案例全部失敗，所以沒有開跑。');
  console.error(probe.fixed
    ? `BANDIT_BROWSER_PORT=${probe.port} 也被改寫；請在過濾器放行這個埠，或改設其他已放行的埠；見 docs/testing.md。`
    : `請改用過濾器已放行的埠，例如設 BANDIT_BROWSER_PORT=8942（PowerShell：$env:BANDIT_BROWSER_PORT='8942'），或在過濾器加 127.0.0.1 的例外；見 docs/testing.md。`);
  // process.exit right after the probe's sockets close trips a libuv assertion on Windows.
  process.exitCode = 1;
  return;
}
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'bandit-browser-'));
const visual = args.includes('--visual');
const child = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test',
  '--config', path.join(root, 'tests/browser/playwright.config.cjs'), ...args.filter(a => a !== '--visual')], {
  cwd: root, stdio: 'inherit', env: {...process.env, BANDIT_BROWSER_ARTIFACTS: artifacts, BANDIT_BROWSER_VISUAL: visual ? '1' : ''}
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
child.once('error', error => { console.error(error.message); fs.rmSync(artifacts, {recursive: true, force: true}); process.exitCode = 1; });
child.once('exit', (code, signal) => {
  if (code === 0 && !visual) fs.rmSync(artifacts, {recursive: true, force: true});
  else console.log(`Browser artifacts: ${artifacts}`);
  process.exitCode = signal || code === null ? 1 : code;
});
})().catch(error => { console.error(error.message); process.exitCode = 1; });
