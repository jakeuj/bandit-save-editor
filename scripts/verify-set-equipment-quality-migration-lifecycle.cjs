#!/usr/bin/env node
'use strict';
// B2: lifecycle runner for set-equipment quality. Each copy is one fixed start (state × direction): the quality edit is applied by the
// candidate core to a fixed baseline save and written as bytes, then the isolated game runs two IO rounds with a new PID each:
//   round 1  load the edited save → observe → native save → stop → new PID → load → read back equal
//   round 2  native same-slot refine → equip/unequip move cycle (y0–49 only, tail markers y50–59) → native sort → save → stop → new PID → read back
// Results use the A10 per-case shape {id,caseHash,passed,nativeCompared:true}. This is calibration of the runner, not the B4 matrix.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict');
const O=require('./set-equipment-quality-oracle.cjs'),E=require('./set-equipment-quality-effects-oracle.cjs'),Q=require('./set-equipment-quality-data.cjs'),M=require('./set-equipment-quality-scenarios.cjs'),P=require('./set-equipment-quality-proof.cjs');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const {hash}=Q,states=M.states,directions=['up','down'];
// Marker values for y50–59, seeded on the source row right before each native move (7001+10·phase+i); a move must never copy them.
const markerBase=7001;
// [from,to] pairs per class; index 0 is the calibration copy, further indexes add copies of the same class.
const spans={up:[[2,3],[3,5],[1,2]],down:[[4,3],[6,4],[2,1]]};
const lifecycleId=(state,direction)=>`lifecycle:${state}-${direction}`;
const classes=()=>states.flatMap(state=>directions.map(direction=>({state,direction})));

// ---- pure planning -------------------------------------------------------------------------------------------------------
// One start per (state, direction, index). Templates alternate tiers 1/9 across classes so both ends of the tier axis are touched.
function planCopies(k,levelResults,{perClass=1}={}){
 assert.ok(Number.isSafeInteger(perClass)&&perClass>=1&&perClass<=spans.up.length,'非法每類副本數');
 const items=k.setEquipmentLevel.items,used=new Set(),out=[];
 classes().forEach(({state,direction},ci)=>{for(let i=0;i<perClass;i++){
  const [from,to]=spans[direction][i],tier=(ci+i)%2?9:1,plane=state==='backpack'?7:9;
  const source=levelResults.find(v=>v.quality===from&&v.after[23]===3&&items[v.templateId].tier===tier&&!used.has(v.templateId));
  assert.ok(source,`缺 ${state}-${direction} 的 Q${from} T${tier} 基準`);used.add(source.templateId);
  const record=source.after.slice();record[7]=state==='equipped'?1:0;
  out.push({id:i?`${lifecycleId(state,direction)}#${i+1}`:lifecycleId(state,direction),caseId:lifecycleId(state,direction),index:i,state,direction,plane,group:M.groupOf(state,direction),
   templateId:source.templateId,originId:source.origin,tier,from,to,slot:items[source.templateId].slot,record});
 }});
 return out;
}
// P原 tail for an upgrade: first origin ids not already kept; coefficient inside the target range with two decimals.
function tailFor(k,copy){
 const pool=k.setEquipmentLevel.origins[copy.originId].affixIds,keep=O.slots(copy.from),kept=new Set(copy.record.slice(9,9+keep));
 const need=O.slots(copy.to)-keep,ids=pool.filter(id=>!kept.has(id)).slice(0,Math.max(0,need));assert.equal(ids.length,Math.max(0,need),'原池不足以補尾槽');
 const [lo]=O.subRange(copy.to);return ids.map((attributeId,i)=>({slot:keep+1+i,attributeId,coefficient:lo+7.25+i}));
}
const emptyRows=(obj)=>{for(let x=1;x<obj.size[0];x++)for(const z of [7,9,18])for(let y=0;y<60;y++)obj.data[x][y][z]=0;for(let x=1;x<obj.size[0];x++)for(let s=1;s<=6;s++)obj.data[x][15+s][2]=0;};
// Start bytes: the fixed baseline save with exactly one item (and pointer when worn), then the real transaction through candidate SaveCore.
function candidateCore(k,source){
 const candidate=structuredClone(k);for(const g of Q.groups)candidate.verification[g]=true;
 const ctx={};vm.runInNewContext(source.replace('/*__KNOWLEDGE__*/null',JSON.stringify(candidate)),ctx);return ctx.SaveCore;
}
function buildStart(C,k,saveText,copy){
 const obj=JSON.parse(saveText.replace(/^﻿/,''));emptyRows(obj);
 copy.record.forEach((v,y)=>{obj.data[1][y][copy.plane]=v;});if(copy.state==='equipped')obj.data[1][15+copy.slot][2]=1;
 const startText=JSON.stringify(obj),m=C.parse(startText),tail=copy.direction==='up'?tailFor(k,copy):[];
 const preview=C.applySetEquipmentQualityCandidate(m,{itemId:1,plane:copy.plane,quality:copy.to,addedAffixes:tail,confirmRemovedAffixes:copy.direction==='down'});
 const editedText=C.serialize(m),edited=JSON.parse(editedText.replace(/^﻿/,'')),expected=Array.from({length:60},(_,y)=>edited.data[1][y][copy.plane]);
 // The independent oracles must agree with the real transaction before any native run.
 const oracle=O.transition(copy.record,copy.to,{tail:tail.map(t=>({id:t.attributeId,coefficient:t.coefficient}))},k.setEquipmentQuality,k.setEquipmentLevel);
 assert.ok(oracle.ok,'A7 oracle 拒絕起點：'+oracle.reason);assert.deepEqual(oracle.record,expected,'核心交易與 A7 oracle 不一致');
 assert.deepEqual(E.transition(copy.record,copy.to,{added:tail,confirmRemoved:copy.direction==='down'}),expected,'核心交易與 A8 oracle 不一致');
 E.assertQualityOnly(copy.record,expected,copy.to);
 return {startText,editedText,expected,tail,changes:preview.changes.length,pointers:Array.from({length:6},(_,s)=>edited.data[1][16+s][2])};
}

