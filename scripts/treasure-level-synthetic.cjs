'use strict';
// Synthetic checks of the candidate core against the independent oracle. Never counted as native evidence.
const assert=require('node:assert/strict'),vm=require('node:vm');
const O=require('./treasure-level-oracle.cjs');
function treasureRecord(k,templateId,{quality=1,level=1,owner=0}={}){
 const t=k.treasureLevel.items[templateId];assert.ok(t,'未知寶物範本');
 const r=Array(60).fill(0);Object.assign(r,{0:5,1:templateId,2:1,3:t.tier,5:quality,6:level,7:owner,8:100,22:0});return r;
}
function createSyntheticRunner(k,core){
 const candidate=structuredClone(k);candidate.verification.backpackTreasureLevel=candidate.verification.treasureLevel=true;
 const ctx={};vm.runInNewContext(core.replace('/*__KNOWLEDGE__*/null',JSON.stringify(candidate)),ctx);const C=ctx.SaveCore;
 const firstOf=tier=>+Object.keys(k.treasureLevel.items).find(i=>k.treasureLevel.items[i].tier===tier);
 return c=>{
  if(c.kind==='cost'){
   const level=c.mode==='at-cap'?O.cap(c.quality):1,cost=O.souls(c.tier,level),balance=c.mode==='insufficient'?cost-1:c.mode==='exact'||c.mode==='partial-max'?cost:1e12;
   return {expected:O.upgrade({tier:c.tier,quality:c.quality,level,souls:balance},['partial-max','maximum','at-cap'].includes(c.mode)),nativeCompared:false};
  }
  if(c.kind==='decompose'){
   const row=treasureRecord(k,firstOf(c.tier),{quality:c.quality,level:c.level});
   row[22]=c.mode==='batch-locked'?1:0;
   return {expected:c.mode==='single'?O.decompose(row):O.batchDecompose([row],{quality:6}),nativeCompared:false};
  }
  const plane=c.state==='backpack'?7:9,owner=c.state==='equipped'?1:0;
  const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='合成角色';
  const record=treasureRecord(k,c.templateId,{quality:c.quality,level:c.from,owner});record.forEach((v,y)=>data[20][y][plane]=v);if(owner)data[1][21][2]=20;
  const model=C.parse(JSON.stringify({c2array:true,size:[221,60,22],data})),options={itemId:20,plane,level:c.to};
  if(c.kind==='reject'){
   const row=model.original.data[20];
   switch(c.rejection){case 'q0':row[5][plane]=0;break;case 'q7':row[5][plane]=7;break;case 'level0':options.level=0;break;case 'overcap':options.level=1000;break;case 'fraction':options.level=1.5;break;case 'string':options.level='2';break;case 'unknown-template':row[1][plane]=0;break;case 'bad-quantity':row[2][plane]=2;break;case 'bad-tier':row[3][plane]=c.tier%6+1;break;case 'bad-owner':row[7][plane]=999;break;case 'duplicate-owner':if(plane===7)row[7][plane]=7;else model.original.data[2][21][2]=20;break;case 'bad-plane':options.plane=8;break;default:throw Error('未知拒絕案例');}
   const before=C.serialize(model);assert.throws(()=>C.setEquipmentLevel(model,options));assert.equal(C.serialize(model),before);assert.equal(model.history.length,0);return {rejected:true,nativeCompared:false};
  }
  C.setEquipmentLevel(model,options);const after=Array.from({length:60},(_,y)=>C.get(model,{x:20,y,z:plane}));O.assertLevelOnly(record,after,c.to);assert.equal(model.changes.size,1);
  return {expected:{record:after},nativeCompared:false};
 };
}
module.exports={treasureRecord,createSyntheticRunner};
