'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png'};

async function createSite() {
  const port = Number(process.env.BANDIT_BROWSER_PORT || 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid BANDIT_BROWSER_PORT');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bandit-site-'));
  const files = ['index.html', 'sw.js', 'manifest.webmanifest', ...(await fs.readdir(path.join(root, 'assets'))).map(f => 'assets/' + f)];
  await fs.mkdir(path.join(dir, 'assets'));
  await Promise.all(files.map(file => fs.copyFile(path.join(root, file), path.join(dir, file))));
  const server = http.createServer(async (req, res) => {
    try {
      const requested = new URL(req.url, 'http://localhost').pathname;
      const file = requested === '/' ? 'index.html' : requested.slice(1);
      if (!['GET', 'HEAD'].includes(req.method) || !files.includes(file)) { res.writeHead(404); res.end(); return; }
      const bytes = await fs.readFile(path.join(dir, file));
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { res.writeHead(500); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return {
    dir, url: `http://127.0.0.1:${server.address().port}/`,
    async upgrade() {
      // Build a second release in the disposable copy using the production builder.
      for (const folder of ['scripts', 'src', 'knowledge']) await fs.cp(path.join(root, folder), path.join(dir, folder), {recursive: true});
      const html = await fs.readFile(path.join(dir, 'index.html'), 'utf8');
      await fs.writeFile(path.join(dir, 'index.html'), html.replace('<html ', '<html data-test-release="next" '));
      execFileSync(process.execPath, [path.join(dir, 'scripts/build-editor.cjs')], {cwd: dir});
      execFileSync(process.execPath, [path.join(dir, 'scripts/build-editor.cjs'), '--check'], {cwd: dir});
    },
    async close() {
      await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
      await fs.rm(dir, {recursive: true, force: true});
    }
  };
}
module.exports = {createSite};
