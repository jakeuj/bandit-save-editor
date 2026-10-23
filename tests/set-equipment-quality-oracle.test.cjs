'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const O=require('../scripts/set-equipment-quality-oracle.cjs');
const k=require('../knowledge/catalog.json'),R=k.setEquipmentQuality,L=k.setEquipmentLevel;
const templateId=28,originId=2,set=R.pools[templateId],origin=L.origins[originId];
const P原=origin.affixIds,P套=set.affixIds;
const originOnly=P原.filter(a=>!P套.includes(a)),setOnly=P套.filter(a=>!P原.includes(a)),both=P原.filter(a=>P套.includes(a));
// Synthetic record built from the oracle's own range formulas (not from any core preview).
function record(q,{level=3,ids,flags={},mainOffset=15,subOffset=0}={}){
 const r=Array(60).fill(0);Object.assign(r,{0:5,1:templateId,2:1,3:set.tier,5:q,6:level,7:0,8:O.mainRange(q)[0]+mainOffset,23:3,24:1,26:1.7,27:originId});
 const pick=ids||P原.slice(0,q-1);
 for(let s=1;s<q;s++){r[O.col.id(s)]=pick[s-1];r[O.col.coef(s)]=O.subRange(q)[0]+10+subOffset;r[O.col.flag(s)]=flags[s]||0;}
 return r;
}
const run=(r,to,tail)=>O.transition(r,to,{tail},R,L);
const tailFor=(r,to)=>{const from=r[5],kept=r.slice(9,9+from-1);return P原.filter(a=>!kept.includes(a)).slice(0,to-from).map(id=>({id,coefficient:O.subRange(to)[0]+5}));};

