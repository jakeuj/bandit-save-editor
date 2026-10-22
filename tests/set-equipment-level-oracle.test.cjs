'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const O=require('../scripts/set-equipment-level-oracle.cjs'),rules=require('../knowledge/catalog.json').setEquipmentLevel;
const record=(template,points=1,level=1)=>{const row=Array(60).fill(0);row[1]=template;row[3]=rules.items[template].tier;row[5]=1;row[6]=level;row[8]=100;row[23]=points;return row;};
test('independent upgrade oracle distinguishes exact balance, insufficient money, cap and souls',()=>{
 assert.equal(O.money(1,1),10);assert.equal(O.money(1,2),25);
 const state={tier:1,quality:1,level:1,copper:10,souls:900};
 assert.deepEqual(O.upgrade(state),{level:2,copper:0,souls:900,costs:[10]});
 assert.deepEqual(O.upgrade({...state,copper:9}),{level:1,copper:9,souls:900,costs:[]});
 assert.deepEqual(O.upgrade({...state,copper:35},true),{level:3,copper:0,souls:900,costs:[10,25]});
 assert.deepEqual(O.upgrade({...state,level:10},true),{level:10,copper:10,souls:900,costs:[]});
 assert.throws(()=>O.upgrade({...state,quality:7}));assert.throws(()=>O.money(10,1));
 for(let t=1;t<=9;t++)for(let q=1;q<=6;q++)for(let l=1;l<=O.cap(q);l++)assert.ok(Number.isSafeInteger(O.money(t,l)));
});
test('set score uses the largest y23 per part; real count and activation are separate',()=>{
 const a=[record(28,1),record(28,3),record(29,2)],s=O.setSummary(a,rules,1);
 assert.equal(s.parts,2);assert.equal(s.score,5);assert.equal(s.count,3);assert.equal(s.divisor,3);
 const b=a.map(r=>{r=r.slice();r[6]=10;return r;});assert.deepEqual(O.setSummary(b,rules,1),s);
 const before=O.characterEffects(a,rules),after=O.characterEffects(b,rules);
 assert.deepEqual(before.sets,after.sets);assert.notDeepEqual(before.singles,after.singles);
 assert.deepEqual(O.characterEffects([record(28)],rules).sets,{});
 assert.equal(Object.keys(O.characterEffects(rules.sets[1].members.map(id=>record(id)),rules).sets).length,2);
});
test('three set effect branches use minimum score four and source rounding order',()=>{
 assert.equal(O.rawSetEffect({coefficient:100,format:'百分比'},1),10);
 assert.equal(O.rawSetEffect({coefficient:20,format:'倍率'},4),.02);
 assert.equal(O.rawSetEffect({coefficient:10,format:'整数'},4),8);
 assert.throws(()=>O.rawSetEffect({coefficient:10,format:'unknown'},4));
 const values=O.itemEffects(record(28),rules);assert.equal(values[4],3);assert.equal(values[43],5);assert.equal(values[1],.31);
});
test('movement preserves y0 identity and destination tail, and level-only comparison catches metadata damage',()=>{
 const source=Array.from({length:60},(_,i)=>i+100),dest=Array(60).fill(9),m=O.movedRecord(source,dest);
 assert.equal(m.source[0],0);assert.equal(m.source[50],150);assert.equal(m.destination[0],100);assert.equal(m.destination[50],9);
 const after=source.slice();after[6]=5;O.assertLevelOnly(source,after,5);after[27]=0;assert.throws(()=>O.assertLevelOnly(source,after,5),/等級外/);
});
