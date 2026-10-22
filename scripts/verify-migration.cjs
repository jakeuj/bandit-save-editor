#!/usr/bin/env node
'use strict';
// Re-verifies every write group on disposable game copies: generates representative scenarios, replays the existing
// isolated CLI steps for each copy, and records which required checks were proven. Outputs stay outside the repo.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const S = require('./verification-suite.cjs');
const R = require('./verification-requirements.cjs');
const root = path.resolve(__dirname, '..');
// Lifecycle scripts that can re-read their results after the new-PID restart.
const comparable = new Set(['verify-equipment-workflow.cjs', 'verify-quality-lifecycle.cjs']);

// Ordered CLI steps for one copy. '{state}' is replaced by the state path that setup prints.
function steps(copy, setupArgs) {
  const family = S.families[copy.family], scenario = copy.scenarioFile ? ['--scenario', copy.scenarioFile] : [];
  const game = (step, ...args) => ({step, script: 'verify-game.cjs', args: ['--state', '{state}', ...args]});
  // --stop only signals the process; --restart refuses until it has exited, so it is retried like boot-time loads.
  const restart = tag => [game('stop', '--stop'), {...game('restart', '--restart'), retry: true}, {...game('restartLoad', '--load', '--mode', '存档'), retry: true}, game(tag, '--assert', '--quiet')];
  const oracle = compare => family.oracle ? [{step: compare ? 'oracleCompare' : 'oracle', script: family.oracle, args: ['--state', '{state}', ...scenario, ...copy.oracleArgs, ...(compare ? ['--compare'] : [])]}] : [];
  const list = [
    {step: 'setup', script: 'verify-game.cjs', args: ['--setup', ...setupArgs, ...scenario]},
    {...game('load', '--load', '--mode', '云存档'), retry: true},
    ...oracle(false), ...(family.formulas ? [{step: 'formulas', script: family.oracle, args: ['--state', '{state}', ...scenario, '--formulas']}] : []), game('save', '--save'), game('assert', '--assert', '--quiet'), ...restart('reload'), ...oracle(true)
  ];
  if (copy.lifecycle) {
    const scripts = family.lifecycle || [];
    list.push(...scripts.map(script => ({step: 'lifecycle', script, args: ['--state', '{state}', ...scenario]})));
    list.push({...game('lifecycle', '--save')}, game('lifecycle', '--assert', '--quiet'), ...restart('lifecycle'));
    list.push(...scripts.filter(script => comparable.has(script)).map(script => ({step: 'lifecycle', script, args: ['--state', '{state}', ...scenario, '--compare']})));
  }
  list.push(game('stop', '--stop'));
  return list;
}

// Required checks proven by the recorded copies. A check holds when at least one copy of an owning family ran its step
// and every such step passed; lifecycle steps run only on marked copies. Groups whose families did not run are left
// out. UI checks hold only for native or carried UI evidence.
function provenChecks(copies, ui = {}) {
  const familyRan = family => copies.some(c => c.family === family);
  const passed = (family, step) => {
    const ran = copies.filter(c => c.family === family).flatMap(c => c.steps.filter(s => s.step === step));
    return ran.length > 0 && ran.every(s => s.ok) && copies.filter(c => c.family === family).every(c => c.ok !== false);
  };
  const result = {};
  for (const [family, spec] of Object.entries(S.families)) for (const group of spec.groups) {
    if (!familyRan(family)) continue;
    const section = R.sectionOf(group), peers = Object.keys(S.families).filter(name => familyRan(name) && S.families[name].groups.some(g => R.sectionOf(g) === section));
    result[group] = Object.fromEntries(R.requiredChecks(group).map(check => {
      if (check === R.uiChecks[group]) return [check, ui[check]?.source === 'carried' || ui[check]?.source === 'native'];
      return [check, peers.some(name => S.families[name].checks[check] && passed(name, S.families[name].checks[check]))];
    }));
  }
  return result;
}

