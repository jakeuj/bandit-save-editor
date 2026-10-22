'use strict';
const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const sha=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const group='randomCharacterSkillCaps',hashPattern=/^[0-9a-f]{64}$/;
// Bind all unembedded write logic, including eligibility, transactions, batches and exact serialization.
const formulaHash=source=>sha(source.replace(/\r\n/g,'\n'));
const dataHash=k=>sha(k.randomCharacterSkillCaps);
const binding=(k,source)=>({gameVersion:k.gameVersion,fingerprints:{...k.fingerprints,...k.batch2Fingerprints},dataHash:dataHash(k),formulaHash:formulaHash(source)});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function sourceChecks(source,expected){
 assert.ok(source&&Object.keys(source.fingerprints||{}).length===15,'缺少實際15來源紀錄');
 assert.deepEqual(source.fingerprints,expected.fingerprints,'實際來源與測試catalog不符');
 assert.equal(Object.keys(source.sourceHashes||{}).length,15,'實際來源摘要不完整');
 for(const [file,hash]of Object.entries(expected.fingerprints)){
  assert.match(hash,hashPattern);const actual=source.sourceHashes[file];assert.match(actual||'',hashPattern);
  if(actual!==hash){assert.equal(file,'scripts/c3runtime.js');assert.equal(source.runtimePatch?.original_c3runtime_sha256,hash);assert.equal(source.runtimePatch?.patched_c3runtime_sha256,actual);}
 }
 assert.ok(source.originalFileHashes?.length&&source.originalFileHashes.every(h=>hashPattern.test(h)),'缺少原檔雜湊');
 const assertions=source.assertions;
 assert.ok(Array.isArray(assertions)&&assertions.length>=2&&assertions.every(a=>a.passed===true&&Number.isSafeInteger(a.pid)&&a.pid>0&&hashPattern.test(a.savedHash||'')),'缺少原版存檔斷言');
 const initial=assertions.find(a=>!a.restarted),reload=assertions.find(a=>a.restarted&&a.pid!==initial?.pid);
 assert.ok(initial&&reload,'原版存檔必須停止後以新 PID 讀回');
 return {load:true,save:true,restart:true,originalHashes:true};
}
// Recompute checks from native observations; CLI exit 0 or a supplied all-true map proves nothing by itself.
function copyChecks(copy,expected){
 assert.equal(copy.family,group);assert.equal(copy.ok,true);assert.ok(copy.steps?.length);
 assert.ok(copy.steps.every(s=>s.ok===true),'原生步驟失敗');
 for(const step of ['setup','load','oracle','save','assert','reload','oracleCompare','stop'])assert.ok(copy.steps.some(s=>s.step===step),'缺少步驟 '+step);
 const evidence=copy.evidence;assert.ok(evidence?.scenario,'缺少原生結果與矩陣');
 assert.equal(copy.scenarioHash,sha(evidence.scenario),'矩陣內容已改變');
 assert.equal(copy.batchHash,sha(evidence.batchRequests||[]),'批次要求已改變');
 const checks=sourceChecks(evidence.source,expected);
 const native=require('./verify-random-character-skill-caps.cjs').validateEffects;
 assert.equal(typeof native,'function','原生oracle未完成');
 Object.assign(checks,native(evidence.effects,{scenario:evidence.scenario,compareRequired:true}));
 assert.ok(evidence.source.assertions.some(a=>!a.restarted&&a.pid===evidence.effects.load.pid),'oracle與原版初次存檔PID不符');
 assert.ok(evidence.source.assertions.some(a=>a.restarted&&a.pid===evidence.effects.reload.pid),'oracle與原版重啟PID不符');
 if(evidence.batchRequests?.length){
  assert.equal(checks.batchCompatibility,true,'批次要求缺少原生觀測');assert.deepEqual(evidence.effects.batchRequests,evidence.batchRequests,'原生報告批次要求不符');
  const followup=evidence.effects.batchFollowup,assertions=evidence.source.assertions,offset=assertions.findIndex(a=>a.restarted&&a.pid===evidence.effects.reload.pid)+1;
  assert.ok(followup.assertions.every(a=>a.restarted===true),'批次後續原生事件缺少重啟標記');
  assert.deepEqual(assertions.slice(offset),followup.assertions,'批次後續原生事件的存檔斷言不屬於同次來源紀錄');
 }
 if(copy.lifecycle){
  assert.ok(copy.steps.some(s=>s.step==='lifecycle'&&s.script==='verify-skill-caps-lifecycle.cjs'&&s.args?.includes('--compare')),'缺少生命週期讀回');
  const lifecycle=require('./verify-skill-caps-lifecycle.cjs').validateLifecycle;
  assert.equal(typeof lifecycle,'function','原生生命週期未完成');
  Object.assign(checks,lifecycle(evidence.lifecycle,{scenario:evidence.scenario,compareRequired:true}));
  const life=evidence.lifecycle,assertions=evidence.source.assertions;
  assert.equal(life.initialPid,evidence.effects.reload.pid,'生命週期不屬於此副本的oracle重啟');
  assert.deepEqual(life.initial,evidence.effects.reload.observed,'生命週期初始資料與oracle重啟讀回不同');
  const offset=assertions.findIndex(a=>a.restarted&&a.pid===life.initialPid)+1,stageAssertions=life.stages.flatMap(s=>s.assertions);
  assert.ok(stageAssertions.every(a=>a.restarted===true),'生命週期階段缺少重啟標記');
  assert.deepEqual(assertions.slice(offset,offset+stageAssertions.length),stageAssertions,'生命週期原版存檔斷言不屬於同次來源紀錄');
  assert.equal(assertions.length,offset+stageAssertions.length+2,'生命週期斷言鏈不完整');
  assert.equal(assertions.at(-2).pid,life.reload.previousPid);assert.equal(assertions.at(-1).pid,life.reload.pid);
  assert.equal(assertions.at(-2).savedHash,assertions.at(-1).savedHash,'最後一次生命週期重啟未讀回原版存檔');
 }
 return checks;
}
function manifestProblem(copies,initial,catalog,{partial=false}={}){
 const expectedNames=initial?['random-skill-caps-matrix','random-skill-caps-lifecycle']:['random-skill-caps-representative','random-skill-caps-lifecycle'];
 if(partial)assert.ok(!initial&&copies.length>0&&copies.length<=2&&new Set(copies.map(c=>c.name)).size===copies.length&&copies.every(c=>expectedNames.includes(c.name)),'未知或重複代表副本');
 else assert.deepEqual(copies.map(c=>c.name).sort(),expectedNames.sort(),'完整矩陣／代表矩陣與生命週期副本不完整');
 const matrix=copies.find(c=>!c.lifecycle),lifecycle=copies.find(c=>c.lifecycle);
 if(!partial)assert.ok(matrix&&lifecycle,'缺少矩陣或生命週期');
 const manifest=matrix?.evidence?.scenario?.skillCapManifest||[],life=lifecycle?.evidence?.scenario?.skillCapManifest||[];
 assert.ok(Array.isArray(manifest)&&Array.isArray(life),'缺少完整manifest');
 if(matrix){
 assert.equal(manifest.length,initial?108:2,'矩陣案例數不完整');
 assert.ok(manifest.every(m=>Number.isSafeInteger(m.id)&&m.id>0),'角色ID不合法');
 assert.equal(new Set(manifest.map(m=>m.id)).size,manifest.length,'矩陣角色重複');
 assert.equal(matrix.cases,manifest.length);
 assert.deepEqual(matrix.evidence.batchRequests,[{kind:'skillExperience',characterId:manifest[0].id,amount:20000}],'批次矩陣要求不符');
 const keys=manifest.map(m=>`${m.quality}:${m.primary}:${m.direction}`).sort();
 const expected=[];for(const q of initial?[1,2,3,4,5,6]:[1,6])for(const p of initial?[1,2,3,4,5,6,7,8,9]:[1])for(const d of initial?['up','down']:['up'])expected.push(`${q}:${p}:${d}`);
 assert.deepEqual(keys,expected.sort(),'矩陣缺少品質／主技藝／方向');
 for(const m of manifest)assert.equal(m.secondary,(m.primary-1+(m.direction==='up'?1:4))%9+1,'次技藝位置不符完整矩陣');
 }
 if(lifecycle){assert.equal(lifecycle.cases,2);assert.equal(life.length,2);assert.deepEqual(lifecycle.evidence.batchRequests,[],'生命週期副本不應混入批次');assert.deepEqual(life.map(m=>m.id),[10,11]);assert.ok(life.every(m=>m.quality===1));}
 for(const c of copies){
  const scenario=c.evidence.scenario;assert.equal(scenario.skillCapCoverage,initial?'initial-matrix':'representative','coverage不符');assert.equal(scenario.skillCapMatrixVersion,1,'未知矩陣版本');
  assert.deepEqual(scenario.skillCapCharacters,scenario.skillCapManifest.map(m=>m.id));assert.equal(scenario.skillCapCases?.length,c.cases);
  const baseline=new Map(scenario.baseline.map(([x,y,z,value])=>[[x,y,z].join(','),value])),observed=new Set(scenario.observe.map(cell=>cell.join(',')));
  assert.equal(scenario.operations.length,c.cases,'矩陣不得有額外覆寫操作');
  for(const [i,m]of scenario.skillCapManifest.entries()){
   const spec=scenario.skillCapCases[i],ranges=catalog.randomCharacterSkillCaps.ranges[m.quality-1];
   for(const key of ['id','quality','primary','secondary','direction'])assert.equal(spec[key],m[key],'case與manifest不符');
   const endpoint=which=>Array.from({length:9},(_,s)=>(s+1===m.primary?ranges.primary:s+1===m.secondary?ranges.secondary:ranges.base)[which]);
   assert.deepEqual(spec.beforeCaps,endpoint(m.direction==='up'?0:1),'矩陣起點不符來源端點');
   assert.deepEqual(spec.afterCaps,endpoint(m.direction==='up'?1:0),'矩陣終點不符來源端點');
   assert.deepEqual(spec.raw,Array(3).fill(catalog.randomCharacterSkillCaps.totals[m.quality-1][0]/3));
   assert.deepEqual(spec.talents,[1,2,3]);assert.deepEqual(spec.talentLevels,Array(3).fill(catalog.randomCharacterSkillCaps.talentLevels[m.quality-1][0]));
   const boundary=initial&&!c.lifecycle&&m.id===2;
   assert.equal(spec.atLevelBoundary,boundary);assert.deepEqual(spec.levels,spec.afterCaps.map(cap=>boundary?cap:1));assert.deepEqual(spec.remainders,spec.afterCaps.map((_,index)=>boundary?0:index===8?0.5:0));
   for(const [start,values]of [[22,spec.beforeCaps],[31,spec.levels],[40,spec.remainders]])for(const [index,value]of values.entries()){
    const key=[m.id,start+index,2].join(',');assert.equal(baseline.get(key),value,'矩陣基準未實際設為宣告值');assert.ok(observed.has(key),'矩陣缺少27欄原版存讀觀察');
   }
   assert.ok(scenario.operations.some(o=>o.method==='setCharacterSkillCaps'&&o.options.characterId===m.id&&same(o.options.caps,spec.afterCaps)),'缺少實際上限操作');
  }
 }
 return {matrixCases:manifest.length,lifecycleCases:life.length,manifestHash:sha(copies.map(c=>({name:c.name,manifest:c.evidence.scenario.skillCapManifest})))};
}
function validateMigrationCopy(copy,k,expected){manifestProblem([copy],false,k,{partial:true});return copyChecks(copy,expected);}
function validateResults(k,source,results,{initial=true}={}){
 assert.equal(results?.completed,true,'隔離矩陣未完成');
 assert.equal(results.gameVersion,k.gameVersion,'結果遊戲版本不符');
 const expected=binding(k,source);assert.deepEqual(results.skillCapsBinding,expected,'來源／資料／core摘要已改變');
 const copies=results.copies?.filter(c=>c.family===group)||[];
 if(initial)assert.equal(results.copies.length,2,'初次獨立證明只能包含完整上限矩陣與生命週期');
 const manifest=manifestProblem(copies,initial,k),derived=copies.map(c=>copyChecks(c,expected));
 const checks={};for(const check of require('./verification-requirements.cjs').requiredChecks(group)){
  const owners=derived.filter(c=>Object.hasOwn(c,check));assert.ok(owners.length&&owners.every(c=>c[check]===true),'缺少實證 check：'+check);checks[check]=true;
 }
 assert.deepEqual(results.checks?.[group],checks,'傳入checks與原生觀測不符');
 return {checks,validation:{version:1,runner:initial?'verify-skill-caps-suite.cjs':'verify-migration.cjs',...manifest,evidenceHash:sha({binding:expected,copies})}};
}
function initialProblem(initial){return !initial||initial.coverage!=='initial-matrix'||initial.matrixCases!==108||initial.lifecycleCases!==2||Object.keys(initial.fingerprints||{}).length!==15||!hashPattern.test(initial.dataHash||'')||!hashPattern.test(initial.formulaHash||'')||!hashPattern.test(initial.manifestHash||'')||!hashPattern.test(initial.evidenceHash||'');}
function record(k,source,{date,platform,checks,coverage='representative',copies,validation,initialVerification}){
 if(coverage==='initial-matrix')initialVerification={coverage,...binding(k,source),...validation};
 assert.ok(!initialProblem(initialVerification),'首次完整矩陣證明缺失');
 assert.ok(validation&&hashPattern.test(validation.evidenceHash||'')&&hashPattern.test(validation.manifestHash||''),'缺少原生結果摘要');
 return {date,platform,...binding(k,source),coverage,copies,validation,initialVerification,groups:{[group]:{checks}}};
}
function problem(k,proof,source){
 if(proof.schemaVersion===2)return require('./migration-proof.cjs').problem(k,proof,source,group);
 const p=proof[group],expected=binding(k,source),required=require('./verification-requirements.cjs').requiredChecks(group);
 if(!p||!k.randomCharacterSkillCaps||Object.keys(expected.fingerprints).length!==15||!same({gameVersion:p.gameVersion,fingerprints:p.fingerprints,dataHash:p.dataHash,formulaHash:p.formulaHash},expected)||initialProblem(p.initialVerification)||!['initial-matrix','representative'].includes(p.coverage)||p.validation?.version!==1||!hashPattern.test(p.validation?.evidenceHash||'')||!hashPattern.test(p.validation?.manifestHash||'')||p.validation.lifecycleCases!==2||p.validation.matrixCases!==(p.coverage==='initial-matrix'?108:2)||p.validation.runner!==(p.coverage==='initial-matrix'?'verify-skill-caps-suite.cjs':'verify-migration.cjs')||!required.every(c=>p.groups?.[group]?.checks?.[c]===true))return '一般隨機角色技藝上限缺少相符的獨立驗證';
 const initial=p.coverage==='initial-matrix',copies=[{name:initial?'random-skill-caps-matrix':'random-skill-caps-representative',operations:initial?108:2},{name:'random-skill-caps-lifecycle',operations:2}];
 if(!same(p.copies,copies)||initial&&!same(p.initialVerification,{coverage:p.coverage,...expected,...p.validation}))return '一般隨機角色技藝上限缺少相符的獨立驗證';
 return null;
}
function requireNativeRunner(){
 const family=require('./verification-suite.cjs').families[group];
 if(family.pendingReason)throw Error(family.pendingReason+'；不可產生或合併成功證明');
 for(const [file,fn]of [['verify-random-character-skill-caps.cjs','validateEffects'],['verify-skill-caps-lifecycle.cjs','validateLifecycle']])assert.equal(typeof require('./'+file)[fn],'function','原生驗證器尚未完成');
}
module.exports={group,sha,binding,formulaHash,dataHash,record,problem,requireNativeRunner,copyChecks,validateMigrationCopy,validateResults,initialProblem};
