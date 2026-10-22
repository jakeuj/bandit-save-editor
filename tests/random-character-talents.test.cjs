'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup:baseSetup}=require('./helpers/batch-fixture.cjs');
// Character 1: Q2 with an aptitude talent (力量强化), a single-attribute and a two-attribute talent.
// Character 2: Q1 shaped like the v2.8 fixture so its skill cap witness can be compared.
function setup(nx=450,count=2){
 const f=baseSetup(nx,count);
 for(const [y,v]of [[10,50],[11,40],[12,40],[49,2]])f.a[1][y][2]=v;
 [[1,1],[4,2],[52,3]].forEach(([id,l],i)=>{f.a[1][1+i][12]=id;f.a[1][21+i][12]=l;});
 for(const [y,v]of [[10,30],[11,30],[12,30],[49,1]])f.a[2][y][2]=v;
 for(let i=0;i<9;i++)f.a[2][22+i][2]=i===0?28:i===1?20:10;
 for(let i=0;i<3;i++){f.a[2][1+i][12]=i+1;f.a[2][21+i][12]=1;}
 const pills=[1,2,3].map(a=>Number(Object.keys(f.k.batch2Data.pills).find(id=>f.k.batch2Data.pills[id].aptitude===a&&f.k.batch2Data.pills[id].cap>=40)));
 pills.forEach(id=>f.a[id][6][0]=10);
 for(const g of ['randomCharacterTalents','randomCharacterBaseAptitudes','pillAptitudeBonus','randomCharacterSkillCaps'])f.C.KNOWLEDGE.verification[g]=true;
 return {...f,pills,m:f.reparse(),raw:f.rawWith()};
}
const c=(x,y,z=12)=>({x,y,z});
// Core objects come from a vm realm; compare plain JSON shapes.
const eq=(a,b,msg)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),b,msg);
const apply=(C,m,o)=>C.setCharacterTalents(m,o,{preview:C.previewCharacterTalents(m,o)});
// Independent of the core switch: native 天赋属性 branches written from the reviewed expressions.
function oracle(k,attribute,coefficient,level){
 if([12,51,34].includes(attribute))return coefficient+2*level;
 if([13,52,11].includes(attribute))return coefficient*level;
 if(attribute===10)return Math.round(100*level*coefficient)/10000;
 if(k.catalogs.attributes&&k.randomCharacterTalents.attributes[attribute].unit==='倍率')return Math.floor(coefficient*Math.pow(1.79,level-1))/100;
 if(attribute>=104&&attribute<=107)return level*(coefficient/10);
 return Math.floor(coefficient*Math.pow(1.8,level-1));
}
test('all 535 talent attribute values match the reviewed native branches and research examples',()=>{
 const {C,k}=setup();let n=0;
 for(const t of Object.values(k.batch2Data.talents))t.attributes.forEach((a,i)=>{if(!a)return;for(let L=1;L<=5;L++){assert.equal(C.talentEffect(a,t.coefficients[i],L),oracle(k,a,t.coefficients[i],L),JSON.stringify([a,L]));n++;}});
 assert.equal(n,535);
 const values=(id,slot)=>[1,2,3,4,5].map(L=>C.talentEffect(k.batch2Data.talents[id].attributes[slot],k.batch2Data.talents[id].coefficients[slot],L));
 eq(values(4,0),[5,7,9,11,13]);eq(values(6,0),[0.2,0.4,0.6,0.8,1]);eq(values(1,0),[0.5,1,1.5,2,2.5]);
 eq(values(52,1),[0.03,0.05,0.09,0.17,0.3]);eq(values(52,0),[10,18,32,58,104]);
 for(const bad of [[999,1,1],[12,1,0],[12,1,1.5],[12,'1',1]])assert.equal(C.talentEffect(...bad),null);
});
test('eligibility mirrors the v2.7/v2.8 scope and keeps ids, empty slots and out-of-pool levels read only',()=>{
 const f=setup(),{C}=f;
 const info=C.randomCharacterTalentsInfo(f.m,{characterId:1});
 assert.equal(info.eligible,true);eq(info.levelPool,[1,2,3]);eq(info.slots.map(s=>[s.id,s.level,s.aptitude]),[[1,1,true],[4,2,false],[52,3,false]]);
 const cases=[[[2,2],1,/範本 0/],[[55,2],1,/非在監/],[[50,2],1,/結丹/],[[3,16],1,/結丹/],[[49,2],7,/品質/],[[1,12],0,/空槽/],[[2,12],1,/重複/],[[3,12],76,/已知 ID/],[[21,12],4,/等級池/]];
 for(const [[y,z],v,reason]of cases){f.a[1][y][z]=v;const m=f.reparse();f.a[1][y][z]=z===2&&y===49?2:z===2?0:z===16?0:{1:1,2:4,3:52,21:1}[y];
  const i=C.randomCharacterTalentsInfo(m,{characterId:1});assert.equal(i.eligible,false,String(reason));assert.match(i.reasons.join(),reason);}
 // 0/0 is rejected even though v2.7 aptitude info accepts it.
 f.a[1][3][12]=0;f.a[1][23][12]=0;const empty=f.reparse();f.a[1][3][12]=52;f.a[1][23][12]=3;
 assert.equal(C.randomCharacterTalentsInfo(empty,{characterId:1}).eligible,false);
 assert.equal(C.randomCharacterTalentsInfo(f.m,{characterId:3}).eligible,false);
 for(const y of [1,21]){const field=C.resolveField(f.m,c(1,y));assert.equal(field.editable,false);assert.match(field.label,/天賦/);assert.throws(()=>C.set(f.m,c(1,y),2),/唯讀/);}
});
test('preview validates pooled levels only, Q6 has nothing to change and the closed gate cannot apply',()=>{
 const f=setup(),{C,m}=f;
 for(const [o,reason]of [[{characterId:1,levels:[1,2]},/三槽/],[{characterId:1,levels:[1,2,'3']},/三槽/],[{characterId:1,levels:[1,2,3],ids:[1,4,52]},/ID/],[{characterId:1,levels:[4,2,3]},/等級須為/],[{characterId:1,levels:[0,2,3]},/等級須為/]]){
  const p=C.previewCharacterTalents(m,o);assert.equal(p.canApply,false);assert.match(p.reasons.join(),reason);
 }
 const same=C.previewCharacterTalents(m,{characterId:1,levels:[1,2,3]});assert.equal(same.unchanged,true);assert.equal(same.canApply,false);
 C.setCharacterTalents(m,{characterId:1,levels:[1,2,3]},{preview:same});assert.equal(m.changes.size,0);assert.equal(m.history.length,0);
 f.a[1][49][2]=6;for(let i=0;i<3;i++)f.a[1][21+i][12]=5;const q6=f.reparse();
 eq(C.randomCharacterTalentsInfo(q6,{characterId:1}).levelPool,[5]);assert.equal(C.previewCharacterTalents(q6,{characterId:1,levels:[5,5,5]}).unchanged,true);
 assert.match(C.previewCharacterTalents(q6,{characterId:1,levels:[4,5,5]}).reasons.join(),/等級須為/);
 C.KNOWLEDGE.verification.randomCharacterTalents=false;
 const closed=C.previewCharacterTalents(m,{characterId:1,levels:[2,2,3]});assert.equal(closed.reasons.length,0);assert.equal(closed.canApply,false);
 assert.throws(()=>C.setCharacterTalents(m,{characterId:1,levels:[2,2,3]},{preview:closed}),/隔離驗證/);assert.equal(m.changes.size,0);
});
test('set writes only changed level tokens and preserves every other byte',()=>{
 const {C,m,raw,rawWith}=setup();
 const r=apply(C,m,{characterId:1,levels:[2,1,3]});
 eq(r.changes.map(x=>[x.slot,x.before,x.after]),[[1,1,2],[2,2,1]]);
 eq(r.changes[1].effects.map(e=>e.value),[5]);
 assert.equal(C.serialize(m),rawWith([[1,21,12,2],[1,22,12,1]]));
 assert.ok(raw.startsWith('﻿')&&C.serialize(m).includes('987654321098765432109876543210')&&C.serialize(m).includes('1e+03'));
 assert.equal(m.history.length,1);eq([...m.changes.values()].map(v=>v.group),['aptitude:1','aptitude:1']);
 const reloaded=C.parse(C.serialize(m));eq(C.randomCharacterTalentsInfo(reloaded,{characterId:1}).slots.map(s=>s.level),[2,1,3]);
});
test('stale, foreign or mismatched previews are rejected before any write',()=>{
 const f=setup(),{C,m}=f,o={characterId:1,levels:[2,2,3]};
 assert.throws(()=>C.setCharacterTalents(m,o,{}),/預覽不相符/);
 const p=C.previewCharacterTalents(m,o);
 assert.throws(()=>C.setCharacterTalents(m,{characterId:1,levels:[3,2,3]},{preview:p}),/預覽不相符/);
 assert.throws(()=>C.setCharacterTalents(f.reparse(),o,{preview:p}),/預覽不相符/);
 C.addExperience(m,{kind:'character',characterId:2,amount:1});
 assert.throws(()=>C.setCharacterTalents(m,o,{preview:p}),/重新預覽/);
 const q=C.previewCharacterTalents(m,o);C.KNOWLEDGE.randomCharacterTalents={...C.KNOWLEDGE.randomCharacterTalents,version:2};
 assert.throws(()=>C.setCharacterTalents(m,o,{preview:q}),/重新預覽/);
 assert.equal([...m.changes.values()].filter(v=>v.z===12).length,0);
});
test('aptitude talents move the pill cap; a bonus above the new cap blocks instead of clipping',()=>{
 const {C,m,pills}=setup();
 assert.ok(C.recruitmentCombination(2,[50,40,40]));
 const before=C.randomCharacterGrowthInfo(m,{characterId:1}).aptitudes[0];
 const up=C.previewCharacterTalents(m,{characterId:1,levels:[3,2,3]});
 eq(up.aptitudes.map(a=>[a.aptitude,a.before.base,a.after.base,a.after.cap]),[[1,before.base,before.base+1,Math.round(100*(before.base+1)*1.5)/100]]);
 C.setCharacterTalents(m,{characterId:1,levels:[3,2,3]},{preview:up});
 assert.equal(C.randomCharacterGrowthInfo(m,{characterId:1}).aptitudes[0].base,up.aptitudes[0].after.base);
 const max=C.pillInfo(m,1,1,pills[0]).max;C.setPillAptitudeBonus(m,{characterId:1,aptitude:1,pillId:pills[0],bonus:max});
 const down=C.previewCharacterTalents(m,{characterId:1,levels:[1,2,3]});assert.equal(down.canApply,false);assert.match(down.reasons.join(),/力量丹藥增量/);
 // Non-aptitude slots do not consult the pill cap.
 const other=C.previewCharacterTalents(m,{characterId:1,levels:[3,1,3]});assert.equal(other.canApply,true);eq(other.aptitudes,[]);
});
test('changing levels keeps the v2.8 skill cap witness and invalidates an open cap preview',()=>{
 const {C,m}=setup();
 const before=C.randomCharacterSkillCapsInfo(m,{characterId:2});assert.equal(before.eligible,true);
 const caps=[28,20,10,10,10,10,10,10,11],capPreview=C.previewCharacterSkillCaps(m,{characterId:2,caps});
 apply(C,m,{characterId:2,levels:[2,1,2]});
 const after=C.randomCharacterSkillCapsInfo(m,{characterId:2});assert.equal(after.eligible,true);eq(after.witnesses,JSON.parse(JSON.stringify(before.witnesses)));
 assert.throws(()=>C.setCharacterSkillCaps(m,{characterId:2,caps},{preview:capPreview}),/重新預覽/);
});
test('talent levels, base aptitudes and pill bonuses share one 12-column restore group in either order',()=>{
 for(const talentFirst of [true,false]){
  const {C,m,raw,pills}=setup();
  const talent=()=>apply(C,m,{characterId:1,levels:[2,1,3]}),base=()=>C.setCharacterBaseAptitudes(m,{characterId:1,baseRaw:[52,40,38]});
  if(talentFirst){talent();base();}else{base();talent();}
  C.setPillAptitudeBonus(m,{characterId:1,aptitude:2,pillId:pills[1],bonus:1});
  assert.equal(m.changes.size,5);assert.ok([...m.changes.values()].every(v=>v.group==='aptitude:1'));
  C.restore(m,c(1,14,2));assert.equal(m.changes.size,0);assert.equal(C.serialize(m),raw);
  C.undo(m);assert.equal(m.changes.size,5);
  C.undo(m);C.undo(m);assert.equal(m.changes.size,2);
 }
});
test('undo, restoreAll and other characters or skill groups stay independent',()=>{
 const {C,m,raw}=setup();
 apply(C,m,{characterId:2,levels:[2,1,2]});
 C.setCharacterSkillCaps(m,{characterId:2,caps:[28,20,10,10,10,10,10,10,11]},{preview:C.previewCharacterSkillCaps(m,{characterId:2,caps:[28,20,10,10,10,10,10,10,11]})});
 apply(C,m,{characterId:1,levels:[2,2,3]});
 eq([...new Set([...m.changes.values()].map(v=>v.group))].sort(),['aptitude:1','aptitude:2','skill-growth:2']);
 C.restore(m,c(2,21));eq([...new Set([...m.changes.values()].map(v=>v.group))].sort(),['aptitude:1','skill-growth:2']);
 C.undo(m);assert.equal([...m.changes.values()].filter(v=>v.group==='aptitude:2').length,2);
 C.undo(m);assert.equal([...m.changes.values()].filter(v=>v.group==='aptitude:1').length,0);
 C.restoreAll(m);assert.equal(m.changes.size,0);assert.equal(C.serialize(m),raw);
});
test('batch staging keeps talent changes and makes an earlier talent preview stale',async()=>{
 const {C,m}=setup();
 apply(C,m,{characterId:1,levels:[2,2,3]});
 const p=C.previewCharacterTalents(m,{characterId:1,levels:[3,2,3]});
 const request={kind:'skillExperience',characterId:1,amount:1};
 await C.applyBatch(m,request,{preview:await C.previewBatch(m,request)});
 assert.equal(m.changes.get('1,21,12').value,2);assert.equal(m.changes.get('1,21,12').group,'aptitude:1');
 assert.throws(()=>C.setCharacterTalents(m,{characterId:1,levels:[3,2,3]},{preview:p}),/重新預覽/);
});
