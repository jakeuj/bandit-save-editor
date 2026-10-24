'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Ordinary Q2 柴斧 (tier 1, 10–80) in z9 worn by character 1 and a copy in the z7 backpack; slot 1 is the selected wash slot.
function setup({advanced=true,patch=()=>{}}={}){
 const K=JSON.parse(fs.readFileSync('knowledge/catalog.json'));
 Object.assign(K.verification,{equipmentAffixCoefficient:true,backpackEquipmentAffixCoefficient:true,equipmentAffixReplacement:true,backpackEquipmentAffixReplacement:true,equipmentQualityUpgrade:true,equipmentQualityDowngrade:true,equipmentLevel:true,backpackEquipmentLevel:true,pillAptitudeBonus:true,pillAptitudeBonusDecimal:false,pillAptitudeBonusAscended:false,equipmentAffixCoefficientAdvanced:advanced});
 const ctx={};vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(K)),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='測試甲';data[1][2][2]=1;
 const template=K.batch2Data.characters[1];for(let i=0;i<3;i++){data[1][10+i][2]=template.base[i];data[1][1+i][12]=template.talents[i];data[1][21+i][12]=template.talentLevels[i];}
 const affix=K.batch2Data.items[1].affixIds[0];
 for(const z of [7,9]){const put=(y,v)=>data[1][y][z]=v;put(0,1);put(1,1);put(2,1);put(3,1);put(5,2);put(6,1);put(8,95);put(9,affix);put(15,20);put(28,1);}
 data[1][7][9]=1;data[1][16][2]=1;
 const pills=[1,2,3].map(a=>Number(Object.keys(K.batch2Data.pills).find(id=>K.batch2Data.pills[id].aptitude===a&&K.batch2Data.pills[id].cap>=40)));pills.forEach(id=>data[id][6][0]=10);
 patch(data);
 const text='﻿'+JSON.stringify({c2array:true,size:[221,60,22],data}).replace('{','{\r\n"large":987654321098765432109876543210,');
 return {C,m:C.parse(text),text,pills,affix};
}
const coef=(C,m,z=9)=>C.get(m,{x:1,y:15,z});

test('flag off reports the over-limit range but refuses to write',()=>{
 const {C,m,text}=setup({advanced:false});
 const info=C.affixAdvancedInfo(m,1,1,9);
 assert.equal(info.verified,false);assert.deepEqual([info.min,info.normalMax,info.max,info.current],[10,80,1000,20]);
 assert.throws(()=>C.setEquipmentAffixCoefficientAdvanced(m,{itemId:1,slot:1,coefficient:500}),/冒煙/);
 assert.equal(C.serialize(m),text);
});

test('z9 and z7 accept the native minimum through 1000 as exact tokens and restore cleanly',()=>{
 const {C,m,text}=setup();
 for(const plane of [9,7])for(const coefficient of [10,80.01,123.45,1000]){C.setEquipmentAffixCoefficientAdvanced(m,{itemId:1,slot:1,coefficient,plane});assert.equal(coef(C,m,plane),coefficient);}
 assert.equal(m.changes.size,2);
 assert.ok(C.serialize(m).includes('1000')&&!C.serialize(m).includes('1000.0'));
 C.restore(m,{x:1,y:15,z:9});C.restore(m,{x:1,y:15,z:7});assert.equal(C.serialize(m),text);
 C.setEquipmentAffixCoefficientAdvanced(m,{itemId:1,slot:1,coefficient:500.5});C.undo(m);assert.equal(C.serialize(m),text);
});

test('out-of-range, over-precise and non-number input is rejected without a partial write',()=>{
 const {C,m,text}=setup();
 for(const coefficient of [9.99,0,1000.01,10.001,NaN,Infinity,'500',null])assert.throws(()=>C.setEquipmentAffixCoefficientAdvanced(m,{itemId:1,slot:1,coefficient}),/10–1000/);
 assert.equal(m.history.length,0);assert.equal(C.serialize(m),text);
});