// ---- pure validation of one native observation report -------------------------------------------------------------------------
const colsOf=s=>[O.col.id(s),O.col.coef(s),O.col.flag(s)];
// Native same-slot refining must only touch the chosen slot, stay in the set pool, in the sub range of the current quality, and cost souls.
function validateRefine(k,copy,start,refine){
 const pools={origin:k.setEquipmentLevel.origins[copy.originId].affixIds,set:k.setEquipmentQuality.pools[copy.templateId].affixIds},[lo,hi]=O.subRange(copy.to),s=refine.slot;
 assert.ok(refine.attempts.length>0,'沒有洗練結果');let prev=start;
 refine.attempts.forEach((a,i)=>{
  for(let y=0;y<60;y++)if(!colsOf(s).includes(y))assert.equal(a.row[y],prev[y],`第 ${i+1} 次洗練改變欄 ${y}`);
  assert.ok(pools.set.includes(a.row[O.col.id(s)]),`第 ${i+1} 次洗練結果不在 P套`);
  assert.ok(a.row[O.col.coef(s)]>=lo&&a.row[O.col.coef(s)]<=hi,`第 ${i+1} 次係數超出 Q${copy.to} 區間`);
  assert.equal(a.row[O.col.flag(s)],1,`第 ${i+1} 次旗標`);assert.ok(a.soulCost>0,`第 ${i+1} 次無魂魄成本`);prev=a.row;
 });
 const last=refine.attempts.at(-1).row,setOnly=pools.set.filter(id=>!pools.origin.includes(id));
 assert.equal(!!refine.hit,setOnly.includes(last[O.col.id(s)]),'命中標示與結果不符');
 return {attempts:refine.attempts.length,hit:!!refine.hit,final:last};
}
// Sort must not change the record at either location (the page only reorders list order); the record is found again by identity.
function validateSort(sort,expected){
 assert.ok(sort&&Array.isArray(sort.after),'缺排序觀察');
 const hits=sort.after.filter(v=>v.record[0]>0&&v.record[1]===expected[1]&&v.record[5]===expected[5]);
 assert.equal(hits.length,1,'排序後找不到唯一的物品');
 for(let y=0;y<E.moveColumns;y++)if(y!==7)assert.equal(hits[0].record[y],expected[y],'排序改變欄 '+y);
 return hits[0];
}
// Everything one finished copy must satisfy. Throws on the first violated assertion; returns the compact summary on success.
function validateCopy(k,copy,report){
 const {expected,refine,cycle}=report;
 const refined=validateRefine(k,copy,expected,refine);
 E.validateCycle(cycle,refined.final,{slot:copy.slot,worn:copy.state==='equipped'});
 for(const step of cycle.steps)E.validateTail({steps:[step]},step.markers);
 E.validateIO(report.rounds,expected,report.finalLocations);
 assert.equal(report.rounds[0].label,'edit');assert.equal(report.rounds[1].label,'cycle');
 const bag=cycle.steps.at(-1);assert.equal(bag.plane,7);assert.equal(bag.record[7],0,'最後應在背包且無 owner');
 const sorted=validateSort(report.sort,cycle.steps.at(-1).record);
 return {refineAttempts:refined.attempts,setOnlyHit:refined.hit,steps:cycle.steps.map(s=>s.phase),sortedAt:{id:sorted.id,plane:sorted.plane}};
}

