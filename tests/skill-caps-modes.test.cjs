'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup:baseSetup}=require('./helpers/batch-fixture.cjs');
const initial=[15,23,4,28,1,4,10,37,1],recruited=[28,20,10,10,10,10,10,10,10];
const cell=(y,x=1)=>({x,y,z:2});
function setup({caps=initial,initialGate=true,advancedGate=true}={}){
 const f=baseSetup(221,2);
 for(let x=1;x<=2;x++){
  for(const [y,v]of [[10,30],[11,30],[12,30],[49,1]])f.a[x][y][2]=v;
  caps.forEach((v,i)=>{f.a[x][22+i][2]=v;});
  for(let i=0;i<3;i++){f.a[x][1+i][12]=i+1;f.a[x][21+i][12]=1;}
 }
 Object.assign(f.C.KNOWLEDGE.verification,{randomCharacterSkillCaps:true,randomCharacterSkillCapsInitial:initialGate,randomCharacterSkillCapsAdvanced:advancedGate});
 return {...f,m:f.reparse(),raw:f.rawWith()};
}
const request=caps=>({characterId:1,caps});
const advanced=(C,m,caps)=>C.setCharacterSkillCapsAdvanced(m,request(caps),{preview:C.previewCharacterSkillCapsAdvanced(m,request(caps))});

test('initial vector has its unique native source witness and an independent closed gate',()=>{
 const {C,m}=setup({initialGate:false}),info=C.randomCharacterSkillCapsInfo(m,{characterId:1});
 assert.equal(info.eligible,true);assert.equal(info.verified,false);
 assert.equal(JSON.stringify(info.witnesses.map(w=>[w.source,w.primary,w.secondary])),JSON.stringify([['initial',8,4]]));
 const target=initial.map((v,i)=>i===0?16:v),o=request(target),p=C.previewCharacterSkillCaps(m,o);
 assert.equal(p.rows.length,9);assert.equal(p.canApply,false);
 assert.throws(()=>C.setCharacterSkillCaps(m,o,{preview:p}),/隔離驗證/);
 C.KNOWLEDGE.verification.randomCharacterSkillCapsInitial=true;
 const ready=C.previewCharacterSkillCaps(m,o);assert.equal(ready.canApply,true);
 C.setCharacterSkillCaps(m,o,{preview:ready});assert.equal(C.get(m,cell(22)),16);
});

test('initial endpoints retain fixed aptitude and talent constraints, including primary exclusions',()=>{
 const {C}=setup(),check=(caps,q=1,raw=[30,30,30],talents=[1,2,3])=>C.skillCapCombinations(q,raw,talents,[1,1,1],caps).filter(w=>w.source==='initial');
 for(const side of [0,1])assert.ok(check([36+8*side,26+8*side,...Array(7).fill(1+29*side)]).length);
 for(const values of [[35,34,...Array(7).fill(1)],[45,26,...Array(7).fill(30)],[36,35,...Array(7).fill(1)],[44,0,...Array(7).fill(1)]])assert.equal(check(values).length,0);
 assert.equal(check(initial,2,[40,40,40]).length,0);
 assert.equal(check(initial,1,[1,1,1]).length,0);
 assert.equal(check(initial,1,[30,30,30],[1,1,3]).length,0);
 const blocked=Object.entries(C.KNOWLEDGE.randomCharacterSkillCaps.talents).find(([id,t])=>+id>3&&t.excludedPrimary.includes(8));
 assert.ok(blocked);assert.equal(check(initial,1,[30,30,30],[+blocked[0],2,3]).length,0);
 // A recruitment-only character cannot write an initial-only target until that gate is open.
 const f=setup({caps:recruited,initialGate:false});assert.equal(f.C.randomCharacterSkillCapsInfo(f.m,{characterId:1}).verified,true);
 assert.equal(f.C.previewCharacterSkillCaps(f.m,request(initial)).canApply,false);
});

test('advanced caps ignore generation compatibility, keep exact tokens and enforce 1–100',()=>{
 const {C,m,a,rawWith}=setup();a[1][10][2]=1;a[1][1][12]=0;
 const model=C.parse(rawWith()),target=Array(9).fill(100);
 assert.equal(C.randomCharacterSkillCapsInfo(model,{characterId:1}).eligible,false);
 assert.equal(C.randomCharacterSkillCapsAdvancedInfo(model,{characterId:1}).eligible,true);
 for(const bad of [0,101,1.5,'100',NaN,Infinity])assert.equal(C.previewCharacterSkillCapsAdvanced(model,request([bad,...target.slice(1)])).canApply,false);
 for(const bad of [[],Array(9),target.slice(1),[...target,1]])assert.equal(C.previewCharacterSkillCapsAdvanced(model,request(bad)).canApply,false);
 assert.equal(m.changes.size,0);advanced(C,model,target);
 assert.equal(C.serialize(model),rawWith(target.map((v,i)=>[1,22+i,2,v])));
 assert.equal(C.randomCharacterSkillCapsInfo(model,{characterId:1}).eligible,false);
 advanced(C,model,Array(9).fill(1));assert.equal(C.serialize(model),rawWith(target.map((_,i)=>[1,22+i,2,1])));
});

