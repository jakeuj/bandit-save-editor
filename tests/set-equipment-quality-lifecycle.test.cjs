'use strict';
// Synthetic tests for the B2 lifecycle runner: planning, bytes, a mock engine behind the real driver, validators and coverage.
// No game, no real save: the engine is a small in-memory stand-in with the move semantics observed in B2 (y0–49 only).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../scripts/verify-set-equipment-quality-migration-lifecycle.cjs'),O=require('../scripts/set-equipment-quality-oracle.cjs'),M=require('../scripts/set-equipment-quality-scenarios.cjs'),Q=require('../scripts/set-equipment-quality-data.cjs');
const k=require('../knowledge/catalog.json'),source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
const filler=Object.fromEntries(['baselineHash','runtimeHash','sourceManifestHash','runtimeManifestHash'].map(n=>[n,'0'.repeat(64)]));
const census=O.reachabilityCensus(k.setEquipmentQuality,k.setEquipmentLevel);
// A valid native-shaped baseline record for a template at quality q (slots from P原, flag 0, materials at 3 points).
function baseline(templateId,q){
 const row=census.find(r=>r.templateId===templateId),origin=k.setEquipmentLevel.origins[row.originId],set=k.setEquipmentQuality.pools[templateId],rec=Array(60).fill(0);
 Object.assign(rec,{0:1,1:templateId,2:1,3:set.tier,5:q,6:1,8:95+30*(q-1),23:3,24:1,26:1.5,27:row.originId});
 for(let s=1;s<=q-1;s++){rec[8+s]=origin.affixIds[s-1];rec[14+s]=O.subRange(q)[0]+5;}
 return {templateId,quality:q,origin:row.originId,after:rec};
}
const templates=Object.keys(k.setEquipmentQuality.pools).map(Number);
const results=templates.flatMap(t=>[1,2,3,4,5,6].map(q=>baseline(t,q)));
const saveText=()=>{const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='驗證角色';return JSON.stringify({c2array:true,size:[221,60,22],data});};