// ---- coverage ---------------------------------------------------------------------------------------------------------------
// Which A9 lifecycle cases does a set of copies cover? Base cases need the same state/direction copy; extra axes only when a copy
// shows the axis on the right group (tier, transition). Everything else stays listed as pending for B4.
function covers(copy,c){
 if(c.id===copy.caseId)return true;
 if(c.group!==copy.group||c.kind!=='lifecycle')return false;
 if(c.axis==='tier')return copy.tier===c.value;
 return false;
}
function coverage(manifest,copies,results=new Map()){
 const lifecycle=manifest.cases.filter(c=>c.kind==='lifecycle'),rows=lifecycle.map(c=>{
  const by=copies.filter(v=>covers(v,c)).map(v=>v.id),executable=c.classification!==M.classes.na;
  const status=!executable?'not-applicable':!by.length?'pending-B4':by.some(id=>results.get(id)===true)?'passed':by.some(id=>results.get(id)===false)?'failed':'planned';
  return {id:c.id,group:c.group,executable,copies:by,status};
 });
 const perGroup={};for(const r of rows){const g=perGroup[r.group]??={total:0,executable:0,passed:0,failed:0,planned:0,pending:0,notApplicable:0};g.total++;if(!r.executable)g.notApplicable++;else if(r.status==='passed')g.passed++;else if(r.status==='failed')g.failed++;else if(r.status==='planned')g.planned++;else g.pending++;g.executable+=r.executable?1:0;}
 const missingBase=classes().filter(({state,direction})=>!copies.some(v=>v.caseId===lifecycleId(state,direction))).map(v=>lifecycleId(v.state,v.direction));
 return {lifecycleCases:lifecycle.length,rows,perGroup,missingBase,baseComplete:!missingBase.length};
}
// A10 per-case results for the base lifecycle cases a copy proves. caseHash is the live manifest hash, so stale cases are visible.
function caseResults(manifest,copies,outcomes){
 const byId=new Map(manifest.cases.map(c=>[c.id,c])),out=[];
 for(const copy of copies){
  if(copy.index!==0)continue;const c=byId.get(copy.caseId);assert.ok(c&&c.classification!==M.classes.na,'未知或不適用案例 '+copy.caseId);
  const passed=outcomes.get(copy.id);assert.equal(typeof passed,'boolean','缺結果 '+copy.id);
  out.push({id:c.id,caseHash:hash(c),passed,nativeCompared:true});
 }
 return out;
}

