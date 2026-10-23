'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup:baseSetup}=require('./helpers/batch-fixture.cjs');
// Character 1: raw 69/71/69 (Q4) against P=10 pills, whose endpoints are float tails (30.999999999999996, 29.000000000000004).
// Character 2: raw 31/31/31 (Q1) against P>=40 pills, whose C=4.65 endpoint is B=15.5.
// Character 3: Q2 with 力量强化 so the talent preview reads a decimal B.
function setup({decimal=true,patch=()=>{}}={}){
 const f=baseSetup(450,3);
 for(const [y,v]of [[10,69],[11,71],[12,69],[49,4]])f.a[1][y][2]=v;
 for(const [y,v]of [[10,31],[11,31],[12,31],[49,1]])f.a[2][y][2]=v;
 for(const [y,v]of [[10,50],[11,40],[12,40],[49,2]])f.a[3][y][2]=v;
 [[1,1],[4,2],[52,3]].forEach(([id,l],i)=>{f.a[3][1+i][12]=id;f.a[3][21+i][12]=l;});
 const pick=test=>[1,2,3].map(a=>Number(Object.keys(f.k.batch2Data.pills).find(id=>f.k.batch2Data.pills[id].aptitude===a&&test(f.k.batch2Data.pills[id]))));
 const low=pick(p=>p.cap===10),high=pick(p=>p.cap>=40);
 [...low,...high].forEach(id=>f.a[id][6][0]=10);
 patch(f.a);
 for(const g of ['randomCharacterTalents','randomCharacterBaseAptitudes','pillAptitudeBonus'])f.C.KNOWLEDGE.verification[g]=true;
 f.C.KNOWLEDGE.verification.pillAptitudeBonusDecimal=decimal;
 return {...f,low,high,m:f.reparse(),raw:f.rawWith()};
}
const B=(x,aptitude)=>({x,y:12+aptitude,z:2});
const talentOptions={characterId:3,levels:[2,2,3]};

test('flag off keeps the integer-only behaviour and decimal B read only',()=>{
 const {C,m,high}=setup({decimal:false});
 assert.equal(C.pillInfo(m,2,1,high[0]).max,15);assert.equal(C.pillInfo(m,2,1,high[0]).step,1);
 for(const bonus of [0.5,15.5])assert.throws(()=>C.setPillAptitudeBonus(m,{characterId:2,aptitude:1,pillId:high[0],bonus}),/整數/);
 const d=setup({decimal:false,patch:a=>{a[2][13][2]=15.5;a[3][13][2]=0.5;}});
 assert.throws(()=>d.C.pillInfo(d.m,2,1,d.high[0]),/唯讀/);
 assert.equal(d.C.randomCharacterGrowthInfo(d.m,{characterId:2}).eligible,false);
 assert.match(d.C.previewCharacterTalents(d.m,talentOptions).reasons.join(),/唯讀/);
});

test('three aptitudes accept 0, the .5 endpoint and the step before it, and reject the step after and off-grid values',()=>{
 const {C,m,high,raw}=setup();
 for(let aptitude=1;aptitude<=3;aptitude++){
  const o={characterId:2,aptitude,pillId:high[aptitude-1]},info=C.pillInfo(m,2,aptitude,o.pillId);
  assert.equal(info.max,15.5);assert.equal(info.step,0.1);assert.equal(info.cap,4.65);
  for(const bonus of [0,15.4,15.5]){C.setPillAptitudeBonus(m,{...o,bonus});assert.equal(C.get(m,B(2,aptitude)),bonus);}
  assert.equal(C.pillInfo(m,2,aptitude,o.pillId).total,4.65);
  for(const bonus of [15.6,15.55,0.05,-0.1,NaN,Infinity,'1',null])assert.throws(()=>C.setPillAptitudeBonus(m,{...o,bonus}),/一位小數/);
  assert.equal(C.get(m,B(2,aptitude)),15.5);
  C.setPillAptitudeBonus(m,{...o,bonus:0});
 }
 assert.equal(m.changes.size,0);assert.equal(C.serialize(m),raw);
});

