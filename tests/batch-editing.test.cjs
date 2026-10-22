'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {setup}=require('./helpers/batch-fixture.cjs');
const request=(characterIds=[1,2],amount=6500)=>({kind:'characterExperience',characterIds,amount});

test('batch preview is readonly, commit is one undo and export replaces only independently expected tokens',async()=>{
 const {C,m,raw,rawWith}=setup();
 C.transaction(m,()=>C.set(m,{x:1,y:2,z:0},777),'existing');const before=C.serialize(m),history=m.history.length;
 const p=await C.previewBatch(m,request());assert.equal(C.serialize(m),before);assert.equal(m.history.length,history);assert.deepEqual({...p.summary},{targets:2,changed:2,unchanged:0,excluded:0,blocked:0,changedCells:4});
 await C.applyBatch(m,request(),{preview:p});
 assert.equal(m.history.length,history+1);
 assert.ok(C.serialize(m)===rawWith([[1,2,0,777],[1,3,2,3],[1,4,2,500],[2,3,2,3],[2,4,2,500]]),'only expected tokens change');
 C.undo(m);assert.equal(C.serialize(m),before);C.undo(m);assert.equal(C.serialize(m),raw);
});
test('last invalid target rolls back all state and reports every error without losing existing changes',async()=>{
 const s=setup(),{C,m}=s;C.transaction(m,()=>C.set(m,{x:1,y:2,z:0},77));
 const before=C.serialize(m),history=[...m.history],changes=m.changes,counter=m.operationCounter;
 const p=await C.previewBatch(m,request([1,2,300,301]));assert.equal(p.summary.blocked,2);assert.equal(p.canApply,false);
 await assert.rejects(C.applyBatch(m,request([1,2,300,301])),/整批未套用/);
 assert.equal(m.changes,changes);assert.deepEqual([...m.history],history);assert.equal(m.operationCounter,counter);assert.equal(C.serialize(m),before);
 for(const malformed of [{kind:'setField'}, {...request(),method:'set'}, {...request(),advanced:true},request([1,1]),request([])])await assert.rejects(C.applyBatch(m,malformed));
});

test('restore keeps existing cumulative growth and whole-equipment groups; undo reverses a restore',async()=>{
 const {C,m,raw}=setup();C.addExperience(m,{kind:'character',characterId:1,amount:100});
 await C.applyBatch(m,request());const after=C.serialize(m);
 C.restore(m,{x:1,y:4,z:2});assert.equal(C.get(m,{x:1,y:3,z:2}),1);assert.equal(C.get(m,{x:1,y:4,z:2}),0);assert.equal(C.get(m,{x:2,y:3,z:2}),3);
 C.undo(m);assert.equal(C.serialize(m),after);C.undo(m);assert.equal(C.get(m,{x:1,y:4,z:2}),100);
 C.restore(m,{x:1,y:4,z:2});assert.equal(C.serialize(m),raw);
 await C.applyBatch(m,{kind:'equipmentMax',plane:9});C.setEquipmentLevel(m,{itemId:3,level:4});C.restore(m,{x:3,y:6,z:9});assert.equal(C.get(m,{x:3,y:6,z:9}),1);assert.equal(C.get(m,{x:5,y:6,z:9}),10);
 C.transaction(m,()=>m.changes.clear());assert.equal(C.serialize(m),raw);
});

test('learned jobs only, profession decimals and nine skill coordinates agree with the existing APIs',async()=>{
 const {C,m}=setup();
 const p=await C.previewBatch(m,{kind:'professionExperience',characterId:1,amount:1.5});assert.equal(p.summary.targets,1);
 await C.applyBatch(m,{kind:'professionExperience',characterId:1,amount:1.5});assert.equal(C.get(m,{x:1,y:1,z:5}),1.5);assert.equal(C.get(m,{x:1,y:2,z:4}),0);
 await C.applyBatch(m,{kind:'skillExperience',characterId:1,amount:21500});for(let id=1;id<=9;id++){assert.equal(C.get(m,{x:1,y:30+id,z:2}),3);assert.equal(C.get(m,{x:1,y:39+id,z:2}),500);}
 m.original.data[1][59][2]=1;await assert.rejects(C.applyBatch(m,{kind:'professionExperience',characterId:1,amount:1}),/自動轉職/);
 for(const amount of [0,-1,1.1,Infinity,Number.MAX_SAFE_INTEGER+1])await assert.rejects(C.applyBatch(m,request([1],amount)));
});

