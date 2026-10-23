'use strict';
// First-proof contract for the two cross-pool set-level groups (B7 gate, opened in B8). Each library opens only with its own
// record built from the eight A10 `level-regression` cases of that library, run natively on the current core: quality proofs,
// the other library or the old-core B4 equivalence can never stand in for it.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const D=require('./set-equipment-quality-data.cjs'),M=require('./set-equipment-quality-scenarios.cjs'),Q=require('./set-equipment-quality-proof.cjs'),Core=require('./core-source-proof.cjs'),R=require('./verification-requirements.cjs');
const {hash}=D,groups=D.crossPoolGroups,valid=v=>/^[a-f0-9]{64}$/.test(v||'');
const levelGroupOf=group=>M.levelGroups[group===groups[0]?0:1];
const codeHash=file=>hash(fs.readFileSync(path.join(__dirname,file),'utf8').replace(/\r\n/g,'\n'));
const inputKeys=['fixedSaveHash','levelBaselineHash','runtimeHash','sourceManifestHash','runtimeManifestHash'];
const filler=Object.fromEntries(['baselineHash','runtimeHash','sourceManifestHash','runtimeManifestHash'].map(k=>[k,'0'.repeat(64)]));
function expected(k,source,group){
 assert.ok(groups.includes(group),'未知跨池等級群組');
 const m=M.createManifest(k,source,filler),cases=m.cases.filter(c=>c.kind==='level-regression'&&c.group===levelGroupOf(group)&&c.classification!==M.classes.na);
 return {manifestHash:m.manifestHash,cases,caseIdsHash:hash(cases.map(c=>c.id).sort()),caseHashes:new Map(cases.map(c=>[c.id,hash(c)]))};
}
// The quality binding (sources, rules, core, data script, oracles, scenarios) plus the level oracle and the B6 runner.
const binding=(k,source)=>({...Q.binding(k,source),levelOracleHash:codeHash('set-equipment-level-oracle.cjs'),runnerHash:codeHash('verify-set-equipment-level-cross-pool.cjs')});
const sameBinding=(record,b)=>hash(Object.fromEntries(Object.keys(b).map(key=>[key,record?.[key]])))===hash(b);
const ioOk=io=>!!io&&io.rounds===2&&io.newPidReadback===true&&io.shiftedColumns===50&&io.tailColumns===10;
const runOk=(run,manifestHash,source)=>!!run&&valid(run.evidenceSha256)&&run.coreHash===Q.textHash(source)&&run.manifestHash===manifestHash&&run.equivalence===undefined;
function initialProblem(v,group,opts={}){
 if(!groups.includes(group))return '未知跨池等級群組';
 if(!v||v.group!==group||v.levelGroup!==levelGroupOf(group)||v.coverage!=='initial-matrix'||Object.keys(v.fingerprints||{}).length!==15||!Object.values(v.fingerprints).every(valid))return '跨池等級首次證明紀錄不完整';
 for(const key of ['coreHash','dataHash','levelDataHash','manifestHash','bindingHash','evidenceHash','caseIdsHash','dataScriptHash','transactionOracleHash','effectOracleHash','scenarioHash','levelOracleHash','runnerHash',...inputKeys])if(!valid(v[key]))return '跨池等級首次證明紀錄不完整：'+key;
 if(!Core.supported(v.coreHashAlgorithm))return '跨池等級首次證明紀錄不完整：coreHashAlgorithm';
 if(!Number.isInteger(v.executed)||v.executed<1||v.passed!==v.executed||v.nativeCompared!==v.executed||v.failed!==0||v.unknown!==0)return '跨池等級首次證明案例數不符';
 if(!ioOk(v.io))return '跨池等級首次證明缺少兩輪 IO 與搬移斷言';
 if(!Q.uiOk(v.ui)&&!(opts.pendingUi&&Q.uiPending(v.ui)))return '跨池等級首次證明缺少 UI 驗收';
 if(!v.nativeRun||v.nativeRun.count!==v.executed)return '跨池等級首次證明缺少原生執行紀錄';
 return null;
}
function recordProblem(v,group,k,source,opts={}){
 const bad=initialProblem(v,group,opts);if(bad)return bad;
 if(!sameBinding(v,binding(k,source)))return '跨池等級首次證明綁定已過期：'+group;
 let e;try{e=expected(k,source,group);}catch{return '跨池等級 manifest 無法重建：'+group;}
 if(v.manifestHash!==e.manifestHash||v.caseIdsHash!==e.caseIdsHash||v.executed!==e.cases.length)return '跨池等級 manifest 或案例清單不符：'+group;
 if(!runOk(v.nativeRun,e.manifestHash,source))return '跨池等級原生執行必須在目前 core 上：'+group;
 return null;
}
function validateResults(k,source,results,group){
 assert.ok(groups.includes(group),'未知跨池等級群組');
 assert.ok(results&&results.completed===true,'首次原生結果未完成');
 assert.ok(R.requiredChecks(group).every(c=>results.checks?.[group]?.[c]===true),'首次原生 checks 不完整');
 const n=results.native?.[group];assert.ok(n,'只有 checks=true 而沒有逐案原生結果');
 assert.equal(n.coverage,'initial-matrix','代表遷移不可首次開放');
 const e=expected(k,source,group);
 assert.equal(n.manifestHash,e.manifestHash,'結果的 manifest 與目前不符');
 assert.ok(runOk(n.run,e.manifestHash,source),'跨池等級原生執行必須在目前 core 與 manifest 上，不可沿用等價紀錄');
 assert.ok(Array.isArray(n.cases),'缺少逐案結果');
 const seen=new Set();
 for(const r of n.cases){
  assert.ok(e.caseHashes.has(r.id),'未知、錯庫或不適用案例：'+r.id);
  assert.ok(!seen.has(r.id),'重複案例：'+r.id);seen.add(r.id);
  assert.equal(r.caseHash,e.caseHashes.get(r.id),'案例摘要過期：'+r.id);
  assert.equal(r.passed,true,'案例未通過：'+r.id);assert.equal(r.nativeCompared,true,'合成結果不可冒充原生：'+r.id);
 }
 assert.equal(seen.size,e.cases.length,'漏案：缺 '+(e.cases.length-seen.size)+' 項');
 assert.ok(ioOk(n.io),'缺少兩輪 IO 與搬移斷言');assert.ok(Q.uiOk(n.ui)||Q.uiPending(n.ui),'缺少 UI 驗收');
 assert.equal(n.levelOracleHash,codeHash('set-equipment-level-oracle.cjs'),'等級 oracle 摘要過期');
 assert.equal(n.runnerHash,codeHash('verify-set-equipment-level-cross-pool.cjs'),'跨池 runner 摘要過期');
 for(const key of inputKeys)assert.ok(valid(n.inputs?.[key]),'缺外部輸入摘要：'+key);
 return e;
}
function buildRecord(k,source,results,group){
 const e=validateResults(k,source,results,group),n=results.native[group],b=binding(k,source);
 return {group,levelGroup:levelGroupOf(group),coverage:'initial-matrix',...b,...n.inputs,manifestHash:e.manifestHash,bindingHash:hash(b),executed:e.cases.length,passed:e.cases.length,nativeCompared:e.cases.length,failed:0,unknown:0,
  caseIdsHash:e.caseIdsHash,evidenceHash:hash(n),io:n.io,ui:n.ui,nativeRun:{...n.run,count:e.cases.length}};
}
function finalizeUi(record,ui){
 assert.ok(Q.uiPending(record?.ui),'只有待 B9 的紀錄可以補 UI');
 assert.ok(Q.uiOk(ui)&&valid(ui.evidenceHash)&&Object.keys(ui).every(key=>Q.uiKeys.includes(key)||key==='evidenceHash'),'UI 驗收須五項皆 true 並附證據摘要');
 return {...record,ui:{...ui}};
}
// Only the composite (schemaVersion 2) proof format can carry these groups.
function problem(k,proof,source,only,opts={}){
 const open=only?[only]:groups.filter(g=>k.verification[g]);
 if(!open.length)return null;
 if(proof.schemaVersion!==2)return '跨池等級只能由複合證明開啟';
 return require('./migration-proof.cjs').problem(k,proof,source,only,opts);
}
function mergeProof({catalog,proof,group,results,source}){
 assert.equal(proof.schemaVersion,2,'跨池等級只能合併進複合證明');
 const record=buildRecord(catalog,source,results,group),bad=recordProblem(record,group,catalog,source,{pendingUi:true});assert.ok(!bad,bad);
 const next=structuredClone(proof);next.groups={...next.groups,[group]:true};
 require('./migration-proof.cjs').mergeInitial(catalog,next,group,{initialVerification:{[group]:record},coverage:'initial-matrix'},{completed:true,checks:results.checks,copies:[{name:'initial'}]},source);
 return next;
}
function validateMigrationCopy(){throw Error('跨池等級沒有代表遷移；代表遷移不可首次開放');}
module.exports={groups,levelGroupOf,inputKeys,expected,binding,initialProblem,recordProblem,validateResults,buildRecord,finalizeUi,problem,mergeProof,validateMigrationCopy};