test('float-tail endpoints round onto the grid instead of losing a step',()=>{
 const {C,m,low}=setup();
 assert.equal(C.pillInfo(m,1,1,low[0]).max,31);assert.equal(C.pillInfo(m,1,2,low[1]).max,29);
 C.setPillAptitudeBonus(m,{characterId:1,aptitude:1,pillId:low[0],bonus:31});assert.equal(C.pillInfo(m,1,1,low[0]).total,10);
 assert.throws(()=>C.setPillAptitudeBonus(m,{characterId:1,aptitude:2,pillId:low[1],bonus:29.1}),/一位小數/);
});

test('an untouched native float tail keeps its token; edits, undo and restore return to it',()=>{
 const tail=30.999999999999996,{C,m,low,raw,rawWith}=setup({patch:a=>{a[1][13][2]=tail;}});
 assert.ok(raw.includes(String(tail)));
 const o={characterId:1,aptitude:1,pillId:low[0]},info=C.pillInfo(m,1,1,o.pillId);
 assert.equal(info.current,tail);assert.equal(info.display,31);assert.equal(info.total,10);
 assert.equal(C.setPillAptitudeBonus(m,{...o,bonus:31}).unchanged,true);assert.equal(m.history.length,0);assert.equal(C.serialize(m),raw);
 C.setPillAptitudeBonus(m,{...o,bonus:30.9});assert.equal(C.serialize(m),rawWith([[1,13,2,30.9]]));
 C.undo(m);assert.equal(C.serialize(m),raw);
 C.setPillAptitudeBonus(m,{...o,bonus:0});C.setPillAptitudeBonus(m,{...o,bonus:12.3});C.restore(m,B(1,1));assert.equal(C.serialize(m),raw);
});

test('decimal B joins the base aptitude group: caps block, restore returns every token',()=>{
 const {C,m,high,raw}=setup();
 C.setPillAptitudeBonus(m,{characterId:2,aptitude:1,pillId:high[0],bonus:15.5});
 const info=C.randomCharacterGrowthInfo(m,{characterId:2});assert.equal(info.eligible,true);assert.equal(info.aptitudes[0].total,4.65);
 const blocked=C.previewCharacterBaseAptitudes(m,{characterId:2,baseRaw:[30,31,31]});assert.match(blocked.reasons.join(),/15\.5/);
 C.setPillAptitudeBonus(m,{characterId:2,aptitude:1,pillId:high[0],bonus:15});
 C.setCharacterBaseAptitudes(m,{characterId:2,baseRaw:[30,31,31]});assert.equal(C.get(m,{x:2,y:10,z:2}),30);
 C.restore(m,B(2,1));assert.equal(m.changes.size,0);assert.equal(C.serialize(m),raw);
});

test('talent preview reads a decimal B and blocks a level that would leave it over the cap',()=>{
 const {C,m,high,raw}=setup({patch:a=>{a[3][13][2]=7.5;}});
 const p=C.previewCharacterTalents(m,talentOptions);assert.equal(p.reasons.length,0,p.reasons.join());
 const strength=p.aptitudes.find(a=>a.aptitude===1);assert.equal(strength.after.bonus,7.5);
 assert.equal(C.setCharacterTalents(m,talentOptions,{preview:p}).changes.length,1);
 C.setPillAptitudeBonus(m,{characterId:3,aptitude:1,pillId:high[0],bonus:C.pillInfo(m,3,1,high[0]).max});
 const down={characterId:3,levels:[1,2,3]};assert.match(C.previewCharacterTalents(m,down).reasons.join(),/超過上限/);
 C.restore(m,B(3,1));assert.equal(C.serialize(m),raw);
});

test('custom coordinates and advanced mode cannot bypass the decimal flag',()=>{
 const {C,m,high}=setup();
 for(const c of [B(2,1),B(2,2),B(2,3)]){assert.throws(()=>C.set(m,c,0.5),/唯讀/);assert.throws(()=>C.setField(m,c,0.5),/唯讀/);}
 assert.throws(()=>C.setPillAptitudeBonus(m,{characterId:2,aptitude:1,pillId:high[0],bonus:1.5,advanced:true}),/超限/);
 C.KNOWLEDGE.verification.pillAptitudeBonus=false;assert.throws(()=>C.setPillAptitudeBonus(m,{characterId:2,aptitude:1,pillId:high[0],bonus:1.5}),/驗證/);
 assert.equal(m.changes.size,0);
});
