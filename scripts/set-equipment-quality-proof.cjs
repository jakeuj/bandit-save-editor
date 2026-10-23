'use strict';
// Proof contract for the four set-equipment quality groups (A10). Phase A is wiring only: every group stays closed and
// nothing here runs the game. A group may open only with its own initial-matrix record that is bound to the fixed A9
// manifest, the A7/A8 oracle sources and the final core, and that lists every executable case once with a native result.
// Representative migration copies and bare checks=true results can never create such a record.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const D=require('./set-equipment-quality-data.cjs'),M=require('./set-equipment-quality-scenarios.cjs'),Core=require('./core-source-proof.cjs'),R=require('./verification-requirements.cjs'),E=require('./set-equipment-quality-equivalence.cjs');
const {hash,groups}=D,valid=v=>/^[a-f0-9]{64}$/.test(v||'');
const codeHash=file=>hash(fs.readFileSync(path.join(__dirname,file),'utf8').replace(/\r\n/g,'\n'));
const uiKeys=['desktop','mobile390','downloadReload','file','pwa'];
const filler=Object.fromEntries(['baselineHash','runtimeHash','sourceManifestHash','runtimeManifestHash'].map(k=>[k,'0'.repeat(64)]));
const cache=new Map();
// Case ids, case hashes and denominators do not depend on the external input hashes, so they can be recomputed anywhere.
function manifestFor(k,source){
 const key=hash([k.setEquipmentQuality,k.setEquipmentLevel,Core.hash(source)]);
 if(!cache.has(key))cache.set(key,M.createManifest(k,source,filler));
 return cache.get(key);
}
// Executable cases a group must pass natively: its own, plus the matching library's set-level regression supplement.
function required(manifest,group){
 const levelGroup=M.levelGroups[group.startsWith('backpack')?0:1];
 return manifest.cases.filter(c=>c.classification!==M.classes.na&&(c.group===group||c.group===levelGroup&&c.kind==='level-regression'));
}
const expected=(k,source,group)=>{
 const m=manifestFor(k,source),cases=required(m,group);
 return {manifestHash:m.manifestHash,denominator:m.denominators[group],cases,caseIdsHash:hash(cases.map(c=>c.id).sort()),caseHashes:new Map(cases.map(c=>[c.id,hash(c)]))};
};
// Parts of the A9 binding that can be recomputed from the repository; the external baseline/runtime hashes stay in the record.
const binding=(k,source)=>({gameVersion:k.gameVersion,fingerprints:{...k.fingerprints,...k.batch2Fingerprints},dataHash:hash(k.setEquipmentQuality),levelDataHash:hash(k.setEquipmentLevel),qualitySourceDigest:k.setEquipmentQuality?.sourceDigest,
 coreHash:Core.hash(source),coreHashAlgorithm:Core.algorithm,dataScriptHash:codeHash('set-equipment-quality-data.cjs'),transactionOracleHash:codeHash('set-equipment-quality-oracle.cjs'),effectOracleHash:codeHash('set-equipment-quality-effects-oracle.cjs'),scenarioHash:codeHash('set-equipment-quality-scenarios.cjs')});
