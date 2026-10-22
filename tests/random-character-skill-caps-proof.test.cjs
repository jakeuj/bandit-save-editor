'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const P=require('../scripts/random-character-skill-caps-proof.cjs'),R=require('../scripts/verification-requirements.cjs'),S=require('../scripts/verification-suite.cjs'),M=require('../scripts/verify-migration.cjs');
const {mergeProof,recordProof}=require('../scripts/verify-skill-caps-suite.cjs');
const k=structuredClone(require('../knowledge/catalog.json')),old=structuredClone(require('../knowledge/verification.json')),core=fs.readFileSync('src/core.js','utf8'),root=path.resolve(__dirname,'..');
// Exercise first-opening behavior independently of whether the shipping catalog is already open.
k.verification[P.group]=false;delete old[P.group];delete old.groups[P.group];
const checks=()=>Object.fromEntries(R.requiredChecks(P.group).map(c=>[c,true]));
const validation={version:1,runner:'verify-skill-caps-suite.cjs',matrixCases:108,lifecycleCases:2,manifestHash:'a'.repeat(64),evidenceHash:'b'.repeat(64)};
// This structural unit fixture is never written into the product catalog or presented as native evidence.
const record=()=>P.record(k,core,{date:'2026-10-22',platform:'synthetic-test-only',checks:checks(),coverage:'initial-matrix',copies:[{name:'random-skill-caps-matrix',operations:108},{name:'random-skill-caps-lifecycle',operations:2}],validation});
const directory=()=>fs.mkdtempSync(path.join(os.tmpdir(),'bandit-caps-proof-'));
const copyRepo=dir=>{fs.cpSync(root,dir,{recursive:true,filter:p=>!/[\\/](\.git|graphify-out|node_modules)([\\/]|$)/.test(p)});fs.writeFileSync(path.join(dir,'knowledge/catalog.json'),JSON.stringify(k));fs.writeFileSync(path.join(dir,'knowledge/verification.json'),JSON.stringify(old));};

test('cap proof binds 15 sources, rules, all checks, entire core, complete initial ancestry and native evidence digest',()=>{
 const proof={...old,[P.group]:record()};assert.equal(P.problem(k,proof,core),null);assert.ok(P.problem(k,old,core));
 for(const file of Object.keys(record().fingerprints))for(const missing of [false,true]){
  const p=structuredClone(proof);if(missing)delete p[P.group].fingerprints[file];else p[P.group].fingerprints[file]='f'.repeat(64);assert.ok(P.problem(k,p,core),file);
 }
 for(const check of R.requiredChecks(P.group)){const p=structuredClone(proof);delete p[P.group].groups[P.group].checks[check];assert.ok(P.problem(k,p,core),check);}
 for(const key of ['validation','initialVerification']){const p=structuredClone(proof);delete p[P.group][key];assert.ok(P.problem(k,p,core),key);}
 for(const key of ['manifestHash','evidenceHash','formulaHash','fingerprints']){const p=structuredClone(proof);delete p[P.group].initialVerification[key];assert.ok(P.problem(k,p,core),key);}
 for(const change of [n=>n.randomCharacterSkillCaps.ranges[0].primary[0]++,n=>n.randomCharacterSkillCaps.talents[1].excludedPrimary.push(1),n=>n.randomCharacterSkillCaps.weights[0][0][0]++,n=>delete n.batch2Fingerprints['yx.json']]){
  const n=structuredClone(k);change(n);if(JSON.stringify(n)!==JSON.stringify(k))assert.ok(P.problem(n,proof,core));
 }
 for(const token of ['function skillCapCombinations','function transaction','function addExperience','function serialize','function resolveField'])assert.ok(P.problem(k,proof,core.replace(token,token+'Changed')));
 assert.equal(require('../scripts/random-character-growth-proof.cjs').problem(k,old,core),null,'the old aptitude proof is not rewritten');
 assert.throws(()=>P.record(k,core,{date:'2026-10-22',checks:checks()}),/首次完整矩陣/);
});

