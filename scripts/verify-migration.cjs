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
  const restart = tag => [game('stop', '--stop'), game('restart', '--restart'), {...game('restartLoad', '--load', '--mode', '存档'), retry: true}, game(tag, '--assert', '--quiet')];
  const oracle = compare => family.oracle ? [{step: compare ? 'oracleCompare' : 'oracle', script: family.oracle, args: ['--state', '{state}', ...scenario, ...copy.oracleArgs, ...(compare ? ['--compare'] : [])]}] : [];
  const list = [
    {step: 'setup', script: 'verify-game.cjs', args: ['--setup', ...setupArgs, ...scenario]},
    {...game('load', '--load', '--mode', '云存档'), retry: true},
    ...oracle(false), game('save', '--save'), game('assert', '--assert', '--quiet'), ...restart('reload'), ...oracle(true)
  ];
  if (copy.lifecycle) {
    const scripts = family.lifecycle || [];
    list.push(...scripts.map(script => ({step: 'lifecycle', script, args: ['--state', '{state}', ...scenario]})));
    list.push({...game('lifecycle', '--save')}, game('lifecycle', '--assert', '--quiet'), ...restart('lifecycle'));
    list.push(...scripts.filter(script => comparable.has(script)).map(script => ({step: 'lifecycle', script, args: ['--state', '{state}', '--compare']})));
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
    if (!ok) entry.error = String(result.stderr || result.error || '').trim().split('\n').slice(-3).join(' ').slice(0, 400);
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
function uiEvidence(gameDir, proof, gameVersion, digest) {
  const records = {selectionUi: proof.equipmentWorkflow?.groups?.equipmentAffixInitialSelection?.uiEvidence, qualityUi: proof.equipmentQuality?.groups?.equipmentQualityUpgrade?.uiEvidence};
  return Object.fromEntries(Object.entries(R.uiEvents).map(([check, sids]) => {
    const eventDigest = digest(gameDir, sids), previous = records[check];
    if (previous?.eventDigest !== eventDigest) return [check, {source: 'pending', gameVersion, eventSids: sids, eventDigest}];
    if (previous.gameVersion === gameVersion) return [check, previous];
    return [check, {source: 'carried', gameVersion, eventSids: sids, eventDigest, carriedFrom: {gameVersion: previous.gameVersion, eventDigest}}];
  }));
}

async function runMigration({catalog, proof, copies, runDir, setupArgs, exec = defaultExec, sleep = defaultSleep, log = console.log, digest}) {
  for (const copy of copies) if (copy.scenario) {
    copy.scenarioFile = path.join(runDir, copy.name + '.json');
    fs.writeFileSync(copy.scenarioFile, JSON.stringify(copy.scenario));
  }
  const records = [];
  for (const copy of copies) {
    const record = await runCopy(copy, setupArgs, {exec, sleep, log});
    records.push(record);
    if (!record.ok) break;
  }
  const completed = records.length === copies.length && records.every(r => r.ok);
  const gameDir = records.find(r => r.state) && JSON.parse(fs.readFileSync(records.find(r => r.state).state, 'utf8')).game;
  const ui = completed && gameDir ? uiEvidence(gameDir, proof, catalog.gameVersion, digest) : {};
  const results = {date: new Date().toISOString(), gameVersion: catalog.gameVersion, platform: `${process.platform}-${process.arch}`, completed, copies: records.map(({state, ...r}) => r), ui, checks: provenChecks(records, ui)};
  fs.writeFileSync(path.join(runDir, 'results.json'), JSON.stringify(results, null, 2));
  return results;
}

async function main() {
  const args = process.argv.slice(2), opt = key => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
  if (args.includes('--help') || !opt('--source') || !opt('--runtime') || !opt('--save-file') || !opt('--artifacts')) {
    console.log('Node 22+: verify-migration.cjs --source PREPARED_GAME --runtime NWJS --save-file BASE.dat --artifacts OUTSIDE_REPO [--package STEAM_GAME_DIR (macOS)] [--catalog CATALOG.json] [--copies name,name]');
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
  const results = await runMigration({catalog, proof, copies, runDir, setupArgs, digest: (dir, sids) => eventDigest(inspectGame(dir), sids)});
  console.log(`RESULTS ${path.join(runDir, 'results.json')}`);
  console.log(results.completed ? 'PASS: every copy completed' : 'FAILED: see results for the failing copy and step');
  if (!results.completed) process.exitCode = 1;
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = {steps, provenChecks, uiEvidence, runMigration};
