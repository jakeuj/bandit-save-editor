'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const O=require('../scripts/set-equipment-quality-effects-oracle.cjs'),k=require('../knowledge/catalog.json');
const L=k.setEquipmentLevel,Q=k.setEquipmentQuality;
// Synthetic records only. #28 (T1 weapon, mains [4 attack,43,1], setting 15) and #30 (mains [4,12,1]; 12 is also a legal sub-affix).
function record({template=28,quality=3,level=5,main=150,subs=[],points=1,selected=0}={}){
 const r=Array(60).fill(0);Object.assign(r,{0:1,1:template,3:L.items[template].tier,5:quality,6:level,8:main,23:points,27:1});
 subs.forEach(([id,coef],i)=>{r[9+i]=id;r[15+i]=coef;});if(selected)r[27+selected]=1;return r;
}
const hand=(level,q,coefficient,setting)=>{const n=1,base=Math.ceil(5*n+65*1.036**n-55);return Math.floor(base*(1+.04*level)*(coefficient/100)*(setting/100)+level*q);};

test('oracle reads no SaveCore, core source or native observation',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../scripts/set-equipment-quality-effects-oracle.cjs'),'utf8'),dep=fs.readFileSync(path.join(__dirname,'../scripts/set-equipment-level-oracle.cjs'),'utf8');
 for(const text of [src,dep])assert.deepEqual([...text.matchAll(/require\(([^)]*)\)/g)].map(m=>m[1]).filter(v=>!/node:assert|set-equipment-level-oracle/.test(v)),[]);
 assert.ok(!/SaveCore|src\/core|core\.js/.test(src));
});
test('Q1/Q2 closed forms agree with the A2 data for every quality',()=>{
 const q=Q.quality;
 for(let v=1;v<=6;v++){
  assert.equal(O.cap(v),q.levelCapBase+q.levelCapStep*(v-1));assert.equal(O.slots(v),Math.min(Math.max(v,1),6)-1);
  assert.deepEqual(O.mainRange(v),[q.mainBase+q.mainStep*(v-1),q.mainBase+q.mainStep*v]);assert.deepEqual(O.subRange(v),[q.subStep*(v-1),q.subSpan+q.subStep*v]);
 }
 for(const bad of [0,7,1.5,'3',NaN])assert.throws(()=>O.cap(bad));
 assert.equal(O.hundredths(25.5),2550);assert.throws(()=>O.hundredths(25.555));assert.throws(()=>O.hundredths(NaN));
});
test('upgrade shifts main by 30·ΔQ and kept slots by 10·ΔQ in hundredths, appends explicit tail slots with flag 0',()=>{
 const before=record({quality:2,level:6,main:120,subs:[[12,15.05]]}),
  after=O.transition(before,4,{added:[{slot:2,attributeId:13,coefficient:30.5},{slot:3,attributeId:17,coefficient:60}]});
 assert.equal(after[5],4);assert.equal(after[8],180);assert.equal(after[15],35.05);
 assert.deepEqual([after[10],after[11],after[16],after[17],after[29],after[30]],[13,17,30.5,60,0,0]);assert.equal(after[6],6);
 O.assertQualityOnly(before,after,4);
 assert.deepEqual(O.transition(before,2),before,'同品質無變更');
 // exact boundaries of both ranges
 O.transition(record({quality:1,level:1,main:80,subs:[]}),2,{added:[{slot:1,attributeId:13,coefficient:10}]});
 O.transition(record({quality:6,level:35,main:230,subs:[[12,110],[13,110],[17,110],[18,110],[19,110]]}),6);
 assert.throws(()=>O.transition(record({quality:6,level:35,main:231,subs:[[12,110],[13,110],[17,110],[18,110],[19,110]]}),5,{confirmRemoved:true}));
});
test('downgrade needs confirmation, clears removed tail slots and refuses removing a selected slot or exceeding the target cap',()=>{
 const before=record({quality:4,level:10,main:200,subs:[[12,35],[13,40],[17,45.5]],selected:1});
 assert.throws(()=>O.transition(before,2),/確認/);
 const after=O.transition(before,2,{confirmRemoved:true});
 assert.equal(after[8],140);assert.equal(after[15],15);assert.equal(O.slots(2),1);
 assert.deepEqual([after[10],after[11],after[16],after[17],after[29],after[30],after[31]],[0,0,0,0,0,0,0]);assert.equal(after[28],1);O.assertQualityOnly(before,after,2);
 assert.throws(()=>O.transition(record({quality:4,level:10,main:200,subs:[[12,35],[13,40],[17,45.5]],selected:3}),2,{confirmRemoved:true}),/已選槽/);
 assert.throws(()=>O.transition(record({quality:4,level:16,main:200,subs:[[12,35],[13,40],[17,45.5]]}),2,{confirmRemoved:true}),/上限/);
 assert.throws(()=>O.transition(record({quality:3,level:5,main:150,subs:[[12,35],[13,40]],selected:1}).map((v,y)=>y===29?1:v),2,{confirmRemoved:true}),/旗標/);
});
test('upgrade rejects wrong tail count, new duplicates, out-of-range or over-precise rolls and stray data outside the quality slots',()=>{
 const base=record({quality:2,level:5,main:120,subs:[[12,15]]});
 const add=(slot,attributeId,coefficient)=>({slot,attributeId,coefficient});
 assert.throws(()=>O.transition(base,3),/新增尾槽數/);
 assert.throws(()=>O.transition(base,3,{added:[add(2,13,30),add(3,17,30)]}),/新增尾槽數/);
 assert.throws(()=>O.transition(base,3,{added:[add(3,13,30)]}),/連續尾槽/);
 assert.throws(()=>O.transition(base,3,{added:[add(2,12,30)]}),/重複/);
 assert.throws(()=>O.transition(base,3,{added:[add(2,13,19.99)]}),/範圍/);assert.throws(()=>O.transition(base,3,{added:[add(2,13,90.01)]}),/範圍/);
 assert.throws(()=>O.transition(base,3,{added:[add(2,13,30.005)]}),/兩位小數/);
 O.transition(base,3,{added:[add(2,13,20)]});O.transition(base,3,{added:[add(2,13,90)]});
 assert.throws(()=>O.transition(record({quality:2,subs:[[12,15],[13,20]],main:120}),2),/品質外/);
 assert.throws(()=>O.transition(record({quality:1,level:11,main:100}),1),/上限/);
 assert.throws(()=>O.transition(base.map((v,y)=>y===5?7:v),3));
 assert.throws(()=>O.assertQualityOnly(base,base.map((v,y)=>y===27?0:v),2));
});
test('attack effect: L×Q term is exact and moves one level per quality at fixed coefficient',()=>{
 const rules=L;
 assert.equal(hand(1,1,100,15),3);assert.equal(hand(1,3,150,15),7);
 for(const [level,q,coef] of [[1,1,100],[5,3,150],[10,2,120],[35,6,230]]){
  const r=record({quality:q,level,main:coef});assert.equal(O.effects(r,rules)[4],hand(level,q,coef,15),`L${level} Q${q}`);
 }
 for(const level of [1,7,20,35]){
  const q1=record({quality:1,level,main:100}),q4=record({quality:4,level,main:100}),d=O.effects(q4,rules)[4]-O.effects(q1,rules)[4];
  assert.equal(d,O.attackQualityTerm(level,4)-O.attackQualityTerm(level,1));assert.equal(d,3*level);
 }
});
test('sub-affix roll rounds to hundredths with no level term; main + sub overlap accumulates',()=>{
 const rules=L,rule=rules.attributes[12],tier=1;
 const sub=record({template:30,quality:2,level:20,main:110,subs:[[13,15.05]]}),e=O.effects(sub,rules)[13];
 const r13=rules.attributes[13],want=Math.floor((r13.base+r13.tier*tier)*(15.05/100)*100)/100;assert.equal(e,want);
 assert.ok(Math.abs(e*100-Math.round(e*100))<1e-6);
 const lvl1=O.effects(record({template:30,quality:2,level:1,main:110,subs:[[13,15.05]]}),rules)[13];assert.equal(lvl1,e,'副詞條不受等級影響');
 // #30 mains [4,12,1]: attribute 12 appears as main (leveled) and as a sub (not leveled); totals add.
 const r=record({template:30,quality:2,level:10,main:110,subs:[[12,15]]}),got=O.effects(r,rules)[12];
 const mainPart=Math.floor((rule.base+rule.tier*tier+rule.level*10)*(110/100)*(L.items[30].mainSettings[1]/100)*100)/100;
 const subPart=Math.floor((rule.base+rule.tier*tier)*(15/100)*100)/100;
 assert.ok(Math.abs(got-(mainPart+subPart))<1e-9);
});
test('old effect is removed when a slot disappears and kept slots move by their shifted roll',()=>{
 const rules=L,before=record({template:30,quality:4,level:10,main:200,subs:[[13,45],[17,60.5],[18,70]]});
 const after=O.transition(before,2,{confirmRemoved:true}),change=O.effectChange(before,after,rules);
 assert.equal(change[17].removed,true);assert.equal(change[17].after,0);assert.equal(change[18].removed,true);assert.ok(change[17].delta<0);
 assert.ok(!(17 in O.effects(after,rules))&&!(18 in O.effects(after,rules)));
 assert.equal(change[13].removed,false);assert.ok(change[13].after>0&&change[13].after<change[13].before);
 // dropping all tail slots equals evaluating the record with those slots blanked
 assert.equal(O.effects(O.withoutSlot(O.withoutSlot(before,3),2),rules)[13],O.effects(before,rules)[13],'未動的槽效果不變');
 assert.ok(!(17 in O.effects(O.withoutSlot(before,2),rules))&&(18 in O.effects(O.withoutSlot(before,2),rules)));
 // main attributes carry no stale data: every effect before equals its recomputation only when all slots match
 const up=O.transition(after,4,{added:[{slot:2,attributeId:17,coefficient:60.5},{slot:3,attributeId:18,coefficient:70}]}),back=O.effectChange(after,up,rules);
 assert.ok(back[17].delta>0&&back[18].delta>0);
});
test('set S, N, active parts and extra set effects are independent of quality and slot content',()=>{
 const rules=L,set1=rules.sets[1].members,pts=[2,3,0,1];
 const records=set1.map((id,i)=>record({template:id,quality:3,level:5,main:150,subs:[[12,25],[13,30]],points:pts[i]}));
 const worn=records.slice(0,3).map((r,i)=>{r=r.slice();r[23]=pts[i];return r;});
 const changed=worn.map((r,i)=>i===0?O.transition(r,6,{added:[{slot:3,attributeId:17,coefficient:70},{slot:4,attributeId:18,coefficient:80},{slot:5,attributeId:19,coefficient:90}]}):i===1?O.transition(r,1,{confirmRemoved:true}):r);
 O.assertSetInvariant(worn,changed,rules,1);
 const s=O.setSummary(changed,rules,1);assert.equal(s.count,3);assert.equal(s.parts,2);assert.equal(s.score,5);assert.equal(s.divisor,3);
 assert.notDeepEqual(O.characterEffects(changed,rules).singles,O.characterEffects(worn,rules).singles);
 assert.deepEqual(O.characterEffects(changed,rules).sets,O.characterEffects(worn,rules).sets);
 const bad23=changed.map((r,i)=>i===0?r.map((v,y)=>y===23?9:v):r),bad1=changed.map((r,i)=>i===0?r.map((v,y)=>y===1?set1[3]:v):r);
 assert.throws(()=>O.assertSetInvariant(worn,bad23,rules,1));assert.throws(()=>O.assertSetInvariant(worn,bad1,rules,1));
 // mixed score pieces: the largest y23 per part wins, so a second lower-score copy changes N but not S
 const dup=worn.concat([worn[0].map((v,y)=>y===23?1:v)]);assert.equal(O.setSummary(dup,rules,1).score,s.score);assert.equal(O.setSummary(dup,rules,1).count,4);
 assert.deepEqual(O.setSummary(worn.slice(0,1),rules,1).parts,1);
});
const expectedRow=()=>record({quality:3,level:5,main:150,subs:[[12,25],[13,30]]});
function cycleReport(expected,{worn=false,slot=6}={}){
 const bag=expected.map((v,y)=>y===7?0:v),w=expected.map((v,y)=>y===7?1:v),markers=Array.from({length:10},(_,i)=>100+i);
 const src=expected.map((v,y)=>y<50?0:markers[y-50]);
 return {markers,report:{initial:expected,steps:[
  {phase:'equip',id:6,plane:9,record:w,refs:[0,0,0,0,0,6],source:src},
  {phase:'unequip',id:9,plane:7,record:bag,refs:[0,0,0,0,0,0],source:src}]}};
}
test('movement copies and clears y0-49 only; tail ten stays at the source and never reaches the destination',()=>{
 const src=Array.from({length:60},(_,y)=>y+1),dst=Array(60).fill(9),m=O.movedRecord(src,dst);
 assert.equal(O.moveColumns,50);assert.deepEqual(O.tailColumns,[50,51,52,53,54,55,56,57,58,59]);
 assert.deepEqual(m.destination.slice(0,50),src.slice(0,50));assert.deepEqual(m.destination.slice(50),Array(10).fill(9));
 assert.deepEqual(m.source.slice(0,50),Array(50).fill(0));assert.deepEqual(m.source.slice(50),src.slice(50));
 const exp=expectedRow(),{report,markers}=cycleReport(exp);
 assert.equal(O.validateCycle(report,exp,{slot:6}),true);assert.equal(O.validateTail(report,markers),true);
 const takeout={phase:'takeout',id:8,plane:7,record:exp.map((v,y)=>y===7?0:v),refs:[0,0,0,0,0,0],source:report.steps[0].source};
 assert.equal(O.validateCycle({...report,steps:[takeout,...report.steps]},exp,{slot:6,worn:true}),true);
 const stale=exp.map((v,y)=>y===7?1:v);assert.equal(O.validateCycle({initial:stale,steps:[{...takeout,record:stale},...report.steps.map(s=>({...s,record:s.record.map((v,y)=>y===7?(s.phase==='equip'?1:0):v)}))]},stale,{slot:6}),true);
 const bad=(mut)=>{const c=structuredClone(report);mut(c);return c;};
 assert.throws(()=>O.validateCycle(bad(c=>{c.steps[0].record[5]=4;}),exp,{slot:6}),/搬移欄位 5/);
 assert.throws(()=>O.validateCycle(bad(c=>{c.steps[0].record[49]=1;}),exp,{slot:6}),/搬移欄位 49/);
 assert.throws(()=>O.validateCycle(bad(c=>{c.steps[1].record[7]=1;}),exp,{slot:6}),/owner/);
 assert.throws(()=>O.validateCycle(bad(c=>{c.steps[0].source[0]=1;}),exp,{slot:6}),/未清除/);
 assert.throws(()=>O.validateCycle(bad(c=>{c.steps[0].refs[5]=0;}),exp,{slot:6}));
 assert.throws(()=>O.validateCycle(bad(c=>{c.steps[1].refs[5]=6;}),exp,{slot:6}));
 assert.throws(()=>O.validateCycle(bad(c=>{c.steps.pop();}),exp,{slot:6}));
 assert.throws(()=>O.validateTail(bad(c=>{c.steps[0].record[53]=103;}),markers),/尾十欄/);
 assert.throws(()=>O.validateTail(bad(c=>{c.steps[1].source[50]=7;}),markers),/尾十欄/);
});
test('two IO rounds need an equal reload from a new PID, a matching first round and distinct restarts',()=>{
 const exp=expectedRow(),round=(label,pids)=>({label,observed:[exp],reloaded:[exp],pids});
 const rounds=[{...round('edit',[11,12]),observed:exp,reloaded:exp},{...round('cycle',[12,13])}];
 const locations=[{id:9,plane:7},{id:6,plane:9}];
 assert.equal(O.validateIO(rounds,exp,locations),true);
 assert.deepEqual(O.ioRounds.map(r=>r.round),[1,2]);assert.ok(O.ioRounds.every(r=>r.steps.includes('stop')&&r.steps.includes('restart')&&r.steps.includes('observe-equal')));
 const copy=f=>{const c=structuredClone(rounds);f(c);return c;};
 assert.throws(()=>O.validateIO(rounds.slice(0,1),exp,locations),/兩輪/);
 assert.throws(()=>O.validateIO(copy(c=>{c[0].pids=[11,11];}),exp,locations),/PID/);
 assert.throws(()=>O.validateIO(copy(c=>{c[1].reloaded=[exp.map((v,y)=>y===5?4:v)];}),exp,locations),/讀回/);
 assert.throws(()=>O.validateIO(copy(c=>{c[0].observed=exp.map((v,y)=>y===5?4:v);c[0].reloaded=c[0].observed;}),exp,locations),/第一輪/);
 assert.throws(()=>O.validateIO(copy(c=>{c[1].pids=[12,12];}),exp,locations));
 assert.throws(()=>O.validateIO(copy(c=>{c[1].pids=[12,12+0];c[0].pids=[11,12];}),exp,locations));
 assert.throws(()=>O.validateIO(rounds,exp,[locations[0]]),/位置/);
 assert.throws(()=>O.validateIO(copy(c=>{c[0].label='cycle';}),exp,locations));
});
test('lifecycle starts list six state×direction classes plus the extra coverage axes',()=>{
 const {base,extras}=O.lifecycleStarts();
 assert.deepEqual(base.map(b=>b.id),['backpack-up','backpack-down','stored-up','stored-down','equipped-up','equipped-down']);
 assert.deepEqual(new Set(extras.map(e=>e.axis)),new Set(['tier','transition','pool','selected','path']));
 for(const needed of ['q1-q6','q5-q6','tier-1','tier-9','synthesis-in-place-z9','synthesis-from-bag-z7','selected-slot'])assert.ok(extras.some(e=>e.id===needed),needed);
 assert.equal(new Set([...base,...extras].map(v=>v.id)).size,base.length+extras.length);
});
