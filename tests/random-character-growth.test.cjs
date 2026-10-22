'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup:baseSetup}=require('./helpers/batch-fixture.cjs');
function setup(nx=450,count=2){
 const f=baseSetup(nx,count);
 for(let x=1;x<=count;x++)for(const [y,v]of [[10,30],[11,30],[12,30],[49,1]])f.a[x][y][2]=v;
 const pills=[1,2,3].map(a=>Number(Object.keys(f.k.batch2Data.pills).find(id=>f.k.batch2Data.pills[id].aptitude===a&&f.k.batch2Data.pills[id].cap>=40)));
 pills.forEach(id=>f.a[id][6][0]=10);
 f.C.KNOWLEDGE.verification.randomCharacterBaseAptitudes=true;f.C.KNOWLEDGE.verification.pillAptitudeBonus=true;
 return {...f,pills,m:f.reparse(),raw:f.rawWith()};
}
const coord=(x,y,z=2)=>({x,y,z});
test('exact recruitment accepts generated witnesses for all qualities, orientations and rounded endpoints',()=>{
 const {C,k}=setup();let cases=0;
 for(let q=1;q<=6;q++)for(const n of k.randomCharacterGrowth.totals[q-1])for(const bounds of k.randomCharacterGrowth.weights)for(let t=0;t<12;t++){
  const ws=bounds.map(([a,b],i)=>a+(b-a)*((t*7+i*3)%13)/13),s=ws.reduce((a,b)=>a+b,0),raw=ws.map(w=>Math.round(n*w/s));
  assert.ok(C.recruitmentCombination(q,raw),JSON.stringify({q,n,ws,raw}));cases++;
 }
 assert.equal(cases,576);
 for(const raw of [[21,21,57],[57,57,57],[20,35,35],[1,1,1],[142,79,79]])assert.equal(C.recruitmentCombination(1,raw),null);
 assert.ok(C.recruitmentCombination(6,[142,79,79]));assert.ok(C.recruitmentCombination(1,[30,30,30]));
 for(const raw of [[],[30,30],[30,30,30,30],[30,30,NaN],[30,30,'30'],[30,30,Infinity]])assert.equal(C.recruitmentCombination(1,raw),null);
});
test('base preview is read only, atomic set changes only requested raw tokens, no-op has no history',()=>{
 const {C,m,raw,rawWith}=setup(),o={characterId:1,baseRaw:[40,30,30]};
 const p=C.previewCharacterBaseAptitudes(m,o);assert.equal(p.canApply,true);assert.equal(m.changes.size,0);assert.equal(m.history.length,0);
 assert.equal(p.aptitudes[0].after.base,4);assert.equal(p.aptitudes[0].after.cap,6);
 C.setCharacterBaseAptitudes(m,o);assert.equal(C.serialize(m),rawWith([[1,10,2,40]]));assert.equal(m.history.length,1);
 C.setCharacterBaseAptitudes(m,o);assert.equal(m.history.length,1);C.undo(m);assert.equal(C.serialize(m),raw);
});
test('eligibility rejects named, inactive, imprisoned, staged, malformed and unsupported sources',()=>{
 const mutations=[[1,2,2,1],[1,0,2,0],[1,0,2,2],[1,55,2,1],[1,55,2,2],[1,50,2,1],[1,1,16,1],[1,16,16,1],[1,49,2,0],[1,49,2,7],[1,49,2,'1'],[1,10,2,'30'],[1,10,2,1],[1,13,2,0.5],[1,14,2,-1],[1,15,2,null],[1,1,12,999],[1,21,12,1],[1,16,2,999]];
 for(const [x,y,z,v]of mutations){const {C,m,raw}=setup();m.original.data[x][y][z]=v;const info=C.randomCharacterGrowthInfo(m,{characterId:1});assert.equal(info.eligible,false,JSON.stringify([x,y,z,v]));assert.ok(info.reasons.length);assert.throws(()=>C.setCharacterBaseAptitudes(m,{characterId:1,baseRaw:[40,30,30]}));assert.equal(C.serialize(m),raw);}
 const {C,m}=setup();for(const id of [0,-1,450,NaN,'1',null])assert.equal(C.randomCharacterGrowthInfo(m,{characterId:id}).eligible,false);
 m.original.data[3][7][9]=1;assert.equal(C.randomCharacterGrowthInfo(m,{characterId:1}).eligible,false);
});
test('three saved talent slots contribute aptitude effects and require valid numeric ID/level pairs',()=>{
 const {C,m}=setup();for(let i=0;i<3;i++){m.original.data[1][1+i][12]=i+1;m.original.data[1][21+i][12]=2;}
 const info=C.randomCharacterGrowthInfo(m,{characterId:1});assert.equal(info.eligible,true);assert.deepEqual(Array.from(info.aptitudes,a=>a.base),[4,4,4]);
 m.original.data[1][2][12]=1;assert.equal(C.randomCharacterGrowthInfo(m,{characterId:1}).eligible,false);
 m.original.data[1][2][12]=2;m.original.data[1][22][12]=0;assert.equal(C.randomCharacterGrowthInfo(m,{characterId:1}).eligible,false);
 m.original.data[1][22][12]='2';assert.equal(C.randomCharacterGrowthInfo(m,{characterId:1}).eligible,false);
});
test('pill dependency blocks decreases without truncation; equality and inventory-free base edits are allowed',()=>{
 const {C,m}=setup();m.original.data[1][13][2]=15;
 const good=C.previewCharacterBaseAptitudes(m,{characterId:1,baseRaw:[30,40,30]});assert.equal(good.canApply,true);
 const bad=C.previewCharacterBaseAptitudes(m,{characterId:1,baseRaw:[28,35,35]});assert.equal(bad.canApply,false);assert.match(bad.reasons.join(),/丹藥/);
 assert.throws(()=>C.setCharacterBaseAptitudes(m,{characterId:1,baseRaw:[28,35,35]}));assert.equal(C.get(m,coord(1,13)),15);assert.equal(m.history.length,0);
 const f=setup();f.pills.forEach(id=>f.m.original.data[id][6][0]=0);f.C.setCharacterBaseAptitudes(f.m,{characterId:1,baseRaw:[40,30,30]});
});
test('six-cell cumulative restore, per-step undo and failure rollback preserve other characters',()=>{
 const {C,m,pills,raw,rawWith}=setup();
 C.setCharacterBaseAptitudes(m,{characterId:1,baseRaw:[40,40,40]});
 for(let aptitude=1;aptitude<=3;aptitude++)C.setPillAptitudeBonus(m,{characterId:1,aptitude,pillId:pills[aptitude-1],bonus:1});
 C.setCharacterBaseAptitudes(m,{characterId:2,baseRaw:[40,30,30]});
 assert.equal(m.changes.size,7);C.restore(m,coord(1,14));assert.equal(m.changes.size,1);assert.equal(C.serialize(m),rawWith([[2,10,2,40]]));
 C.undo(m);assert.equal(m.changes.size,7);C.undo(m);assert.equal(m.changes.size,6);
 const before=C.serialize(m),history=m.history.length;
 assert.throws(()=>C.transaction(m,()=>{C.setCharacterBaseAptitudes(m,{characterId:1,baseRaw:[45,35,35]});throw Error('forced final failure');}));
 assert.equal(C.serialize(m),before);assert.equal(m.history.length,history);
 C.restore(m,coord(1,10));assert.equal(C.serialize(m),raw);
});
test('independent gates, original field types and custom coordinates cannot bypass named API policy',()=>{
 const {C,m,raw}=setup();C.KNOWLEDGE.verification.randomCharacterBaseAptitudes=false;
 assert.throws(()=>C.setCharacterBaseAptitudes(m,{characterId:1,baseRaw:[40,30,30]}),/隔離驗證/);
 for(const x of [1,220])for(const y of [10,11,12]){assert.equal(C.resolveField(m,coord(x,y)).known,true);assert.throws(()=>C.set(m,coord(x,y),40),/唯讀/);assert.throws(()=>C.setField(m,coord(x,y),40),/唯讀/);}
 C.KNOWLEDGE.verification.randomCharacterBaseAptitudes=true;
 for(const baseRaw of [[30,30,'40'],[30,30,40.1],[30,30,NaN],[30,30,Infinity],[30,30,null],[],[30,30,301]])assert.throws(()=>C.setCharacterBaseAptitudes(m,{characterId:1,baseRaw}));
 assert.throws(()=>C.setCharacterBaseAptitudes(m,{characterId:1,baseRaw:[40,30,30],advanced:true}));assert.equal(C.serialize(m),raw);
});
test('2501x60x22 complete size preserves independent expected tokens and highest character identity',()=>{
 const {C,m,rawWith,raw}=setup(2501,2500);assert.equal(C.listEntities(m,'characters').length,2500);
 C.setCharacterBaseAptitudes(m,{characterId:2500,baseRaw:[40,35,30]});
 const out=C.serialize(m);assert.equal(out,rawWith([[2500,10,2,40],[2500,11,2,35]]));assert.ok(out.startsWith('\ufeff'));assert.ok(out.includes('987654321098765432109876543210'));assert.ok(out.includes('1e+03'));
 const reloaded=C.parse(out);assert.equal(C.randomCharacterGrowthInfo(reloaded,{characterId:2500}).eligible,true);C.restore(m,coord(2500,10));assert.equal(C.serialize(m),raw);
});
module.exports={setup};