const defaultExec = (script, args, timeout) => spawnSync(process.execPath, [path.join(__dirname, script), ...args], {cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, timeout});
const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runCopy(copy, setupArgs, {exec, sleep, log}) {
  const record = {name: copy.name, family: copy.family, cases: copy.cases, lifecycle: !!copy.lifecycle, steps: []};
  let state;
  for (const step of steps(copy, setupArgs)) {
    const args = step.args.map(a => a === '{state}' ? state : a), started = Date.now();
    let result;
    for (let attempt = 0; attempt < (step.retry ? 6 : 1); attempt++) {
      if (attempt) await sleep(5000);
      result = exec(step.script, args, 20 * 60 * 1000);
      if (result.status === 0) break;
    }
    const ok = result.status === 0, entry = {step: step.step, script: step.script, args: args.filter(a => a !== state).filter(a => !String(a).startsWith(os.homedir())), ok, seconds: Math.round((Date.now() - started) / 1000)};
    if (step.step === 'setup' && ok) state = /STATE (.+)/.exec(result.stdout)?.[1]?.trim();
    if (!ok) entry.error = String(result.stderr || result.error || '').split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('at ')).slice(-3).join(' ').slice(0, 400);
    record.steps.push(entry);
    log(`${copy.name} ${step.step} ${path.basename(step.script)} ${ok ? 'ok' : 'FAILED'}`);
    if (!ok) {
      if (state && step.step !== 'stop') exec('verify-game.cjs', ['--state', state, '--stop'], 60 * 1000);
      break;
    }
  }
  record.ok = record.steps.every(s => s.ok) && record.steps.length === steps(copy, setupArgs).length;
  record.state = state;
  return record;
}

// UI evidence for the tested build: carried when the declared UI events digest the same as the current proof.
function uiEvidence(digests, proof, gameVersion) {
  const records = {selectionUi: proof.equipmentWorkflow?.groups?.equipmentAffixInitialSelection?.uiEvidence, qualityUi: proof.equipmentQuality?.groups?.equipmentQualityUpgrade?.uiEvidence};
  return Object.fromEntries(Object.entries(R.uiEvents).map(([check, sids]) => {
    const eventDigest = digests[check], previous = records[check];
    if (previous?.eventDigest !== eventDigest) return [check, {source: 'pending', gameVersion, eventSids: sids, eventDigest}];
    if (previous.gameVersion === gameVersion) return [check, previous];
    return [check, {source: 'carried', gameVersion, eventSids: sids, eventDigest, carriedFrom: {gameVersion: previous.gameVersion, eventDigest}}];
  }));
}

const defaultRemove = target => fs.rmSync(target, {recursive: true, force: true, maxRetries: 5, retryDelay: 1000});

async function runMigration({catalog, proof, copies, runDir, setupArgs, exec = defaultExec, sleep = defaultSleep, log = console.log, digest, keepCopies = false, remove = defaultRemove}) {
  for (const copy of copies) if (copy.scenario) {
    copy.scenarioFile = path.join(runDir, copy.name + '.json');
    fs.writeFileSync(copy.scenarioFile, JSON.stringify(copy.scenario));
  }
  const records = [];
  let digests;
  for (const copy of copies) {
    const record = await runCopy(copy, setupArgs, {exec, sleep, log});
    records.push(record);
    if (!record.ok) break;
    // Digest the UI events from the first passing copy before its game folder is pruned.
    digests ??= Object.fromEntries(Object.entries(R.uiEvents).map(([check, sids]) => [check, digest(JSON.parse(fs.readFileSync(record.state, 'utf8')).game, sids)]));
    // A passing copy keeps its state, logs and JSON evidence; the game folder and profile are only needed to debug failures.
    if (!keepCopies) for (const name of ['game', 'profile']) remove(path.join(path.dirname(record.state), name));
  }
  const completed = records.length === copies.length && records.every(r => r.ok);
  if (completed && !keepCopies) for (const name of ['BANDIT Editor Test.app', 'BANDIT Editor Test.source.json']) remove(path.join(runDir, name));
  const ui = completed && digests ? uiEvidence(digests, proof, catalog.gameVersion) : {};
  const results = {date: new Date().toISOString(), gameVersion: catalog.gameVersion, platform: `${process.platform}-${process.arch}`, completed, copies: records.map(({state, ...r}) => r), ui, checks: provenChecks(records, ui)};
  fs.writeFileSync(path.join(runDir, 'results.json'), JSON.stringify(results, null, 2));
  return results;
}

