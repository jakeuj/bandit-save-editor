'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {EventEmitter} = require('node:events');
const {unsafePorts, listenLoopback} = require('./browser/loopback.cjs');

// A server whose listen binds the next port in a script, or emits an error, so the OS draw can be forced.
function scriptedServer(ports) {
  const server = new EventEmitter(), calls = [];
  let bound = null;
  server.listen = (port, host, callback) => {
    calls.push({port, host});
    const next = ports.shift();
    if (next instanceof Error) process.nextTick(() => server.emit('error', next));
    else process.nextTick(() => { bound = next; callback(); });
  };
  server.address = () => ({port: bound});
  server.close = callback => { calls.push('close'); bound = null; process.nextTick(callback); };
  return {server, calls};
}

test('Chromium 封鎖清單含實際撞到的 5060 與 6566', () => {
  for (const port of [5060, 6566, 6000, 10080]) assert.ok(unsafePorts.has(port), port);
  for (const port of [8942, 49152, 65535]) assert.ok(!unsafePorts.has(port), port);
});

test('隨機埠落在 unsafe port 時關閉後重新 listen', async () => {
  const {server, calls} = scriptedServer([5060, 6566, 8942]);
  assert.equal(await listenLoopback(server, 0), 8942);
  assert.deepEqual(calls, [{port: 0, host: '127.0.0.1'}, 'close', {port: 0, host: '127.0.0.1'}, 'close', {port: 0, host: '127.0.0.1'}]);
  assert.equal(server.listenerCount('error'), 0);
});

test('隨機埠一直被封鎖時有上限並報錯', async () => {
  const {server, calls} = scriptedServer([5060, 6566, 5061]);
  await assert.rejects(listenLoopback(server, 0, 3), /Chromium-blocked ports; last 5061/);
  assert.equal(calls.filter(c => c === 'close').length, 3);
});

test('指定 BANDIT_BROWSER_PORT 時不重試也不換埠', async () => {
  const unsafe = scriptedServer([5060, 8942]);
  assert.equal(await listenLoopback(unsafe.server, 5060), 5060);
  assert.deepEqual(unsafe.calls, [{port: 5060, host: '127.0.0.1'}]);
  const busy = scriptedServer([Object.assign(Error('listen EADDRINUSE'), {code: 'EADDRINUSE'}), 8942]);
  await assert.rejects(listenLoopback(busy.server, 8942), {code: 'EADDRINUSE'});
  assert.deepEqual(busy.calls, [{port: 8942, host: '127.0.0.1'}]);
});

test('真實 http server 拿到非封鎖的 loopback 埠', async () => {
  const server = http.createServer((req, res) => res.end('ok'));
  const port = await listenLoopback(server, 0);
  try {
    assert.ok(port > 0 && !unsafePorts.has(port));
    assert.equal(await (await fetch(`http://127.0.0.1:${port}/`)).text(), 'ok');
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
});