// ---- native driver (runs inside the instrumented disposable game; calls original functions only) ---------------------------------
async function lifecycleDriver(request){
 const runtime=self.__banditValidationRuntime,manager=runtime.GetEventSheetManager(),a=runtime.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();
 const call=(name,...args)=>{const f=manager.GetFunctionBlockByName(name);if(!f)throw Error('Missing native function '+name);const b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};
 const pause=()=>new Promise(resolve=>setTimeout(resolve,500)),read=(id,z)=>Array.from({length:60},(_,y)=>a.At(id,y,z)),refs=()=>Array.from({length:6},(_,s)=>a.At(1,16+s,2));
 const observe=locations=>({records:locations.map(v=>({...v,record:read(v.id,v.plane)})),refs:refs()});
 const find=(z,template)=>{for(let id=1;id<a.GetWidth();id++)if(a.At(id,0,z)>0&&a.At(id,1,z)===template)return id;throw Error('Native destination absent '+z+' refs '+JSON.stringify(refs()));};
 if(request.op==='observe')return observe(request.locations);
 if(request.op==='prepare'){runtime.SetTimeScale(0);a.Set(3,2,0,1e9);a.Set(1,2,0,1e12);for(const d of request.decoys)d.record.forEach((v,y)=>a.Set(d.id,y,d.plane,v));return observe([{id:1,plane:request.plane}]);}
 if(request.op==='refine'){
  const attempts=[];let hit=false;
  while(attempts.length<request.max){const souls=a.At(3,2,0);call('词条洗练',1,request.slot,request.plane);const row=read(1,request.plane);attempts.push({row,soulCost:souls-a.At(3,2,0)});
   if(request.setOnly.includes(row[8+request.slot])){hit=true;break;}if(!request.setOnly.length)break;}
  return {slot:request.slot,hit,attempts,refs:refs()};
 }
 if(request.op==='cycle'){
  const initial=read(1,request.plane),steps=[],template=initial[1];let bag=1,z9=1;
  const seed=(source)=>{const m=Array.from({length:10},(_,i)=>request.markerBase+steps.length*10+i);m.forEach((v,i)=>a.Set(source.id,50+i,source.plane,v));return m;};
  const step=(phase,id,plane,source,markers)=>steps.push({phase,id,plane,record:read(id,plane),source:read(source.id,source.plane),sourceAt:source,markers,refs:refs()});
  if(request.plane===9){
   const m=seed({id:1,plane:9});if(initial[7])call('卸下装备',request.slot,1,1,false,false);else call('装备库取出',1,true,0);
   await pause();bag=find(7,template);step('takeout',bag,7,{id:1,plane:9},m);
  }
  const from=bag,m1=seed({id:from,plane:7});call('穿戴装备',request.slot,bag,1,false,false);await pause();z9=a.At(1,15+request.slot,2);
  if(!z9)throw Error('Native equip did not set role pointer '+JSON.stringify(refs()));step('equip',z9,9,{id:from,plane:7},m1);
  call('刷新单角色全属性',1,true,0);const m2=seed({id:z9,plane:9});call('卸下装备',request.slot,z9,1,false,false);await pause();bag=find(7,template);step('unequip',bag,7,{id:z9,plane:9},m2);
  return {initial,steps,locations:[{id:bag,plane:7},{id:z9,plane:9}]};
 }
 if(request.op==='sort'){
  const snapshot=()=>{const rows=[];for(const plane of [7,9])for(let id=1;id<=12;id++)rows.push({id,plane,record:read(id,plane)});return rows;};
  const before=snapshot();call('装备排序',request.index);await pause();return {before,after:snapshot(),refs:refs()};
 }
 throw Error('Unknown lifecycle request '+request.op);
}