const sha = value => require('node:crypto').createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const qualityFormula = coreSource => coreSource.match(/ function qualityAttributeEffect\([\s\S]*?(?= function previewEquipmentQualityChange)/)?.[0].replace(/\r\n/g, '\n');
function recordedChecks(proof, group) {
  const section = R.sectionOf(group);
  const checks = section === 'base' ? proof.checks : section === 'batch2' ? proof.batch2?.checks : section === 'affixReplacement' ? proof.affixReplacement?.checks : proof[section]?.groups?.[group]?.checks;
  return Object.fromEntries(R.requiredChecks(group).map(check => [check, checks?.[check] === true]));
}
const pick = (checks, names) => Object.fromEntries(names.map(name => [name, checks[name] === true]));

// The proof the build gate expects for this catalog, from a completed representative run.
function buildProof({catalog, results, coreSource, steamBuild, previous}) {
  const date = results.date.slice(0, 10), all = {...catalog.fingerprints, ...catalog.batch2Fingerprints}, checks = results.checks;
  const opened = group => Object.values(checks[group]).every(Boolean);
  const coverage = family => ({coverage: 'representative', copies: results.copies.filter(c => c.family === family).map(c => ({name: c.name, operations: c.cases}))});
  const formulasPassed = results.copies.filter(c => c.family === 'equipmentQuality').every(c => c.steps.some(s => s.step === 'formulas' && s.ok));
  const uiRecord = group => R.uiChecks[group] ? {uiEvidence: results.ui[R.uiChecks[group]]} : {};
  const groups = Object.fromEntries(Object.keys(catalog.verification).map(group => [group, opened(group) && (R.sectionOf(group) !== 'equipmentQuality' || formulasPassed)]));
  const perGroup = section => Object.fromEntries(R.sections[section].groups.map(group => [group, {checks: checks[group], ...uiRecord(group)}]));
  const items = catalog.batch2Data.items;
  return {
    date, gameVersion: catalog.gameVersion, steamBuildId: steamBuild || null,
    eventFingerprint: catalog.fingerprints['data.json'], runtimeFingerprint: catalog.fingerprints['scripts/c3runtime.js'], fingerprints: catalog.fingerprints,
    environment: `${results.platform}；獨立遊戲、runtime、profile 與存檔；真實 Steam 初始化`,
    method: 'verify-migration.cjs 代表子集：每個副本以原版函式載入、原生存檔、停止後新 PID 重啟讀回，並執行原生效果與後續操作',
    checks: pick(checks[R.sections.base.groups[0]], R.sections.base.checks), groups,
    scenarios: results.copies.map(c => c.name),
    limits: ['代表子集，不是原版本的完整矩陣；各副本與操作數見各區段 copies', '未驗證真實雲端上傳、成就或統計寫入', `UI 證據依事件摘要${Object.values(results.ui).map(u => u.source).join('／')}`],
    editingLimits: catalog.editingLimits,
    migration: {runner: 'verify-migration.cjs', previousGameVersion: previous.gameVersion, completed: results.completed},
    advancedEditing: {date, ...coverage('advanced')},
    batch2: {date, gameVersion: catalog.gameVersion, fingerprints: catalog.batch2Fingerprints, limits: catalog.batch2Limits, dataHash: sha(catalog.batch2Data), checks: pick(checks[R.sections.batch2.groups[0]], R.sections.batch2.checks), ...coverage('batch2')},
    affixReplacement: {date, gameVersion: catalog.gameVersion, fingerprints: all, limits: catalog.affixReplacementLimits, dataHash: sha({rules: catalog.affixReplacement, items}), checks: checks.equipmentAffixReplacement, ...coverage('affixReplacement')},
    equipmentWorkflow: {date, platform: results.platform, gameVersion: catalog.gameVersion, fingerprints: all, limits: catalog.equipmentWorkflowLimits, dataHash: sha({rules: catalog.equipmentWorkflowLimits, items, formulas: catalog.affixReplacement}), groups: perGroup('equipmentWorkflow'), ...coverage('equipmentWorkflow')},
    equipmentQuality: {date, gameVersion: catalog.gameVersion, fingerprints: all, dataHash: sha({quality: catalog.equipmentQuality, items, workflow: catalog.equipmentWorkflowLimits}), ...(formulasPassed ? {formulaHash: sha(qualityFormula(coreSource)), formulaCases: Object.keys(catalog.equipmentQuality.items).length * 24 + Object.keys(catalog.affixReplacement.attributes).length * 20} : {}), groups: perGroup('equipmentQuality'), ...coverage('equipmentQuality')}
  };
}

// Writes the new proof and gates only when every native check passed on a build the current proof does not cover;
// a build failure restores every touched file. On the proven build it only compares, keeping the existing proof.
function writeBack({dir = root, catalog, proof, results, steamBuild, exec = (script, args) => spawnSync(process.execPath, [path.join(dir, 'scripts', script), ...args], {cwd: dir, encoding: 'utf8'})}) {
  const groups = Object.keys(catalog.verification);
  if (!results.completed || groups.some(group => !results.checks[group])) return {action: 'skipped', reason: '流水線未完成或未涵蓋全部群組'};
  const failing = groups.filter(group => Object.entries(results.checks[group]).some(([check, ok]) => !ok && check !== R.uiChecks[group]));
  const comparison = groups.map(group => ({group, existing: Object.values(recordedChecks(proof, group)).every(Boolean) && catalog.verification[group] === true, migrated: Object.values(results.checks[group]).every(Boolean)}));
  if (JSON.stringify(proof.fingerprints) === JSON.stringify(catalog.fingerprints) && JSON.stringify(proof.batch2?.fingerprints) === JSON.stringify(catalog.batch2Fingerprints))
    return {action: 'compared', consistent: failing.length === 0 && comparison.every(c => c.existing === c.migrated), failing, comparison};
  if (failing.length) return {action: 'skipped', reason: '原生 checks 未全部通過', failing};
  const files = ['knowledge/catalog.json', 'knowledge/verification.json', 'index.html', 'sw.js'].map(file => path.join(dir, file)), backup = files.map(file => fs.readFileSync(file));
  const next = buildProof({catalog, results, coreSource: fs.readFileSync(path.join(dir, 'src/core.js'), 'utf8'), steamBuild, previous: proof});
  const gated = {...catalog, verification: {...next.groups}};
  try {
    fs.writeFileSync(files[0], JSON.stringify(gated, null, 2) + '\n');
    fs.writeFileSync(files[1], JSON.stringify(next, null, 2) + '\n');
    for (const args of [[], ['--check']]) { const r = exec('build-editor.cjs', args); if (r.status !== 0) throw Error(String(r.stderr || r.stdout).trim()); }
  } catch (error) {
    files.forEach((file, i) => fs.writeFileSync(file, backup[i]));
    return {action: 'restored', reason: error.message};
  }
  return {action: 'written', opened: groups.filter(group => next.groups[group]), closed: groups.filter(group => !next.groups[group])};
}

async function main() {
  const args = process.argv.slice(2), opt = key => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
  if (args.includes('--help') || !opt('--source') || !opt('--runtime') || !opt('--save-file') || !opt('--artifacts')) {
    console.log('Node 22+: verify-migration.cjs --source PREPARED_GAME --runtime NWJS --save-file BASE.dat --artifacts OUTSIDE_REPO [--package STEAM_GAME_DIR (macOS)] [--catalog CATALOG.json] [--copies name,name] [--keep-copies]');
    return;
  }
  const artifacts = fs.realpathSync(opt('--artifacts')), rel = path.relative(root, artifacts);
  if (!rel || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep))) throw Error('Validation artifacts must stay outside the repo');
  const catalogPath = path.resolve(opt('--catalog') || path.join(root, 'knowledge/catalog.json')), catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const proof = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/verification.json'), 'utf8'));
  const {buildScenarios} = require('./migration-scenarios.cjs'), {inspectGame, eventDigest} = require('./extract-game.cjs');
  const only = opt('--copies')?.split(',');
  const copies = buildScenarios({catalog, saveText: fs.readFileSync(opt('--save-file'), 'utf8')}).filter(c => !only || only.includes(c.name));
  const runDir = fs.mkdtempSync(path.join(artifacts, 'migration-'));
  const setupArgs = ['--source', opt('--source'), '--runtime', opt('--runtime'), '--save-file', opt('--save-file'), '--artifacts', runDir, '--catalog', catalogPath, ...(opt('--package') ? ['--package', opt('--package')] : [])];
  const results = await runMigration({catalog, proof, copies, runDir, setupArgs, keepCopies: args.includes('--keep-copies'), digest: (dir, sids) => eventDigest(inspectGame(dir), sids)});
  if (!only) {
    // The Steam manifest sits two levels above the game directory; its build id is recorded when present.
    const manifest = opt('--package') && path.join(path.resolve(opt('--package')), '../../appmanifest_4267800.acf');
    const steamBuild = manifest && fs.existsSync(manifest) ? /"buildid"\s+"(\d+)"/.exec(fs.readFileSync(manifest, 'utf8'))?.[1] : null;
    results.writeBack = writeBack({catalog, proof, results, steamBuild});
    fs.writeFileSync(path.join(runDir, 'results.json'), JSON.stringify(results, null, 2));
    console.log('WRITE-BACK ' + JSON.stringify(results.writeBack).slice(0, 2000));
  }
  console.log(`RESULTS ${path.join(runDir, 'results.json')}`);
  console.log(results.completed ? 'PASS: every copy completed' : 'FAILED: see results for the failing copy and step');
  if (!results.completed || ['restored', 'skipped'].includes(results.writeBack?.action) || results.writeBack?.consistent === false) process.exitCode = 1;
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = {steps, provenChecks, uiEvidence, runMigration, buildProof, writeBack};
