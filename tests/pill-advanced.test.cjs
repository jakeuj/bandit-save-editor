'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup:baseSetup}=require('./helpers/batch-fixture.cjs');
// Character 2: raw 31/31/31 (Q1), A=3.1 and C=4.65, so the normal range ends at B=15; over-cap mode goes to 1000.
// Character 3: the same, ascended once (z16/z17 record), which over-cap mode does not cover.
// No pill is held: over-cap mode does not take a pill as the cap reference.
function setup({advanced=true,patch=()=>{}}={}){
 const f=baseSetup(450,3),inner=f.k.catalogs.items.find(i=>i.kind==='内丹');
 for(const x of [2,3])for(const [y,v]of [[10,31],[11,31],[12,31],[49,1]])f.a[x][y][2]=v;
 const r=f.a[400];f.a[3][50][2]=1;f.a[3][1][16]=3;f.a[3][2][16]=400;
 r[0][17]=400;r[1][17]=inner.id;r[3][17]=1;r[5][17]=3;r[6][17]=1;r[7][17]=3;r[8][17]=100;
 [107,108,109].forEach((v,j)=>{r[9+j][17]=v;r[15+j][17]=0.8;});
 patch(f.a);
 for(const g of ['randomCharacterTalents','randomCharacterBaseAptitudes','pillAptitudeBonus','pillAptitudeBonusDecimal','pillAptitudeBonusAscended'])f.C.KNOWLEDGE.verification[g]=true;
 f.C.KNOWLEDGE.verification.pillAptitudeBonusAdvanced=advanced;
 return {...f,m:f.reparse(),raw:f.rawWith()};
}
const B=(x,aptitude)=>({x,y:12+aptitude,z:2});

test('flag off reports the range but refuses to write',()=>{
 const {C,m,raw}=setup({advanced:false});
 const info=C.pillAdvancedInfo(m,{characterId:2,aptitude:1});
 assert.equal(info.verified,false);assert.equal(info.max,1000);assert.equal(info.cap,4.65);assert.equal(info.capMax,15);
 assert.throws(()=>C.setPillAptitudeBonusAdvanced(m,{characterId:2,aptitude:1,bonus:100}),/冒煙/);
 assert.equal(C.serialize(m),raw);
});

test('three aptitudes accept 0, the normal end, one past it and 1000 as exact integer tokens',()=>{
 const {C,m,raw,rawWith}=setup();
 for(let aptitude=1;aptitude<=3;aptitude++){
  const o={characterId:2,aptitude};
  for(const bonus of [0,15,16,1000]){C.setPillAptitudeBonusAdvanced(m,{...o,bonus});assert.equal(C.get(m,B(2,aptitude)),bonus);}
  const info=C.pillAdvancedInfo(m,o);assert.equal(info.total,103.1);assert.equal(info.overCap,true);
 }
 assert.equal(C.serialize(m),rawWith([[2,13,2,1000],[2,14,2,1000],[2,15,2,1000]]));
 for(let aptitude=1;aptitude<=3;aptitude++)C.restore(m,B(2,aptitude));
 assert.equal(m.changes.size,0);assert.equal(C.serialize(m),raw);
});

test('out-of-range, fractional and non-number input is rejected without a partial write',()=>{
 const {C,m,raw}=setup();
 for(const bonus of [1001,-1,0.5,15.5,NaN,Infinity,'10',null])assert.throws(()=>C.setPillAptitudeBonusAdvanced(m,{characterId:2,aptitude:1,bonus}),/0–1000 的整數/);
 for(const aptitude of [0,4,1.5])assert.throws(()=>C.pillAdvancedInfo(m,{characterId:2,aptitude}),/資質類型/);
 assert.equal(m.history.length,0);assert.equal(C.serialize(m),raw);
});

test('ascended characters stay out of over-cap mode while the normal ascended path still works',()=>{
 const {C,m}=setup();
 assert.throws(()=>C.pillAdvancedInfo(m,{characterId:3,aptitude:1}),/無結丹/);
 assert.throws(()=>C.setPillAptitudeBonusAdvanced(m,{characterId:3,aptitude:1,bonus:100}),/無結丹/);
 assert.equal(m.changes.size,0);
});

test('re-entering the current value is a no-op; undo and the aptitude group return every token',()=>{
 const {C,m,raw,rawWith}=setup({patch:a=>{a[2][13][2]=7.5;}});
 assert.equal(C.pillAdvancedInfo(m,{characterId:2,aptitude:1}).display,7.5);
 C.setPillAptitudeBonusAdvanced(m,{characterId:2,aptitude:1,bonus:200});assert.equal(C.serialize(m),rawWith([[2,13,2,200]]));
 assert.equal(C.setPillAptitudeBonusAdvanced(m,{characterId:2,aptitude:1,bonus:200}).unchanged,true);assert.equal(m.history.length,1);
 C.undo(m);assert.equal(C.serialize(m),raw);
 C.setPillAptitudeBonusAdvanced(m,{characterId:2,aptitude:1,bonus:300});C.setPillAptitudeBonusAdvanced(m,{characterId:2,aptitude:2,bonus:20});
 C.restore(m,B(2,1));assert.equal(m.changes.size,0);assert.equal(C.serialize(m),raw);
});

test('an over-cap B blocks the other aptitude edits until the normal pill path lowers it',()=>{
 const pills=require('../knowledge/catalog.json').batch2Data.pills,pillId=Number(Object.keys(pills).find(id=>pills[id].aptitude===1&&pills[id].cap>=40));
 const {C,m}=setup({patch:a=>{a[pillId][6][0]=5;}});
 assert.equal(C.randomCharacterGrowthInfo(m,{characterId:2}).eligible,true);
 C.setPillAptitudeBonusAdvanced(m,{characterId:2,aptitude:1,bonus:500});
 assert.match(C.randomCharacterGrowthInfo(m,{characterId:2}).reasons.join(),/超過角色資質上限/);
 const info=C.pillInfo(m,2,1,pillId);assert.equal(info.max,15.5);assert.equal(info.current,500);
 C.setPillAptitudeBonus(m,{characterId:2,aptitude:1,pillId,bonus:15});
 assert.equal(C.randomCharacterGrowthInfo(m,{characterId:2}).eligible,true);
});

test('custom coordinates and the normal entry cannot bypass over-cap mode',()=>{
 const {C,m}=setup();
 for(const c of [B(2,1),B(2,2),B(2,3)]){assert.throws(()=>C.set(m,c,500),/唯讀/);assert.throws(()=>C.setField(m,c,500),/唯讀/);}
 assert.throws(()=>C.setPillAptitudeBonus(m,{characterId:2,aptitude:1,pillId:1,bonus:500,advanced:true}),/超限/);
 assert.equal(m.changes.size,0);
});

test('the shipped flag has a lightweight smoke record and stays out of the composite migration proof',()=>{
 const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),P=require('../scripts/migration-proof.cjs');
 assert.equal(k.verification.pillAptitudeBonusAdvanced,true);assert.equal(proof.groups.pillAptitudeBonusAdvanced,true);
 const rec=proof.lightweight.pillAptitudeBonusAdvanced;assert.equal(rec.passed,true);assert.equal(rec.gameVersion,k.gameVersion);
 assert.equal(P.composite(proof,'pillAptitudeBonusAdvanced'),false);
});