// ---- orchestration ---------------------------------------------------------------------------------------------------------
// The two IO rounds against any driver: rpc(request) runs lifecycleDriver, restart() saves natively, stops, starts a new PID and reloads.
async function playCopy({copy,k,start,pid0,rpc,restart}){
  const loc1=[{id:1,plane:copy.plane}];
  // Round 1: the edited bytes load, read back, survive a native save and a new PID.
  const observed1=await rpc({op:'observe',locations:loc1});assert.deepEqual(observed1.records[0].record,start.expected,'載入後與編輯結果不符');
  assert.deepEqual(observed1.refs,start.pointers,'角色指標與存檔不符');
  const pid1=await restart();assert.notEqual(pid0,pid1,'第一輪 PID 未更新');
  const reloaded1=await rpc({op:'observe',locations:loc1});assert.deepEqual(reloaded1,observed1,'第一輪新 PID 讀回不一致');
  const round1={label:'edit',observed:observed1.records[0].record,reloaded:reloaded1.records[0].record,pids:[pid0,pid1]};
  // Round 2: refine in place, move cycle with tail markers, sort, then save and read back again.
  const pools=k.setEquipmentQuality.pools[copy.templateId].affixIds,origin=k.setEquipmentLevel.origins[copy.originId].affixIds,setOnly=pools.filter(id=>!origin.includes(id));
  const decoy=copy.record.map((v,y)=>y===1?copy.originId:y===0?1:[7,23,24,26,27].includes(y)?0:v),decoys=[{id:2,plane:7,record:decoy},...(copy.plane===7?[{id:1,plane:9,record:decoy}]:[])];
  await rpc({op:'prepare',plane:copy.plane,decoys});
  const refine=await rpc({op:'refine',plane:copy.plane,slot:1,setOnly,max:120});validateRefine(k,copy,start.expected,refine);
  const cycle=await rpc({op:'cycle',plane:copy.plane,slot:copy.slot,markerBase});
  const sort=await rpc({op:'sort',index:0});
  const bagAfter=validateSort(sort,cycle.steps.at(-1).record),finalLocations=[{id:bagAfter.id,plane:7},...cycle.locations.filter(v=>v.plane===9)];
  const beforeFinal=await rpc({op:'observe',locations:finalLocations});const pid2=await restart();assert.notEqual(pid1,pid2,'第二輪 PID 未更新');
  const afterFinal=await rpc({op:'observe',locations:finalLocations});assert.deepEqual(afterFinal,beforeFinal,'第二輪新 PID 讀回不一致');
  const round2={label:'cycle',observed:beforeFinal.records.map(v=>v.record),reloaded:afterFinal.records.map(v=>v.record),pids:[pid1,pid2]};
 return {expected:start.expected,refine,cycle,sort,finalLocations,rounds:[round1,round2]};
}
async function runCopy({copy,k,source,entry,out,saveInfo,catalogPath,port,C,fixedText}){
 const {evaluate,waitMain}=require('./verify-game.cjs'),L=require('./verify-set-equipment-level-lifecycle.cjs');
 const rpc=(state,request)=>evaluate(state,`(${lifecycleDriver.toString()})(${JSON.stringify(request)})`);
 const start=buildStart(C,k,fixedText,copy),dir=path.join(out,'starts',copy.id.replace(/[^\w-]/g,'_')),file=path.join(dir,'savedir','ea3save.dat');
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,start.editedText);if(saveInfo)fs.copyFileSync(saveInfo,path.join(path.dirname(file),'saveinfo.dat'));
 const observeCells=[...Array.from({length:60},(_,y)=>[1,y,copy.plane]),...Array.from({length:6},(_,s)=>[1,16+s,2])],scenarioFile=path.join(dir,'scenario.json');
 fs.writeFileSync(scenarioFile,JSON.stringify({observe:observeCells}));
 let stateFile;
 try{
  const setup=L.command(['--setup','--source',entry.source,'--runtime',entry.runtime,'--save-file',file,'--catalog',catalogPath,'--artifacts',out,'--scenario',scenarioFile,'--port',String(port)]);
  stateFile=setup.match(/STATE (.+)/)[1].trim();L.command(['--state',stateFile,'--load']);let s=JSON.parse(fs.readFileSync(stateFile));await waitMain(s);
  const played=await playCopy({copy,k,start,pid0:s.pid,rpc:request=>rpc(s,request),restart:async()=>{s=await L.checkpoint(stateFile);return s.pid;}});
  return {copy,start:{hash:hash(start.editedText),tail:start.tail,changes:start.changes,pointers:start.pointers},report:played,stateFile,
   source:{fingerprints:s.fingerprints,sourceHashes:s.sourceHashes,assertions:s.assertions},steam:JSON.parse(fs.readFileSync(path.join(s.dir,'steam-init.json'),'utf8'))};
 }finally{if(stateFile)try{L.command(['--state',stateFile,'--stop']);}catch{}}
}

