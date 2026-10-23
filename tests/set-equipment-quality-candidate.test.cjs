'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {saveFixture,renderSave}=require('./helpers/save-fixture.cjs');
const source=fs.readFileSync(require.resolve('../src/core.js'),'utf8');
const D=require('../scripts/set-equipment-quality-data.cjs');
const catalog=require('../knowledge/catalog.json'),templateId=28,originId=2;
const S=require('./helpers/set-quality-shipped.cjs');
const L=catalog.setEquipmentLevel,t=L.items[templateId],P原=L.origins[originId].affixIds,P套=catalog.setEquipmentQuality.pools[templateId].affixIds;
const originOnly=P原.filter(a=>!P套.includes(a)),setOnly=P套.filter(a=>!P原.includes(a)),both=P原.filter(a=>P套.includes(a));
// Candidate tests open level gates only to show formal entries still reject the new range; quality and cross-pool groups start closed in this copy.
function fixture({plane=9,owner=0,quality=3,affixes,flags={},origin=originId,levelGates=true}={}){
 const k=S.closed(catalog);for(const g of ['backpackSetEquipmentLevel','setEquipmentLevel'])k.verification[g]=levelGates;
 D.requireClosed(k);
 const ctx={};vm.runInNewContext(source.replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
 const {data}=saveFixture({characters:2}),id=20,row=Array(60).fill(0);
 Object.assign(row,{0:5,1:templateId,2:1,3:t.tier,5:quality,6:3,7:owner,8:95+30*(quality-1),23:3,24:1,26:1.7,27:origin});
 const ids=affixes||P原.slice(0,quality-1);
 for(let slot=1;slot<quality;slot++){row[8+slot]=ids[slot-1];row[14+slot]=40+10*(quality-1);row[27+slot]=flags[slot]||0;}
 row.forEach((v,y)=>data[id][y][plane]=v);if(owner)data[owner][15+t.slot][2]=id;
 const text=renderSave(data),model=C.parse(text);return {C,k,data,text,model,id,plane};
}
const info=(f,o={})=>f.C.setEquipmentQualityCandidateInfo(f.model,{itemId:f.id,plane:f.plane,...o});
const untouched=f=>{assert.equal(f.C.serialize(f.model),f.text);assert.equal(f.model.history.length,0);assert.equal(f.model.changes.size,0);};

test('synthetic pools contain origin-only, set-only and shared ids for the fixture template',()=>{
 assert.ok(originOnly.length&&setOnly.length&&both.length);
 assert.equal(D.classify(catalog.setEquipmentQuality,L,templateId,originId,setOnly[0]),'set');
 assert.equal(D.classify(catalog.setEquipmentQuality,L,templateId,originId,originOnly[0]),'origin');
});
test('unselected slots accept P原 only; the sole selected slot accepts P原 or P套 and keeps its flag',()=>{
 for(const plane of [7,9])for(const owner of plane===7?[0]:[0,1]){
  const f=fixture({plane,owner,affixes:[originOnly[0],both[0]]}),i=info(f);
  assert.equal(i.kind,'setEquipmentQualityCandidate');assert.equal(i.selectedSlot,null);assert.equal(i.originId,originId);
  assert.deepEqual([...i.slots.map(s=>s.source)],['origin','both']);
  assert.deepEqual({...i.groups},plane===7?{upgrade:'backpackSetEquipmentQualityUpgrade',downgrade:'backpackSetEquipmentQualityDowngrade'}:{upgrade:'setEquipmentQualityUpgrade',downgrade:'setEquipmentQualityDowngrade'});
  assert.deepEqual({...i.verified},{upgrade:false,downgrade:false});untouched(f);
  for(const [id,src] of [[setOnly[0],'set'],[originOnly[0],'origin'],[both[0],'both']])for(const slot of [1,2]){
   const ids=[originOnly[0],originOnly[1]??both[0]];ids[slot-1]=id;
   const g=fixture({plane,owner,affixes:ids,flags:{[slot]:1}}),j=info(g);
   assert.equal(j.selectedSlot,slot);assert.equal(j.slots[slot-1].source,src);assert.equal(j.slots[slot-1].selected,true);
   assert.equal(g.C.get(g.model,{x:g.id,y:27+slot,z:plane}),1);untouched(g);
  }
 }
 for(let quality=1;quality<=6;quality++)assert.equal(info(fixture({quality})).slots.length,quality-1);
});
test('cross-pool misplacement, multiple flags, missing y27, wrong tier/slot source and tail data are rejected',()=>{
 const wrongTier=Object.keys(L.origins).map(Number).find(o=>L.origins[o].slot===t.slot&&L.origins[o].tier!==t.tier);
 const wrongSlot=Object.keys(L.origins).map(Number).find(o=>L.origins[o].tier===t.tier&&L.origins[o].slot!==t.slot);
 const cases=[
  [{affixes:[setOnly[0],P原[1]]},/未選槽只能使用原裝備詞條/],
  [{affixes:[P原[0],setOnly[0]],flags:{1:1}},/未選槽只能使用原裝備詞條/],
  [{affixes:[999,P原[1]],flags:{1:1}},/不在原裝備或套裝池/],
  [{flags:{1:1,2:1}},/多個已選洗練槽/],
  [{quality:4,affixes:[setOnly[0],P原[1],P原[2]],flags:{1:1,3:1}},/多個已選洗練槽/],
  [{origin:0},/缺少合成來源 y27/],
  [{origin:templateId},/缺少合成來源 y27/],
  [{origin:wrongTier},/同階／部位不符/],
  [{origin:wrongSlot},/同階／部位不符/]
 ];
 for(const [o,re] of cases){const f=fixture(o);assert.throws(()=>info(f),re);untouched(f);}
 for(const patch of [r=>{r[11]=P原[2];},r=>{r[17]=50;},r=>{r[30]=1;},r=>{r[14]=setOnly[0];r[33]=1;},r=>{r[27]='2';},r=>{r[27]=undefined;},r=>{r[28]=2;}]){
  const f=fixture(),a=f.model.original.data[f.id],row=a.map(c=>c[9]);patch(row);row.forEach((v,y)=>a[y][9]=v);
  assert.throws(()=>info(f),/套裝品質候選/);untouched(f);
 }
 const f=fixture();for(const plane of [0,8,'9'])assert.throws(()=>f.C.setEquipmentQualityCandidateInfo(f.model,{itemId:f.id,plane}),/庫別/);
});
test('formal level and quality entries still reject the new cross-pool range',()=>{
 for(const plane of [7,9])for(const slot of [1,2]){
  const ids=[P原[0],P原[1]];ids[slot-1]=setOnly[0];
  const f=fixture({plane,affixes:ids,flags:{[slot]:1}});info(f);
  assert.throws(()=>f.C.setEquipmentLevelInfo(f.model,{itemId:f.id,plane}),/套裝等級/);
  assert.throws(()=>f.C.editingInfo(f.model,'equipment',f.id,plane),/套裝等級/);
  assert.throws(()=>f.C.setEquipmentLevel(f.model,{itemId:f.id,plane,level:4}),/套裝等級/);
  assert.throws(()=>f.C.equipmentQualityInfo(f.model,{itemId:f.id,plane}));
  for(const quality of [2,4])for(const api of ['previewEquipmentQualityChange','setEquipmentQuality'])
   assert.throws(()=>f.C[api](f.model,{itemId:f.id,plane,quality,addedAffixes:[],confirmRemovedAffixes:true}));
  for(const api of ['set','setField'])for(const y of [5,8+slot,27+slot])assert.throws(()=>f.C[api](f.model,{x:f.id,y,z:plane},1),/唯讀/);
  untouched(f);
 }
 // Quality entries reject even a legal P原-only set item; set quality has no formal entry yet.
 const f=fixture();assert.throws(()=>f.C.previewEquipmentQualityChange(f.model,{itemId:f.id,quality:4,addedAffixes:[],confirmRemovedAffixes:true}));untouched(f);
});
test('ordinary, set-level and treasure-level permissions are unchanged and rejected by the candidate entry',()=>{
 const f=fixture();assert.equal(f.C.editingInfo(f.model,'equipment',f.id,9).group,'setEquipmentLevel');
 f.C.setEquipmentLevel(f.model,{itemId:f.id,level:4});assert.equal(f.C.serialize(f.model),renderSave(f.data,[[f.id,6,9,4]]));
 const closed=fixture({levelGates:false});assert.throws(()=>closed.C.setEquipmentLevel(closed.model,{itemId:closed.id,level:4}),/驗證/);untouched(closed);
 const treasure=Object.keys(catalog.treasureLevel.items).map(Number).find(i=>catalog.treasureLevel.items[i].tier===1);
 const ordinary=Object.keys(catalog.equipmentQuality.items).map(Number).find(i=>catalog.catalogs.items.find(r=>r.id===i)?.kind!=='套装');
 for(const [templ,group] of [[treasure,'treasureLevel'],[ordinary,'equipmentLevel']]){
  const g=fixture(),a=g.model.original.data[g.id];a[1][9]=templ;a[27][9]=0;
  assert.throws(()=>info(g),/範本或詞條池/);
  if(group==='treasureLevel'){for(let y=8;y<=27;y++)a[y][9]=0;a[8][9]=100;a[3][9]=1;assert.equal(g.C.editingInfo(g.model,'equipment',g.id,9).group,group);}
  untouched(g);
 }
});
test('candidate entry is read-only and all four quality groups remain closed',()=>{
 const f=fixture({affixes:[setOnly[0],P原[1]],flags:{1:1}});
 for(const g of D.groups)assert.equal(f.k.verification[g],false);
 const before=f.C.serialize(f.model);for(let n=0;n<3;n++)info(f);assert.equal(f.C.serialize(f.model),before);untouched(f);
 const k=structuredClone(catalog);k.verification.setEquipmentQualityUpgrade=true;assert.throws(()=>D.requireClosed(k),/首次證明/);
});
