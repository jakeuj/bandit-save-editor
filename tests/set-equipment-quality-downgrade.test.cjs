'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {saveFixture,renderSave}=require('./helpers/save-fixture.cjs');
const source=fs.readFileSync(require.resolve('../src/core.js'),'utf8');
const D=require('../scripts/set-equipment-quality-data.cjs');
const catalog=require('../knowledge/catalog.json'),templateId=28,originId=2;
const S=require('./helpers/set-quality-shipped.cjs');
const L=catalog.setEquipmentLevel,t=L.items[templateId],P原=L.origins[originId].affixIds,P套=catalog.setEquipmentQuality.pools[templateId].affixIds;
const setOnly=P套.filter(a=>!P原.includes(a));
const UP={7:'backpackSetEquipmentQualityUpgrade',9:'setEquipmentQualityUpgrade'},DOWN={7:'backpackSetEquipmentQualityDowngrade',9:'setEquipmentQualityDowngrade'};
const ALL=[UP[7],UP[9],DOWN[7],DOWN[9]];
// Quality gates open only inside this isolated knowledge copy, which starts with every set-quality and cross-pool group closed.
function fixture({plane=9,owner=0,quality=5,level=3,affixes,flags={},open=ALL}={}){
 const k=S.closed(catalog);for(const g of ['backpackSetEquipmentLevel','setEquipmentLevel'])k.verification[g]=true;
 D.requireClosed(structuredClone(k));for(const g of open)k.verification[g]=true;
 const ctx={};vm.runInNewContext(source.replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
 const {data}=saveFixture({characters:2}),id=20,row=Array(60).fill(0);
 Object.assign(row,{0:5,1:templateId,2:1,3:t.tier,5:quality,6:level,7:owner,8:95+30*(quality-1),23:3,24:1,26:1.7,27:originId});
 const ids=affixes||P原.slice(0,quality-1);
 for(let slot=1;slot<quality;slot++){row[8+slot]=ids[slot-1];row[14+slot]=40+10*(quality-1);row[27+slot]=flags[slot]||0;}
 row.forEach((v,y)=>data[id][y][plane]=v);if(owner)data[owner][15+t.slot][2]=id;
 const text=renderSave(data),model=C.parse(text);return {C,data,text,model,id,plane,row};
}
const apply=(f,o)=>f.C.applySetEquipmentQualityCandidate(f.model,{itemId:f.id,plane:f.plane,...o});
const untouched=f=>{assert.equal(f.C.serialize(f.model),f.text);assert.equal(f.model.history.length,0);assert.equal(f.model.changes.size,0);};
const at=(f,y)=>({x:f.id,y,z:f.plane});
// Expected patches follow the parent spec directly: y5=Q, y8+=30ΔQ, kept subs +=10ΔQ, removed tails zero id/coef/flag.
function expected(f,quality,extra=[]){
 const r=f.row,d=quality-r[5],p=[[f.id,5,f.plane,quality],[f.id,8,f.plane,r[8]+30*d]];
 for(let s=1;s<r[5];s++){
  if(s<quality)p.push([f.id,14+s,f.plane,(Math.round(r[14+s]*100)+1000*d)/100]);
  else{if(r[8+s])p.push([f.id,8+s,f.plane,0]);if(r[14+s])p.push([f.id,14+s,f.plane,0]);if(r[27+s])p.push([f.id,27+s,f.plane,0]);}
 }
 return renderSave(f.data,[...p,...extra]);
}

test('confirmed downgrade zeroes removed tails and shifts kept rolls, keeping BOM and literals',()=>{
 for(const plane of [7,9])for(const owner of plane===7?[0]:[0,1])for(const quality of [1,2,4]){
  const f=fixture({plane,owner}),p=apply(f,{quality,confirmRemovedAffixes:true}),out=f.C.serialize(f.model);
  assert.equal(p.direction,'downgrade');assert.equal(p.group,DOWN[plane]);assert.equal(p.requiresRemovalConfirmation,true);
  assert.equal(out,expected(f,quality));
  assert.ok(out.startsWith('﻿{ "unrelated":987654321098765432109876543210,"exponent":1e+03,'));
  assert.equal(f.model.history.length,1);
  for(const c of f.model.changes.values()){assert.equal(c.group,`editing:equipment:${plane}:${f.id}`);assert.ok(![0,1,2,3,6,7,23,24,25,26,27].includes(c.y));}
  const info=f.C.setEquipmentQualityCandidateInfo(f.model,{itemId:f.id,plane});assert.equal(info.quality,quality);assert.equal(info.slots.length,quality-1);
  if(owner)assert.equal(f.C.get(f.model,{x:owner,y:15+t.slot,z:2}),f.id);
 }
 // A kept selected P套 slot keeps id and flag; removed unselected tails are cleared.
 const g=fixture({quality:4,affixes:[setOnly[0],P原[1],P原[2]],flags:{1:1}});
 apply(g,{quality:2,confirmRemovedAffixes:true});assert.equal(g.C.serialize(g.model),expected(g,2));
 assert.equal(g.C.get(g.model,at(g,28)),1);assert.equal(g.C.get(g.model,at(g,9)),setOnly[0]);
 // Hundredths arithmetic downward.
 const h=fixture({quality:3});h.model.original.data[h.id][15][9]=40.07;h.row[15]=40.07;
 apply(h,{quality:2,confirmRemovedAffixes:true});assert.equal(h.C.get(h.model,at(h,15)),30.07);
});
test('unconfirmed removal, removed selected slot, target cap and closed gates are refused without writing',()=>{
 for(const plane of [7,9]){
  for(const confirm of [undefined,false])
   {const f=fixture({plane});assert.throws(()=>apply(f,{quality:3,...(confirm===undefined?{}:{confirmRemovedAffixes:confirm})}),/請確認移除/);untouched(f);}
  for(const confirm of ['true',1,null]){const f=fixture({plane});assert.throws(()=>apply(f,{quality:3,confirmRemovedAffixes:confirm}),/刪槽確認格式/);untouched(f);}
  const sel=fixture({plane,affixes:[P原[0],P原[1],setOnly[0],P原[2]],flags:{3:1}});
  assert.throws(()=>apply(sel,{quality:3,confirmRemovedAffixes:true}),/已選洗練槽會被移除/);
  assert.equal(apply(sel,{quality:4,confirmRemovedAffixes:true}).slots[2].after.flag,1);
  const cap=fixture({plane,level:18});
  assert.throws(()=>apply(cap,{quality:2,confirmRemovedAffixes:true}),/等級超過目標品質上限/);untouched(cap);
  for(const open of [[],[UP[7],UP[9]],[DOWN[plane===7?9:7]]]){const f=fixture({plane,open});assert.throws(()=>apply(f,{quality:3,confirmRemovedAffixes:true}),/尚未完成獨立遊戲驗證/);untouched(f);}
 }
 // The shipped catalog opens a direction only with its merged first proof; while closed, the real knowledge refuses.
 S.assertShipped(catalog);
 const ctx={};vm.runInNewContext(source.replace('/*__KNOWLEDGE__*/null',JSON.stringify(catalog)),ctx);
 const f=fixture(),real=ctx.SaveCore,m=real.parse(f.text),run=()=>real.applySetEquipmentQualityCandidate(m,{itemId:f.id,quality:3,confirmRemovedAffixes:true});
 if(catalog.verification[DOWN[9]]){run();assert.notEqual(real.serialize(m),f.text);assert.equal(m.history.length,1);}
 else{assert.throws(run,/尚未完成獨立遊戲驗證/);assert.equal(real.serialize(m),f.text);assert.equal(m.history.length,0);}
});
test('quality→level→quality interleaves on one editing group; cap tracks the current quality',()=>{
 const f=fixture({quality:3,level:3}),tail={slot:3,attributeId:P原[2],coefficient:45};
 apply(f,{quality:4,addedAffixes:[tail]});
 f.C.setEquipmentLevel(f.model,{itemId:f.id,level:22});
 assert.throws(()=>apply(f,{quality:3,confirmRemovedAffixes:true}),/等級超過目標品質上限/);
 f.C.setEquipmentLevel(f.model,{itemId:f.id,level:18});
 apply(f,{quality:3,confirmRemovedAffixes:true});
 // Q3→Q4→Q3 returns every quality token to baseline; only the level change remains.
 assert.equal(f.C.serialize(f.model),renderSave(f.data,[[f.id,6,9,18]]));
 assert.equal(f.model.history.length,4);assert.equal(f.model.changes.size,1);
 assert.equal([...f.model.changes.values()][0].group,`editing:equipment:9:${f.id}`);
 f.C.undo(f.model);
 assert.equal(f.C.serialize(f.model),renderSave(f.data,[[f.id,5,9,4],[f.id,6,9,18],[f.id,8,9,185],[f.id,11,9,P原[2]],[f.id,15,9,70],[f.id,16,9,70],[f.id,17,9,45]]));
 f.C.undo(f.model);f.C.undo(f.model);
 assert.equal(f.C.serialize(f.model),renderSave(f.data,[[f.id,5,9,4],[f.id,8,9,185],[f.id,11,9,P原[2]],[f.id,15,9,70],[f.id,16,9,70],[f.id,17,9,45]]));
 f.C.undo(f.model);untouched(f);
});
test('restore on any quality or level token reverts the whole item; other edits and restoreAll behave',()=>{
 for(const y of [5,6,8,15,11]){
  const f=fixture({quality:3}),coin={x:1,y:2,z:0};
  f.C.set(f.model,coin,12345);
  apply(f,{quality:4,addedAffixes:[{slot:3,attributeId:P原[2],coefficient:45}]});
  f.C.setEquipmentLevel(f.model,{itemId:f.id,level:12});
  apply(f,{quality:2,confirmRemovedAffixes:true});
  const history=f.model.history.length;
  f.C.restore(f.model,at(f,y===11?6:y));
  assert.equal(f.C.serialize(f.model),renderSave(f.data,[[1,2,0,12345]]));
  assert.equal(f.model.history.length,history+1);
  f.C.undo(f.model);assert.equal(f.C.get(f.model,at(f,5)),2);assert.equal(f.C.get(f.model,at(f,6)),12);
  f.C.restoreAll(f.model);assert.equal(f.C.serialize(f.model),f.text);
 }
});
test('round trips without net change leave no tokens; failures keep earlier changes',()=>{
 const f=fixture({quality:3});
 apply(f,{quality:2,confirmRemovedAffixes:true});
 apply(f,{quality:3,addedAffixes:[{slot:2,attributeId:P原[1],coefficient:60}]});
 assert.equal(f.C.serialize(f.model),f.text);assert.equal(f.model.changes.size,0);assert.equal(f.model.history.length,2);
 assert.equal(apply(f,{quality:3}).unchanged,true);assert.equal(f.model.history.length,2);
 f.C.setEquipmentLevel(f.model,{itemId:f.id,level:5});const kept=f.C.serialize(f.model);
 assert.throws(()=>f.C.transaction(f.model,()=>{apply(f,{quality:2,confirmRemovedAffixes:true});throw Error('外層失敗');},'外層'),/外層失敗/);
 assert.throws(()=>apply(f,{quality:2}),/請確認移除/);
 assert.equal(f.C.serialize(f.model),kept);assert.equal(f.model.history.length,3);
});
test('formal level, quality and raw field entries still refuse the cross-pool range after a candidate downgrade',()=>{
 for(const plane of [7,9]){
  const f=fixture({plane,quality:4,affixes:[setOnly[0],P原[1],P原[2]],flags:{1:1}});
  apply(f,{quality:2,confirmRemovedAffixes:true});const out=f.C.serialize(f.model);
  assert.throws(()=>f.C.setEquipmentLevelInfo(f.model,{itemId:f.id,plane}),/套裝等級/);
  assert.throws(()=>f.C.setEquipmentLevel(f.model,{itemId:f.id,plane,level:4}),/套裝等級/);
  assert.throws(()=>f.C.editingInfo(f.model,'equipment',f.id,plane),/套裝等級/);
  for(const api of ['previewEquipmentQualityChange','setEquipmentQuality'])assert.throws(()=>f.C[api](f.model,{itemId:f.id,plane,quality:1,confirmRemovedAffixes:true}));
  for(const api of ['set','setField'])for(const y of [5,8,9,15,28])assert.throws(()=>f.C[api](f.model,{x:f.id,y,z:plane},1),/唯讀/);
  assert.equal(f.C.serialize(f.model),out);assert.equal(f.model.history.length,1);
 }
});