test('quality rules match the reviewed Q1/Q2 formulas and the catalog summary',()=>{
 for(let q=1;q<=6;q++){
  assert.deepEqual(O.mainRange(q),[80+30*(q-1),80+30*q]);assert.deepEqual(O.subRange(q),[10*(q-1),60+10*q]);
  assert.equal(O.slots(q),q-1);assert.equal(O.cap(q),10+5*(q-1));
 }
 const c=R.quality;assert.equal(c.mainBase,80);assert.equal(c.mainStep,30);assert.equal(c.subStep,10);assert.equal(c.subSpan,60);assert.equal(c.levelCapBase,10);assert.equal(c.levelCapStep,5);
 assert.deepEqual(c.shift,{main:30,sub:10});
 for(const bad of [0,7,1.5,'3',NaN])assert.throws(()=>O.cap(bad));
});
test('upgrade shifts main by 30 and retained sub rolls by 10 per grade; new tail has flag 0',()=>{
 const r=record(2,{ids:[originOnly[0]]}),tail=tailFor(r,4);
 const e=run(r,4,tail);assert.equal(e.ok,true);
 assert.equal(e.record[5],4);assert.equal(e.record[8],r[8]+60);assert.equal(e.record[15],r[15]+20);
 assert.deepEqual([e.record[10],e.record[11]],tail.map(t=>t.id));assert.deepEqual([e.record[16],e.record[17]],tail.map(t=>t.coefficient));
 assert.deepEqual([e.record[29],e.record[30]],[0,0]);assert.equal(e.record[9],originOnly[0]);
 O.assertPreserved(r,e.record);
 assert.deepEqual(e.changed,[5,8,10,11,15,16,17]);
});
test('downgrade clears removed tail id/coefficient/flag and shifts the kept rolls down',()=>{
 const r=record(5,{flags:{2:1}}),e=run(r,3,[]);assert.equal(e.ok,true);
 assert.equal(e.record[8],r[8]-60);assert.equal(e.record[15],r[15]-20);assert.equal(e.record[16],r[16]-20);
 for(const s of [3,4])assert.deepEqual([e.record[O.col.id(s)],e.record[O.col.coef(s)],e.record[O.col.flag(s)]],[0,0,0]);
 assert.equal(e.record[29],1);O.assertPreserved(r,e.record);
});
test('hundredths arithmetic is exact with two-decimal rolls',()=>{
 assert.equal(O.shifted(40.07,10),50.07);assert.equal(O.shifted(0.1,0)+0.2,0.1+0.2);
 assert.equal(O.shifted(0.3,10),10.3);assert.equal(O.shifted(99.99,-30),69.99);assert.throws(()=>O.cents(1.005));
 const r=record(2,{ids:[originOnly[0]],subOffset:0});r[15]=10.07;
 assert.equal(run(r,3,tailFor(r,3)).record[15],20.07);
});
test('range endpoints: both ends of main and sub shift to the matching ends of the target range; one step outside is refused as a source',()=>{
 for(const {from,to} of O.conversions()){
  for(const end of [0,1]){
   const r=record(from,{level:1});r[8]=O.mainRange(from)[end];for(let s=1;s<from;s++)r[O.col.coef(s)]=O.subRange(from)[end];
   const e=run(r,to,to>from?tailFor(r,to):[]);assert.equal(e.ok,true,from+'->'+to+':'+e.reason);
   assert.equal(e.record[8],O.mainRange(to)[end]);for(let s=1;s<Math.min(from,to);s++)assert.equal(e.record[O.col.coef(s)],O.subRange(to)[end]);
  }
 }
 const high=record(3);high[8]=O.mainRange(3)[1]+1;assert.match(run(high,4,tailFor(high,4)).reason,/主係數/);
 const low=record(3);low[15]=O.subRange(3)[0]-1;assert.match(run(low,4,tailFor(low,4)).reason,/副係數/);
 const lowMain=record(3);lowMain[8]=O.mainRange(3)[0]-1;assert.match(run(lowMain,2,[]).reason,/主係數/);
});
test('all 30 conversions: direction counts, slot counts, and no change outside the allowed columns',()=>{
 const cs=O.conversions();assert.equal(cs.length,30);assert.equal(cs.filter(c=>c.direction==='up').length,15);
 for(const {from,to} of cs){
  const r=record(from,{level:1}),e=run(r,to,to>from?tailFor(r,to):[]);
  assert.equal(e.ok,true,`${from}->${to}:${e.reason}`);
  assert.equal(e.record.slice(9,14).filter(Boolean).length,to-1);
  assert.equal(e.record.slice(15,20).filter(Boolean).length,to-1);
  O.assertPreserved(r,e.record);
  const allowed=new Set([5,8,...Array.from({length:5},(_,i)=>[9+i,15+i,28+i]).flat()]);
  for(const y of e.changed)assert.ok(allowed.has(y),`y${y} 不在允許欄位`);
  assert.equal(e.record.length,60);
 }
});
test('rejections: no-op, cap, selected-slot removal, tail count, duplicates, out-of-pool, bad coefficient, multiple flags, stray tail data',()=>{
 const r3=record(3);
 assert.equal(run(r3,3,[]).reason,'無變更');assert.match(run(r3,7,[]).reason,/目標品質/);assert.match(run(r3,0,[]).reason,/目標品質/);assert.match(run(r3,2.5,[]).reason,/目標品質/);
 assert.match(run(record(6,{level:20}),2,[]).reason,/等級/);assert.equal(run(record(6,{level:15}),2,[]).ok,true);assert.equal(run(record(6,{level:16}),2,[]).ok,false);
 assert.match(run(record(4,{flags:{3:1}}),2,[]).reason,/已選槽/);assert.match(run(record(4,{flags:{3:1}}),3,[]).reason,/已選槽/);assert.equal(run(record(4,{flags:{1:1}}),3,[]).ok,true);assert.equal(run(record(4,{flags:{3:1}}),5,tailFor(record(4,{flags:{3:1}}),5)).ok,true);
 assert.match(run(r3,5,tailFor(r3,5).slice(1)).reason,/數量/);assert.match(run(r3,2,tailFor(r3,5)).reason,/降品不接受/);
 const dup=tailFor(r3,4);dup[0].id=r3[9];assert.match(run(r3,4,dup).reason,/重複/);
 const dupTail=tailFor(r3,5);dupTail[1].id=dupTail[0].id;assert.match(run(r3,5,dupTail).reason,/重複/);
 const out=tailFor(r3,4);out[0].id=setOnly[0];assert.match(run(r3,4,out).reason,/不在原池/);
 const coef=tailFor(r3,4);coef[0].coefficient=O.subRange(4)[1]+1;assert.match(run(r3,4,coef).reason,/係數/);
 const lo=tailFor(r3,4);lo[0].coefficient=O.subRange(4)[0]-1;assert.match(run(r3,4,lo).reason,/係數/);
 const fine=tailFor(r3,4);fine[0].coefficient=O.subRange(4)[0]+0.005;assert.throws(()=>run(r3,4,fine));
 assert.match(run(record(3,{flags:{1:1,2:1}}),4,tailFor(r3,4)).reason,/多旗標/);
 const stray=record(3);stray[12]=P原[5];assert.match(run(stray,4,tailFor(stray,4)).reason,/尾槽有資料/);
 const strayFlag=record(3);strayFlag[30]=1;assert.match(run(strayFlag,4,tailFor(strayFlag,4)).reason,/尾槽有資料/);
 const flag2=record(3);flag2[28]=2;assert.match(run(flag2,4,tailFor(flag2,4)).reason,/旗標/);
 const missing=record(3);missing[9]=0;assert.match(run(missing,4,tailFor(missing,4)).reason,/缺詞條/);
 assert.match(O.sourceProblem(r3.slice(0,59),R,L),/長度/);
 const badOrigin=record(3);badOrigin[27]=999999;assert.match(run(badOrigin,4,[]).reason,/原裝備/);
 const badSet=record(3);badSet[1]=999999;assert.match(run(badSet,4,[]).reason,/套裝範本/);
 const wrongTier=record(3);wrongTier[3]=set.tier+1;assert.match(run(wrongTier,4,[]).reason,/同階/);
});
test('dual-pool rules: unselected slot needs P原; the sole selected slot may hold P套; the source is never altered',()=>{
 assert.ok(originOnly.length&&setOnly.length&&both.length);
 const inSet=record(3,{ids:[setOnly[0],originOnly[0]]});
 assert.equal(O.sourceProblem(inSet,R,L),'未選槽 ID 不在原池');
 const selectedSet=record(3,{ids:[setOnly[0],originOnly[0]],flags:{1:1}});
 assert.equal(O.sourceProblem(selectedSet,R,L),null);
 const e=run(selectedSet,4,tailFor(selectedSet,4));assert.equal(e.ok,true);assert.equal(e.record[9],setOnly[0]);assert.equal(e.record[28],1);
 assert.equal(run(selectedSet,2,[]).ok,true);// the selected slot 1 is kept, only slot 2 goes
 const before=JSON.stringify(selectedSet);run(selectedSet,5,tailFor(selectedSet,5));assert.equal(JSON.stringify(selectedSet),before);
 const wrongSlot=record(3,{ids:[originOnly[0],setOnly[0]],flags:{1:1}});assert.equal(O.sourceProblem(wrongSlot,R,L),'未選槽 ID 不在原池');
 const poolOut=record(3,{ids:[999999,originOnly[0]],flags:{1:1}});assert.equal(O.sourceProblem(poolOut,R,L),'已選槽 ID 池外');
 // a tail may reuse an id the set pool shares, but never a P套-only id
 const t=tailFor(selectedSet,4);t[0].id=setOnly[1];assert.match(run(selectedSet,4,t).reason,/不在原池/);
 t[0].id=both[0];if(!selectedSet.slice(9,12).includes(both[0]))assert.equal(run(selectedSet,4,t).ok,true);
});
test('pre-existing duplicates are kept on shift but a new duplicate is refused',()=>{
 const r=record(3,{ids:[originOnly[0],originOnly[0]]});assert.equal(O.sourceProblem(r,R,L),null);
 const e=run(r,2,[]);assert.equal(e.ok,true);assert.equal(e.record[9],originOnly[0]);
 const up=run(r,4,tailFor(r,4));assert.equal(up.ok,true);assert.deepEqual(up.record.slice(9,12),[originOnly[0],originOnly[0],up.record[11]]);
 const d=tailFor(r,4);d[0].id=originOnly[0];assert.match(run(r,4,d).reason,/重複/);
});
test('a failed transition returns no record and a successful one never mutates its source',()=>{
 const r=record(4),snap=JSON.stringify(r);
 const bad=run(r,6,[]);assert.equal(bad.ok,false);assert.equal(bad.record,undefined);
 const ok=run(r,5,tailFor(r,5));assert.equal(ok.ok,true);assert.equal(JSON.stringify(r),snap);assert.notEqual(ok.record,r);
});
test('round trip through the oracle restores a never-refined piece when the same tail is cleared',()=>{
 const r=record(2,{ids:[originOnly[0]]}),up=run(r,5,tailFor(r,5)),down=run(up.record,2,[]);
 assert.equal(down.ok,true);assert.deepEqual(down.record,r);
});

