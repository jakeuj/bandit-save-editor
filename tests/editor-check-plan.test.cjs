'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {fixture, coreSource} = require('./helpers/inspection-fixture.cjs');
const {buildInspection} = require('../scripts/editor-inspection.cjs');
const {changedReport, testCandidates, suggestChecks} = require('../scripts/editor-check-plan.cjs');
const {run} = require('../scripts/inspect-editor.cjs');

test('static test candidates follow helper imports and cycles without executing tests', t => {
  const f = fixture(t), sentinel = path.join(f.root, 'must-not-exist');
  f.write('tests/a.test.cjs', "require('./helpers/a.cjs');");
  f.write('tests/b.test.cjs', "require('./helpers/b.cjs');");
  f.write('tests/helpers/a.cjs', "require('./b.cjs');");
  f.write('tests/helpers/b.cjs', "require('./a.cjs'); const C={}; C.read();");
  f.write('tests/side-effect.test.cjs', "require('node:fs').writeFileSync(" + JSON.stringify(sentinel) + ", 'executed'); const C={};C.read();");
  const candidates = testCandidates(buildInspection({root: f.root}), new Set(['read']));
  for (const name of ['tests/a.test.cjs', 'tests/b.test.cjs', 'tests/read.test.cjs', 'tests/side-effect.test.cjs']) assert.ok(candidates.includes(name), name);
  assert.equal(fs.existsSync(sentinel), false);
});

test('unsupported test syntax is explicit and falls back to complete Node checks', t => {
  const f = fixture(t); f.write('tests/broken.test.cjs', 'const =;');
  const index = buildInspection({root: f.root}), limitations = [];
  testCandidates(index, new Set(['read']), limitations);
  assert.ok(limitations.some(l => l.code === 'TEST_PARSE'));
  const checks = suggestChecks(index, {ids: ['core:read']});
  assert.deepEqual(checks[0].args, ['test']);
  assert.match(checks[0].reason, /broken\.test\.cjs/);
});

test('unresolved and dynamic test helpers are explicit instead of silently narrowing checks', t => {
  const f = fixture(t);
  f.write('tests/imports.test.cjs', "require('./helpers/missing.cjs'); const moduleName='./helpers/unknown'; require(moduleName);");
  const index = buildInspection({root: f.root}), limitations = [];
  testCandidates(index, new Set(['read']), limitations);
  for (const code of ['TEST_IMPORT', 'TEST_DYNAMIC_IMPORT']) assert.ok(limitations.some(l => l.code === code));
  assert.deepEqual(suggestChecks(index, {ids: ['core:read']})[0].args, ['test']);
});

test('clean and documentation-only changes are reported without executing product checks', t => {
  const f = fixture(t); f.initGit();
  assert.deepEqual(changedReport({root: f.root}).suggestedChecks, []);
  f.write('notes.md', '# Synthetic plan\n');
  const report = changedReport({root: f.root});
  assert.deepEqual(report.files, ['notes.md']);
  assert.equal(report.suggestedChecks[0].command, 'git');
  assert.ok(report.suggestedChecks.some(c => c.kind === 'manual'));
  assert.equal(report.suggestedChecks.some(c => c.command === 'npm'), false);
});

test('unstaged, untracked and removed declarations trigger conservative coverage', t => {
  const f = fixture(t); f.initGit();
  f.write('src/core.js', coreSource.replace('  function unused(){return 2;}\n', ''));
  f.write('src/new-source.js', 'const newSource=1;');
  const report = changedReport({root: f.root, base: f.git('rev-parse', 'HEAD').trim()});
  assert.ok(report.files.includes('src/new-source.js'));
  assert.ok(report.limitations.some(l => l.message.includes('unused')));
  assert.ok(report.limitations.some(l => l.message.includes('未追蹤新檔')));
  assert.ok(report.diagnostics.some(d => d.code === 'UNREGISTERED_SOURCE'));
  assert.ok(report.suggestedChecks.some(c => c.command === 'npm' && c.args.includes('test:browser')));
});

test('staged analysis uses Git blobs and the staged assembler/registries, ignoring broken worktree copies', t => {
  const f = fixture(t); f.initGit();
  f.write('src/core.js', coreSource.replace('  globalThis.SaveCore=', '  function stagedOnly(){return 3;}\n  globalThis.SaveCore='));
  f.git('add', 'src/core.js');
  const tree = f.git('write-tree').trim();
  f.write('src/core.js', 'const broken=;');
  f.write('scripts/editor-source.cjs', 'throw Error("working copy must be ignored");');
  f.write('scripts/verification-suite.cjs', 'throw Error("working registry must be ignored");');
  f.write('src/worktree-only.js', 'const worktreeOnly=1;');
  const report = changedReport({root: f.root, staged: true});
  assert.equal(report.snapshotTree, tree);
  assert.deepEqual(report.files, ['src/core.js']);
  assert.deepEqual(report.diagnostics, []);
  assert.ok(report.definitions.some(d => d.name === 'stagedOnly'));
  assert.ok(report.families.some(f => f.name === 'sample'));
  assert.equal(f.git('write-tree').trim(), tree);
});

test('staged documentation does not inspect unrelated unstaged broken product code', t => {
  const f = fixture(t); f.initGit();
  f.write('notes.md', '# Staged docs\n'); f.git('add', 'notes.md');
  f.write('src/core.js', 'const broken=;');
  const report = changedReport({root: f.root, staged: true});
  assert.deepEqual(report.files, ['notes.md']);
  assert.deepEqual(report.diagnostics, []);
  assert.equal(report.suggestedChecks[0].coverage, 'documents');
});

test('a snapshot with an older assembly interface reports its limitation and complete fallback', t => {
  const f = fixture(t); f.initGit();
  f.write('scripts/editor-source.cjs', 'module.exports={};'); f.git('add', 'scripts/editor-source.cjs');
  const report = changedReport({root: f.root, staged: true});
  assert.ok(report.limitations.some(l => l.message.includes('沒有來源位置介面')));
  assert.ok(report.suggestedChecks.some(c => c.args.includes('test:browser')));
});

test('deleted product paths and invalid revisions never produce empty successful advice', t => {
  const f = fixture(t); f.initGit(); fs.unlinkSync(path.join(f.root, 'src/ui.js'));
  const report = changedReport({root: f.root});
  assert.ok(report.limitations.some(l => l.message.includes('刪除：src/ui.js')));
  assert.ok(report.suggestedChecks.some(c => c.args.includes('test:browser')));
  let output;
  assert.equal(run(['--changed', '--base', 'not-a-valid-ref', '--json'], {root: f.root, stdout: s => output = s}), 1);
  assert.ok(JSON.parse(output).error);
});