test('advanced identity, state, level and remainder checks survive the relaxed generation policy',()=>{
 const {C,a,reparse}=setup();
 for(const [y,v]of [[0,2],[2,1],[49,0],[49,7],[55,1],[22,101],[22,0],[31,0],[40,-1]]){
  const old=a[1][y][2];a[1][y][2]=v;assert.equal(C.randomCharacterSkillCapsAdvancedInfo(reparse(),{characterId:1}).eligible,false,String(y));a[1][y][2]=old;
 }
 a[1][31][2]=10;a[1][40][2]=0.5;const m=reparse();
 for(const cap of [9,10])assert.equal(C.previewCharacterSkillCapsAdvanced(m,request([cap,...initial.slice(1)])).canApply,false);
 advanced(C,m,[11,...initial.slice(1)]);assert.equal(C.get(m,cell(31)),10);assert.equal(C.get(m,cell(40)),0.5);
});

test('both modes attach each lowering conflict to its skill without changing atomic apply checks',()=>{
 for(const mode of ['', 'Advanced']){
  const {C,a,reparse,rawWith}=setup({caps:recruited});
  Object.assign(a[1][31],{2:27});a[1][40][2]=0.5;a[1][32][2]=19;a[1][41][2]=2.25;a[1][33][2]=8;
  const m=reparse(),raw=C.serialize(m),target=[26,19,8,9,...recruited.slice(4)];
  const preview=C['previewCharacterSkillCaps'+mode],apply=C['setCharacterSkillCaps'+mode],o=request(target),p=preview(m,o);
  assert.equal(p.canApply,false);assert.equal(p.rows.length,9);assert.equal(p.reasons.length,2);
  assert.match(p.rows[0].reasons[0],/目標上限 26 不得低於目前等級 27/);
  assert.match(p.rows[1].reasons[0],/目標上限 19 等於目前等級 19.*餘額 2.25.*設為 20 以上/);
  assert.ok(p.rows.slice(2).every(row=>row.reasons.length===0));
  assert.equal(JSON.stringify(p.reasons),JSON.stringify(p.rows.flatMap(row=>row.reasons)));
  p.reasons.length=0;for(const row of p.rows)row.reasons.length=0;p.canApply=true;
  assert.throws(()=>apply(m,o,{preview:p}),/不得低於目前等級 27/);
  assert.equal(C.serialize(m),raw);assert.equal(m.history.length,0);
  const valid=request([28,20,8,9,...recruited.slice(4)]),ready=preview(m,valid);
  assert.equal(ready.canApply,true,ready.reasons.join());assert.ok(ready.rows.every(row=>row.reasons.length===0));
  apply(m,valid,{preview:ready});assert.equal(C.serialize(m),rawWith([[1,24,2,8],[1,25,2,9]]));
 }
});

test('private previews reject cross-mode, model, input, flag and rule drift',()=>{
 const {C,m,reparse}=setup({caps:recruited}),o=request([29,...recruited.slice(1)]),p=C.previewCharacterSkillCapsAdvanced(m,o),normal=C.previewCharacterSkillCaps(m,o);
 assert.throws(()=>C.setCharacterSkillCaps(m,o,{preview:p}),/預覽/);
 assert.throws(()=>C.setCharacterSkillCapsAdvanced(m,o,{preview:normal}),/預覽/);
 assert.throws(()=>C.setCharacterSkillCapsAdvanced(m,o,{preview:{...p}}),/預覽/);
 assert.throws(()=>C.setCharacterSkillCapsAdvanced(reparse(),o,{preview:p}),/預覽/);
 assert.throws(()=>C.setCharacterSkillCapsAdvanced(m,request(Array(9).fill(100)),{preview:p}),/預覽/);
 C.KNOWLEDGE.verification.randomCharacterSkillCapsAdvanced=false;
 assert.throws(()=>C.setCharacterSkillCapsAdvanced(m,o,{preview:p}),/重新預覽/);
 const closed=C.previewCharacterSkillCapsAdvanced(m,o);assert.equal(closed.canApply,false);
 assert.throws(()=>C.setCharacterSkillCapsAdvanced(m,o,{preview:closed}),/隔離驗證/);
 C.KNOWLEDGE.verification.randomCharacterSkillCapsAdvanced=true;
 const current=C.previewCharacterSkillCapsAdvanced(m,o);C.KNOWLEDGE.randomCharacterSkillCaps.initial.ranges.base[1]=29;
 assert.throws(()=>C.setCharacterSkillCapsAdvanced(m,o,{preview:current}),/重新預覽/);
 assert.equal(m.changes.size,0);
});

test('advanced transactions retain cumulative skill restore, undo and atomic rollback',()=>{
 const {C,m,raw,rawWith}=setup(),target=Array(9).fill(100),exp=(x,id,amount)=>C.addExperience(m,{kind:'skill',characterId:x,id,amount});
 exp(1,1,5);exp(2,1,7);advanced(C,m,target);exp(1,2,9);
 const expected=rawWith([...target.map((v,i)=>[1,22+i,2,v]),[1,40,2,5],[1,41,2,9],[2,40,2,7]]);
 assert.equal(C.serialize(m),expected);
 assert.throws(()=>C.transaction(m,()=>{advanced(C,m,Array(9).fill(99));throw Error('rollback');}),/rollback/);assert.equal(C.serialize(m),expected);
 C.restore(m,cell(22));assert.equal(C.serialize(m),rawWith([[2,40,2,7]]));
 C.undo(m);assert.equal(C.serialize(m),expected);
 C.restoreAll(m);assert.equal(C.serialize(m),raw);C.undo(m);assert.equal(C.serialize(m),expected);
 for(const setter of [C.set,C.setField])assert.throws(()=>setter(m,cell(22),99));
});
