'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {saveFixture,renderSave}=require('./helpers/save-fixture.cjs');
const source=fs.readFileSync(require.resolve('../src/core.js'),'utf8');
const D=require('../scripts/set-equipment-quality-data.cjs');
const catalog=require('../knowledge/catalog.json'),templateId=28,originId=2;
const L=catalog.setEquipmentLevel,t=L.items[templateId],P原=L.origins[originId].affixIds,P套=catalog.setEquipmentQuality.pools[templateId].affixIds;
const originOnly=P原.filter(a=>!P套.includes(a)),setOnly=P套.filter(a=>!P原.includes(a)),both=P原.filter(a=>P套.includes(a));
const allowedY=new Set([5,8,...Array.from({length:6},(_,i)=>[9+i,15+i,28+i]).flat()]);
// Expected values are written out from the parent-spec formulas, not read from the preview under test.
function fixture({plane=9,owner=0,quality=3,level=3,affixes,flags={},levelGates=true}={}){
 const k=structuredClone(catalog);for(const g of ['backpackSetEquipmentLevel','setEquipmentLevel'])k.verification[g]=levelGates;
 D.requireClosed(k);
 const ctx={};vm.runInNewContext(source.replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
 const {data}=saveFixture({characters:2}),id=20,row=Array(60).fill(0);
 Object.assign(row,{0:5,1:templateId,2:1,3:t.tier,5:quality,6:level,7:owner,8:95+30*(quality-1),23:3,24:1,26:1.7,27:originId});
 const ids=affixes||P原.slice(0,quality-1);
 for(let slot=1;slot<quality;slot++){row[8+slot]=ids[slot-1];row[14+slot]=40+10*(quality-1);row[27+slot]=flags[slot]||0;}
 row.forEach((v,y)=>data[id][y][plane]=v);if(owner)data[owner][15+t.slot][2]=id;
 const text=renderSave(data),model=C.parse(text);return {C,k,data,text,model,id,plane,row};
}
const preview=(f,o)=>f.C.previewSetEquipmentQualityCandidate(f.model,{itemId:f.id,plane:f.plane,...o});
const untouched=f=>{assert.equal(f.C.serialize(f.model),f.text);assert.equal(f.model.history.length,0);assert.equal(f.model.changes.size,0);};
const tails=(from,to,pool=originOnly.concat(both).filter(a=>!P原.slice(0,from-1).includes(a)))=>Array.from({length:to-from},(_,i)=>({slot:from+i,attributeId:pool[i],coefficient:10*(to-1)+5}));

test('four plane×direction previews dispatch to their own closed group and never write',()=>{
 for(const plane of [7,9])for(const owner of plane===7?[0]:[0,1])for(const [quality,direction] of [[5,'upgrade'],[2,'downgrade']]){
  const f=fixture({plane,owner,quality:3}),p=preview(f,{quality,addedAffixes:quality>3?tails(3,quality):[]});
  const prefix=plane===7?'backpackSetEquipmentQuality':'setEquipmentQuality';
  assert.equal(p.kind,'setEquipmentQualityCandidatePreview');assert.equal(p.candidate,true);
  assert.equal(p.direction,direction);assert.equal(p.group,prefix+(direction==='upgrade'?'Upgrade':'Downgrade'));assert.equal(p.verified,false);
  assert.equal(f.k.verification[p.group],false);
  for(const c of p.changes){assert.equal(c.coordinate.x,f.id);assert.equal(c.coordinate.z,plane);assert.ok(allowedY.has(c.coordinate.y),`y${c.coordinate.y}`);}
  untouched(f);
 }
});
test('upgrade shifts main by 30ΔQ and kept subs by 10ΔQ, adds P原 tails with flag 0',()=>{
 const f=fixture({quality:3,affixes:[originOnly[0],setOnly[0]],flags:{2:1}}),added=[{slot:3,attributeId:originOnly.find(a=>a!==originOnly[0]),coefficient:41.25},{slot:4,attributeId:both[0],coefficient:110}];
 const p=preview(f,{quality:5,addedAffixes:added});
 assert.deepEqual({...p.mainCoefficient},{before:155,after:215});
 assert.equal(p.targetSlots,4);assert.equal(p.previousSlots,2);assert.equal(p.normalMax,30);assert.equal(p.previousMax,20);assert.equal(p.requiresRemovalConfirmation,false);
 assert.deepEqual([...p.slots.map(s=>[s.slot,s.kind,s.source,s.after.attributeId,s.after.coefficient,s.after.flag])],[
  [1,'retained','origin',originOnly[0],80,0],[2,'retained','set',setOnly[0],80,1],[3,'added','origin',added[0].attributeId,41.25,0],[4,'added','origin',added[1].attributeId,110,0]]);
 const byY=Object.fromEntries(p.changes.map(c=>[c.coordinate.y,c.after]));
 assert.deepEqual(byY,{5:5,8:215,11:added[0].attributeId,12:added[1].attributeId,15:80,16:80,17:41.25,18:110});
 assert.ok(!p.changes.some(c=>c.coordinate.y===28+2),'selected flag kept');
 assert.equal(p.selectedSlot,2);assert.deepEqual([...p.pools.origin],P原);assert.deepEqual([...p.pools.set],P套);
 untouched(f);
 // Hundredths arithmetic: 60.07 + 10 stays exact.
 const g=fixture({quality:2});const a=g.model.original.data[g.id];a[15][9]=20.07;
 assert.equal(preview(g,{quality:3,addedAffixes:[{slot:2,attributeId:P原[1],coefficient:20}]}).slots[0].after.coefficient,30.07);untouched(g);
});
test('downgrade removes tail slots, zeros their id/coefficient/flag and shifts kept rolls down',()=>{
 const f=fixture({quality:5}),p=preview(f,{quality:2});
 assert.equal(p.direction,'downgrade');assert.equal(p.requiresRemovalConfirmation,true);assert.equal(p.targetSlots,1);
 assert.deepEqual({...p.mainCoefficient},{before:215,after:125});
 assert.deepEqual([...p.slots.map(s=>[s.kind,s.after.attributeId,s.after.coefficient,s.after.flag])],[['retained',P原[0],50,0],['removed',0,0,0],['removed',0,0,0],['removed',0,0,0]]);
 untouched(f);
 const g=fixture({quality:3,affixes:[setOnly[0],P原[1]],flags:{1:1}}),q=preview(g,{quality:2});
 assert.deepEqual([q.slots[0].source,q.slots[0].after.flag,q.slots[0].after.attributeId],['set',1,setOnly[0]]);untouched(g);
});
test('existing duplicates are kept but new duplicates and non-P原 tails are rejected',()=>{
 const f=fixture({quality:3,affixes:[P原[0],P原[0]]});
 const p=preview(f,{quality:4,addedAffixes:[{slot:3,attributeId:P原[1],coefficient:50}]});
 assert.deepEqual([...p.slots.slice(0,2).map(s=>s.after.attributeId)],[P原[0],P原[0]]);
 const g=fixture({quality:3,affixes:[P原[0],setOnly[0]],flags:{2:1}});
 for(const [id,re] of [[P原[0],/重複/],[setOnly[0],/原裝備詞條/],[999,/原裝備詞條/]])
  assert.throws(()=>preview(g,{quality:4,addedAffixes:[{slot:3,attributeId:id,coefficient:50}]}),re);
 if(setOnly.length>1)assert.throws(()=>preview(g,{quality:4,addedAffixes:[{slot:3,attributeId:setOnly[1],coefficient:50}]}),/原裝備詞條/);
 assert.throws(()=>preview(f,{quality:5,addedAffixes:[{slot:3,attributeId:P原[1],coefficient:50},{slot:4,attributeId:P原[1],coefficient:50}]}),/重複/);
 untouched(f);untouched(g);
});
test('target level cap blocks downgrade; quality never lowers level',()=>{
 const f=fixture({quality:3,level:12});
 assert.equal(preview(f,{quality:2}).normalMax,15);
 assert.throws(()=>preview(f,{quality:1}),/等級超過目標品質上限/);
 assert.ok(!preview(f,{quality:2}).changes.some(c=>c.coordinate.y===6));
 const g=fixture({quality:6,level:35});assert.throws(()=>preview(g,{quality:5}),/等級超過目標品質上限/);
 untouched(f);untouched(g);
});
test('invalid targets, removed selected slots, tail counts and coefficients are rejected',()=>{
 const f=fixture({quality:4,affixes:[P原[0],P原[1],setOnly[0]],flags:{3:1}});
 assert.throws(()=>preview(f,{quality:3}),/已選洗練槽會被移除/);
 assert.throws(()=>preview(f,{quality:2}),/已選洗練槽會被移除/);
 assert.equal(preview(f,{quality:5,addedAffixes:[{slot:4,attributeId:P原[2],coefficient:40}]}).slots[2].after.flag,1);
 const g=fixture({quality:3});
 for(const quality of [0,7,'4',3.5,undefined])assert.throws(()=>preview(g,{quality}),/目標品質/);
 for(const addedAffixes of [[],null,[{slot:3,attributeId:P原[2],coefficient:50},{slot:4,attributeId:P原[3],coefficient:50}]])
  assert.throws(()=>preview(g,{quality:4,addedAffixes}),/新增/);
 assert.throws(()=>preview(g,{quality:2,addedAffixes:[{slot:2,attributeId:P原[2],coefficient:30}]}),/新增尾槽/);
 for(const a of [{slot:2,attributeId:P原[2],coefficient:50},{slot:5,attributeId:P原[2],coefficient:50},{slot:3,attributeId:P原[2],coefficient:29.99},{slot:3,attributeId:P原[2],coefficient:100.01},{slot:3,attributeId:P原[2],coefficient:50.001},{slot:3,attributeId:'1',coefficient:50}])
  assert.throws(()=>preview(g,{quality:4,addedAffixes:[a]}),/新增/);
 // Candidate eligibility still runs first: cross-pool misplacement is rejected before any plan.
 const bad=fixture({affixes:[setOnly[0],P原[1]]});assert.throws(()=>preview(bad,{quality:4,addedAffixes:[{slot:3,attributeId:P原[2],coefficient:50}]}),/未選槽只能使用原裝備詞條/);
 untouched(f);untouched(g);untouched(bad);
});
test('same quality is an unchanged preview with no group',()=>{
 const f=fixture({quality:3}),p=preview(f,{quality:3});
 assert.equal(p.unchanged,true);assert.equal(p.direction,'none');assert.equal(p.group,null);assert.equal(p.verified,false);assert.equal(p.changes.length,0);untouched(f);
});
test('formal entries still reject the candidate range and only candidate entries exist',()=>{
 for(const plane of [7,9]){
  const f=fixture({plane,affixes:[setOnly[0],P原[1]],flags:{1:1}});preview(f,{quality:2});
  assert.throws(()=>f.C.setEquipmentLevelInfo(f.model,{itemId:f.id,plane}),/套裝等級/);
  assert.throws(()=>f.C.editingInfo(f.model,'equipment',f.id,plane),/套裝等級/);
  for(const api of ['previewEquipmentQualityChange','setEquipmentQuality'])for(const quality of [2,4])
   assert.throws(()=>f.C[api](f.model,{itemId:f.id,plane,quality,addedAffixes:quality>3?[{slot:3,attributeId:P原[2],coefficient:50}]:[],confirmRemovedAffixes:true}));
  for(const api of ['set','setField'])assert.throws(()=>f.C[api](f.model,{x:f.id,y:5,z:plane},4),/唯讀/);
  untouched(f);
 }
 const f=fixture();
 assert.deepEqual(Object.keys(f.C).filter(k=>/SetEquipmentQuality|setEquipmentQualityCandidate/i.test(k)&&k!=='setEquipmentQuality').sort(),['applySetEquipmentQualityCandidate','previewSetEquipmentQualityCandidate','setEquipmentQualityCandidateInfo']);
 for(const g of D.groups)assert.equal(f.k.verification[g],false);
});