test('only the selected wash slot of an ordinary in-level item is accepted',()=>{
 assert.throws(()=>setup().C.affixAdvancedInfo(setup().m,1,2,9),/品質範圍/);
 const unwashed=setup({patch:d=>{d[1][28][9]=0;}});assert.throws(()=>unwashed.C.setEquipmentAffixCoefficientAdvanced(unwashed.m,{itemId:1,slot:1,coefficient:500}),/選定/);
 const overLevel=setup({patch:d=>{d[1][6][9]=100;}});assert.throws(()=>overLevel.C.affixAdvancedInfo(overLevel.m,1,1,9),/超限裝備停用/);
 const overMax=setup({patch:d=>{d[1][15][9]=1000.01;}});assert.throws(()=>overMax.C.affixAdvancedInfo(overMax.m,1,1,9),/原版範圍/);
});

test('an over-limit item can be read back, lowered to the native range and re-edited',()=>{
 const {C,m}=setup({patch:d=>{d[1][15][9]=600;}});
 assert.equal(C.affixAdvancedInfo(m,1,1,9).current,600);
 C.setEquipmentAffixCoefficientAdvanced(m,{itemId:1,slot:1,coefficient:40});
 assert.equal(C.affixInfo(m,1,1,9).current,40);C.setEquipmentAffixCoefficient(m,{itemId:1,slot:1,coefficient:50});assert.equal(coef(C,m),50);
});

test('over-limit coefficients block quality, replacement and the ordinary coefficient entry',()=>{
 const {C,m}=setup({patch:d=>{d[1][15][9]=d[1][15][7]=600;}});
 assert.throws(()=>C.affixInfo(m,1,1,9),/已超限/);
 assert.throws(()=>C.setEquipmentAffixCoefficient(m,{itemId:1,slot:1,coefficient:30}),/已超限/);
 assert.throws(()=>C.equipmentAffixReplacementInfo(m,{itemId:1,slot:1}),/已超限/);
 assert.throws(()=>C.equipmentQualityInfo(m,{itemId:1}),/已超限/);
 assert.throws(()=>C.affixInfo(m,1,1,7),/已超限/);
});

test('level edits and the wearer aptitude features accept an over-limit coefficient only with the flag on',()=>{
 const on=setup({patch:d=>{d[1][15][9]=d[1][15][7]=600;}});
 on.C.setEquipmentLevel(on.m,{itemId:1,level:5});on.C.setEquipmentLevel(on.m,{itemId:1,plane:7,level:5});
 assert.equal(on.C.get(on.m,{x:1,y:6,z:7}),5);
 on.C.setPillAptitudeBonus(on.m,{characterId:1,aptitude:1,pillId:on.pills[0],bonus:1});
 const off=setup({advanced:false,patch:d=>{d[1][15][9]=d[1][15][7]=600;}});
 assert.throws(()=>off.C.setEquipmentLevel(off.m,{itemId:1,plane:7,level:5}),/已超限/);
 assert.throws(()=>off.C.setPillAptitudeBonus(off.m,{characterId:1,aptitude:1,pillId:off.pills[0],bonus:1}),/已超限/);
});

test('preview reports the linear item effect for the slot attribute',()=>{
 const {C,m}=setup();
 const p=C.previewEquipmentAffixCoefficientAdvanced(m,{itemId:1,slot:1,coefficient:1000});
 assert.equal(p.overLimit,true);assert.equal(p.unchanged,false);
 assert.ok(p.effect.after>p.effect.before*40,'effect should scale with the coefficient');
 assert.equal(C.previewEquipmentAffixCoefficientAdvanced(m,{itemId:1,slot:1,coefficient:20}).unchanged,true);
 assert.equal(C.setEquipmentAffixCoefficientAdvanced(m,{itemId:1,slot:1,coefficient:20}).unchanged,true);assert.equal(m.history.length,0);
});

test('the shipped flag has a lightweight smoke record and stays out of the composite migration proof',()=>{
 const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),P=require('../scripts/migration-proof.cjs');
 assert.equal(k.verification.equipmentAffixCoefficientAdvanced,true);assert.equal(proof.groups.equipmentAffixCoefficientAdvanced,true);
 const rec=proof.lightweight.equipmentAffixCoefficientAdvanced;assert.equal(rec.passed,true);assert.equal(rec.gameVersion,k.gameVersion);
 assert.equal(P.composite(proof,'equipmentAffixCoefficientAdvanced'),false);
});
