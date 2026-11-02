const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const { insertBefore, normalize, announcements } = require('../scripts/game-update.cjs');
const { reviewedVersions } = require('../scripts/extract-game.cjs');

function copy(t, file) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bandit-game-update-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, path.basename(file));
  fs.copyFileSync(path.join(repo, file), target);
  return target;
}

test('apply appends one reviewed version to the extract-game map', t => {
  const file = copy(t, 'scripts/extract-game.cjs');
  insertBefore(file, '\n};\n\nfunction createCatalog', `  '${'a'.repeat(64)}': { version: 'V9.9.9.9', expressionOffset: 1, runtimes: ['${'b'.repeat(64)}'] }`);
  const text = fs.readFileSync(file, 'utf8'), start = text.indexOf('const reviewedVersions = ') + 'const reviewedVersions = '.length;
  const map = vm.runInNewContext('(' + text.slice(start, text.indexOf('\n};', start) + 2) + ')');
  assert.deepEqual(Object.keys(map).slice(0, -1), Object.keys(reviewedVersions));
  assert.deepEqual({ ...map['a'.repeat(64)], runtimes: [...map['a'.repeat(64)].runtimes] }, { version: 'V9.9.9.9', expressionOffset: 1, runtimes: ['b'.repeat(64)] });
});

test('apply appends one reviewed runtime to the Mac launcher whitelist', t => {
  const file = copy(t, 'launcher/prepare-macos.py');
  insertBefore(file, '\n}\nSTEAM_COMMON', `    "${'c'.repeat(64)}": "V9.9.9.9",`);
  const r = spawnSync('python3', ['-c', 'import ast,sys;t=ast.parse(open(sys.argv[1]).read());d=[n.value for n in t.body if isinstance(n,ast.Assign) and n.targets[0].id=="SCRIPT_SHA256"][0];print(ast.literal_eval(d)[sys.argv[2]])', file, 'c'.repeat(64)], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'V9.9.9.9');
});

test('object renumbering is not an event change', () => {
  assert.equal(normalize('A ["o2","背包",3,[11,42]]'), normalize('A ["o2","仓库",3,[11,57]]'));
  assert.notEqual(normalize('A ["obj","save",1]'), normalize('A ["obj","save",2]'));
});

test('announcements list every version newer than the current knowledge', () => {
  const gg = { data: [[['欢迎']], [['']], [['V1.0.17.0'], ['优化'], ['']], [['V1.0.16.0'], ['修复']], [['V1.0.15.0'], ['旧']]] };
  assert.deepEqual(announcements(gg, 'V1.0.15.0'), [{ version: 'V1.0.17.0', notes: ['优化'] }, { version: 'V1.0.16.0', notes: ['修复'] }]);
});
