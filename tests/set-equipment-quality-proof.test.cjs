'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('../scripts/set-equipment-quality-proof.cjs'),D=require('../scripts/set-equipment-quality-data.cjs'),M=require('../scripts/set-equipment-quality-scenarios.cjs'),R=require('../scripts/verification-requirements.cjs'),S=require('../scripts/verification-suite.cjs'),A=require('../scripts/migration-analysis.cjs'),Core=require('../scripts/core-source-proof.cjs');
const k=JSON.parse(fs.readFileSync(path.join(__dirname,'../knowledge/catalog.json'),'utf8')),proof=JSON.parse(fs.readFileSync(path.join(__dirname,'../knowledge/verification.json'),'utf8')),source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
const hex=c=>c.repeat(64),{hash}=D;
const codeHash=f=>hash(fs.readFileSync(path.join(__dirname,'../scripts',f),'utf8').replace(/\r\n/g,'\n'));
const clone=o=>structuredClone(o);
// Synthetic "native" results shaped like a finished first run. Nothing here ran the game; they only exercise the validators.
function results(group,src=source){
 const e=P.expected(k,src,group);
 return {completed:true,checks:{[group]:Object.fromEntries(R.requiredChecks(group).map(c=>[c,true]))},copies:[],native:{[group]:{
  coverage:'initial-matrix',manifestHash:e.manifestHash,cases:e.cases.map(c=>({id:c.id,caseHash:hash(c),passed:true,nativeCompared:true})),
  io:{rounds:2,newPidReadback:true,shiftedColumns:50,tailColumns:10},ui:Object.fromEntries(P.uiKeys.map(x=>[x,true])),
  oracles:{transactionOracleHash:codeHash('set-equipment-quality-oracle.cjs'),effectOracleHash:codeHash('set-equipment-quality-effects-oracle.cjs')},
  inputs:{baselineHash:hex('a'),runtimeHash:hex('b'),sourceManifestHash:hex('c'),runtimeManifestHash:hex('d')}}}};
}
const legacy=()=>({schemaVersion:1,groups:{}});