test('planning gives six class starts with distinct templates, both tiers, and legal oracle-checked edits',()=>{
 const copies=R.planCopies(k,results);
 assert.deepEqual(copies.map(c=>c.caseId),R.classes().map(c=>R.lifecycleId(c.state,c.direction)));
 assert.equal(new Set(copies.map(c=>c.templateId)).size,6);assert.deepEqual([...new Set(copies.map(c=>c.tier))].sort(),[1,9]);
 for(const c of copies){assert.equal(c.group,M.groupOf(c.state,c.direction));assert.equal(c.plane,c.state==='backpack'?7:9);assert.equal(c.record[7],c.state==='equipped'?1:0);assert.ok((c.to>c.from)===(c.direction==='up'));}
 assert.equal(R.planCopies(k,results,{perClass:2}).length,12);
 assert.throws(()=>R.planCopies(k,results,{perClass:4}),/非法/);assert.throws(()=>R.planCopies(k,results.filter(v=>v.quality!==4)),/缺 /);
});
test('start bytes come from the candidate transaction and agree with both independent oracles',()=>{
 const C=R.candidateCore(k,source);
 for(const c of R.planCopies(k,results,{perClass:2})){
  const b=R.buildStart(C,k,saveText(),c),after=JSON.parse(b.editedText).data;
  assert.equal(after[1][5][c.plane],c.to);assert.equal(b.tail.length,Math.max(0,c.to-c.from));
  assert.deepEqual(b.pointers,c.state==='equipped'?Array.from({length:6},(_,s)=>s+1===c.slot?1:0):Array(6).fill(0));
  assert.notEqual(b.startText,b.editedText);
 }
 const ctx={};require('node:vm').runInNewContext(source.replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const shipped=ctx.SaveCore;
 assert.throws(()=>R.buildStart(shipped,k,saveText(),R.planCopies(k,results)[0]),/尚未完成/);
});

// ---- mock engine ---------------------------------------------------------------------------------------------------------
function engine(k,start){
 const cells=new Map(),key=(x,y,z)=>x+','+y+','+z,At=(x,y,z)=>cells.get(key(x,y,z))??0,Set=(x,y,z,v)=>cells.set(key(x,y,z),v);
 const data=JSON.parse(start).data;for(const z of [7,9])for(let x=1;x<30;x++)for(let y=0;y<60;y++)if(data[x][y][z])Set(x,y,z,data[x][y][z]);for(let s=0;s<6;s++)Set(1,16+s,2,data[1][16+s][2]);
 let n=0;const blocks={};
 const free=z=>{for(let id=1;id<30;id++)if(!At(id,0,z))return id;throw Error('full');};
 const move=(from,to,y7)=>{const dest=free(to.z);for(let y=0;y<50;y++){Set(dest,y,to.z,At(from.id,y,from.z));Set(from.id,y,from.z,0);}Set(dest,7,to.z,y7);return dest;};
 blocks['装备库取出']=id=>{move({id,z:9},{z:7},0);};
 blocks['穿戴装备']=(slot,id)=>{Set(1,15+slot,2,move({id,z:7},{z:9},1));};
 blocks['卸下装备']=(slot,id)=>{Set(1,15+slot,2,0);move({id,z:9},{z:7},0);};
 blocks['刷新单角色全属性']=()=>{};blocks['装备排序']=()=>{};
 blocks['词条洗练']=(id,slot,z)=>{const pool=k.setEquipmentQuality.pools[At(id,1,z)].affixIds,q=At(id,5,z);Set(id,8+slot,z,pool[n++%pool.length]);Set(id,14+slot,z,O.subRange(q)[0]+9+n/100);Set(id,27+slot,z,1);Set(3,2,0,At(3,2,0)-100);};
 const fn=name=>({GetEventBlock:()=>({GetSolModifiersIncludingParents:()=>null,RunAsExpressionFunctionCall:(a,b,c,d,...args)=>blocks[name](...args)}),IsCopyPicked:()=>false,GetReturnType:()=>0,GetDefaultReturnValue:()=>0});
 return {At,Set,rows:cells,runtime:{GetEventSheetManager:()=>({GetFunctionBlockByName:name=>blocks[name]?fn(name):null}),GetObjectClassByName:()=>({GetInstances:()=>[{GetSdkInstance:()=>({At,Set,GetWidth:()=>30})}]}),SetTimeScale(){}}};
}
async function play(copy){
 const C=R.candidateCore(k,source),start=R.buildStart(C,k,saveText(),copy),eng=engine(k,start.editedText);
 const saved={self:globalThis.self,timeout:globalThis.setTimeout};globalThis.self=globalThis;globalThis.__banditValidationRuntime=eng.runtime;globalThis.setTimeout=fn=>{fn();return 0;};
 let pid=100;
 try{
  const report=await R.playCopy({copy,k,start,pid0:pid,rpc:request=>R.lifecycleDriver(JSON.parse(JSON.stringify(request))),restart:async()=>++pid});
  return {copy,report};
 }finally{globalThis.self=saved.self;if(!saved.self)delete globalThis.self;globalThis.setTimeout=saved.timeout;delete globalThis.__banditValidationRuntime;}
}
const copies=R.planCopies(k,results);

test('driver + assembly produce a report every validator accepts, for all six classes',async()=>{
 for(const copy of copies){
  const {report}=await play(copy),summary=R.validateCopy(k,copy,report);
  assert.deepEqual(summary.steps,copy.plane===7?['equip','unequip']:['takeout','equip','unequip']);
  assert.equal(report.rounds.length,2);assert.equal(report.finalLocations.length,2);
  for(const step of report.cycle.steps)assert.equal(step.markers.length,10);
 }
});
test('validators refuse copied tails, uncleared sources, stale PIDs, bad refines and lost items',async()=>{
 const copy=copies[0],{report}=await play(copy),fresh=()=>structuredClone(report);
 let r=fresh();r.cycle.steps[0].record[55]=r.cycle.steps[0].markers[5];assert.throws(()=>R.validateCopy(k,copy,r),/尾十欄不得進入目的列/);
 r=fresh();r.cycle.steps[0].source[3]=1;assert.throws(()=>R.validateCopy(k,copy,r),/來源搬移後未清除/);
 r=fresh();r.cycle.steps[1].source[52]=1;assert.throws(()=>R.validateCopy(k,copy,r),/尾十欄來源不得被改寫/);
 r=fresh();r.cycle.steps[0].record[9]+=1;assert.throws(()=>R.validateCopy(k,copy,r),/搬移欄位 9/);
 r=fresh();r.rounds[1].pids[1]=r.rounds[0].pids[1];assert.throws(()=>R.validateCopy(k,copy,r),/PID/);
 r=fresh();r.rounds[0].reloaded[8]+=1;assert.throws(()=>R.validateCopy(k,copy,r),/讀回不一致/);
 r=fresh();r.rounds[0].observed[8]+=1;r.rounds[0].reloaded[8]+=1;assert.throws(()=>R.validateCopy(k,copy,r),/第一輪編輯後讀回須等於預期/);
 r=fresh();r.refine.attempts[0].row[9+4]=0;r.refine.attempts[0].row[10]=1;assert.throws(()=>R.validateCopy(k,copy,r),/洗練改變欄/);
 r=fresh();r.refine.attempts[0].row[O.col.id(1)]=999999;assert.throws(()=>R.validateCopy(k,copy,r),/不在 P套/);
 r=fresh();r.refine.attempts[0].soulCost=0;assert.throws(()=>R.validateCopy(k,copy,r),/魂魄成本/);
 r=fresh();r.refine.attempts[0].row[O.col.flag(1)]=0;assert.throws(()=>R.validateCopy(k,copy,r),/旗標/);
 r=fresh();r.sort.after=r.sort.after.map(v=>({...v,record:v.record.map((x,y)=>y===1?0:x)}));assert.throws(()=>R.validateCopy(k,copy,r),/排序後找不到/);
 r=fresh();r.finalLocations=[r.finalLocations[0]];assert.throws(()=>R.validateCopy(k,copy,r),/背包與裝備庫/);
 r=fresh();r.cycle.steps.pop();assert.throws(()=>R.validateCopy(k,copy,r),/unequip|equip/);
});

// ---- coverage and per-case results -----------------------------------------------------------------------------------------------
const manifest=M.createManifest(k,source,filler);
test('coverage maps copies to the A9 lifecycle denominator and lists everything else as pending',()=>{
 const all=R.planCopies(k,results),c=R.coverage(manifest,all);
 assert.equal(c.lifecycleCases,manifest.cases.filter(v=>v.kind==='lifecycle').length);assert.ok(c.baseComplete&&!c.missingBase.length);
 for(const base of R.classes()){const row=c.rows.find(r=>r.id===R.lifecycleId(base.state,base.direction));assert.deepEqual(row.copies,all.filter(v=>v.caseId===row.id).map(v=>v.id));assert.equal(row.status,'planned');}
 const total=Object.values(c.perGroup).reduce((n,g)=>n+g.total,0);assert.equal(total,c.lifecycleCases);
 for(const g of Object.values(c.perGroup))assert.equal(g.executable,g.passed+g.failed+g.planned+g.pending);
 assert.ok(c.rows.filter(r=>!r.executable).every(r=>r.status==='not-applicable'&&!r.copies.length));
 assert.ok(c.rows.filter(r=>r.executable&&!r.copies.length).every(r=>r.status==='pending-B4'));
 const partial=R.coverage(manifest,all.slice(1));assert.equal(partial.baseComplete,false);assert.deepEqual(partial.missingBase,[all[0].caseId]);
 const done=R.coverage(manifest,all,new Map(all.map(v=>[v.id,v.id!==all[2].id])));
 assert.equal(done.rows.find(r=>r.id===all[2].caseId).status,'failed');assert.equal(done.rows.find(r=>r.id===all[0].caseId).status,'passed');
 assert.equal(Object.values(done.perGroup).reduce((n,g)=>n+g.failed,0),1+done.rows.filter(r=>r.copies.includes(all[2].id)&&r.id!==all[2].caseId).length);
});
test('per-case output has the A10 shape, uses live case hashes and refuses unknown, missing or extra copies',()=>{
 const all=R.planCopies(k,results,{perClass:2}),outcomes=new Map(all.map(v=>[v.id,true])),out=R.caseResults(manifest,all,outcomes);
 assert.equal(out.length,6);
 for(const r of out){assert.deepEqual(Object.keys(r),['id','caseHash','passed','nativeCompared']);assert.equal(r.nativeCompared,true);const c=manifest.cases.find(v=>v.id===r.id);assert.equal(r.caseHash,Q.hash(c));}
 outcomes.delete(all[0].id);assert.throws(()=>R.caseResults(manifest,all,outcomes),/缺結果/);
 assert.throws(()=>R.caseResults(manifest,[{...all[0],caseId:'lifecycle:nope'}],new Map([[all[0].id,true]])),/未知或不適用/);
});
test('calibration results cannot be merged as proof: partial coverage is refused by the proof contract',()=>{
 const P=require('../scripts/set-equipment-quality-proof.cjs'),all=R.planCopies(k,results),outcomes=new Map(all.map(v=>[v.id,true])),cases=R.caseResults(manifest,all,outcomes);
 const group=all[0].group,native={coverage:'initial-matrix',manifestHash:manifest.manifestHash,cases:cases.filter(c=>manifest.cases.find(v=>v.id===c.id).group===group),io:{rounds:2,newPidReadback:true,shiftedColumns:50,tailColumns:10},ui:{}};
 assert.throws(()=>P.validateResults(k,source,{completed:true,checks:{[group]:{}},native:{[group]:native}},group));
});
test('runner stays outside the repo and keeps the shipped flags closed',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../scripts/verify-set-equipment-quality-migration-lifecycle.cjs'),'utf8');
 assert.match(src,/Artifacts must stay outside the repo/);
 for(const g of Q.groups)assert.equal(k.verification[g],false);
});