const sameBinding=(record,b)=>hash(Object.fromEntries(Object.keys(b).map(key=>[key,record?.[key]])))===hash(b);
const uiOk=ui=>!!ui&&uiKeys.every(key=>ui[key]===true);
// Two-stage record (B8): the native part merges first and the browser acceptance is marked as owed to B9. Only the snapshot
// build accepts it (opts.pendingUi); the normal gate still requires all five UI checks.
const uiPending=ui=>!!ui&&typeof ui==='object'&&hash(ui)===hash({pending:'B9'});
const textHash=source=>hash(source.replace(/\r\n/g,'\n'));
// Each native run states the core and manifest it ran on. A run on another core is accepted only through the pinned B4
// equivalence, so old evidence is never bound to the current core without saying so.
function runProblem(run,manifestHash,k,source){
 if(!run||!valid(run.coreHash)||!valid(run.manifestHash)||!valid(run.evidenceSha256))return '原生執行紀錄不完整';
 if(run.coreHash===textHash(source)&&run.manifestHash===manifestHash)return run.equivalence===undefined?null:'目前 core 的原生執行不可帶等價紀錄';
 return E.runProblem(run,k,source);
}
const ioOk=io=>!!io&&io.rounds===2&&io.newPidReadback===true&&io.shiftedColumns===50&&io.tailColumns===10;
// Shape and arithmetic of a record, without the current-source comparison.
function initialProblem(v,group,opts={}){
 if(!groups.includes(group))return '未知套裝品質群組';
 if(!v||v.group!==group||v.coverage!=='initial-matrix'||Object.keys(v.fingerprints||{}).length!==15||!Object.values(v.fingerprints).every(valid))return '套裝品質首次證明紀錄不完整';
 for(const key of ['coreHash','dataHash','levelDataHash','manifestHash','bindingHash','evidenceHash','caseIdsHash','baselineHash','runtimeHash','sourceManifestHash','runtimeManifestHash','dataScriptHash','transactionOracleHash','effectOracleHash','scenarioHash'])if(!valid(v[key]))return '套裝品質首次證明紀錄不完整：'+key;
 if(!Core.supported(v.coreHashAlgorithm))return '套裝品質首次證明紀錄不完整：coreHashAlgorithm';
 const d=v.denominator;
 if(!d||!Number.isInteger(d.executable)||d.executable<1||!Number.isInteger(v.executed)||v.executed!==d.executable+(v.levelRegressionExecutable||0)||v.passed!==v.executed||v.nativeCompared!==v.executed||v.failed!==0||v.unknown!==0)return '套裝品質首次證明案例數不符';
 if(!ioOk(v.io))return '套裝品質首次證明缺少兩輪 IO 與搬移斷言';
 if(!uiOk(v.ui)&&!(opts.pendingUi&&uiPending(v.ui)))return '套裝品質首次證明缺少 UI 驗收';
 return null;
}
// Full check of a record against the current sources: stale rules, oracles, manifest or core are refused.
function recordProblem(v,group,k,source,opts={}){
 const bad=initialProblem(v,group,opts);if(bad)return bad;
 if(!sameBinding(v,binding(k,source)))return '套裝品質首次證明綁定已過期：'+group;
 let e;try{e=expected(k,source,group);}catch{return '套裝品質 manifest 無法重建：'+group;}
 if(v.manifestHash!==e.manifestHash||v.caseIdsHash!==e.caseIdsHash)return '套裝品質 manifest 或案例清單不符：'+group;
 if(hash(v.denominator)!==hash(e.denominator)||v.executed!==e.cases.length)return '套裝品質分母不符：'+group;
 if(!Array.isArray(v.nativeRuns)||!v.nativeRuns.length||v.nativeRuns.reduce((n,r)=>n+(Number.isInteger(r?.count)&&r.count>0?r.count:NaN),0)!==v.executed)return '套裝品質首次證明缺少原生執行紀錄：'+group;
 for(const run of v.nativeRuns){const p=runProblem(run,e.manifestHash,k,source);if(p)return p+'：'+group;}
 return null;
}
// Validates one group's native result list: exact coverage, no duplicates, right library/direction, current case hashes.
function validateResults(k,source,results,group){
 assert.ok(groups.includes(group),'未知套裝品質群組');
 assert.ok(results&&results.completed===true,'首次原生結果未完成');
 assert.ok(R.requiredChecks(group).every(c=>results.checks?.[group]?.[c]===true),'首次原生 checks 不完整');
 const n=results.native?.[group];assert.ok(n,'只有 checks=true 而沒有逐案原生結果');
 assert.equal(n.coverage,'initial-matrix','代表遷移不可首次開放');
 const e=expected(k,source,group);
 assert.equal(n.manifestHash,e.manifestHash,'結果的 manifest 與目前不符');
 assert.ok(Array.isArray(n.cases),'缺少逐案結果');
 const seen=new Set();
 for(const r of n.cases){
  assert.ok(e.caseHashes.has(r.id),'未知、錯庫、錯方向或不適用案例：'+r.id);
  assert.ok(!seen.has(r.id),'重複案例：'+r.id);seen.add(r.id);
  assert.equal(r.caseHash,e.caseHashes.get(r.id),'案例摘要過期：'+r.id);
  assert.equal(r.passed,true,'案例未通過：'+r.id);assert.equal(r.nativeCompared,true,'合成結果不可冒充原生：'+r.id);
  assert.ok(Number.isInteger(r.run)&&r.run>=0&&r.run<(n.runs?.length||0),'案例缺少原生執行來源：'+r.id);
 }
 assert.equal(seen.size,e.cases.length,'漏案：缺 '+(e.cases.length-seen.size)+' 項');
 assert.ok(Array.isArray(n.runs)&&n.runs.length,'缺少原生執行紀錄');
 n.runs.forEach((run,i)=>{const p=runProblem(run,e.manifestHash,k,source);assert.ok(!p,p);assert.ok(n.cases.some(r=>r.run===i),'原生執行沒有任何案例');});
 assert.ok(ioOk(n.io),'缺少兩輪 IO 與搬移斷言');assert.ok(uiOk(n.ui)||uiPending(n.ui),'缺少 UI 驗收');
 for(const [key,file] of [['transactionOracleHash','set-equipment-quality-oracle.cjs'],['effectOracleHash','set-equipment-quality-effects-oracle.cjs']])assert.equal(n.oracles?.[key],codeHash(file),'oracle 摘要過期：'+key);
 for(const key of ['baselineHash','runtimeHash','sourceManifestHash','runtimeManifestHash'])assert.ok(valid(n.inputs?.[key]),'缺外部輸入摘要：'+key);
 return e;
}
// Build the initial record from validated results; callers pass the external input hashes through the results.
function buildRecord(k,source,results,group){
 const e=validateResults(k,source,results,group),n=results.native[group],own=e.cases.filter(c=>c.group===group).length;
 return {group,coverage:'initial-matrix',...binding(k,source),...n.inputs,manifestHash:e.manifestHash,bindingHash:hash(binding(k,source)),denominator:e.denominator,levelRegressionExecutable:e.cases.length-own,
  executed:e.cases.length,passed:e.cases.length,nativeCompared:e.cases.length,failed:0,unknown:0,caseIdsHash:e.caseIdsHash,evidenceHash:hash(n),io:n.io,ui:n.ui,
  nativeRuns:n.runs.map((run,i)=>{const ids=n.cases.filter(r=>r.run===i).map(r=>r.id).sort();return {...run,count:ids.length,caseIdsHash:hash(ids)};})};
}
// B9 completes a pending record with its browser acceptance; the normal gate then accepts it. Nothing else may change.
function finalizeUi(record,ui){
 assert.ok(uiPending(record?.ui),'只有待 B9 的紀錄可以補 UI');
 assert.ok(uiOk(ui)&&valid(ui.evidenceHash)&&Object.keys(ui).every(key=>uiKeys.includes(key)||key==='evidenceHash'),'UI 驗收須五項皆 true 並附證據摘要');
 return {...record,ui:{...ui}};
}
// Build gate: a flag may be true only when the composite proof carries this group's matching initial record.
function problem(k,proof,source,only,opts={}){
 const open=only?[only]:groups.filter(g=>k.verification[g]);
 if(!open.length)return null;
 if(proof.schemaVersion===2)return require('./migration-proof.cjs').problem(k,proof,source,only,opts);
 const p=proof.setEquipmentQuality;
 for(const group of open)if(!p||recordProblem(p.initialVerification?.[group],group,k,source,opts)||!R.requiredChecks(group).every(c=>p.groups?.[group]?.checks?.[c]===true))return '套裝品質缺少相符的獨立首次證明：'+group;
 return null;
}
// Pure merge; never touches the other groups, other sections or the input object.
function mergeProof({catalog,proof,group,results,source}){
 const record=buildRecord(catalog,source,results,group),next=structuredClone(proof),checks=Object.fromEntries(R.requiredChecks(group).map(c=>[c,true]));
 const bad=recordProblem(record,group,catalog,source,{pendingUi:true});assert.ok(!bad,bad);
 next.groups={...next.groups,[group]:true};
 if(proof.schemaVersion===2){
  next.setEquipmentQuality={...(next.setEquipmentQuality||{}),initialVerification:{...(next.setEquipmentQuality?.initialVerification||{}),[group]:record}};
  require('./migration-proof.cjs').mergeInitial(catalog,next,group,{initialVerification:{[group]:record},coverage:'initial-matrix'},{completed:true,checks:results.checks,copies:[{name:'initial'}]},source);
  return next;
 }
 const old=next.setEquipmentQuality;
 next.setEquipmentQuality={...(old||{}),coverage:'initial-matrix',initialVerification:{...(old?.initialVerification||{}),[group]:record},groups:{...(old?.groups||{}),[group]:{checks}}};
 return next;
}
// A representative migration copy only proves a later build; it is refused as first-opening evidence.
function validateMigrationCopy(){throw Error('套裝品質沒有代表遷移；代表遷移不可首次開放');}
module.exports={groups,uiKeys,uiOk,uiPending,textHash,expected,binding,initialProblem,recordProblem,runProblem,validateResults,buildRecord,finalizeUi,problem,mergeProof,validateMigrationCopy};
