'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png'};

// A candidate site is a disposable build of the current source with the named flags opened or closed and the proof gate removed.
// It exists only to exercise unproven UI paths in a browser; it is never a release artifact and never touches the repo.
async function buildCandidate(dir, spec) {
  const {open = [], close = []} = Array.isArray(spec) ? {open: spec} : spec;
  for (const folder of ['scripts', 'src', 'knowledge']) await fs.cp(path.join(root, folder), path.join(dir, folder), {recursive: true});
  const catalogFile = path.join(dir, 'knowledge/catalog.json'), catalog = JSON.parse(await fs.readFile(catalogFile, 'utf8'));
  for (const [flags, value] of [[open, true], [close, false]]) for (const flag of flags) { if (!Object.hasOwn(catalog.verification, flag)) throw Error('Unknown candidate flag ' + flag); catalog.verification[flag] = value; }
  await fs.writeFile(catalogFile, JSON.stringify(catalog, null, 2));
  const builder = path.join(dir, 'scripts/build-editor.cjs'), gate = 'if(open.length){', source = await fs.readFile(builder, 'utf8');
  if (!source.includes(gate)) throw Error('Candidate builder gate not found');
  await fs.writeFile(builder, source.replace(gate, 'if(false){'));
  execFileSync(process.execPath, [builder], {cwd: dir});
}

async function createSite({candidate} = {}) {
  const port = Number(process.env.BANDIT_BROWSER_PORT || 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid BANDIT_BROWSER_PORT');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bandit-site-'));
  const files = ['index.html', 'sw.js', 'manifest.webmanifest', ...(await fs.readdir(path.join(root, 'assets'))).map(f => 'assets/' + f)];
  await fs.mkdir(path.join(dir, 'assets'));
  await Promise.all(files.map(file => fs.copyFile(path.join(root, file), path.join(dir, file))));
  if (candidate) await buildCandidate(dir, candidate);
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
      if (!candidate) for (const folder of ['scripts', 'src', 'knowledge']) await fs.cp(path.join(root, folder), path.join(dir, folder), {recursive: true});
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