async function run({out,perClass=1,only,verbose=console.log}){
 const root=path.resolve(__dirname,'..'),index=JSON.parse(fs.readFileSync(path.join(root,'.local/game-sources.json'),'utf8')),entry=index.entries.find(e=>e.id===index.preferredDevelopmentSourceId);
 const B1=require('./set-equipment-quality-baseline.cjs'),catalogPath=path.join(root,'knowledge/catalog.json'),k=JSON.parse(fs.readFileSync(catalogPath,'utf8')),source=fs.readFileSync(path.join(root,'src/core.js'),'utf8');
 if(!path.relative(root,out).startsWith('..'))throw Error('Artifacts must stay outside the repo');fs.mkdirSync(out,{recursive:true});
 const b1=path.join(entry.artifactsRoot,'set-equipment-quality-B1'),levelFile=path.join(entry.artifactsRoot,'set-equipment-level-B','native-baselines.json');
 const fixedSave=path.join(entry.artifactsRoot,'native-cache-smoke-4IKtSE','baseline','savedir','ea3save.dat'),playerSave=path.join(index.installedGameDirectory,'savedir','ea3save.dat');
 const saveInfo=fs.existsSync(path.join(path.dirname(fixedSave),'saveinfo.dat'))?path.join(path.dirname(fixedSave),'saveinfo.dat'):null;
 const sources=B1.verifySources(entry,k),guarded={fixedSave:sha(fixedSave),playerSave:sha(playerSave),levelBaselines:sha(levelFile)};
 const level=JSON.parse(fs.readFileSync(levelFile,'utf8'));assert.deepEqual(level.binding.fingerprints,sources.fingerprints,'等級基準指紋不符');
 const copies=planCopies(k,level.results,{perClass}).filter(c=>!only||only.includes(c.id)),C=candidateCore(k,source),fixedText=fs.readFileSync(fixedSave,'utf8');
 const manifest=M.createManifest(k,source,{baselineHash:'0'.repeat(64),runtimeHash:entry.runtimeHash,sourceManifestHash:sources.sourceManifestHash,runtimeManifestHash:sources.runtimeManifestHash});
 const resultFile=path.join(out,'lifecycle-results.json'),binding={coreHash:hash(source.replace(/\r\n/g,'\n')),dataHash:hash(k.setEquipmentQuality),scenarioHash:hash(fs.readFileSync(path.join(__dirname,'set-equipment-quality-scenarios.cjs'),'utf8').replace(/\r\n/g,'\n')),
  runnerHash:hash(fs.readFileSync(__filename,'utf8').replace(/\r\n/g,'\n')),fingerprints:sources.fingerprints};
 const result=fs.existsSync(resultFile)?JSON.parse(fs.readFileSync(resultFile,'utf8')):{binding,copies:[]};assert.deepEqual(result.binding,binding,'續跑綁定不符（程式或輸入已改）');
 const base=19700+Math.floor(Math.random()*200);
 for(const [i,copy] of copies.entries()){
  if(result.copies.some(v=>v.id===copy.id))continue;
  const done=await runCopy({copy,k,source,entry,out,saveInfo,catalogPath,port:base+i,C,fixedText});
  let summary,error=null;try{summary=validateCopy(k,copy,done.report);}catch(e){error=e.message;}
  result.copies.push({id:copy.id,caseId:copy.caseId,passed:!error,error,summary,start:done.start,report:done.report,source:done.source,steam:done.steam});
  fs.writeFileSync(resultFile+'.tmp',JSON.stringify(result));fs.renameSync(resultFile+'.tmp',resultFile);verbose(`lifecycle ${result.copies.length}/${copies.length} ${copy.id} ${error?'FAILED '+error:'passed'}`);
 }
 const after={fixedSave:sha(fixedSave),playerSave:sha(playerSave),levelBaselines:sha(levelFile)};assert.deepEqual(after,guarded,'原檔或既有基準雜湊改變');
 assert.deepEqual(B1.verifySources(entry,k),sources,'快取雜湊改變');
 const outcomes=new Map(result.copies.map(v=>[v.id,v.passed])),done=copies.filter(c=>outcomes.has(c.id));
 const report={schemaVersion:1,task:'set-equipment-quality-B2',calibration:true,mergesProof:false,binding,manifestHash:manifest.manifestHash,guarded,guardedAfter:after,cacheUnchanged:true,
  copies:done.map(c=>({id:c.id,caseId:c.caseId,state:c.state,direction:c.direction,group:c.group,templateId:c.templateId,tier:c.tier,from:c.from,to:c.to,passed:outcomes.get(c.id)})),
  cases:caseResults(manifest,done,outcomes),coverage:(({rows,...rest})=>({...rest,pendingExecutable:rows.filter(r=>r.status==='pending-B4').length,covered:rows.filter(r=>r.copies.length).map(r=>r.id)}))(coverage(manifest,done,outcomes)),
  resultsHash:sha(resultFile)};
 fs.writeFileSync(path.join(out,'b2-report.json'),JSON.stringify(report,null,1)+'\n');return report;
}
module.exports={playCopy,markerBase,spans,lifecycleId,classes,planCopies,tailFor,candidateCore,buildStart,validateRefine,validateSort,validateCopy,covers,coverage,caseResults,lifecycleDriver,run};
if(require.main===module){
 const argv=process.argv.slice(2),opt=n=>argv.includes(n)?argv[argv.indexOf(n)+1]:undefined;
 // Without an explicit artifacts folder outside the repo nothing runs, so a migration run can never count this as evidence.
 if(!opt('--output')){console.error('套裝品質生命週期校正需要 --output（repo 外的 artifacts 目錄）；未提供，不產生任何驗證結果');process.exitCode=1;return;}
 run({out:path.resolve(opt('--output')),perClass:Number(opt('--per-class')||1),only:opt('--only')?.split(',')})
  .then(r=>{console.log(JSON.stringify({copies:r.copies.map(c=>c.id+':'+c.passed),cases:r.cases,baseComplete:r.coverage.baseComplete}));process.stdout.write('',()=>process.exit(r.copies.every(c=>c.passed)?0:1));})
  .catch(e=>{console.error(e.stack);process.stderr.write('',()=>process.exit(1));});
}
