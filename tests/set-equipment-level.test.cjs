'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {saveFixture,renderSave}=require('./helpers/save-fixture.cjs');
const source=fs.readFileSync(require.resolve('../src/core.js'),'utf8');
function fixture({plane=9,owner=0,quality=3,enabled=true}={}){
 const k=structuredClone(require('../knowledge/catalog.json')),groups=['backpackSetEquipmentLevel','setEquipmentLevel'];
 for(const group of groups)k.verification[group]=enabled;
 const ctx={};vm.runInNewContext(source.replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
 const {data}=saveFixture({characters:2}),id=20,t=k.setEquipmentLevel.items[28],origin=2,row=Array(60).fill(0);
 Object.assign(row,{0:5,1:28,2:1,3:t.tier,5:quality,6:3,7:owner,8:95+30*(quality-1),23:3,24:1,26:1.7,27:origin});
 for(let slot=1;slot<quality;slot++){row[8+slot]=k.setEquipmentLevel.origins[origin].affixIds[slot-1];row[14+slot]=40+10*(quality-1);}
 row.forEach((v,y)=>data[id][y][plane]=v);if(owner)data[owner][15+t.slot][2]=id;
 const text=renderSave(data),model=C.parse(text);return {C,k,data,text,model,id,plane};
}
test('candidate set writes one token and retains conversion metadata through undo and restore',()=>{
 for(const plane of [7,9])for(const owner of plane===7?[0]:[0,1]){
  const {C,data,text,model,id}=fixture({plane,owner}),c={x:id,y:6,z:plane};
  assert.equal(C.editingInfo(model,'equipment',id,plane).group,plane===7?'backpackSetEquipmentLevel':'setEquipmentLevel');
  C.setEquipmentLevel(model,{itemId:id,plane,level:4});assert.equal(C.serialize(model),renderSave(data,[[id,6,plane,4]]));
  C.setEquipmentLevel(model,{itemId:id,plane,level:2});assert.equal(model.changes.size,1);C.undo(model);assert.equal(C.get(model,c),4);
  C.restore(model,c);assert.equal(C.serialize(model),text);const history=model.history.length;C.setEquipmentLevel(model,{itemId:id,plane,level:3});assert.equal(model.history.length,history);
 }
});
test('independent closed gates and raw setters cannot bypass them',()=>{
 const {C,model,text,id}=fixture({enabled:false});
 assert.equal(C.setEquipmentLevelInfo(model,{itemId:id}).verified,false);
 assert.throws(()=>C.setEquipmentLevel(model,{itemId:id,level:4}),/驗證/);
 C.KNOWLEDGE.verification.backpackSetEquipmentLevel=true;assert.throws(()=>C.setEquipmentLevel(model,{itemId:id,level:4}),/驗證/);
 for(const api of ['set','setField'])assert.throws(()=>C[api](model,{x:id,y:6,z:9},4),/唯讀/);
 assert.equal(C.serialize(model),text);assert.equal(model.history.length,0);
 const D=require('../scripts/set-equipment-level-data.cjs'),k=structuredClone(require('../knowledge/catalog.json'));for(const g of D.groups)k.verification[g]=false;D.requireClosed(k);k.verification.setEquipmentLevel=true;assert.throws(()=>D.requireClosed(k),/首次證明/);
});
test('invalid metadata, structural state, reference and inherited affix pools are rejected atomically',()=>{
 for(const patch of [r=>r[0]=0,r=>r[2]=2,r=>r[3]=2,r=>r[5]=7,r=>r[6]=0,r=>r[6]=999,r=>r[23]=0,r=>r[23]='3',r=>r[26]=1.71,r=>r[26]=-1,r=>r[27]=28,r=>r[27]=10,r=>r[25]=1,r=>r[24]=2,r=>r[8]=999,r=>r[9]=999,r=>r[15]=999,r=>r[28]=2,r=>{r[28]=r[29]=1;},r=>r[14]=12]){
  const f=fixture();const a=f.model.original.data[f.id];const row=a.map(c=>c[9]);patch(row);row.forEach((v,y)=>a[y][9]=v);
  const before=Ctext(f);assert.throws(()=>f.C.setEquipmentLevel(f.model,{itemId:f.id,level:4}),/套裝/);assert.equal(Ctext(f),before);assert.equal(f.model.history.length,0);
 }
 function Ctext(f){return f.C.serialize(f.model);}
 for(const [plane,owner]of [[9,0],[9,1]]){
  const f=fixture({plane,owner});f.model.original.data[2][16][2]=f.id;
  assert.throws(()=>f.C.setEquipmentLevel(f.model,{itemId:f.id,plane,level:4}),/雙向/);
 }
 const backpack=fixture({plane:7});backpack.model.original.data[2][16][2]=backpack.id;
 backpack.C.setEquipmentLevel(backpack.model,{itemId:backpack.id,plane:7,level:4}); // A role pointer addresses z9, not a same-numbered z7 row.
 // Conversion keeps the original ordinary item's pool: #37 is in original #2 but not set #28.
 const f=fixture();f.model.original.data[f.id][9][9]=37;f.C.setEquipmentLevel(f.model,{itemId:f.id,level:4});
});
test('all legal quality boundaries are finite; advanced, invalid input and cross-kind calls fail',()=>{
 for(let quality=1;quality<=6;quality++){
  const {C,model,id}=fixture({quality}),cap=10+5*(quality-1);
  C.setEquipmentLevel(model,{itemId:id,level:cap});C.setEquipmentLevel(model,{itemId:id,level:1});
  const text=C.serialize(model),history=model.history.length;
  for(const level of [0,cap+1,NaN,Infinity,'2',2.5])assert.throws(()=>C.setEquipmentLevel(model,{itemId:id,level}));
  assert.throws(()=>C.setEquipmentLevel(model,{itemId:id,level:2,advanced:true}),/驗證/);
  assert.throws(()=>C.setEquipmentLevel(model,{itemId:id,plane:8,level:2}),/庫別/);
  assert.equal(C.serialize(model),text);assert.equal(model.history.length,history);
 }
});
