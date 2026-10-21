const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const script = path.join(repo, 'scripts/extract-game.cjs');
const { createCatalog } = require(script);

test('reviewed event versions cannot be paired with another version runtime', () => {
  const oldEvents = '6661d77209c0e98069219965908fd4d6b9ee3dca84763c158dcd5f0a863df665';
  const newEvents = '32a36accc1b97e9bb3498eb3be76950e1e72b2e8f7a0cf9ce293b57aa5e0d820';
  const oldRuntime = '58d634814f9ee8145ad553ffde60a6a511b5f68cf27f7ba86933d66216901998';
  const newRuntime = '1e1643722efc032824881f03ce4d81df1135e6a8cd8e08d9fd87e56e480ac9f6';
  for (const [events, runtime] of [[oldEvents, newRuntime], [newEvents, oldRuntime]]) {
    assert.throws(() => createCatalog({ fingerprints: { 'data.json': events, 'scripts/c3runtime.js': runtime } }), /JavaScript 指紋已變更/);
  }
});

function fixture(t) {
  const tempRoot = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(tempRoot, 'bandit-extract-'));
  assert.equal(path.dirname(fs.realpathSync(root)), tempRoot);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'game');
  fs.mkdirSync(path.join(source, 'scripts'), { recursive: true });
  const project = [];
  project[3] = Array.from({ length: 13 }, (_, i) => [i === 12 ? 'save' : `object${i}`]);
  project[6] = [['主事件', [[4, ['合成函式'], false, null, 123, 0, [], [
    [12, 0, null, 456, 0, null, [[0, [1]], [0, [2]], [0, [0]], [7, [3]]]]
  ]]]]];
  fs.writeFileSync(path.join(source, 'data.json'), JSON.stringify({ project }));
  fs.writeFileSync(path.join(source, 'scripts/c3runtime.js'), `self.C3_GetObjectRefTable = function () {
  return [
\t\tC3.Plugins.Arr.Acts.SetXYZ,
\t\tC3.Plugins.Arr.Exps.At
  ];
};
self.C3_JsPropNameTable = [];
self.C3_ExpressionFuncs = [() => 0, () => 1, () => 2, () => 5, p => { throw Error('factory must not run'); }];`);
  for (const table of ['cl', 'js', 'zy', 'sx', 'wp', 'kj', 'jz', 'rw', 'tf', 'ss', 'lw']) {
    fs.writeFileSync(path.join(source, `${table}.json`), JSON.stringify({ data: [] }));
  }
  const output = path.join(root, 'catalog.json');
  const glossary = path.join(root, 'traditional-names.json');
  fs.writeFileSync(output, 'catalog sentinel');
  fs.writeFileSync(glossary, 'glossary sentinel');
  const run = (...args) => spawnSync(process.execPath, [script, '--source', source, '--output', output, ...args], { cwd: root, encoding: 'utf8' });
  return { root, source, output, glossary, run };
}

test('unknown sources can be audited without running factories or modifying catalog and glossary', t => {
  const f = fixture(t), audit = path.join(f.root, 'analysis', 'audit.json');
  const result = f.run('--audit-only', '--audit', audit);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { auditOnly: true, functions: 1, setXYZ: 1, arrayActions: 1, readSites: 0 });
  const parsed = JSON.parse(fs.readFileSync(audit, 'utf8'));
  assert.equal(Object.keys(parsed.fingerprints).length, 13);
  assert.equal(parsed.operations[0].actionSid, 456);
  assert.deepEqual(parsed.operations[0].params.map(p => p.constant), [1, 2, 0, 5]);
  assert.equal(fs.readFileSync(f.output, 'utf8'), 'catalog sentinel');
  assert.equal(fs.readFileSync(f.glossary, 'utf8'), 'glossary sentinel');
});

test('normal extraction still rejects unknown event fingerprints before writing knowledge', t => {
  const f = fixture(t), audit = path.join(f.root, 'audit.json');
  const result = f.run('--audit', audit);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /遊戲事件指紋已變更/);
  assert.equal(fs.existsSync(audit), false);
  assert.equal(fs.readFileSync(f.output, 'utf8'), 'catalog sentinel');
  assert.equal(fs.readFileSync(f.glossary, 'utf8'), 'glossary sentinel');
});

test('audit-only requires an external output and rejects repo paths', t => {
  const f = fixture(t);
  const missing = f.run('--audit-only');
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /需要 --audit/);
  const internal = path.join(repo, `${path.basename(f.root)}-audit.json`);
  const rejected = f.run('--audit-only', '--audit', internal);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /原始分析輸出必須放在 repo 外/);
  assert.equal(fs.existsSync(internal), false);
  assert.equal(fs.readFileSync(f.output, 'utf8'), 'catalog sentinel');
});
