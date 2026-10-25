'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Ordinary Q6 柴斧 (tier 1, slots 1–5 filled, slot 1 washed) in z9 worn by character 1 and a copy in the z7 backpack.
function setup({open=true,patch=()=>{}}={}){
 const K=JSON.parse(fs.readFileSync('knowledge/catalog.json'));
 Object.assign(K.verification,{equipmentAffixCoefficient:true,backpackEquipmentAffixCoefficient:true,equipmentAffixReplacement:true,backpackEquipmentAffixReplacement:true,equipmentQualityUpgrade:true,equipmentQualityDowngrade:true,equipmentLevel:true,backpackEquipmentLevel:true,pillAptitudeBonus:true,pillAptitudeBonusDecimal:false,pillAptitudeBonusAscended:false,equipmentAffixCoefficientAdvanced:true,equipmentSixthAffix:open});
 const ctx={};vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(K)),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='測試甲';data[1][2][2]=1;
 const template=K.batch2Data.characters[1];for(let i=0;i<3;i++){data[1][10+i][2]=template.base[i];data[1][1+i][12]=template.talents[i];data[1][21+i][12]=template.talentLevels[i];}
 const supported=K.batch2Data.items[1].affixIds.filter(a=>K.affixReplacement.attributes[a]&&K.affixReplacementLimits.attributeIds.includes(a)),used=supported.slice(0,5),free=supported[5];
 for(const z of [7,9]){const put=(y,v)=>data[1][y][z]=v;put(0,1);put(1,1);put(2,1);put(3,1);put(5,6);put(6,10);put(8,245);used.forEach((a,i)=>{put(9+i,a);put(15+i,60+i);});put(28,1);}
 data[1][7][9]=1;data[1][16][2]=1;
 const pills=[1,2,3].map(a=>Number(Object.keys(K.batch2Data.pills).find(id=>K.batch2Data.pills[id].aptitude===a&&K.batch2Data.pills[id].cap>=40)));pills.forEach(id=>data[id][6][0]=10);
 patch(data,{used,free});
 const text='﻿'+JSON.stringify({c2array:true,size:[221,60,22],data}).replace('{','{\r\n"large":987654321098765432109876543210,');
 return {C,m:C.parse(text),text,pills,used,free,K};
}
const cell=(C,m,y,z=9)=>C.get(m,{x:1,y,z});

test('flag off reports the slot but refuses to write',()=>{
 const {C,m,text,free}=setup({open:false});
 const info=C.sixthAffixInfo(m,{itemId:1});
 assert.deepEqual([info.verified,info.attributeId,info.current,info.min,info.max],[false,0,0,50,120]);
 assert.throws(()=>C.setEquipmentSixthAffix(m,{itemId:1,attributeId:free,coefficient:100}),/冒煙/);
 assert.equal(C.serialize(m),text);
});

test('z9 and z7 add, replace and clear the sixth slot as exact tokens and restore cleanly',()=>{
 const {C,m,text,free,K}=setup();
 const other=K.batch2Data.items[1].affixIds.find(a=>a!==free&&!setup().used.includes(a)&&K.affixReplacement.attributes[a]&&K.affixReplacementLimits.attributeIds.includes(a));
 for(const plane of [9,7]){
  C.setEquipmentSixthAffix(m,{itemId:1,plane,attributeId:free,coefficient:50});assert.deepEqual([cell(C,m,14,plane),cell(C,m,20,plane),cell(C,m,33,plane)],[free,50,0]);
  C.setEquipmentSixthAffix(m,{itemId:1,plane,attributeId:other,coefficient:120});assert.deepEqual([cell(C,m,14,plane),cell(C,m,20,plane)],[other,120]);
  C.setEquipmentSixthAffix(m,{itemId:1,plane,attributeId:free,coefficient:87.65});
 }
 assert.ok(C.serialize(m).includes('87.65'));
 for(const plane of [9,7]){C.setEquipmentSixthAffix(m,{itemId:1,plane,attributeId:0});assert.deepEqual([cell(C,m,14,plane),cell(C,m,20,plane)],[0,0]);}
 assert.equal(C.serialize(m),text);
 C.setEquipmentSixthAffix(m,{itemId:1,attributeId:free,coefficient:100});C.undo(m);assert.equal(C.serialize(m),text);
 C.setEquipmentSixthAffix(m,{itemId:1,attributeId:free,coefficient:100});C.restore(m,{x:1,y:14,z:9});assert.equal(C.serialize(m),text);
});

test('out-of-range, over-precise, duplicate and foreign input is rejected without a partial write',()=>{
 const {C,m,text,free,used}=setup();
 for(const coefficient of [49.99,0,120.01,50.001,NaN,Infinity,'100',null])assert.throws(()=>C.setEquipmentSixthAffix(m,{itemId:1,attributeId:free,coefficient}),/50–120/);
 for(const id of used)assert.throws(()=>C.setEquipmentSixthAffix(m,{itemId:1,attributeId:id,coefficient:100}),/重複/);
 assert.throws(()=>C.setEquipmentSixthAffix(m,{itemId:1,attributeId:104,coefficient:100}),/合法池/);
 assert.throws(()=>C.setEquipmentSixthAffix(m,{itemId:1,attributeId:0,coefficient:50}),/係數須為 0/);
 assert.equal(m.history.length,0);assert.equal(C.serialize(m),text);
 assert.equal(C.setEquipmentSixthAffix(m,{itemId:1,attributeId:0}).unchanged,true);assert.equal(m.history.length,0);
});

