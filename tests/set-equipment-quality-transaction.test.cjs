'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {saveFixture,renderSave}=require('./helpers/save-fixture.cjs');
const source=fs.readFileSync(require.resolve('../src/core.js'),'utf8');
const D=require('../scripts/set-equipment-quality-data.cjs');
const catalog=require('../knowledge/catalog.json'),templateId=28,originId=2;
const L=catalog.setEquipmentLevel,t=L.items[templateId],P原=L.origins[originId].affixIds,P套=catalog.setEquipmentQuality.pools[templateId].affixIds;
const setOnly=P套.filter(a=>!P原.includes(a));
const UP={7:'backpackSetEquipmentQualityUpgrade',9:'setEquipmentQualityUpgrade'},DOWN={7:'backpackSetEquipmentQualityDowngrade',9:'setEquipmentQualityDowngrade'};
// Quality gates open only inside this isolated knowledge copy; the shipped catalog keeps all four groups unregistered.
function fixture({plane=9,owner=0,quality=3,level=3,affixes,flags={},open=[UP[7],UP[9]]}={}){
 const k=structuredClone(catalog);for(const g of ['backpackSetEquipmentLevel','setEquipmentLevel'])k.verification[g]=true;
 D.requireClosed(structuredClone(catalog));for(const g of open)k.verification[g]=true;
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
// Expected patches follow the parent spec directly: y5=Q, y8+=30ΔQ, kept subs +=10ΔQ, new tails id/coef with flag 0.
function expected(f,quality,added){
 const r=f.row,d=quality-r[5],p=[[f.id,5,f.plane,quality],[f.id,8,f.plane,r[8]+30*d]];
 for(let s=1;s<r[5];s++)p.push([f.id,14+s,f.plane,(Math.round(r[14+s]*100)+1000*d)/100]);
 for(const a of added)p.push([f.id,8+a.slot,f.plane,a.attributeId],[f.id,14+a.slot,f.plane,a.coefficient]);
 return renderSave(f.data,p);
}
const tails=(from,to,ids)=>ids.slice(0,to-from).map((attributeId,i)=>({slot:from+i,attributeId,coefficient:10*(to-1)+5.5}));

test('upgrade writes only the planned tokens and keeps BOM, whitespace, big integer and exponent literals',()=>{
 for(const plane of [7,9])for(const owner of plane===7?[0]:[0,1]){
  const f=fixture({plane,owner}),added=tails(3,5,P原.slice(2));
  const p=apply(f,{quality:5,addedAffixes:added}),out=f.C.serialize(f.model);
  assert.equal(p.direction,'upgrade');assert.equal(p.group,UP[plane]);
  assert.equal(out,expected(f,5,added));
  assert.ok(out.startsWith('﻿{ "unrelated":987654321098765432109876543210,"exponent":1e+03,'));
  assert.equal(f.model.history.length,1);
  for(const c of f.model.changes.values()){assert.equal(c.group,`editing:equipment:${plane}:${f.id}`);assert.equal(c.x,f.id);assert.equal(c.z,plane);assert.ok(![0,1,2,3,6,7,23,24,25,26,27].includes(c.y));}
  assert.equal(typeof f.C.get(f.model,{x:f.id,y:17,z:plane}),'number');
  const info=f.C.setEquipmentQualityCandidateInfo(f.model,{itemId:f.id,plane});
  assert.equal(info.quality,5);assert.deepEqual([...info.slots.map(s=>s.selected)],[false,false,false,false]);
  if(owner)assert.equal(f.C.get(f.model,{x:owner,y:15+t.slot,z:2}),f.id);
 }
});
test('selected P套 slot keeps its id and flag, existing duplicates stay, and new duplicates are refused',()=>{
 const f=fixture({affixes:[setOnly[0],P原[0]],flags:{1:1}}),added=tails(3,4,[P原[1]]);
 apply(f,{quality:4,addedAffixes:added});assert.equal(f.C.serialize(f.model),expected(f,4,added));
 assert.equal(f.C.get(f.model,{x:f.id,y:28,z:9}),1);assert.equal(f.C.get(f.model,{x:f.id,y:9,z:9}),setOnly[0]);
 const dup=fixture({affixes:[P原[0],P原[0]]}),dupAdded=tails(3,4,[P原[1]]);
 apply(dup,{quality:4,addedAffixes:dupAdded});assert.equal(dup.C.serialize(dup.model),expected(dup,4,dupAdded));
 for(const id of [P原[0],setOnly[0],999]){
  const g=fixture({affixes:[P原[0],setOnly[0]],flags:{2:1}});
  assert.throws(()=>apply(g,{quality:4,addedAffixes:[{slot:3,attributeId:id,coefficient:50}]}),/重複|原裝備詞條/);untouched(g);
 }
});
test('each upgrade gate is independent; closed gates, a closed downgrade gate and advanced mode are refused without writing',()=>{
 for(const plane of [7,9]){
  const closed=fixture({plane,open:[]});assert.throws(()=>apply(closed,{quality:4,addedAffixes:tails(3,4,[P原[2]])}),/尚未完成獨立遊戲驗證/);untouched(closed);
  const other=fixture({plane,open:[UP[plane===7?9:7],DOWN[plane]]});assert.throws(()=>apply(other,{quality:4,addedAffixes:tails(3,4,[P原[2]])}),/尚未完成獨立遊戲驗證/);untouched(other);
  const down=fixture({plane,open:[UP[plane]]});assert.throws(()=>apply(down,{quality:2,confirmRemovedAffixes:true}),/尚未完成獨立遊戲驗證/);untouched(down);
  const adv=fixture({plane});assert.throws(()=>apply(adv,{quality:4,addedAffixes:tails(3,4,[P原[2]]),advanced:true}),/超限/);untouched(adv);
 }
 // The shipped catalog never registers the four groups, so the real knowledge refuses every upgrade.
 const ctx={};vm.runInNewContext(source.replace('/*__KNOWLEDGE__*/null',JSON.stringify(catalog)),ctx);
 const f=fixture(),real=ctx.SaveCore,m=real.parse(f.text);
 assert.throws(()=>real.applySetEquipmentQualityCandidate(m,{itemId:f.id,quality:4,addedAffixes:tails(3,4,[P原[2]])}),/尚未完成獨立遊戲驗證/);
 assert.equal(real.serialize(m),f.text);assert.equal(m.history.length,0);
});
test('same quality is a no-op without history even when gates are closed',()=>{
 for(const open of [[],[UP[9]]]){const f=fixture({open}),p=apply(f,{quality:3});assert.equal(p.unchanged,true);untouched(f);}
});
test('failures roll back completely and keep earlier changes; undo returns to the previous transaction',()=>{
 const f=fixture();
 f.C.setEquipmentLevel(f.model,{itemId:f.id,level:4});const afterLevel=f.C.serialize(f.model);
 assert.equal(afterLevel,renderSave(f.data,[[f.id,6,9,4]]));
 for(const bad of [[],[{slot:3,attributeId:P原[0],coefficient:50}],[{slot:3,attributeId:P原[2],coefficient:200}],[{slot:4,attributeId:P原[2],coefficient:50}]])
  assert.throws(()=>apply(f,{quality:4,addedAffixes:bad}));
 assert.equal(f.C.serialize(f.model),afterLevel);assert.equal(f.model.history.length,1);
 // An outer transaction that throws after a successful upgrade discards the upgrade as a whole.
 assert.throws(()=>f.C.transaction(f.model,()=>{apply(f,{quality:4,addedAffixes:tails(3,4,[P原[2]])});throw Error('外層失敗');},'外層'),/外層失敗/);
 assert.equal(f.C.serialize(f.model),afterLevel);assert.equal(f.model.history.length,1);
 const added=tails(3,4,[P原[2]]);apply(f,{quality:4,addedAffixes:added});
 const expect=renderSave(f.data,[[f.id,6,9,4],[f.id,5,9,4],[f.id,8,9,185],[f.id,15,9,70],[f.id,16,9,70],[f.id,11,9,P原[2]],[f.id,17,9,added[0].coefficient]]);
 assert.equal(f.C.serialize(f.model),expect);assert.equal(f.model.history.length,2);
 f.C.undo(f.model);assert.equal(f.C.serialize(f.model),afterLevel);
 f.C.undo(f.model);untouched(f);
});
test('successive upgrades compose in hundredths and stay inside the target ranges',()=>{
 const f=fixture({quality:2});f.model.original.data[f.id][15][9]=30.07;f.row[15]=30.07;
 apply(f,{quality:3,addedAffixes:[{slot:2,attributeId:P原[1],coefficient:20.01}]});
 apply(f,{quality:6,addedAffixes:tails(3,6,P原.slice(2))});
 const info=f.C.setEquipmentQualityCandidateInfo(f.model,{itemId:f.id});
 assert.equal(info.quality,6);assert.equal(info.mainCoefficient,95+30*5);
 assert.deepEqual([...info.slots.map(s=>s.coefficient)],[70.07,50.01,55.5,55.5,55.5]);
 assert.equal(f.model.history.length,2);
});
test('formal level, quality and raw field entries still refuse the cross-pool range',()=>{
 for(const plane of [7,9]){
  const f=fixture({plane,affixes:[setOnly[0],P原[1]],flags:{1:1},open:[UP[7],UP[9],DOWN[7],DOWN[9]]});
  assert.throws(()=>f.C.setEquipmentLevelInfo(f.model,{itemId:f.id,plane}),/套裝等級/);
  assert.throws(()=>f.C.setEquipmentLevel(f.model,{itemId:f.id,plane,level:4}),/套裝等級/);
  for(const api of ['previewEquipmentQualityChange','setEquipmentQuality'])assert.throws(()=>f.C[api](f.model,{itemId:f.id,plane,quality:4,addedAffixes:tails(3,4,[P原[2]])}));
  for(const api of ['set','setField'])for(const y of [5,8,11,17,30])assert.throws(()=>f.C[api](f.model,{x:f.id,y,z:plane},1),/唯讀/);
  untouched(f);
 }
});
