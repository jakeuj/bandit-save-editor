'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const check = spawnSync(process.execPath, ['scripts/build-editor.cjs', '--check'], {cwd: root, encoding: 'utf8'});
if (check.status !== 0) { console.error(check.stderr || check.stdout || check.error?.message); process.exit(1); }
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
