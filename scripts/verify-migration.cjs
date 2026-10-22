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
const Caps = require('./random-character-skill-caps-proof.cjs');
const Talents = require('./random-character-talents-proof.cjs');
// First-opening proofs that representative migrations may carry forward but never create.
const initialProblemOf = group => group === Caps.group ? Caps.initialProblem : group === Talents.group ? Talents.initialProblem : () => '缺少首次證明檢查';
const root = path.resolve(__dirname, '..');
// Lifecycle scripts that can re-read their results after the new-PID restart.
const comparable = new Set(['verify-talents-lifecycle.cjs','verify-skill-caps-lifecycle.cjs','verify-random-character-lifecycle.cjs', 'verify-equipment-workflow.cjs', 'verify-quality-lifecycle.cjs']);

// Ordered CLI steps for one copy. '{state}' is replaced by the state path that setup prints.
function steps(copy, setupArgs) {
  const family = S.families[copy.family], scenario = copy.scenarioFile ? ['--scenario', copy.scenarioFile] : [];
  const game = (step, ...args) => ({step, script: 'verify-game.cjs', args: ['--state', '{state}', ...args]});
  // --stop only signals the process; --restart refuses until it has exited, so it is retried like boot-time loads.
  const restart = tag => [game('stop', '--stop'), {...game('restart', '--restart'), retry: true}, {...game('restartLoad', '--load', '--mode', '存档'), retry: true}, game(tag, '--assert', '--quiet')];
  const oracle = compare => family.oracle ? [{step: compare ? 'oracleCompare' : 'oracle', script: family.oracle, args: ['--state', '{state}', ...scenario, ...copy.oracleArgs, ...(compare ? ['--compare'] : [])]}] : [];
  const list = [
    {step: 'setup', script: 'verify-game.cjs', args: ['--setup', ...setupArgs, ...scenario, ...(copy.batchRequestsFile ? ['--batch-requests', copy.batchRequestsFile] : [])]},
    {...game('load', '--load', '--mode', '云存档'), retry: true},
    ...oracle(false), ...(family.formulas && copy.formulas!==false ? [{step: 'formulas', script: family.oracle, args: ['--state', '{state}', ...scenario, '--formulas']}] : []), game('save', '--save'), game('assert', '--assert', '--quiet'), ...restart('reload'), ...oracle(true)
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
function provenChecks(copies, ui = {}, skillCapsBinding, catalog) {
  const familyRan = family => copies.some(c => c.family === family);
  const passed = (family, step) => {
    const ran = copies.filter(c => c.family === family).flatMap(c => c.steps.filter(s => s.step === step));
    return ran.length > 0 && ran.every(s => s.ok) && copies.filter(c => c.family === family).every(c => c.ok !== false);
  };
  const result = {};
  for (const [family, spec] of Object.entries(S.families)) for (const group of spec.groups) {
    const owners=check=>require('./migration-analysis.cjs').owners(group,check);
    if (!familyRan(family)&&!R.requiredChecks(group).some(check=>owners(check).some(familyRan))) continue;
    if (family === Caps.group) {
      const derived = copies.filter(c => c.family === family).map(c => { try { return catalog&&c.evidence?.scenario?.skillCapCoverage==='representative'?Caps.validateMigrationCopy(c,catalog,skillCapsBinding):Caps.copyChecks(c, skillCapsBinding); } catch { return null; } });
      result[group] = Object.fromEntries(R.requiredChecks(group).map(check => {
        const owners = derived.filter(c => c && Object.hasOwn(c, check));
        return [check, derived.every(Boolean) && owners.length > 0 && owners.every(c => c[check] === true)];
      }));
      continue;
    }
    const section = R.sectionOf(group), peers = Object.keys(S.families).filter(name => familyRan(name) && S.families[name].groups.some(g => R.sectionOf(g) === section));
    result[group] = Object.fromEntries(R.requiredChecks(group).map(check => {
      if(spec.pendingReason)return [check,false];
      if (check === R.uiChecks[group]) return [check, ui[check]?.source === 'carried' || ui[check]?.source === 'native'];
      return [check, owners(check).some(name => familyRan(name) && passed(name, S.families[name].checks[check]))];
    }));
  }
  return result;
}

const defaultExec = (script, args, timeout) => spawnSync(process.execPath, [path.join(__dirname, script), ...args], {cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, timeout});
const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runCopy(copy, setupArgs, {exec, sleep, log, skillCapsBinding, catalog}) {
  const record = {name: copy.name, family: copy.family, cases: copy.cases, lifecycle: !!copy.lifecycle, steps: []};
  if(S.families[copy.family].pendingReason)return {...record,ok:false,steps:[{step:'pending',ok:false,error:S.families[copy.family].pendingReason}]};
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
    if (!ok) {
      const lines = String(result.stderr || result.error || result.stdout || '').split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('at '));
      const subject = lines.findIndex(line => /(?:AssertionError|TypeError|RangeError|Error)(?:\s|:|\[)/.test(line));
      entry.error = lines.slice(Math.max(0, subject), Math.max(0, subject) + 3).join(' ').slice(0, 600);
      const artifactIndex = setupArgs.indexOf('--artifacts'), failureDir = state ? path.dirname(state) : artifactIndex >= 0 ? setupArgs[artifactIndex + 1] : null;
      if (failureDir && fs.existsSync(failureDir)) {
        const file = `${copy.name}-${record.steps.length + 1}-${step.step}.log`.replace(/[^a-zA-Z0-9_.-]/g, '_');
        fs.writeFileSync(path.join(failureDir, file), `STDOUT\n${result.stdout || ''}\nSTDERR\n${result.stderr || result.error || ''}`);
        entry.errorLog = file;
      }
    }
    record.steps.push(entry);
    log(`${copy.name} ${step.step} ${path.basename(step.script)} ${ok ? 'ok' : 'FAILED'}`);
    if (!ok) {
      if (state && step.step !== 'stop') exec('verify-game.cjs', ['--state', state, '--stop'], 60 * 1000);
      break;
    }
  }
  record.ok = record.steps.every(s => s.ok) && record.steps.length === steps(copy, setupArgs).length;
  record.state = state;
  if (copy.family === Talents.group && record.ok) {
    try { record.evidence = Talents.readEvidence(state); }
    catch (error) { record.ok = false; record.steps.push({step: 'evidence', ok: false, error: error.message}); log(`${copy.name} evidence FAILED: ${error.message}`); }
  }
  if (copy.family === Caps.group && record.ok) {
    try {
      const s = JSON.parse(fs.readFileSync(state, 'utf8')), read = name => JSON.parse(fs.readFileSync(path.join(s.dir, name), 'utf8'));
      record.scenarioHash = Caps.sha(copy.scenario); record.batchHash = Caps.sha(copy.batchRequests || []);
      record.evidence = {scenario: copy.scenario, batchRequests: copy.batchRequests || [],
        source: {fingerprints: s.fingerprints, sourceHashes: s.sourceHashes, runtimePatch: s.runtimePatch, originalFileHashes: Object.values(s.before || {}), assertions: s.assertions},
        effects: read('skill-caps-effects.json'), ...(copy.lifecycle ? {lifecycle: read('skill-caps-lifecycle.json')} : {})};
      if(copy.scenario.skillCapCoverage==='representative')Caps.validateMigrationCopy(record,catalog,skillCapsBinding);else Caps.copyChecks(record, skillCapsBinding);
    } catch (error) { record.ok = false; record.steps.push({step: 'evidence', ok: false, error: error.message}); log(`${copy.name} evidence FAILED: ${error.message}`); }
  }
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

async function runMigration({catalog, proof, copies, runDir, setupArgs, exec = defaultExec, sleep = defaultSleep, log = console.log, digest, keepCopies = false, remove = defaultRemove, identity, resume = false}) {
  const A=require('./migration-analysis.cjs'), checkpointFile=path.join(runDir,'checkpoint.json');
  const warnings=[], completedCopies=[];
  const checkpoint=resume&&fs.existsSync(checkpointFile)?JSON.parse(fs.readFileSync(checkpointFile,'utf8')):null;
  if(resume&&(!identity||checkpoint?.version!==1||checkpoint.identity!==identity))throw Error('Resume input identity does not match');
  if(checkpoint&&(!Array.isArray(checkpoint.copies)||new Set(checkpoint.copies.map(c=>c.record.name)).size!==checkpoint.copies.length||checkpoint.copies.some(c=>!copies.some(copy=>copy.name===c.record.name))))throw Error('Resume copy manifest does not match');
  const evidenceFiles=state=>Object.fromEntries(fs.readdirSync(path.dirname(state)).filter(n=>/\.json$/.test(n)).map(n=>{const file=path.join(path.dirname(state),n);return [file,A.sha(fs.readFileSync(file))];}));
  const saveCheckpoint=()=>{if(identity){const temp=checkpointFile+'.tmp';fs.writeFileSync(temp,JSON.stringify({version:1,identity,copies:completedCopies},null,2));fs.renameSync(temp,checkpointFile);}};
  if(!resume)saveCheckpoint();
  const prune=target=>{try{const actual=fs.realpathSync(target),rel=path.relative(fs.realpathSync(runDir),actual);if(!rel||path.isAbsolute(rel)||rel==='..'||rel.startsWith('..'+path.sep))throw Error('Cleanup target escaped run directory');remove(target);}catch(e){if(e.code!=='ENOENT')warnings.push({step:'cleanup',target:path.basename(target),error:e.message});}};
  // One formula matrix per family/source binding, shared by its independent save scenarios.
  const formulas=new Set();
  for(const copy of copies)if(S.families[copy.family].formulas&&copy.formulas!==false){copy.formulas=!formulas.has(copy.family);formulas.add(copy.family);}
  const skillCapsBinding = copies.some(c => c.family === Caps.group) ? Caps.binding(catalog, fs.readFileSync(path.join(root, 'src/core.js'), 'utf8')) : undefined;
  for (const copy of copies) if (copy.scenario) {
    copy.scenarioFile = path.join(runDir, copy.name + '.json');
    fs.writeFileSync(copy.scenarioFile, JSON.stringify(copy.scenario));
    if (copy.batchRequests) {
      copy.batchRequestsFile = path.join(runDir, copy.name + '-batch.json');
      fs.writeFileSync(copy.batchRequestsFile, JSON.stringify(copy.batchRequests));
    }
  }
  const records = [];
  let digests;
  for (const copy of copies) {
    const saved=checkpoint?.copies.find(c=>c.record.name===copy.name), copyHash=A.sha({name:copy.name,family:copy.family,cases:copy.cases,scenario:copy.scenario||null,batch:copy.batchRequests||[],lifecycle:copy.lifecycle,formulas:copy.formulas??null});
    let record;
    if(saved){
      if(saved.copyHash!==copyHash||saved.recordHash!==A.sha(saved.record)||!saved.record.ok||Object.entries(saved.files).some(([file,hash])=>!fs.existsSync(file)||A.sha(fs.readFileSync(file))!==hash))throw Error('Resume evidence does not match: '+copy.name);
      record=saved.record; digests??=saved.digests;
      log(copy.name+' reused');
    }else record = await runCopy(copy, setupArgs, {exec, sleep, log, skillCapsBinding, catalog});
    records.push(record);
    if (!record.ok) break;
    // Digest the UI events from the first passing copy before its game folder is pruned.
    if(digest)digests ??= Object.fromEntries(Object.entries(R.uiEvents).map(([check, sids]) => [check, digest(JSON.parse(fs.readFileSync(record.state, 'utf8')).game, sids)]));
    completedCopies.push(saved||{copyHash,record,recordHash:A.sha(record),files:evidenceFiles(record.state),digests});
    saveCheckpoint();
    // A passing copy keeps its state, logs and JSON evidence; the game folder and profile are only needed to debug failures.
    if (!keepCopies) for (const name of ['game', 'profile']) prune(path.join(path.dirname(record.state), name));
  }
  const completed = records.length === copies.length && records.every(r => r.ok);
  if (completed && !keepCopies) for (const name of ['BANDIT Editor Test.app', 'BANDIT Editor Test.source.json']) prune(path.join(runDir, name));
  const ui = completed && digests ? uiEvidence(digests, proof, catalog.gameVersion) : {};
  const results = {date: new Date().toISOString(), gameVersion: catalog.gameVersion, platform: `${process.platform}-${process.arch}`, completed, warnings, copies: records.map(({state, ...r}) => r), ui, ...(skillCapsBinding ? {skillCapsBinding} : {}), checks: provenChecks(records, ui, skillCapsBinding,catalog)};
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
const sameFingerprints = (left, right) => !!left && !!right && Object.keys(left).length === Object.keys(right).length && Object.entries(left).every(([file, hash]) => Object.hasOwn(right, file) && right[file] === hash);

// The proof the build gate expects for this catalog, from a completed representative run.
function buildProof({catalog, results, coreSource, steamBuild, previous}) {
  const date = results.date.slice(0, 10), all = {...catalog.fingerprints, ...catalog.batch2Fingerprints}, checks = results.checks;
  const caps = !Caps.initialProblem(previous[Caps.group]?.initialVerification) ? Caps.validateResults(catalog, coreSource, results, {initial: false}) : null;
  const talents = !Talents.initialProblem(previous[Talents.group]?.initialVerification) ? (() => { try { return Talents.validateResults(catalog, coreSource, results, {initial: false}); } catch { return null; } })() : null;
  const opened = group => (group !== Caps.group || !!caps) && (group !== Talents.group || !!talents) && !S.families[S.familyOf(group)].pendingReason && R.requiredChecks(group).every(c=>checks[group]?.[c]===true);
  const coverage = family => ({coverage: 'representative', copies: results.copies.filter(c => c.family === family).map(c => ({name: c.name, operations: c.cases}))});
  const formulasPassed = results.copies.some(c => c.family === 'equipmentQuality' && c.steps.some(s => s.step === 'formulas' && s.ok));
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
    ...(caps ? {randomCharacterSkillCaps:Caps.record(catalog,coreSource,{date,platform:results.platform,...caps,initialVerification:previous[Caps.group].initialVerification,...coverage(Caps.group)})} : {}),
    ...(talents ? {randomCharacterTalents:Talents.record(catalog,coreSource,{date,platform:results.platform,...talents,initialVerification:previous[Talents.group].initialVerification,coverage:'representative'})} : {}),
    randomCharacterGrowth: require('./random-character-growth-proof.cjs').record(catalog,coreSource,{date,platform:results.platform,checks:checks.randomCharacterBaseAptitudes,...coverage('randomCharacterGrowth')}),
    equipmentQuality: {date, gameVersion: catalog.gameVersion, fingerprints: all, dataHash: sha({quality: catalog.equipmentQuality, items, workflow: catalog.equipmentWorkflowLimits}), ...(formulasPassed ? {formulaHash: sha(qualityFormula(coreSource)), formulaCases: Object.keys(catalog.equipmentQuality.items).length * 24 + Object.keys(catalog.affixReplacement.attributes).length * 20} : {}), groups: perGroup('equipmentQuality'), ...coverage('equipmentQuality')}
  };
}

// Writes the new proof and gates only when every native check passed on a build the current proof does not cover;
// a build failure restores every touched file. On the proven build it only compares, keeping the existing proof.
function writeBack({dir = root, catalog, proof, results, steamBuild, exec = (script, args) => spawnSync(process.execPath, [path.join(dir, 'scripts', script), ...args], {cwd: dir, encoding: 'utf8'})}) {
  const needsInitial = group => S.families[S.familyOf(group)]?.initialProofRequired && initialProblemOf(group)(proof[group]?.initialVerification);
  const allGroups=Object.keys(catalog.verification),groups=allGroups.filter(g=>!S.families[S.familyOf(g)]?.pendingReason&&!needsInitial(g));
  if(allGroups.some(g=>S.families[S.familyOf(g)]?.pendingReason&&catalog.verification[g]))return {action:'skipped',reason:'未完成的原生群組不可開啟'};
  if(allGroups.some(g=>needsInitial(g)&&catalog.verification[g]))return {action:'skipped',reason:'缺少首次完整矩陣證明；代表遷移不可首次開放'};
  if (!results.completed || groups.some(group => !results.checks[group])) return {action: 'skipped', reason: '流水線未完成或未涵蓋全部群組'};
  const failing = groups.filter(group => R.requiredChecks(group).some(check => results.checks[group]?.[check] !== true && check !== R.uiChecks[group]));
  if(groups.includes(Talents.group))try{Talents.validateResults(catalog,fs.readFileSync(path.join(dir,'src/core.js'),'utf8'),results,{initial:false});}catch(error){if(!failing.includes(Talents.group))failing.push(Talents.group);}
  if(groups.includes(Caps.group))try{Caps.validateResults(catalog,fs.readFileSync(path.join(dir,'src/core.js'),'utf8'),results,{initial:false});}catch(error){if(!failing.includes(Caps.group))failing.push(Caps.group);}
  const comparison = allGroups.map(group => ({group, existing: Object.values(recordedChecks(proof, group)).every(Boolean) && catalog.verification[group] === true, migrated: !needsInitial(group) && !failing.includes(group) && !S.families[S.familyOf(group)]?.pendingReason && R.requiredChecks(group).every(check=>results.checks[group]?.[check]===true), ...(S.families[S.familyOf(group)]?.pendingReason?{pending:S.families[S.familyOf(group)].pendingReason}:needsInitial(group)?{pending:'首次完整矩陣須以獨立證明合併'}:{})}));
  if (sameFingerprints(proof.fingerprints, catalog.fingerprints) && sameFingerprints(proof.batch2?.fingerprints, catalog.batch2Fingerprints))
    return {action: 'compared', consistent: failing.length === 0 && comparison.every(c => c.existing === c.migrated), failing, comparison};
  if (failing.length) return {action: 'skipped', reason: '原生 checks 未全部通過', failing};
  const files = ['knowledge/catalog.json', 'knowledge/verification.json', 'index.html', 'sw.js'].map(file => path.join(dir, file)), backup = files.map(file => fs.readFileSync(file));
  let next;
  try {
    next = buildProof({catalog, results, coreSource: fs.readFileSync(path.join(dir, 'src/core.js'), 'utf8'), steamBuild, previous: proof});
    const gated = {...catalog, verification: {...next.groups}};
    fs.writeFileSync(files[0], JSON.stringify(gated, null, 2) + '\n');
    fs.writeFileSync(files[1], JSON.stringify(next, null, 2) + '\n');
    for (const args of [[], ['--check']]) { const r = exec('build-editor.cjs', args); if (r.status !== 0) throw Error(String(r.stderr || r.stdout).trim()); }
  } catch (error) {
    files.forEach((file, i) => fs.writeFileSync(file, backup[i]));
    return {action: 'restored', reason: error.message};
  }
  return {action: 'written', opened: groups.filter(group => next.groups[group]), closed: allGroups.filter(group => !next.groups[group])};
}

async function main() { return require("./migration-cli.cjs").main({runMigration,provenChecks,writeBack}); }
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = {steps, provenChecks, uiEvidence, runMigration, buildProof, writeBack};
