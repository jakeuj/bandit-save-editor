'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const k=require('../knowledge/catalog.json'),D=require('../scripts/set-equipment-quality-data.cjs');
// Synthetic tables rebuilt from catalog rules; no raw game tables are stored in the repo.
function tables(){
 const rules=k.setEquipmentQuality,wp=Array.from({length:738},(_,i)=>{const r=Array(24).fill(0);r[0]=i;return r;}),batch2={items:{}};
 for(const [id,p] of Object.entries(rules.pools)){const s=k.setEquipmentLevel.items[id];Object.assign(wp[id],{3:p.tier,4:'套装',5:'装备',6:p.slot,16:s.setLink,23:p.poolType});batch2.items[id]={affixIds:[...p.affixIds]};}
 const digests=Object.fromEntries(Object.entries(rules.dependencies).map(([q,d])=>[q,d.digest]));
 return {wp,batch2,digests,setLevel:structuredClone(k.setEquipmentLevel)};
}
const build=t=>D.reviewedRules(t.digests,{wp:t.wp},t.batch2,t.setLevel);
test('quality rules reconstruct 216 pools and Q1-Q10 dependency digests; groups open only with their first proofs',()=>{
 const data=build(tables());
 assert.equal(D.hash(data),D.hash(k.setEquipmentQuality));
 assert.equal(Object.keys(data.pools).length,216);assert.deepEqual(Object.keys(data.dependencies),['Q1','Q2','Q3','Q4','Q5','Q6','Q7','Q8','Q9','Q10']);
 assert.deepEqual(D.sourceSids,[...new Set(Object.values(D.dependencies).flatMap(d=>d.sids))]);
 assert.equal(data.quality.mainBase+data.quality.mainStep*5,230);
 require('./helpers/set-quality-shipped.cjs').assertShipped(k);const closed=require('./helpers/set-quality-shipped.cjs').closed(k);D.requireClosed(closed);
 const open=structuredClone(closed);open.verification.setEquipmentQualityUpgrade=true;assert.throws(()=>D.requireClosed(open),/首次證明/);
});
test('missing sources, changed events and changed templates fail closed',()=>{
 for(const mutate of [t=>t.digests.Q4='x',t=>delete t.digests.Q10,t=>{t.setLevel=null;},t=>{t.batch2=null;},t=>{const id=Object.keys(t.batch2.items)[0];t.batch2.items[id].affixIds=[];},
  t=>{const id=Object.keys(t.batch2.items)[0];t.batch2.items[id].affixIds.push(t.batch2.items[id].affixIds[0]);},
  t=>t.wp[Object.keys(t.batch2.items)[0]][23]='通用',t=>{delete t.batch2.items[Object.keys(t.batch2.items)[0]];}]){
  const t=tables();mutate(t);assert.throws(()=>build(t));
 }
 const none=tables();for(const o of Object.values(none.setLevel.origins))if(o.tier===1&&o.slot===1)o.slot=2;assert.throws(()=>build(none),/同階／同?部位/);
 assert.equal(D.extract({fingerprints:{'data.json':'32a36accc1b97e9bb3498eb3be76950e1e72b2e8f7a0cf9ce293b57aa5e0d820'}},()=>{throw Error('historical');},{},k.setEquipmentLevel),null);
});
test('wrong tier or slot origins are rejected and the two pools differ',()=>{
 const rules=k.setEquipmentQuality,L=k.setEquipmentLevel;
 const setId=Object.keys(rules.pools)[0],p=rules.pools[setId];
 const same=Object.keys(L.origins).filter(o=>L.origins[o].tier===p.tier&&L.origins[o].slot===p.slot);
 const other=Object.keys(L.origins).find(o=>L.origins[o].tier!==p.tier||L.origins[o].slot!==p.slot);
 assert.ok(same.length&&other);
 assert.throws(()=>D.classify(rules,L,setId,other,p.affixIds[0]),/同階／同?部位/);
 assert.throws(()=>D.classify(rules,L,'999999',same[0],1),/未知套裝/);
 assert.throws(()=>D.classify(rules,L,setId,'999999',1),/未知原裝備/);
 const seen=new Set();
 for(const [id,pool] of Object.entries(rules.pools))for(const o of Object.keys(L.origins).filter(o=>L.origins[o].tier===pool.tier&&L.origins[o].slot===pool.slot))
  for(const a of new Set([...pool.affixIds,...L.origins[o].affixIds]))seen.add(D.classify(rules,L,id,o,a));
 // Both exclusive sides must exist, otherwise the union policy would be indistinguishable from either pool.
 assert.ok(seen.has('origin')&&seen.has('set')&&seen.has('both'));
 assert.equal(D.classify(rules,L,setId,same[0],-1),'none');
});
test('preservation needs source, level and quality rules to match',()=>{
 assert.equal(D.canPreserve(k,structuredClone(k)),true);
 const other=structuredClone(k);other.setEquipmentQuality.pools[Object.keys(other.setEquipmentQuality.pools)[0]].affixIds.pop();assert.equal(D.canPreserve(k,other),false);
 const moved=structuredClone(k);moved.fingerprints['wp.json']='changed';assert.equal(D.canPreserve(k,moved),false);
});
