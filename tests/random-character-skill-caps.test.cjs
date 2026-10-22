'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup:baseSetup}=require('./helpers/batch-fixture.cjs');
function setup(nx=221,count=2){
 const f=baseSetup(nx,count);
 for(let x=1;x<=count;x++){
  for(const [y,v]of [[10,30],[11,30],[12,30],[49,1]])f.a[x][y][2]=v;
  for(let i=0;i<9;i++)f.a[x][22+i][2]=i===0?28:i===1?20:10;
  for(let i=0;i<3;i++){f.a[x][1+i][12]=i+1;f.a[x][21+i][12]=1;}
 }
 f.C.KNOWLEDGE.verification.randomCharacterSkillCaps=true;
 return {...f,m:f.reparse(),raw:f.rawWith()};
}
const c=(x,y,z=2)=>({x,y,z});
const caps=[28,20,10,10,10,10,10,10,10];
test('exact per-orientation witnesses cover six qualities and open random/round boundaries',()=>{
 const {C,k}=setup();let count=0;
 for(let q=1;q<=6;q++)for(let o=0;o<4;o++)for(const n of k.randomCharacterSkillCaps.totals[q-1])for(let t=0;t<16;t++){
  const ws=k.randomCharacterSkillCaps.weights[o].map(([a,b],i)=>a+(b-a)*((t*7+i*3)%17)/17),sum=ws.reduce((a,b)=>a+b,0),raw=ws.map(w=>Math.round(n*w/sum));
  if(q===1&&o!==3){assert.equal(C.skillCapAptitudeWitness(q,raw,o),null);continue;}
  assert.ok(C.skillCapAptitudeWitness(q,raw,o),JSON.stringify({q,o,n,ws,raw}));count++;
 }
 assert.equal(count,672);
 for(const raw of [[30,30,30],[40,30,30]])assert.ok(C.skillCapAptitudeWitness(1,raw,3));
 for(const raw of [[1,1,1],[20,35,35],[142,79,79],[30,30,'30'],[50,,50]])assert.equal(C.skillCapAptitudeWitness(1,raw,3),null);
 // At raw [30,30,60], general weights would require 40:40:80, outside [50,80).
 assert.equal(C.skillCapAptitudeWitness(1,[30,30,60],3),null);
});
test('whole-vector witnesses enumerate overlap and enforce fixed talents, orientation and distinct primary/secondary',()=>{
 const {C,k}=setup(),check=(q,raw,t,l,v)=>C.skillCapCombinations(q,raw,t,l,v);
 assert.ok(check(1,[30,30,30],[1,2,3],[1,1,1],caps).length);
 const overlap=check(1,[30,30,30],[1,2,3],[1,1,1],[20,10,10,10,10,10,10,10,10]);assert.equal(overlap.length,8);
 assert.equal(check(1,[30,30,30],[1,2,3],[1,1,1],Array(9).fill(20)).length,0);
 assert.equal(check(1,[30,30,30],[1,1,3],[1,1,1],caps).length,0);
 assert.equal(check(1,[30,30,30],[1,2,0],[1,1,0],caps).length,0);
 assert.equal(check(1,[30,30,30],[1,2,3],[3,1,1],caps).length,0);
 assert.equal(check(2,[56,32,32],[1,2,3],[1,1,1],[38,25,12,12,12,12,12,12,12]).length,0);
 const blocked=Object.entries(k.randomCharacterSkillCaps.talents).find(([,v])=>v.excludedPrimary.includes(1));assert.ok(blocked);
 assert.equal(check(1,[30,30,30],[+blocked[0],2,3],[1,1,1],caps).length,0);
 // General aptitude weights and three common-category talents provide production witnesses at all qualities.
 for(let q=1;q<=6;q++)for(const endpoint of [0,1]){
  const r=k.randomCharacterSkillCaps.ranges[q-1],n=k.randomCharacterSkillCaps.totals[q-1][0],v=[r.primary[endpoint],r.secondary[endpoint],...Array(7).fill(r.base[endpoint])];
  assert.ok(check(q,Array(3).fill(n/3),[1,2,3],Array(3).fill(k.randomCharacterSkillCaps.talentLevels[q-1][0]),v).length);
 }
});
module.exports={setup,c,caps};
const options=(values=caps,id=1)=>({characterId:id,caps:[...values]});
const apply=(C,m,o)=>C.setCharacterSkillCaps(m,o,{preview:C.previewCharacterSkillCaps(m,o)});
test('named cap preview keeps level/remainder, applies atomic exact tokens and treats equal values as no-op',()=>{
 const {C,m,rawWith}=setup(),o=options([29,...caps.slice(1)]),p=C.previewCharacterSkillCaps(m,o);
 assert.equal(p.canApply,true);assert.equal(p.rows.length,9);assert.equal(p.changes.length,1);assert.equal(m.changes.size,0);
 p.changes[0].after=99;p.rows[0].after.cap=99;C.setCharacterSkillCaps(m,o,{preview:p});
 assert.equal(C.serialize(m),rawWith([[1,22,2,29]]));assert.equal(m.history.length,1);
 apply(C,m,o);assert.equal(m.history.length,1);
 assert.throws(()=>C.setCharacterSkillCaps(m,o,{preview:p}),/預覽/);
});
test('eligibility is narrower for identity/stage but does not copy pill/equipment/auto-transfer restrictions',()=>{
 const {C,a,reparse}=setup();
 for(const [y,z,v]of [[0,2,0],[0,2,2],[1,2,0],[2,2,1],[2,2,'0'],[55,2,1],[55,2,2],[50,2,1],[1,16,1],[16,16,1],[49,2,7],[49,2,'1'],[22,2,100],[31,2,29],[31,2,0],[40,2,'0'],[40,2,-1],[40,2,Number.MAX_SAFE_INTEGER+1],[1,12,0],[21,12,0],[21,12,3],[10,2,1]]){
  const old=a[1][y][z];a[1][y][z]=v;const m=reparse();assert.equal(C.randomCharacterSkillCapsInfo(m,{characterId:1}).eligible,false,JSON.stringify([y,z,v]));a[1][y][z]=old;
 }
 for(const id of [0,-1,221,'1',NaN])assert.equal(C.randomCharacterSkillCapsInfo(reparse(),{characterId:id}).eligible,false);
 a[1][13][2]=0.5;a[1][16][2]=999;a[1][59][2]=2;
 assert.equal(C.randomCharacterSkillCapsInfo(reparse(),{characterId:1}).eligible,true);
});
test('lowering to nonzero remainder blocks; raising or unchanged cap preserves even capped fractional remainder',()=>{
 const {C,a,reparse}=setup();a[1][31][2]=27;a[1][40][2]=0.5;let m=reparse();
 for(const n of [26,27]){const o=options([n,...caps.slice(1)]);assert.equal(C.previewCharacterSkillCaps(m,o).canApply,false);assert.throws(()=>apply(C,m,o));assert.equal(m.history.length,0);}
 const o=options([29,...caps.slice(1)]);apply(C,m,o);assert.equal(C.get(m,c(1,40)),0.5);assert.equal(C.get(m,c(1,31)),27);
 a[1][40][2]=0;m=reparse();apply(C,m,options([27,...caps.slice(1)]));assert.equal(C.get(m,c(1,22)),27);
 a[1][31][2]=28;a[1][40][2]=10000.5;m=reparse();apply(C,m,options());assert.equal(m.history.length,0);assert.equal(C.get(m,c(1,40)),10000.5);
 apply(C,m,o);assert.equal(C.get(m,c(1,31)),28);assert.equal(C.get(m,c(1,40)),10000.5);
});
test('private preview rejects forged, cross-model, stale, rule/gate/input mutations and malformed requests',()=>{
 const {C,m,reparse}=setup(),o=options([29,...caps.slice(1)]);let p=C.previewCharacterSkillCaps(m,o);
 assert.throws(()=>C.setCharacterSkillCaps(m,o,{preview:{...p}}));assert.throws(()=>C.setCharacterSkillCaps(reparse(),o,{preview:p}));
 assert.throws(()=>C.setCharacterSkillCaps(m,options([30,...caps.slice(1)]),{preview:p}));
 C.set(m,c(1,2,0),10);C.set(m,c(1,2,0),0);assert.throws(()=>C.setCharacterSkillCaps(m,o,{preview:p}));
 p=C.previewCharacterSkillCaps(m,o); C.transaction(m,()=>C.set(m,c(1,2,0),10));assert.throws(()=>C.setCharacterSkillCaps(m,o,{preview:p}));C.undo(m);
 p=C.previewCharacterSkillCaps(m,o);m.original.data[1][40][2]=3;assert.throws(()=>C.setCharacterSkillCaps(m,o,{preview:p}));
 p=C.previewCharacterSkillCaps(m,o);C.KNOWLEDGE.randomCharacterSkillCaps.policy='changed';assert.throws(()=>C.setCharacterSkillCaps(m,o,{preview:p}));
 p=C.previewCharacterSkillCaps(m,o);C.KNOWLEDGE.verification.randomCharacterSkillCaps=false;assert.throws(()=>C.setCharacterSkillCaps(m,o,{preview:p}));assert.throws(()=>apply(C,m,o),/隔離/);
 for(const invalid of [[],Array(9),caps.slice(1),[...caps,10],['28',...caps.slice(1)],[NaN,...caps.slice(1)],[28.5,...caps.slice(1)]])assert.throws(()=>apply(C,m,{characterId:1,caps:invalid}));
 assert.throws(()=>apply(C,m,{...o,advanced:true}));assert.equal(m.changes.size,0);
});
const exp=(C,m,id=1,skill=1,amount=10001)=>C.addExperience(m,{kind:'skill',characterId:id,id:skill,amount});
test('first cap transaction absorbs previous skill experience; restore from cap/level/remainder restores all 27 cells only',()=>{
 for(const y of [22,31,40]){
  const {C,m,rawWith}=setup();exp(C,m);exp(C,m,2);const before=m.history.length;
  apply(C,m,options([29,...caps.slice(1)]));exp(C,m,1,2);
  assert.equal(m.changes.get('1,40,2').group,'skill-growth:1');assert.equal(m.history.length,before+2);
  C.restore(m,c(1,y));assert.equal(C.serialize(m),rawWith([[2,31,2,2],[2,40,2,1]]));
  C.undo(m);assert.equal(m.changes.get('1,40,2').group,'skill-growth:1');assert.equal(C.get(m,c(1,22)),29);
 }
});
test('undo restores dependency modes and immutable prior snapshots; cap baseline still groups later experience',()=>{
 const {C,m,raw}=setup();exp(C,m);apply(C,m,options([29,...caps.slice(1)]));
 C.undo(m);assert.equal(m.changes.get('1,40,2').group,'growth:skill:1:1');
 exp(C,m,1,2);C.restore(m,c(1,41));assert.equal(C.get(m,c(1,40)),1);
 apply(C,m,options([29,...caps.slice(1)]));apply(C,m,options());assert.equal(m.changes.has('1,22,2'),false);
 exp(C,m,1,3);assert.equal(m.changes.get('1,42,2').group,'skill-growth:1');
 C.restoreAll(m);assert.equal(C.serialize(m),raw);C.undo(m);assert.equal(m.changes.get('1,42,2').group,'skill-growth:1');
 C.restoreAll(m);exp(C,m,1,4);assert.equal(m.changes.get('1,43,2').group,'growth:skill:1:4');
});
test('failed outer and nested transactions restore counters, history and dependency markers',()=>{
 const {C,m,raw}=setup(),counter=m.operationCounter;
 assert.throws(()=>C.transaction(m,()=>{apply(C,m,options([29,...caps.slice(1)]));exp(C,m);throw Error('after writes');}));
 assert.equal(C.serialize(m),raw);assert.equal(m.history.length,0);assert.equal(m.operationCounter,counter);
 exp(C,m);assert.equal(m.changes.get('1,40,2').group,'growth:skill:1:1');
 C.transaction(m,()=>{assert.throws(()=>C.transaction(m,()=>{apply(C,m,options([29,...caps.slice(1)]));throw Error('nested');}));exp(C,m,1,2);});
 assert.equal(C.get(m,c(1,22)),28);assert.equal(m.changes.get('1,41,2').group,'growth:skill:1:2');
});
test('v2.6 batches preserve cumulative modes in both orders, isolate other characters, and invalidate stale previews',async()=>{
 const {C,m,rawWith}=setup(),request={kind:'skillExperience',characterId:1,amount:10001};
 const batch=await C.previewBatch(m,request);apply(C,m,options([29,...caps.slice(1)]));
 await assert.rejects(C.applyBatch(m,request,{preview:batch}),/重新預覽/);
 const capPreview=C.previewCharacterSkillCaps(m,options([30,...caps.slice(1)]));
 await C.applyBatch(m,request);assert.throws(()=>C.setCharacterSkillCaps(m,options([30,...caps.slice(1)]),{preview:capPreview}));
 assert.equal(m.history.length,2);for(const d of m.changes.values())assert.equal(d.group,'skill-growth:1');
 exp(C,m,2);C.restore(m,c(1,40));assert.equal(C.serialize(m),rawWith([[2,31,2,2],[2,40,2,1]]));
 await C.applyBatch(m,request);assert.equal(m.changes.get('1,40,2').group,'growth:skill:1:1');
 apply(C,m,options([29,...caps.slice(1)]));C.restore(m,c(1,48));assert.equal(C.serialize(m),rawWith([[2,31,2,2],[2,40,2,1]]));
 C.undo(m);const before=C.serialize(m),history=m.history.length,counter=m.operationCounter;
 // One target is unprocessable: staged earlier targets must not leak back to the model.
 m.original.data[1][30][2]=0;await assert.rejects(C.applyBatch(m,request),/整批未套用/);assert.equal(C.serialize(m),before);assert.equal(m.history.length,history);assert.equal(m.operationCounter,counter);
});
test('caps and experience gates remain independent; existing addExperience still floors, spans levels and zeroes final cap',()=>{
 const {C,a,reparse}=setup();C.KNOWLEDGE.verification.skillExperience=false;let m=reparse();apply(C,m,options([29,...caps.slice(1)]));assert.throws(()=>exp(C,m));
 C.KNOWLEDGE.verification.skillExperience=true;C.KNOWLEDGE.verification.randomCharacterSkillCaps=false;m=reparse();exp(C,m);assert.throws(()=>apply(C,m,options([29,...caps.slice(1)])));
 C.KNOWLEDGE.verification.randomCharacterSkillCaps=true;a[1][31][2]=28;a[1][40][2]=10000.9;m=reparse();apply(C,m,options([29,...caps.slice(1)]));
 const need=C.experienceNeed.skill(28);exp(C,m,1,1,need-10000);assert.equal(C.get(m,c(1,31)),29);assert.equal(C.get(m,c(1,40)),0);
});
test('every known cap/level/remainder is readonly even inactive rows and legacy setters; no tenth skill',()=>{
 const {C,m}=setup();
 for(const x of [0,1,220])for(let y=22;y<=48;y++)for(const method of ['set','setField']){assert.equal(C.resolveField(m,c(x,y)).known,true);assert.throws(()=>C[method](m,c(x,y),5),/唯讀/);}
 assert.throws(()=>C.addExperience(m,{kind:'skill',characterId:1,id:10,amount:1}));assert.equal(m.changes.size,0);
});
test('2501×60×22 last-character caps and interleaved experience export exact independent tokens, then restore and undo',async()=>{
 const f=setup(2501,2),{C,a}=f,id=2500;
 a[id]=a[1].map(row=>[...row]);a[id][0][2]=id;const m=f.reparse(),raw=f.rawWith(),o=options([29,21,...caps.slice(2)],id);
 const before={counter:m.operationCounter,revision:m.revision,history:m.history.length};
 assert.throws(()=>C.transaction(m,()=>{apply(C,m,o);exp(C,m,id);throw Error('full-size rollback');}));
 assert.equal(C.serialize(m),raw);assert.deepEqual({counter:m.operationCounter,revision:m.revision,history:m.history.length},before);
 apply(C,m,o);exp(C,m,id);const p=await C.previewBatch(m,{kind:'skillExperience',characterId:id,amount:20000});
 await C.applyBatch(m,{kind:'skillExperience',characterId:id,amount:20000},{preview:p});
 const patches=[[id,22,2,29],[id,23,2,21],[id,31,2,3],[id,40,2,9001]];
 for(let skill=2;skill<=9;skill++)patches.push([id,30+skill,2,2],[id,39+skill,2,10000]);
 const expected=f.rawWith(patches);assert.equal(C.serialize(m),expected);assert.equal(m.history.length,3);
 const reload=C.parse(expected);assert.equal(C.randomCharacterSkillCapsInfo(reload,{characterId:id}).eligible,true);
 assert.equal(C.resolveField(m,c(id,22)).related.length,27);
 C.restore(m,c(id,48));assert.equal(C.serialize(m),raw);C.undo(m);assert.equal(C.serialize(m),expected);
 C.restoreAll(m);assert.equal(C.serialize(m),raw);C.undo(m);assert.equal(C.serialize(m),expected);
 C.undo(m);C.undo(m);C.undo(m);assert.equal(C.serialize(m),raw);
 assert.equal(raw.charCodeAt(0),0xfeff);assert.ok(raw.includes('987654321098765432109876543210'));assert.ok(raw.includes('1e+03'));
});