test('reachability census covers every set template with a same-tier same-slot origin and is derived from catalog pools only',()=>{
 const rows=O.reachabilityCensus(R,L);
 assert.equal(new Set(rows.map(x=>x.templateId)).size,216);
 for(const x of rows){
  assert.equal(R.pools[x.templateId].tier,L.origins[x.originId].tier);assert.equal(R.pools[x.templateId].slot,L.origins[x.originId].slot);
  assert.equal(x.originOnly+x.shared,x.originCount);assert.equal(x.setOnly+x.shared,x.setCount);
  // Rows that lack a pool kind are reported, not invented: the census never forces three pools per set.
  assert.equal(typeof x.q6Capable,'boolean');
 }
 const none=rows.filter(x=>!x.setOnly).length,noOrigin=rows.filter(x=>!x.originOnly).length;
 assert.ok(none>0&&noOrigin>0,'本版資料確有缺少專有池的組合；不得假設每套都有三池');
 assert.ok(rows.every(x=>x.q6Capable),'每個 P原 至少 5 個不同 ID，Q6 尾槽在唯一性規則下可達');
 const tail=O.tailCandidates([origin.affixIds[0]],origin.affixIds);assert.equal(tail.length,origin.affixIds.length-1);assert.ok(!tail.includes(origin.affixIds[0]));
});
test('native witnesses are a todo list: every entry is pending and cites a source; no native up/down function is invented',()=>{
 assert.equal(O.nativeFunctionKnown,null);
 assert.ok(O.witnessTodo.length>=7);
 const ids=O.witnessTodo.map(w=>w.id);assert.equal(new Set(ids).size,ids.length);
 for(const w of O.witnessTodo){assert.equal(w.status,'pending-native');assert.ok(w.need.length>10&&w.sources.length);for(const s of w.sources)assert.ok(R.dependencies[s],`未知來源 ${s}`);}
 assert.equal(R.limits.reachability,'native-witness-required');
 assert.ok(['W2','W3'].every(id=>ids.includes(id)));
});
test('oracle is independent: it does not load SaveCore, core.js or any preview, and has no native or fixture generator',()=>{
 const src=fs.readFileSync(require.resolve('../scripts/set-equipment-quality-oracle.cjs'),'utf8').split(String.fromCharCode(10)).filter(l=>!l.startsWith('//')).join(String.fromCharCode(10));
 assert.doesNotMatch(src,/require\([^)]*(core|ui|build-editor|save-fixture|child_process)/);
 assert.doesNotMatch(src,/SaveCore|previewEquipmentQuality|setEquipmentQualityCandidateInfo|verification\.json/);
 assert.doesNotMatch(src,/\bnative(Compared|Result|Observation)\b/);
 // The oracle opens nothing: a group is open only with its merged first proof (checked against the composite proof).
 assert.doesNotMatch(src,/verification\[/);require('./helpers/set-quality-shipped.cjs').assertShipped(k);
});