test('only quality-6 ordinary in-range items qualify, and stored sixth slots are validated',()=>{
 const q5=setup({patch:d=>{for(const z of [7,9]){d[1][5][z]=5;d[1][8][z]=215;d[1][13][z]=0;d[1][19][z]=0;}}});
 assert.throws(()=>q5.C.sixthAffixInfo(q5.m,{itemId:1}),/品質 6/);
 const q7=setup({patch:d=>{d[1][5][9]=7;}});assert.throws(()=>q7.C.sixthAffixInfo(q7.m,{itemId:1}),/原版/);
 const overLevel=setup({patch:d=>{d[1][6][9]=36;}});assert.throws(()=>overLevel.C.sixthAffixInfo(overLevel.m,{itemId:1}),/超限裝備停用/);
 for(const [y,v,re] of [[33,1,/原版範圍/],[20,121,/原版範圍/],[20,0,/原版範圍/]]){const s=setup({patch:(d,{free})=>{d[1][14][9]=free;d[1][20][9]=100;d[1][y][9]=v;}});assert.throws(()=>s.C.sixthAffixInfo(s.m,{itemId:1}),re);}
 const dup=setup({patch:(d,{used})=>{d[1][14][9]=used[2];d[1][20][9]=100;}});assert.throws(()=>dup.C.sixthAffixInfo(dup.m,{itemId:1}),/重複/);
 const read=setup({patch:(d,{free})=>{d[1][14][9]=free;d[1][20][9]=99.5;}});const info=read.C.sixthAffixInfo(read.m,{itemId:1});assert.deepEqual([info.attributeId,info.current],[read.free,99.5]);
});

test('a sixth slot blocks quality, replacement and coefficient entries but not level or wearer aptitude edits',()=>{
 const withSixth=open=>setup({open,patch:(d,{free})=>{for(const z of [7,9]){d[1][14][z]=free;d[1][20][z]=100;}}});
 const on=withSixth(true),{C,m}=on;
 assert.throws(()=>C.affixInfo(m,1,1,9),/第六槽/);
 assert.throws(()=>C.equipmentAffixReplacementInfo(m,{itemId:1,slot:1}),/第六槽/);
 assert.throws(()=>C.equipmentQualityInfo(m,{itemId:1}),/第六槽/);
 assert.throws(()=>C.affixAdvancedInfo(m,1,1,7),/第六槽/);
 C.setEquipmentLevel(m,{itemId:1,level:20});C.setEquipmentLevel(m,{itemId:1,plane:7,level:20});assert.equal(cell(C,m,6,7),20);
 C.setPillAptitudeBonus(m,{characterId:1,aptitude:1,pillId:on.pills[0],bonus:1});
 const off=withSixth(false);
 assert.throws(()=>off.C.setEquipmentLevel(off.m,{itemId:1,plane:7,level:20}),/第六槽/);
 assert.throws(()=>off.C.setPillAptitudeBonus(off.m,{characterId:1,aptitude:1,pillId:off.pills[0],bonus:1}),/第六槽/);
 // Clearing the slot restores the five-slot entries.
 C.setEquipmentSixthAffix(m,{itemId:1,attributeId:0});assert.equal(C.affixInfo(m,1,1,9).current,60);
});

test('preview adds the sixth slot to the item contribution of its attribute',()=>{
 const {C,m,free,K}=setup();
 const p=C.previewEquipmentSixthAffix(m,{itemId:1,attributeId:free,coefficient:100});
 const r=K.affixReplacement.attributes[free],expected=Math.floor(((r.base+r.tier*1)*(100/100))*100)/100;
 assert.equal(p.effects.length,1);assert.ok(Math.abs(p.effects[0].delta-expected)<1e-9);
 assert.deepEqual([...p.changes.map(c=>c.coordinate.y)],[14,20]);
 C.setEquipmentSixthAffix(m,{itemId:1,attributeId:free,coefficient:100});
 const clear=C.previewEquipmentSixthAffix(m,{itemId:1,attributeId:0});assert.equal(clear.cleared,true);assert.ok(Math.abs(clear.effects[0].delta+expected)<1e-9);
});

test('the shipped flag has a lightweight smoke record and stays out of the composite migration proof',()=>{
 const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),P=require('../scripts/migration-proof.cjs');
 assert.equal(k.verification.equipmentSixthAffix,true);assert.equal(proof.groups.equipmentSixthAffix,true);
 const rec=proof.lightweight.equipmentSixthAffix;assert.equal(rec.passed,true);assert.equal(rec.gameVersion,k.gameVersion);
 assert.equal(P.composite(proof,'equipmentSixthAffix'),false);
});
