'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('the changelog leads with the editor release shown in the sidebar and both entry points open it',()=>{
  const [, version, date] = html.match(/id="versionBtn"[^>]*>修改器 (v[\d.]+) · ([\d.]+)</) || [];
  assert.ok(version, 'sidebar editor version missing');
  const dialog = html.match(/<dialog id="changelogDialog">[\s\S]*?<\/dialog>/)?.[0];
  assert.ok(dialog, 'changelog dialog missing');
  const entries = [...dialog.matchAll(/<h3>(v[\d.]+)<span>([\d.]+) · ([^<]+)<\/span><\/h3>/g)].map(m => ({version: m[1], date: m[2], game: m[3]}));
  assert.deepEqual([entries[0].version, entries[0].date], [version, date], 'add a changelog entry for each new editor release');
  assert.equal(new Set(entries.map(e => e.version)).size, entries.length);
  for (const e of entries) assert.match(e.game, /遊戲 V\d|未綁定遊戲版本/, e.version);
  assert.match(html, /\$\('changelogBtn'\)\.onclick=\$\('versionBtn'\)\.onclick=\(\)=>\$\('changelogDialog'\)\.showModal\(\);/);
});