test('all-true flags and CLI exit zero without raw reports cannot prove or merge the new family',async()=>{
 const dir=directory(),before=JSON.stringify(old),family=P.group;
 try{
  const copy={name:'random-skill-caps-representative',family,oracleArgs:[],lifecycle:false,cases:2,steps:S.steps.map(step=>({step,ok:true})),ok:true};
  assert.ok(Object.values(M.provenChecks([copy])[family]).every(v=>v===false));
  const state=path.join(dir,'state.json');fs.writeFileSync(state,JSON.stringify({dir,game:dir}));
  const run=await M.runMigration({catalog:k,proof:old,copies:[copy],runDir:dir,setupArgs:[],exec:()=>({status:0,stdout:'STATE '+state}),sleep:async()=>{},log:()=>{}});
  assert.equal(run.completed,false);assert.equal(run.copies[0].steps.at(-1).step,'evidence');assert.ok(Object.values(run.checks[family]).every(v=>v===false));
  for(const completed of [false,true])assert.throws(()=>mergeProof({catalog:k,proof:old,coreSource:core,results:{completed,checks:{[family]:checks()},copies:[copy]}}));
  assert.equal(JSON.stringify(old),before);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('migration scenario wires batch input and independent lifecycle while initial manifests contain all 108 cases',()=>{
 const {saveFixture}=require('./helpers/save-fixture.cjs'),{buildSkillCapScenarios}=require('../scripts/random-character-skill-caps-scenarios.cjs');
 const saveText=saveFixture({characters:120}).raw,copies=buildSkillCapScenarios({catalog:k,saveText});
 assert.deepEqual(S.uncovered([P.group]),[]);assert.equal(copies.length,2);assert.deepEqual(copies.map(c=>c.cases),[2,2]);
 assert.ok(copies[0].scenario.observe.some(c=>c.join(',')==='2,48,2'));
 const setup=M.steps({...copies[0],scenarioFile:'/synthetic/scenario.json',batchRequestsFile:'/synthetic/batch.json'},[]).find(s=>s.step==='setup');
 assert.deepEqual(setup.args.slice(-2),['--batch-requests','/synthetic/batch.json']);
 const steps=M.steps({...copies[1],scenarioFile:'/synthetic/scenario.json'},[]);
 assert.ok(steps.some(s=>s.script==='verify-skill-caps-lifecycle.cjs'&&s.args.includes('--compare')));
 const full=buildSkillCapScenarios({catalog:k,saveText,representative:false});assert.deepEqual(full.map(c=>c.cases),[108,2]);
 assert.equal(new Set(full[0].scenario.skillCapManifest.map(c=>[c.quality,c.primary,c.direction].join(':'))).size,108);
 const C=require('../scripts/verify-game.cjs').loadCore(k);
 assert.throws(()=>require('../scripts/verify-game.cjs').editSave(C,saveText,{operations:[{method:'set',options:{}}]}),/Unsupported/);
 const family=S.families[P.group],lifecycle=family.lifecycle;try{delete family.lifecycle;assert.ok(S.uncovered([P.group]).some(s=>s.includes('nativeRecruitment')));}finally{family.lifecycle=lifecycle;}
});

test('builder rejects all-true synthetic proof; same-fingerprint migration never writes or first-opens the group',()=>{
 const dir=directory();
 try{
  copyRepo(dir);
  const kp=path.join(dir,'knowledge/catalog.json'),pp=path.join(dir,'knowledge/verification.json'),candidate=structuredClone(k);candidate.verification[P.group]=true;
  fs.writeFileSync(kp,JSON.stringify(candidate));const build=()=>spawnSync(process.execPath,['scripts/build-editor.cjs'],{cwd:dir,encoding:'utf8'});
  assert.match(build().stderr,/技藝上限缺少相符/);
  const fabricated={...P.binding(k,core),groups:{[P.group]:{checks:checks()}}};
  fs.writeFileSync(pp,JSON.stringify({...old,groups:{...old.groups,[P.group]:true},[P.group]:fabricated}));assert.match(build().stderr,/技藝上限缺少相符/);
  const proofBytes=fs.readFileSync(pp,'utf8'),results={completed:true,checks:Object.fromEntries(Object.keys(k.verification).map(g=>[g,Object.fromEntries(R.requiredChecks(g).map(c=>[c,true]))]))};
  const compared=M.writeBack({dir,catalog:k,proof:old,results,exec:()=>{throw Error('must not build');}});
  assert.equal(compared.action,'compared');assert.equal(compared.comparison.find(c=>c.group===P.group).migrated,false);assert.equal(fs.readFileSync(pp,'utf8'),proofBytes);
  assert.equal(M.writeBack({dir,catalog:candidate,proof:old,results}).action,'skipped');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

function resultFixture({representative=false,catalog=k}={}){
 const {buildSkillCapScenarios}=require('../scripts/random-character-skill-caps-scenarios.cjs'),{saveFixture}=require('./helpers/save-fixture.cjs'),{createEffects,createLifecycle}=require('./helpers/skill-caps-proof-fixture.cjs');
 const copies=buildSkillCapScenarios({catalog,saveText:saveFixture({characters:120}).raw,representative});
 const hash='a'.repeat(64),assertion=(pid,restarted)=>({pid,restarted,passed:true,savedHash:hash});
 const records=copies.map((copy,i)=>{
  const pid=100+i*100,effects=createEffects(copy.scenario,{pid,reloadPid:pid+1,batch:!copy.lifecycle}),lifecycle=copy.lifecycle?createLifecycle(copy.scenario,{pid:pid+1}):undefined;
  if(!copy.lifecycle)effects.batchRequests=structuredClone(copy.batchRequests);
  const assertions=[assertion(pid,false),assertion(pid+1,true)];
  if(effects.batchFollowup)assertions.push(...structuredClone(effects.batchFollowup.assertions));
  if(lifecycle){for(const stage of lifecycle.stages)for(const a of stage.assertions){a.restarted=true;assertions.push(structuredClone(a));}assertions.push(assertion(lifecycle.reload.previousPid,true),assertion(lifecycle.reload.pid,true));}
  return {name:copy.name,family:copy.family,cases:copy.cases,lifecycle:copy.lifecycle,ok:true,
   steps:M.steps(copy,[]).map(s=>({...s,ok:true})),scenarioHash:P.sha(copy.scenario),batchHash:P.sha(copy.batchRequests||[]),
   evidence:{scenario:copy.scenario,batchRequests:copy.batchRequests||[],effects,...(lifecycle?{lifecycle}:{}),source:{fingerprints:{...catalog.fingerprints,...catalog.batch2Fingerprints},sourceHashes:{...catalog.fingerprints,...catalog.batch2Fingerprints},runtimePatch:null,originalFileHashes:['c'.repeat(64)],assertions}}};
 });
 return {date:'2026-10-22T12:00:00.000Z',gameVersion:catalog.gameVersion,platform:'synthetic-test-only',completed:true,copies:records,skillCapsBinding:P.binding(catalog,core),checks:{[P.group]:checks()},ui:{}};
}

test('selective cap migration validates each present representative manifest without requiring unchanged lifecycle',()=>{
 const results=resultFixture({representative:true});
 for(const copy of results.copies)assert.ok(P.validateMigrationCopy(copy,k,results.skillCapsBinding).restart);
 const matrix=structuredClone(results.copies[0]);matrix.evidence.scenario.skillCapManifest.pop();
 assert.throws(()=>P.validateMigrationCopy(matrix,k,results.skillCapsBinding),/案例數/);
 const life=structuredClone(results.copies[1]);life.evidence.source.assertions.at(-1).pid++;
 assert.throws(()=>P.validateMigrationCopy(life,k,results.skillCapsBinding));
});

test('complete native-shaped fixture merges only the new group; partial matrices, stale calculations and disconnected observations fail',()=>{
 const results=resultFixture(),originalProof=structuredClone(old),originalCatalog=structuredClone(k),merged=mergeProof({catalog:k,proof:old,results,coreSource:core});
 assert.equal(P.problem(merged.catalog,merged.proof,core),null);assert.equal(merged.catalog.verification[P.group],true);
 const retained=structuredClone(merged.proof);delete retained[P.group];retained.groups[P.group]=old.groups[P.group];
 if(!Object.hasOwn(old.groups,P.group))delete retained.groups[P.group];assert.deepEqual(retained,old,'every old group and proof section is retained');
 assert.deepEqual(old,originalProof);assert.deepEqual(k,originalCatalog);assert.equal(merged.catalog.verification.randomCharacterTalents,k.verification.randomCharacterTalents);
 assert.doesNotThrow(()=>mergeProof({catalog:k,proof:old,results,coreSource:core+'\n// formatting only'}));
 assert.throws(()=>mergeProof({catalog:k,proof:old,results,coreSource:core+'\nglobalThis.semanticChange=true;'}),/摘要/);
 assert.throws(()=>mergeProof({catalog:k,proof:old,results:resultFixture({representative:true}),coreSource:core}),/矩陣/);
 for(const mutate of [
  r=>r.copies.pop(),r=>r.copies[0].evidence.scenario.skillCapManifest.pop(),r=>r.copies[0].evidence.scenario.skillCapManifest[0].quality=2,
  r=>r.copies[0].evidence.scenario.skillCapCases[0].afterCaps[0]--,r=>r.copies[0].evidence.batchRequests[0].amount++,
  r=>r.copies[0].evidence.scenario.baseline.push([1,22,2,999]),r=>r.copies[0].evidence.scenario.skillCapCases[1].atLevelBoundary=false,
  r=>r.copies[0].evidence.effects.observed[0].skills[0].experience++,r=>delete r.copies[0].evidence.effects.reload,
  r=>r.copies[0].evidence.source.assertions.at(-1).savedHash='f'.repeat(64),r=>r.copies[0].evidence.effects.batchFollowup.assertions[0].restarted=false,
  r=>delete r.copies[0].evidence.source.fingerprints['yx.json'],r=>r.copies[0].evidence.source.sourceHashes['data.json']='f'.repeat(64),
  r=>r.copies[1].evidence.lifecycle.initialPid++,r=>r.copies[1].evidence.source.assertions[2].savedHash='f'.repeat(64),
  r=>r.copies[1].evidence.lifecycle.initial[0].skills[0].cap++,r=>{r.copies[1].evidence.lifecycle.transfer.skillsBefore=[];r.copies[1].evidence.lifecycle.transfer.skillsAfter=[];},
  r=>r.copies[1].evidence.source.assertions.at(-1).pid++,r=>r.copies[1].evidence.lifecycle.stages[2].assertions[0].restarted=false,
  r=>r.copies[1].evidence.lifecycle.stages[4].afterPid=r.copies[1].evidence.lifecycle.stages[4].beforePid,
  r=>r.copies[1].steps.find(s=>s.step==='lifecycle').ok=false,r=>delete r.checks[P.group].stageRoundtrips
 ]){const bad=structuredClone(results);mutate(bad);assert.throws(()=>mergeProof({catalog:k,proof:old,results:bad,coreSource:core}));}
});

test('first proof write-back restores catalog, old proof, HTML and service worker on write, build or check failure',()=>{
 const dir=directory();
 try{
  copyRepo(dir);const files=['knowledge/catalog.json','knowledge/verification.json','index.html','sw.js'].map(f=>path.join(dir,f)),snapshot=()=>files.map(f=>fs.readFileSync(f));
  const before=snapshot(),results=resultFixture();
  for(const failure of [1,2]){let calls=0;assert.throws(()=>recordProof({dir,catalog:k,proof:old,results,exec:()=>{calls++;fs.writeFileSync(files[2],'partial build');fs.writeFileSync(files[3],'partial worker');return {status:calls===failure?1:0,stderr:'intentional build failure'};}}),/intentional/);assert.deepEqual(snapshot(),before);}
  const originalWrite=fs.writeFileSync;let once=true;
  try{fs.writeFileSync=(file,...args)=>{if(file===files[1]&&once){once=false;throw Error('intentional proof write failure');}return originalWrite(file,...args);};assert.throws(()=>recordProof({dir,catalog:k,proof:old,results,exec:()=>({status:0})}),/intentional proof write/);}finally{fs.writeFileSync=originalWrite;}
  assert.deepEqual(snapshot(),before);
  const bad=structuredClone(results);bad.copies.pop();assert.throws(()=>recordProof({dir,catalog:k,proof:old,results:bad}));assert.deepEqual(snapshot(),before);
  const changed=structuredClone(old);changed.notes='concurrent edit';fs.writeFileSync(files[1],JSON.stringify(changed));
  assert.throws(()=>recordProof({dir,catalog:k,proof:old,results}),/已改變/);assert.equal(JSON.parse(fs.readFileSync(files[1])).notes,'concurrent edit');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('representative re-verification requires initial ancestry and preserves it across a new fingerprint',()=>{
 const initial=mergeProof({catalog:k,proof:old,results:resultFixture(),coreSource:core}),results=resultFixture({representative:true});
 assert.equal(P.validateResults(k,core,results,{initial:false}).validation.matrixCases,2);
 const validation=P.validateResults(k,core,results,{initial:false}),record=P.record(k,core,{date:'2026-10-22',platform:results.platform,...validation,coverage:'representative',copies:results.copies.map(c=>({name:c.name,operations:c.cases})),initialVerification:initial.proof[P.group].initialVerification});
 assert.equal(P.problem(k,{...old,[P.group]:record},core),null);assert.deepEqual(record.initialVerification,initial.proof[P.group].initialVerification);
 const next=structuredClone(k);next.gameVersion='V9.9.9-test';next.fingerprints['cl.json']='d'.repeat(64);
 const migrated=resultFixture({representative:true,catalog:next}),verified=P.validateResults(next,core,migrated,{initial:false});
 const newRecord=P.record(next,core,{date:'2026-10-23',platform:migrated.platform,...verified,coverage:'representative',copies:migrated.copies.map(c=>({name:c.name,operations:c.cases})),initialVerification:record.initialVerification});
 assert.equal(P.problem(next,{...old,[P.group]:newRecord},core),null);assert.ok(P.problem(k,{...old,[P.group]:newRecord},core));assert.deepEqual(newRecord.initialVerification,record.initialVerification);
 assert.throws(()=>P.record(k,core,{date:'2026-10-22',...validation,copies:[]}),/首次完整矩陣/);
 const dir=directory();try{copyRepo(dir);const allChecks=Object.fromEntries(Object.keys(k.verification).map(g=>[g,Object.fromEntries(R.requiredChecks(g).map(c=>[c,true]))]));
  const compared=M.writeBack({dir,catalog:initial.catalog,proof:initial.proof,results:{...results,checks:allChecks},exec:()=>{throw Error('same source must never build');}});assert.equal(compared.action,'compared');assert.equal(compared.failing.includes(P.group),false);
  const fake={...results,copies:[],checks:allChecks};const rejected=M.writeBack({dir,catalog:initial.catalog,proof:initial.proof,results:fake});assert.equal(rejected.action,'compared');assert.ok(rejected.failing.includes(P.group));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
