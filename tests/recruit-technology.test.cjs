'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup:baseSetup}=require('./helpers/batch-fixture.cjs');
// The batch fixture stores every advanced technology at 1 and a 書院 at tier 1, so #33 starts at L=1 (interval 599 s).
function setup({advanced=true,patch=()=>{}}={}){
 const f=baseSetup(450,2);
 f.a[1][17][0]=120;
 patch(f.a);
 f.C.KNOWLEDGE.verification.recruitTechnologyAdvanced=advanced;
 return {...f,m:f.reparse(),raw:f.rawWith()};
}
const L={x:33,y:4,z:0};

test('flag off reports the range but refuses to write',()=>{
 const {C,m,raw}=setup({advanced:false});
 const info=C.recruitTechnologyInfo(m);
 assert.equal(info.verified,false);assert.equal(info.min,300);assert.equal(info.max,599);
 assert.equal(info.current,1);assert.equal(info.interval,599);assert.equal(info.countdown,120);
 assert.throws(()=>C.setRecruitTechnologyLevel(m,{level:400}),/冒煙/);
 assert.equal(C.serialize(m),raw);
});

test('300, 450 and 599 are written as exact integer tokens and leave the countdown alone',()=>{
 const {C,m,raw,rawWith}=setup();
 for(const level of [300,450,599]){const r=C.setRecruitTechnologyLevel(m,{level});assert.equal(C.get(m,L),level);assert.equal(r.interval,600-level);}
 assert.equal(C.recruitTechnologyInfo(m).interval,1);assert.equal(C.get(m,{x:1,y:17,z:0}),120);
 assert.equal(m.changes.size,1);assert.equal(C.serialize(m),rawWith([[33,4,0,599]]));
 C.restore(m,L);assert.equal(m.changes.size,0);assert.equal(C.serialize(m),raw);
});

test('out-of-range, fractional and non-number input is rejected without a partial write',()=>{
 const {C,m,raw}=setup();
 for(const level of [299,600,1000,-1,450.5,NaN,Infinity,'450',null])assert.throws(()=>C.setRecruitTechnologyLevel(m,{level}),/300–599 的整數/);
 assert.equal(m.history.length,0);assert.equal(C.serialize(m),raw);
});

test('a running #33 research blocks the over-limit entry',()=>{
 const {C,m}=setup({patch:a=>{a[33][13][0]=1;}});
 assert.throws(()=>C.recruitTechnologyInfo(m),/正在研究/);
 assert.throws(()=>C.setRecruitTechnologyLevel(m,{level:400}),/正在研究/);
 assert.equal(m.changes.size,0);
});

test('re-entering the current value is a no-op; undo returns the token; advanced mode lowers it back',()=>{
 const {C,m,raw,rawWith}=setup({patch:a=>{a[33][4][0]=350;}});
 assert.equal(C.recruitTechnologyInfo(m).interval,250);
 assert.equal(C.setRecruitTechnologyLevel(m,{level:350}).unchanged,true);assert.equal(m.history.length,0);
 C.setRecruitTechnologyLevel(m,{level:500});assert.equal(C.serialize(m),rawWith([[33,4,0,500]]));
 C.undo(m);assert.equal(C.serialize(m),raw);
 C.setRecruitTechnologyLevel(m,{level:500});
 C.setAdvancedTechnologyLevel(m,{technologyId:33,level:200,advanced:true});assert.equal(C.get(m,L),200);
 assert.equal(m.changes.get('33,4,0').group,'editing:technology:33');
 C.restore(m,L);assert.equal(C.serialize(m),raw);
});

test('custom coordinates, batch and the existing advanced entry cannot pass 299',async()=>{
 const {C,m}=setup();
 assert.throws(()=>C.set(m,L,400),/具名/);assert.throws(()=>C.setField(m,L,400),/具名/);
 assert.throws(()=>C.setAdvancedTechnologyLevel(m,{technologyId:33,level:300,advanced:true}),/299/);
 await assert.rejects(C.applyBatch(m,{kind:'technologyLevel',level:400}),/上限/);
 assert.equal(m.changes.size,0);
});

test('the shipped flag has a lightweight smoke record and stays out of the composite migration proof',()=>{
 const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),P=require('../scripts/migration-proof.cjs');
 assert.equal(k.verification.recruitTechnologyAdvanced,true);assert.equal(proof.groups.recruitTechnologyAdvanced,true);
 const rec=proof.lightweight.recruitTechnologyAdvanced;assert.equal(rec.passed,true);assert.equal(rec.gameVersion,k.gameVersion);
 assert.equal(P.composite(proof,'recruitTechnologyAdvanced'),false);
 assert.equal(k.editingLimits.technology.maxById[33],299,'299 and below stay with the advanced technology group');
});
