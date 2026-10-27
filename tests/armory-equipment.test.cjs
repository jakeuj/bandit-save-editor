'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Armory (z22, V1.0.13.0): rows are verbatim z7 copies, so every backpack editor applies to them behind armoryEquipment.
// Row 1 is an ordinary Q6 柴斧 (slots 1–5, slot 1 washed), row 20 a Q3 set piece, row 21 a Q3 treasure, row 22 a Q3 inner pill;
// z7 keeps the same rows so the backpack path can be compared and stays untouched by the armory gate.
const backpackGroups=['backpackEquipmentLevel','backpackEquipmentLevelAdvanced','backpackEquipmentAffixCoefficient','backpackEquipmentAffixReplacement','equipmentAffixInitialSelection',
 'backpackEquipmentQualityUpgrade','backpackEquipmentQualityDowngrade','backpackSetEquipmentLevel','backpackSetEquipmentQualityUpgrade','backpackSetEquipmentQualityDowngrade',
 'backpackTreasureLevel','backpackInnerPillLevel','equipmentAffixCoefficientAdvanced','equipmentSixthAffix'];
function render(data,patches=[]){
 const p=new Map(patches.map(([x,y,z,v])=>[`${x},${y},${z}`,v]));
 const rows=data.map((row,x)=>'['+row.map((c,y)=>'['+c.map((v,z)=>' '+JSON.stringify(p.has(`${x},${y},${z}`)?p.get(`${x},${y},${z}`):v)+' ').join(',')+']').join(',')+']');
 return '﻿{ "unrelated":987654321098765432109876543210,"exponent":1e+03,\n"c2array":true,"size":['+data.length+',60,'+data[0][0].length+'],"data":['+rows.join(',')+']}\n';
}
function setup({armory=true,layers=23}={}){
 const K=JSON.parse(fs.readFileSync('knowledge/catalog.json'));
 for(const g of backpackGroups)K.verification[g]=true;K.verification.armoryEquipment=armory;
 const ctx={setTimeout,performance};vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(K)),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(layers).fill(0)));data[0][0][1]='szmnqea';
 const supported=K.batch2Data.items[1].affixIds.filter(a=>K.affixReplacement.attributes[a]&&K.affixReplacementLimits.attributeIds.includes(a)),used=supported.slice(0,5),free=supported[5];
 const set=K.setEquipmentLevel.items[28],treasure=Number(Object.keys(K.treasureLevel.items).find(i=>K.treasureLevel.items[i].tier===1)),pill=K.catalogs.items.find(i=>i.kind==='内丹');
 const rows={1:{0:1,1:1,2:1,3:1,5:6,6:10,8:245,28:1},20:{0:5,1:28,2:1,3:set.tier,5:3,6:3,8:155,23:3,24:1,26:1.7,27:2},21:{0:6,1:treasure,2:1,3:1,5:3,6:3,8:100},22:{0:7,1:pill.id,2:1,3:K.batch2Data.items[pill.id].tier,5:3,6:4,8:100,24:1}};
 used.forEach((a,i)=>{rows[1][9+i]=a;rows[1][15+i]=60+i;});
 for(let slot=1;slot<3;slot++){rows[20][8+slot]=K.setEquipmentLevel.origins[2].affixIds[slot-1];rows[20][14+slot]=60;}
 for(const z of [7,22].filter(z=>z<layers))for(const [x,r] of Object.entries(rows))for(const [y,v] of Object.entries(r))data[x][y][z]=v;
 const text=render(data);return {C,K,data,text,m:C.parse(text),used,free};
}

test('armoryEquipment defaults closed in the extractor and is registered in the equipmentWorkflow family',()=>{
 const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),S=require('../scripts/verification-suite.cjs'),R=require('../scripts/verification-requirements.cjs');
 assert.equal(typeof k.verification.armoryEquipment,'boolean');
 assert.match(fs.readFileSync('scripts/extract-game.cjs','utf8'),/armoryEquipment:false/);
 assert.equal(S.familyOf('armoryEquipment'),'equipmentWorkflow');assert.equal(R.sectionOf('armoryEquipment'),'equipmentWorkflow');
 if(k.verification.armoryEquipment){assert.equal(proof.groups.armoryEquipment,true);assert.equal(proof.lightweight.armoryEquipment.passed,true);assert.equal(proof.lightweight.armoryEquipment.gameVersion,k.gameVersion);}
});

test('closed gate: armory rows report every editor but refuse to write; the backpack copies stay open',()=>{
 const {C,m,text,free}=setup({armory:false});
 const infos=z=>[C.editingInfo(m,'equipment',1,z).verified,C.editingInfo(m,'equipment',1,z).advancedVerified,C.affixInfo(m,1,1,z).verified,C.affixAdvancedInfo(m,1,1,z).verified,
  C.equipmentAffixReplacementInfo(m,{itemId:1,slot:1,plane:z}).verified,C.equipmentQualityInfo(m,{itemId:1,plane:z}).targets[4].verified,C.sixthAffixInfo(m,{itemId:1,plane:z}).verified,
  C.editingInfo(m,'equipment',20,z).verified,...Object.values(C.setEquipmentQualityCandidateInfo(m,{itemId:20,plane:z}).verified),C.editingInfo(m,'equipment',21,z).verified,C.innerPillLevelInfo(m,{itemId:22,plane:z}).verified];
 assert.ok(infos(7).every(v=>v===true));assert.ok(infos(22).every(v=>v===false));
 for(const op of [()=>C.setEquipmentLevel(m,{itemId:1,plane:22,level:11}),()=>C.setEquipmentLevel(m,{itemId:1,plane:22,level:40,advanced:true}),
  ()=>C.setEquipmentAffixCoefficient(m,{itemId:1,slot:1,coefficient:99,plane:22}),()=>C.setEquipmentAffixCoefficientAdvanced(m,{itemId:1,slot:1,coefficient:500,plane:22}),
  ()=>C.setEquipmentAffix(m,{itemId:1,slot:1,attributeId:free,coefficient:100,plane:22}),()=>C.setEquipmentQuality(m,{itemId:1,plane:22,quality:5,confirmRemovedAffixes:true}),
  ()=>C.setEquipmentSixthAffix(m,{itemId:1,plane:22,attributeId:free,coefficient:50}),()=>C.setEquipmentLevel(m,{itemId:20,plane:22,level:4}),
  ()=>C.setEquipmentLevel(m,{itemId:21,plane:22,level:4}),()=>C.setInnerPillLevel(m,{itemId:22,plane:22,level:5})])assert.throws(op);
 for(const api of ['set','setField'])assert.throws(()=>C[api](m,{x:1,y:6,z:22},11),/唯讀/);
 assert.equal(C.serialize(m),text);assert.equal(m.history.length,0);
});

