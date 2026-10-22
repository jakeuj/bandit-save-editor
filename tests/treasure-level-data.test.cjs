'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const k=require('../knowledge/catalog.json'),D=require('../scripts/treasure-level-data.cjs');
function tables(){
 const rules=k.treasureLevel,wp=Array.from({length:738},(_,i)=>{const r=Array(24).fill(0);r[0]=i;return r;});
 for(const [id,t] of Object.entries(rules.items)){const r=wp[id];Object.assign(r,{0:+id,1:t.name,3:t.tier,4:'宝物',5:'装备',6:6});r.splice(8,6,...t.mainAttributes,...t.mainSettings);}
 return {wp};
}
test('treasure rules reconstruct 170 templates; both write groups stay closed',()=>{
 const data=D.reviewedRules(D.reviewedDigest,tables());
 assert.equal(D.hash(data),D.hash(k.treasureLevel));assert.equal(Object.keys(data.items).length,170);
 assert.equal(data.limits.experience,false);assert.deepEqual(Object.values(data.decompose.byTier),[20,200,1000,10000,50000,500000]);
 for(const g of D.groups)assert.equal(k.verification[g],undefined,'尚未註冊遷移，旗標不存在');D.requireClosed(k);
 const open=structuredClone(k);open.verification.treasureLevel=true;assert.throws(()=>D.requireClosed(open),/首次證明/);
});
test('unknown events, changed templates and tier counts fail closed',()=>{
 assert.throws(()=>D.reviewedRules('unknown',tables()),/來源事件/);
 const id=Object.keys(k.treasureLevel.items)[0];
 for(const mutate of [t=>t.wp[id][3]=7,t=>t.wp[id][8]='x',t=>t.wp[id][4]='普通',t=>t.wp[wp0(t)][3]=2]){
  const t=tables();mutate(t);assert.throws(()=>D.reviewedRules(D.reviewedDigest,t));
 }
 function wp0(t){return Object.keys(k.treasureLevel.items).find(i=>k.treasureLevel.items[i].tier===1);}
 assert.equal(D.extract({fingerprints:{'data.json':'32a36accc1b97e9bb3498eb3be76950e1e72b2e8f7a0cf9ce293b57aa5e0d820'}},()=>{throw Error('historical');}),null);
});
test('preservation needs source and rule data to match',()=>{
 assert.equal(D.canPreserve(k,structuredClone(k)),true);
 const other=structuredClone(k);other.treasureLevel.items[Object.keys(other.treasureLevel.items)[0]].tier=2;assert.equal(D.canPreserve(k,other),false);
 other.treasureLevel=k.treasureLevel;other.fingerprints['wp.json']='changed';assert.equal(D.canPreserve(k,other),false);
});
