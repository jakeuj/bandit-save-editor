'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {saveFixture,renderSave}=require('./helpers/save-fixture.cjs');
const source=fs.readFileSync(require.resolve('../src/core.js'),'utf8');
function fixture({plane=9,owner=0,quality=3,tier=1,enabled=true,level=3}={}){
 const k=structuredClone(require('../knowledge/catalog.json'));
 for(const group of ['backpackTreasureLevel','treasureLevel'])k.verification[group]=enabled;
 const ctx={};vm.runInNewContext(source.replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
 const templateId=Object.keys(k.treasureLevel.items).map(Number).find(i=>k.treasureLevel.items[i].tier===tier);
 const {data}=saveFixture({characters:2}),id=20,row=Array(60).fill(0);
 Object.assign(row,{0:5,1:templateId,2:1,3:tier,5:quality,6:level,7:owner,8:100,22:0});
 row.forEach((v,y)=>data[id][y][plane]=v);if(owner)data[owner][21][2]=id;
 const text=renderSave(data),model=C.parse(text);return {C,k,data,text,model,id,plane,templateId};
}
test('candidate writes one token for both stores and supports undo and restore',()=>{
 for(const plane of [7,9])for(const owner of plane===7?[0]:[0,1]){
  const {C,data,text,model,id}=fixture({plane,owner}),c={x:id,y:6,z:plane};
  assert.equal(C.editingInfo(model,'equipment',id,plane).group,plane===7?'backpackTreasureLevel':'treasureLevel');
  C.setEquipmentLevel(model,{itemId:id,plane,level:4});assert.equal(C.serialize(model),renderSave(data,[[id,6,plane,4]]));
  C.setEquipmentLevel(model,{itemId:id,plane,level:2});assert.equal(model.changes.size,1);C.undo(model);assert.equal(C.get(model,c),4);
  C.restore(model,c);assert.equal(C.serialize(model),text);const history=model.history.length;C.setEquipmentLevel(model,{itemId:id,plane,level:3});assert.equal(model.history.length,history);
 }
});
test('closed gates and raw setters cannot bypass; ordinary and set paths stay unchanged',()=>{
 const {C,model,text,id}=fixture({enabled:false});
 assert.equal(C.treasureLevelInfo(model,{itemId:id}).verified,false);
 assert.throws(()=>C.setEquipmentLevel(model,{itemId:id,level:4}),/驗證/);
 C.KNOWLEDGE.verification.backpackTreasureLevel=true;assert.throws(()=>C.setEquipmentLevel(model,{itemId:id,level:4}),/驗證/);
 for(const api of ['set','setField'])assert.throws(()=>C[api](model,{x:id,y:6,z:9},4),/唯讀/);
 assert.equal(C.serialize(model),text);assert.equal(model.history.length,0);
});
test('invalid metadata, structure and pointers are rejected atomically',()=>{
 for(const patch of [r=>r[0]=0,r=>r[1]=0,r=>r[2]=2,r=>r[3]=2,r=>r[4]=1,r=>r[5]=0,r=>r[5]=7,r=>r[6]=0,r=>r[6]=999,r=>r[22]=2,r=>r[7]=999,r=>r[6]='3']){
  const f=fixture();const a=f.model.original.data[f.id];const row=a.map(c=>c[9]);patch(row);row.forEach((v,y)=>a[y][9]=v);
  const before=f.C.serialize(f.model);assert.throws(()=>f.C.setEquipmentLevel(f.model,{itemId:f.id,level:4}));assert.equal(f.C.serialize(f.model),before);assert.equal(f.model.history.length,0);
 }
 for(const [plane,owner] of [[9,0],[9,1]]){
  const f=fixture({plane,owner});f.model.original.data[2][21][2]=f.id;
  assert.throws(()=>f.C.setEquipmentLevel(f.model,{itemId:f.id,plane,level:4}),/雙向/);
 }
 const wrongSlot=fixture({owner:1});wrongSlot.model.original.data[1][21][2]=0;wrongSlot.model.original.data[1][20][2]=wrongSlot.id;
 assert.throws(()=>wrongSlot.C.setEquipmentLevel(wrongSlot.model,{itemId:wrongSlot.id,level:4}),/雙向/);
 // Observed native stale owner: a displaced treasure keeps the old owner in z7, and an unworn z9 row can carry it too. Only y6 changes.
 for(const plane of [7,9]){
  const stale=fixture({plane});stale.model.original.data[stale.id][7][plane]=1;
  const before=stale.C.serialize(stale.model);stale.C.setEquipmentLevel(stale.model,{itemId:stale.id,plane,level:4});
  assert.equal(stale.C.get(stale.model,{x:stale.id,y:7,z:plane}),1);assert.equal(stale.model.changes.size,1);assert.notEqual(stale.C.serialize(stale.model),before);
  const inactive=fixture({plane});inactive.model.original.data[inactive.id][7][plane]=7;assert.throws(()=>inactive.C.setEquipmentLevel(inactive.model,{itemId:inactive.id,plane,level:4}),/歸屬/);
 }
 const bag=fixture({plane:7});bag.model.original.data[2][21][2]=bag.id;bag.C.setEquipmentLevel(bag.model,{itemId:bag.id,plane:7,level:4}); // pointer addresses z9
});
test('every tier and quality boundary is accepted; input and cross-kind calls fail',()=>{
 for(let tier=1;tier<=6;tier++)for(let quality=1;quality<=6;quality++){
  const {C,model,id}=fixture({quality,tier}),cap=10+5*(quality-1);
  C.setEquipmentLevel(model,{itemId:id,level:cap});C.setEquipmentLevel(model,{itemId:id,level:1});
  const text=C.serialize(model),history=model.history.length;
  for(const level of [0,cap+1,NaN,Infinity,'2',2.5])assert.throws(()=>C.setEquipmentLevel(model,{itemId:id,level}));
  assert.throws(()=>C.setEquipmentLevel(model,{itemId:id,level:2,advanced:true}),/驗證/);
  assert.throws(()=>C.setEquipmentLevel(model,{itemId:id,plane:8,level:2}),/庫別/);
  assert.equal(C.serialize(model),text);assert.equal(model.history.length,history);
 }
});