test('open gate: each editor writes only its armory tokens, labelled 武庫, and undo／restore return the original bytes',()=>{
 const {C,data,text,m,free,used}=setup();
 const cases=[
  [()=>C.setEquipmentLevel(m,{itemId:1,plane:22,level:15}),[[1,6,22,15]]],
  [()=>C.setEquipmentLevel(m,{itemId:1,plane:22,level:40,advanced:true}),[[1,6,22,40]]],
  [()=>C.setEquipmentAffixCoefficient(m,{itemId:1,slot:1,coefficient:99.5,plane:22}),[[1,15,22,99.5]]],
  [()=>C.setEquipmentAffixCoefficientAdvanced(m,{itemId:1,slot:1,coefficient:500,plane:22}),[[1,15,22,500]]],
  [()=>C.setEquipmentAffix(m,{itemId:1,slot:1,attributeId:free,coefficient:100,plane:22}),[[1,9,22,free],[1,15,22,100]]],
  [()=>C.setEquipmentQuality(m,{itemId:1,plane:22,quality:5,confirmRemovedAffixes:true}),[[1,5,22,5],[1,8,22,215],...[1,2,3,4].map(s=>[1,14+s,22,(60+s-1)-10]),[1,13,22,0],[1,19,22,0]]],
  [()=>C.setEquipmentSixthAffix(m,{itemId:1,plane:22,attributeId:free,coefficient:50}),[[1,14,22,free],[1,20,22,50]]],
  [()=>C.setEquipmentLevel(m,{itemId:20,plane:22,level:4}),[[20,6,22,4]]],
  [()=>C.setEquipmentLevel(m,{itemId:21,plane:22,level:4}),[[21,6,22,4]]],
  [()=>C.setInnerPillLevel(m,{itemId:22,plane:22,level:5}),[[22,6,22,5]]]
 ];
 assert.equal(used.length,5);
 for(const [op,patches] of cases){
  op();assert.equal(C.serialize(m),render(data,patches));
  assert.ok([...m.changes.values()].every(c=>c.z===22&&(String(c.label).includes('武庫')||/等級|係數|詞條/.test(c.label))));
  C.undo(m);assert.equal(C.serialize(m),text);
  op();for(const [x,y,z] of patches)C.restore(m,{x,y,z});assert.equal(C.serialize(m),text);
 }
 const p=C.previewSetEquipmentQualityCandidate(m,{itemId:20,plane:22,quality:2});
 assert.deepEqual([p.group,p.verified,p.changes.every(c=>c.coordinate.z===22&&c.label.startsWith('武庫 #20'))],['backpackSetEquipmentQualityDowngrade',true,true]);
});

test('armory rows follow the backpack checks: a worn owner or an unknown state is refused like z7',()=>{
 for(const z of [7,22]){
  const {C,m,data}=setup();data[1][7][z]=1;const owned=C.parse(render(data));
  assert.throws(()=>C.editingInfo(owned,'equipment',1,z),/歸屬為 0/);
  data[1][7][z]=0;data[1][25][z]=1;assert.throws(()=>C.editingInfo(C.parse(render(data)),'equipment',1,z),/特殊狀態/);
  assert.deepEqual([C.editingInfo(m,'equipment',1,z).verified,C.editingInfo(m,'equipment',1,z).normalMax],[true,35]);
 }
});

test('inventory and batch include the armory only when the save has z22',async()=>{
 const {C,m}=setup();
 const rows=C.listEntities(m,'inventory').filter(r=>r.z===22);
 assert.deepEqual(rows.map(r=>r.id).join(),'1,20,21,22');assert.ok(rows.every(r=>r.detail.startsWith('武庫')));
 const p=await C.previewBatch(m,{kind:'equipmentMax',plane:22});
 assert.deepEqual([p.summary.excluded,p.summary.targets,p.summary.changed],[3,1,1]);
 await C.applyBatch(m,{kind:'equipmentMax',plane:22});assert.equal(C.get(m,{x:1,y:6,z:22}),35);assert.equal(C.get(m,{x:1,y:6,z:7}),10);
 const closed=setup({armory:false});await assert.rejects(closed.C.applyBatch(closed.m,{kind:'equipmentMax',plane:22}),/未|停用/);assert.equal(closed.C.serialize(closed.m),closed.text);
 const old=setup({layers:22});
 assert.ok(old.C.listEntities(old.m,'inventory').every(r=>r.z!==22));
 assert.throws(()=>old.C.editingInfo(old.m,'equipment',1,22),/武庫/);
 await assert.rejects(old.C.previewBatch(old.m,{kind:'equipmentMax',plane:22}),/武庫/);
 assert.equal(old.C.serialize(old.m),old.text);
});
