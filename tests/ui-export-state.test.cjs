'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {setup} = require('./helpers/ui-harness.cjs');

async function assertDownload(h, name, raw) {
  const download = h.downloads.at(-1);
  assert.equal(download.name, name);
  assert.equal(download.blob.type, 'application/octet-stream');
  const bytes = Buffer.from(await download.blob.arrayBuffer());
  assert.deepEqual(bytes, Buffer.from(raw));
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.ok(bytes.includes(Buffer.from('987654321098765432109876543210')));
  assert.ok(bytes.includes(Buffer.from('1e+03')));
}

for (const button of ['downloadBtn', 'reviewDownloadBtn']) {
  test(`${button}: real Blob bytes and export revision survive reload and later edits`, async () => {
    const h = setup(); await h.load('first.dat'); h.edit(10);
    assert.equal(h.unload(), true);
    await h.load('blocked.dat');
    assert.equal(h.prompts.length, 1); assert.equal(h.$('fileName').textContent, 'first.dat');
    await h.$(button).onclick();
    await assertDownload(h, 'first.modified.dat', h.fixture.expected([[1, 2, 0, 10]]));
    assert.equal(h.unload(), false);
    h.expireDownloads(); assert.equal(h.revoked.length, 1);
    await h.load('second.dat'); assert.equal(h.prompts.length, 1);
    assert.equal(h.$('fileName').textContent, 'second.dat');
    h.edit(20); await h.$(button).onclick(); h.edit(21);
    assert.equal(h.unload(), true);
    await h.load('blocked-again.dat'); assert.equal(h.prompts.length, 2);
    assert.equal(h.$('fileName').textContent, 'second.dat');
  });
}

test('backup preserves original bytes and does not mark edits exported; restore and undo are real UI events', async () => {
  const h = setup(); await h.load('original.dat'); h.edit(10);
  h.$('backupBtn').onclick();
  await assertDownload(h, 'original.original-backup.dat', h.fixture.raw);
  await h.load('blocked.dat'); assert.equal(h.prompts.length, 1);
  h.restore(); assert.equal(h.unload(), false); assert.equal(h.$('pendingCount').textContent, 0);
  h.$('undoBtn').onclick(); assert.equal(h.unload(), true);
  await h.$('downloadBtn').onclick();
  await assertDownload(h, 'original.modified.dat', h.fixture.expected([[1, 2, 0, 10]]));
  h.$('resetBtn').onclick(); assert.equal(h.unload(), false);
  await h.load('restored.dat'); assert.equal(h.prompts.length, 1);
  assert.equal(h.$('fileName').textContent, 'restored.dat');
});

test('malformed JSON, invalid UTF-8, read failure and oversized files preserve the current model', async () => {
  const h = setup(); await h.load('valid.dat'); h.edit(7); h.confirm(true);
  for (const bytes of [Buffer.from('{invalid'), Buffer.from([0xc3, 0x28])]) {
    await h.load('invalid.dat', bytes);
    assert.equal(h.$('fileName').textContent, 'valid.dat');
    assert.equal(h.$('pendingCount').textContent, 1); assert.equal(h.unload(), true);
    assert.equal(h.$('openBtn').disabled, false);
  }
  await h.$('fileInput').onchange({target: {files: [{name: 'unreadable.dat', size: 10, arrayBuffer: async () => { throw Error('read failed'); }}]}});
  assert.equal(h.$('toast').textContent, 'read failed');
  await h.$('fileInput').onchange({target: {files: [{name: 'large.dat', size: 50 * 1024 * 1024 + 1, arrayBuffer: () => { throw Error('must not read'); }}]}});
  assert.match(h.$('toast').textContent, /50 MB/);
  await h.$('fileInput').onchange({target: {files: []}});
  assert.equal(h.$('fileName').textContent, 'valid.dat');
  await h.$('downloadBtn').onclick();
  await assertDownload(h, 'valid.modified.dat', h.fixture.expected([[1, 2, 0, 7]]));
});

test('confirmed replacement and drop input use the same decoder and reset export state', async () => {
  const h = setup(); await h.load('first.dat'); h.edit(9); h.confirm(true);
  await h.load('confirmed.dat');
  assert.equal(h.$('fileName').textContent, 'confirmed.dat'); assert.equal(h.unload(), false);
  h.$('dropZone').ondrop({preventDefault() {}, dataTransfer: {files: [h.file('drop.dat')]}});
  // load() schedules its busy callback as a microtask, then awaits arrayBuffer().
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.$('fileName').textContent, 'drop.dat');
  h.$('backupBtn').onclick(); await assertDownload(h, 'drop.original-backup.dat', h.fixture.raw);
});