test('the four quality groups are registered everywhere but stay closed',()=>{
 assert.deepEqual(P.groups,['backpackSetEquipmentQualityUpgrade','backpackSetEquipmentQualityDowngrade','setEquipmentQualityUpgrade','setEquipmentQualityDowngrade']);
 for(const g of P.groups){
  assert.equal(k.verification[g],false);assert.equal(R.sectionOf(g),'setEquipmentQuality');assert.equal(S.familyOf(g),'setEquipmentQuality');
  assert.deepEqual(R.requiredChecks(g),['load','save','restart','originalHashes','nativeEffects','lifecycle']);assert.ok(!proof.groups[g]);
 }
 assert.equal(S.families.setEquipmentQuality.initialProofRequired,true);assert.deepEqual(S.uncovered(P.groups),[]);
 for(const script of [S.families.setEquipmentQuality.oracle,...S.families.setEquipmentQuality.lifecycle])assert.ok(fs.existsSync(path.join(__dirname,'../scripts',script)),script);
 assert.deepEqual(A.coreRoots.setEquipmentQuality.slice(-4),['setEquipmentQualityCandidateInfo','previewSetEquipmentQualityCandidate','applySetEquipmentQualityCandidate','setEquipmentQualityCandidateEffects']);
 assert.ok(A.dependencies.setEquipmentQuality&&A.regions.setEquipmentQuality);
 assert.equal(P.problem(k,proof,source),null);
});
test('the placeholder native runner and the artifact-less lifecycle runner refuse to report any result',()=>{
 const {spawnSync}=require('node:child_process');
 for(const f of ['verify-set-equipment-quality.cjs','verify-set-equipment-quality-migration-lifecycle.cjs']){const r=spawnSync(process.execPath,[path.join(__dirname,'../scripts',f)],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,f==='verify-set-equipment-quality.cjs'?/尚未實作/:/需要 --output/);assert.equal(r.stdout,'');}
 assert.throws(()=>P.validateMigrationCopy(),/代表遷移/);
});
test('a complete synthetic result set builds a record that matches the current sources',()=>{
 for(const g of P.groups){
  const rec=P.buildRecord(k,source,results(g),g);
  assert.equal(P.initialProblem(rec,g),null);assert.equal(P.recordProblem(rec,g,k,source),null);
  const e=P.expected(k,source,g);assert.equal(rec.executed,e.cases.length);assert.ok(e.cases.some(c=>c.kind==='level-regression'),'含等級回歸補證');
  assert.ok(e.cases.every(c=>c.group===g||c.kind==='level-regression'));
 }
});
test('missing cases, duplicates, wrong library or direction, not-applicable and stale case hashes are refused',()=>{
 const g='setEquipmentQualityUpgrade',base=results(g),n=()=>{const r=clone(base);return [r,r.native[g]];};
 let [r,x]=n();x.cases.pop();assert.throws(()=>P.validateResults(k,source,r,g),/漏案/);
 [r,x]=n();x.cases.push(clone(x.cases[0]));assert.throws(()=>P.validateResults(k,source,r,g),/重複/);
 [r,x]=n();x.cases[0]=clone(results('setEquipmentQualityDowngrade').native.setEquipmentQualityDowngrade.cases[0]);assert.throws(()=>P.validateResults(k,source,r,g),/錯庫|錯方向|未知/);
 [r,x]=n();x.cases[0]=clone(results('backpackSetEquipmentQualityUpgrade').native.backpackSetEquipmentQualityUpgrade.cases[0]);assert.throws(()=>P.validateResults(k,source,r,g),/錯庫|錯方向|未知/);
 const na=M.createManifest(k,source,{baselineHash:hex('0'),runtimeHash:hex('0'),sourceManifestHash:hex('0'),runtimeManifestHash:hex('0')}).cases.find(c=>c.group===g&&c.classification===M.classes.na);
 [r,x]=n();x.cases[0]={id:na.id,caseHash:hash(na),passed:true,nativeCompared:true};assert.throws(()=>P.validateResults(k,source,r,g),/未知|不適用/);
 [r,x]=n();x.cases[0].caseHash=hex('e');assert.throws(()=>P.validateResults(k,source,r,g),/過期/);
 [r,x]=n();x.cases[0].passed=false;assert.throws(()=>P.validateResults(k,source,r,g),/未通過/);
 [r,x]=n();x.cases[0].nativeCompared=false;assert.throws(()=>P.validateResults(k,source,r,g),/合成/);
});
test('stale manifest, oracle, rule or core digests are refused',()=>{
 const g='backpackSetEquipmentQualityDowngrade',base=results(g),n=()=>clone(base);
 let r=n();r.native[g].manifestHash=hex('f');assert.throws(()=>P.validateResults(k,source,r,g),/manifest/);
 for(const key of ['transactionOracleHash','effectOracleHash']){r=n();r.native[g].oracles[key]=hex('f');assert.throws(()=>P.validateResults(k,source,r,g),/oracle/);}
 r=n();delete r.native[g].inputs.baselineHash;assert.throws(()=>P.validateResults(k,source,r,g),/外部輸入/);
 const rec=P.buildRecord(k,source,base,g);
 for(const key of ['coreHash','dataHash','levelDataHash','transactionOracleHash','effectOracleHash','scenarioHash','dataScriptHash','qualitySourceDigest','manifestHash','caseIdsHash']){const bad=clone(rec);bad[key]=hex('9');assert.ok(P.recordProblem(bad,g,k,source),key);}
 assert.match(P.recordProblem(rec,g,k,source+'\n;0;'),/過期|不符/);
 const rule=clone(k);rule.setEquipmentQuality.sourceDigest=hex('1');assert.match(P.recordProblem(rec,g,rule,source),/過期|不符/);
 const fp=clone(rec);fp.fingerprints['data.json']=hex('1');assert.ok(P.recordProblem(fp,g,k,source));
 const den=clone(rec);den.denominator.executable+=1;assert.ok(P.recordProblem(den,g,k,source));
});
test('records without IO rounds, UI acceptance or full counts are refused',()=>{
 const g='setEquipmentQualityDowngrade',base=results(g);
 let r=clone(base);r.native[g].io.rounds=1;assert.throws(()=>P.validateResults(k,source,r,g),/IO/);
 r=clone(base);r.native[g].io.newPidReadback=false;assert.throws(()=>P.validateResults(k,source,r,g),/IO/);
 r=clone(base);delete r.native[g].io;assert.throws(()=>P.validateResults(k,source,r,g),/IO/);
 for(const key of P.uiKeys){r=clone(base);r.native[g].ui[key]=false;assert.throws(()=>P.validateResults(k,source,r,g),/UI/,key);}
 r=clone(base);delete r.native[g].ui;assert.throws(()=>P.validateResults(k,source,r,g),/UI/);
 const rec=P.buildRecord(k,source,base,g);
 for(const [key,bad] of [['coverage','representative'],['executed',1],['passed',1],['nativeCompared',0],['failed',1],['unknown',1],['io',{...rec.io,rounds:1}],['ui',{...rec.ui,pwa:false}],['evidenceHash',undefined],['bindingHash','x'],['baselineHash',undefined]]){const b=clone(rec);if(bad===undefined)delete b[key];else b[key]=bad;assert.ok(P.initialProblem(b,g),key);}
 assert.ok(P.initialProblem(null,g));assert.ok(P.initialProblem(rec,'unknown'));
 assert.ok(P.recordProblem(rec,'setEquipmentQualityUpgrade',k,source),'錯方向的紀錄不能換群組使用');
});
test('representative migration evidence and bare checks=true cannot open a group',()=>{
 const g='setEquipmentQualityUpgrade',base=results(g);
 let r=clone(base);delete r.native;assert.throws(()=>P.validateResults(k,source,r,g),/逐案/);
 r=clone(base);r.native[g].coverage='representative';assert.throws(()=>P.validateResults(k,source,r,g),/代表遷移/);
 r=clone(base);r.native[g].cases=[];assert.throws(()=>P.validateResults(k,source,r,g),/漏案/);
 r=clone(base);r.completed=false;assert.throws(()=>P.validateResults(k,source,r,g),/未完成/);
 r=clone(base);r.checks[g].lifecycle=false;assert.throws(()=>P.validateResults(k,source,r,g),/checks/);
 assert.throws(()=>P.mergeProof({catalog:k,proof:legacy(),group:g,results:{completed:true,checks:base.checks},source}),/逐案/);
 // Opening the flag without a record is refused by every gate.
 const open=clone(k);open.verification[g]=true;
 assert.match(P.problem(open,legacy(),source,g),/缺少相符的獨立首次證明/);
 assert.ok(P.problem(open,proof,source,g));
 assert.ok(require('../scripts/migration-proof.cjs').problem(open,proof,source,g));
});
test('merging opens only the merged group; the other three keep no proof and the input is untouched',()=>{
 const g='backpackSetEquipmentQualityUpgrade',before=JSON.stringify(proof);
 const merged=P.mergeProof({catalog:k,proof:legacy(),group:g,results:results(g),source});
 assert.equal(merged.groups[g],true);for(const o of P.groups.filter(x=>x!==g))assert.notEqual(merged.groups[o],true);
 assert.deepEqual(Object.keys(merged.setEquipmentQuality.initialVerification),[g]);
 const open=clone(k);open.verification[g]=true;assert.equal(P.problem(open,merged,source,g),null);
 const other=clone(k);other.verification.setEquipmentQualityUpgrade=true;assert.match(P.problem(other,merged,source,'setEquipmentQualityUpgrade'),/setEquipmentQualityUpgrade/);
 const swapped=clone(merged),t='setEquipmentQualityUpgrade';
 swapped.setEquipmentQuality.initialVerification[t]=swapped.setEquipmentQuality.initialVerification[g];swapped.setEquipmentQuality.groups[t]=swapped.setEquipmentQuality.groups[g];
 const swappedOpen=clone(k);swappedOpen.verification[t]=true;
 assert.match(P.problem(swappedOpen,swapped,source,t),/首次證明/);
 assert.match(P.problem(open,merged,source+'\n;0;',g),/首次證明/);
 assert.equal(JSON.stringify(proof),before);
});
test('a composite proof stores the quality record separately and the build gate checks it',()=>{
 const g='setEquipmentQualityDowngrade',v2={schemaVersion:2,groups:{},migration:{version:2,snapshot:{dataHashes:{}},anchors:{},evidence:{},enabledBefore:[]}};
 const merged=P.mergeProof({catalog:k,proof:v2,group:g,results:results(g),source});
 assert.equal(merged.groups[g],true);assert.equal(merged.migration.qualityInitialVerification[g].group,g);assert.equal(merged.migration.qualityInitialVerification.setEquipmentQualityUpgrade,undefined);
 assert.ok(merged.migration.enabledBefore.includes(g));assert.deepEqual(Object.keys(merged.migration.evidence[g]),R.requiredChecks(g));assert.equal(v2.migration.enabledBefore.length,0);
 assert.equal(P.recordProblem(merged.migration.qualityInitialVerification[g],g,k,source),null);
});
test('the library cases follow their own group: z7 groups carry z7 regression, z9 groups carry z9',()=>{
 for(const g of P.groups){
  const level=g.startsWith('backpack')?'backpackSetEquipmentLevel':'setEquipmentLevel',e=P.expected(k,source,g);
  assert.ok(e.cases.filter(c=>c.kind==='level-regression').every(c=>c.group===level));
  assert.equal(e.cases.filter(c=>c.group===g).length,e.denominator.executable);
 }
 assert.equal(Core.hash(source).length,64);
});
