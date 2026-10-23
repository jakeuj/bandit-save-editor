'use strict';
// Re-derives the treasure-level first-proof record from raw native observations. Nothing here trusts a stored
// success flag: baselines, expected records, oracle values and lifecycle expectations are recomputed from the
// final core, the reviewed rules and the independent oracle.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const D=require('./treasure-level-data.cjs'),P=require('./treasure-level-proof.cjs'),S=require('./treasure-level-scenarios.cjs'),M=require('./verify-treasure-level-matrix.cjs'),L=require('./verify-treasure-level-lifecycle.cjs'),Syn=require('./treasure-level-synthetic.cjs');
const read=(dir,name)=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
function validateLevels(doc,{k,core,manifest,baseline}){
 const cases=manifest.cases.filter(c=>c.kind==='level'),C=M.candidateCore(k,core);
 assert.deepEqual(doc.binding,{...M.baselineBinding(k),manifestHash:manifest.manifestHash,coreHash:D.hash(core)},'等級矩陣綁定不符');
 assert.equal(doc.mode,'native');assert.equal(doc.results.length,cases.length,'等級矩陣漏案或多案');
 doc.results.forEach((r,i)=>{
  const c=cases[i],before=M.beforeRecord(baseline,c);
  assert.equal(r.id,c.id);assert.equal(r.caseHash,S.hash(c));assert.equal(r.nativeCompared,true);assert.equal(r.passed,true,'等級案例未通過：'+c.id);
  assert.deepEqual(r.before,before);const after=M.coreEdit(C,before,c);assert.deepEqual(r.after,after);
  M.validateLevel(r.observed,c,before,after,k);
 });
 return cases;
}
function validateSimple(doc,{k,core,manifest,baseline},kind,build,check){
 const cases=manifest.cases.filter(c=>c.kind===kind);
 assert.deepEqual(doc.binding,{...M.baselineBinding(k),manifestHash:manifest.manifestHash,coreHash:D.hash(core)},kind+' 綁定不符');assert.equal(doc.results.length,cases.length,kind+' 漏案或多案');
 doc.results.forEach((r,i)=>{const c=cases[i],input=build(baseline,k,c);assert.equal(r.id,c.id);assert.equal(r.caseHash,S.hash(c));assert.equal(r.passed,true);assert.equal(r.nativeCompared,true);assert.deepEqual(r.input,input);check(r.observed,c,input);});
 return cases;
}
function validateLifecycle(doc,{k,core}){
 const cases=L.cases(k),binding=doc.binding;
 assert.deepEqual(binding,{coreHash:D.hash(core),dataHash:D.hash(k.treasureLevel),fingerprints:{...k.fingerprints,...k.batch2Fingerprints},runnerHash:binding.runnerHash,driverHash:D.hash(require('./treasure-level-native.cjs').nativeDriver.toString())},'生命週期綁定不符');
 assert.match(binding.runnerHash,/^[a-f0-9]{64}$/);assert.equal(doc.mode,'native');assert.equal(doc.copies.length,cases.length,'生命週期漏案');
 doc.copies.forEach((v,i)=>{
  const c=cases[i];assert.equal(v.id,c.id);assert.deepEqual(v.case,c);
  assert.deepEqual(v.initial,v.reload,'寫檔後新 PID 讀回與編輯結果不同');
  L.validateCycle(v.cycle,v.expected);
  assert.deepEqual(v.beforeFinal,v.afterFinal,'最終新 PID 讀回不同');
  assert.ok(v.assertions.length>=4&&v.assertions.every(a=>a.passed)&&new Set(v.assertions.map(a=>a.pid)).size>=3,'PID／斷言不足');
  assert.ok(v.originalHashes.length>0);
  assert.equal(v.expected[6],c.to);assert.equal(v.expected[5],c.quality);
  if(c.state==='equipped')L.validateReplace(v.replaced,require('./verify-treasure-level-native.cjs').firstOf(k,c.tier===6?5:c.tier+1));else assert.equal(v.replaced,null);
 });
 return cases;
}
// Returns {record, stats}; record is exactly what mergeProof expects.
function validate({k,core,cfg,matrixDir,lifecycleDir}){
 const {manifest}=M.manifestFor(cfg,k),baseline=M.baselineMap(matrixDir,k),ctx={k,core,manifest,baseline};
 const levelCases=validateLevels(read(matrixDir,'native-levels-0-of-1.json'),ctx);
 const costCases=validateSimple(read(matrixDir,'native-costs.json'),ctx,'cost',M.costInput,M.validateCost);
 const decomposeCases=validateSimple(read(matrixDir,'native-decompose.json'),ctx,'decompose',M.decomposeInput,M.validateDecompose);
 const rejectDoc=read(matrixDir,'native-rejects.json'),rejectCases=manifest.cases.filter(c=>c.kind==='reject');
 assert.equal(rejectDoc.mode,'synthetic');assert.equal(rejectDoc.results.length,rejectCases.length);
 const runReject=Syn.createSyntheticRunner(k,core);rejectDoc.results.forEach((r,i)=>{assert.equal(r.id,rejectCases[i].id);assert.equal(r.passed,true);assert.equal(runReject(rejectCases[i]).rejected,true);});
 const lifeDoc=read(lifecycleDir,'treasure-lifecycle.json'),lifeCases=validateLifecycle(lifeDoc,ctx);
 const groupOfLife=c=>['backpack','stale-backpack'].includes(c.state)?'backpackTreasureLevel':'treasureLevel';
 const raw={baselines:read(matrixDir,'native-baselines.json'),levels:read(matrixDir,'native-levels-0-of-1.json'),costs:read(matrixDir,'native-costs.json'),decompose:read(matrixDir,'native-decompose.json'),rejects:rejectDoc,lifecycle:lifeDoc};
 const evidenceHash=D.hash(raw),initialVerification={};
 for(const group of D.groups){
  const templates=new Set(levelCases.filter(c=>c.group===group).map(c=>c.templateId));
  initialVerification[group]={...P.binding(k,core),coverage:'initial-matrix',group,matrixCases:levelCases.filter(c=>c.group===group).length,lifecycleCases:lifeCases.filter(c=>groupOfLife(c)===group).length,effectTemplates:templates.size,costs:costCases.filter(c=>c.group===group).length,decomposes:decomposeCases.filter(c=>c.group===group).length,rejects:rejectCases.filter(c=>c.group===group).length,manifestHash:manifest.manifestHash,evidenceHash};
  assert.equal(P.initialProblem(initialVerification[group],group),null,'首次證明紀錄與固定分母不符：'+group);
 }
 const attributes={covered:new Set(),nativeOnly:new Set()};
 for(const r of raw.levels.results)for(const o of r.observed.components){const rule=k.affixReplacement.attributes[o.id];(rule?attributes.covered:attributes.nativeOnly).add(o.id);}
 return {record:{date:new Date().toISOString().slice(0,10),initialVerification},stats:{level:levelCases.length,cost:costCases.length,decompose:decomposeCases.length,reject:rejectCases.length,lifecycle:lifeCases.length,evidenceHash,attributes:{covered:[...attributes.covered].sort((a,b)=>a-b),nativeOnly:[...attributes.nativeOnly].sort((a,b)=>a-b)}}};
}
module.exports={validate,validateLevels,validateLifecycle};