test('each gate, no-op, equipment range, ownership and technology constraints remain effective',async()=>{
 const {C,m}=setup();
 for(const [gate,r]of [['characterExperience',request()],['professionExperience',{kind:'professionExperience',characterId:1,amount:1}],['skillExperience',{kind:'skillExperience',characterId:1,amount:1}],['equipmentLevel',{kind:'equipmentMax',plane:9}],['backpackEquipmentLevel',{kind:'equipmentMax',plane:7}],['advancedTechnologyLevel',{kind:'technologyLevel',level:2}]]){
  C.KNOWLEDGE.verification[gate]=false;await assert.rejects(C.applyBatch(m,r),/未|唯讀|停用/);C.KNOWLEDGE.verification[gate]=true;
 }
 await C.applyBatch(m,{kind:'equipmentMax',plane:7});const history=m.history.length,p=await C.previewBatch(m,{kind:'equipmentMax',plane:7});assert.equal(p.summary.unchanged,1);await C.applyBatch(m,{kind:'equipmentMax',plane:7});assert.equal(m.history.length,history);
 m.original.data[3][6][9]=11;await assert.rejects(C.applyBatch(m,{kind:'equipmentMax',plane:9}),/不會自動降級/);m.original.data[3][6][9]=1;
 m.original.data[3][7][9]=1;assert.equal((await C.previewBatch(m,{kind:'equipmentMax',plane:9})).summary.excluded,1);await assert.rejects(C.applyBatch(m,{kind:'equipmentMax',plane:9,includeEquipped:true}),/雙向/);
 m.original.data[31][13][0]=1;await assert.rejects(C.applyBatch(m,{kind:'technologyLevel',level:2}),/研究/);m.original.data[31][13][0]=0;
 await assert.rejects(C.applyBatch(m,{kind:'technologyLevel',level:25}),/實體空間/);
 await assert.rejects(C.applyBatch(m,{kind:'technologyLevel',level:300}),/上限/);
 for(let x=1;x<=405;x++)m.original.data[x][0][7]=x;
 await assert.rejects(C.applyBatch(m,{kind:'technologyLevel',level:2}),/容量小於/);
});

test('cancel, stale previews, interleaved mutations and changed requests cannot commit',async()=>{
 const {C,m}=setup(),r=request(),p=await C.previewBatch(m,r);
 C.transaction(m,()=>C.set(m,{x:1,y:2,z:0},2));await assert.rejects(C.applyBatch(m,r,{preview:p}),/重新預覽/);
 const before=C.serialize(m),history=m.history.length;
 const controller=new AbortController();await assert.rejects(C.applyBatch(m,r,{signal:controller.signal,onProgress:()=>controller.abort()}),/取消/);assert.equal(C.serialize(m),before);assert.equal(m.history.length,history);
 let changed=false;await assert.rejects(C.applyBatch(m,r,{onProgress:()=>{if(!changed){changed=true;C.transaction(m,()=>C.set(m,{x:1,y:2,z:0},3));}}}),/已改變/);assert.equal(C.get(m,{x:1,y:4,z:2}),0);
 const mutate=request();await assert.rejects(C.applyBatch(m,mutate,{onProgress:()=>{mutate.amount=1;}}),/參數已改變/);
});

test('isolated smoke applies fixed batches and observes every linked result',async()=>{
 const {applyBatchRequests}=require('../scripts/verify-game.cjs'),{C,m}=setup();
 const result=await applyBatchRequests(C,m,[request(),{kind:'skillExperience',characterId:1,amount:1000}]);
 assert.equal(result.results.length,2);assert.equal(result.cells.length,22);assert.equal(m.history.length,2);
 await assert.rejects(applyBatchRequests(C,m,[]),/1–20/);
 await assert.rejects(applyBatchRequests(C,m,[request([300])]),/blocked/);
});

test('full dimensions batch 2,500 characters and equipment without blocking cancellation or changing extra tokens',async t=>{
 const fixture=setup(2501,2500),{C,a,equipment}=fixture;
 for(let x=1;x<=2500;x++)equipment(x);
 const m=fixture.reparse(),raw=m.text,timings={};let ticks=0,progress=0;
 const timer=setInterval(()=>ticks++,1),start=performance.now();
 try{
  await C.applyBatch(m,request(Array.from({length:2500},(_,i)=>i+1)));timings.characterMs=Math.round(performance.now()-start);
  const controller=new AbortController(),before=C.serialize(m),history=m.history.length;
  await assert.rejects(C.applyBatch(m,{kind:'equipmentMax',plane:9},{signal:controller.signal,onProgress:({done})=>{if(done>0)controller.abort();}}),/取消/);
  assert.equal(C.serialize(m),before);assert.equal(m.history.length,history);
  const s=performance.now(),p=await C.previewBatch(m,{kind:'equipmentMax',plane:9},{onProgress:()=>progress++});timings.equipmentPreviewMs=Math.round(performance.now()-s);
  assert.equal(p.summary.targets,2500);assert.equal(p.summary.blocked,0);
  const applyStart=performance.now();await C.applyBatch(m,{kind:'equipmentMax',plane:9},{preview:p});timings.equipmentApplyMs=Math.round(performance.now()-applyStart);
  assert.equal(m.history.length,2);assert.equal(m.changes.size,7500);assert.ok(ticks>2);assert.ok(progress>2);
  const patches=[];for(let x=1;x<=2500;x++)patches.push([x,3,2,3],[x,4,2,500],[x,6,9,10]);
  const outputStart=performance.now(),output=C.serialize(m);timings.serializeMs=Math.round(performance.now()-outputStart);
  assert.ok(output===fixture.rawWith(patches),'7,500 expected tokens and all surrounding raw characters agree');
  C.undo(m);assert.equal(m.changes.size,5000);C.undo(m);assert.ok(C.serialize(m)===raw);
  t.diagnostic(JSON.stringify({...timings,timerTicks:ticks,progressEvents:progress,bytes:raw.length}));
 }finally{clearInterval(timer);}
});
