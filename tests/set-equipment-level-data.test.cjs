'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const k=require('../knowledge/catalog.json'),D=require('../scripts/set-equipment-level-data.cjs');
function tables(){
 const rules=k.setEquipmentLevel,wp=Array.from({length:738},()=>Array(24).fill(0)),tz=Array.from({length:55},()=>Array(19).fill(0)),sx=Array.from({length:114},(_,id)=>{const r=Array(27).fill(0);r[0]=id;return r;});
 for(const [id,t]of Object.entries(rules.items)){const r=wp[id];Object.assign(r,{0:+id,1:t.name,3:t.tier,4:'套装',5:'装备',6:t.slot,16:t.setLink,17:t.part});r.splice(8,6,...t.mainAttributes,...t.mainSettings);}
 for(const [id,t]of Object.entries(rules.origins))Object.assign(wp[id],{0:+id,3:t.tier,4:'普通',5:'装备',6:t.slot});
 for(const [id,t]of Object.entries(rules.sets)){const r=tz[id];Object.assign(r,{0:+id,1:t.name,2:t.pieces});r.splice(9,t.members.length,...t.members);for(const f of t.effects){r[1+f.pieces]=f.attributeId;r[2+f.pieces]=f.coefficient;sx[f.attributeId][4]=f.format;}}
 for(const [id,t]of Object.entries(rules.attributes))sx[id][4]=t.format;
 return {wp,tz,sx};
}
test('set rules reconstruct all 54 sets and 216 templates; separate write groups require proofs',()=>{
 const data=D.reviewedRules(D.reviewedDigest,tables(),k.batch2Data,k.affixReplacement);
 assert.equal(D.hash(data),D.hash(k.setEquipmentLevel));
 for(const group of D.groups){assert.equal(typeof k.verification[group],'boolean');if(k.verification[group])assert.equal(require('../scripts/set-equipment-level-proof.cjs').problem(k,require('../knowledge/verification.json'),require('node:fs').readFileSync('src/core.js','utf8'),group),null);}
 assert.equal(Object.keys(data.sets).length,54);assert.equal(Object.keys(data.items).length,216);
 assert.equal(data.attributes[28].level,.2);
});
test('unknown events, missing members, changed units and invalid source pools fail closed',()=>{
 assert.equal(D.extract({fingerprints:{'data.json':'32a36accc1b97e9bb3498eb3be76950e1e72b2e8f7a0cf9ce293b57aa5e0d820'}},()=>{throw Error('historical set rules must stay unsupported');}),null);
 assert.throws(()=>D.reviewedRules('unknown',tables(),k.batch2Data,k.affixReplacement),/來源事件/);
 for(const mutate of [t=>t.wp[28][16]=2,t=>t.tz[1][9]=9999,t=>t.sx[19][4]='unknown',t=>t.tz[1][7]=1]){
  const t=tables();mutate(t);assert.throws(()=>D.reviewedRules(D.reviewedDigest,t,k.batch2Data,k.affixReplacement));
 }
 const b=structuredClone(k.batch2Data);delete b.items[1];assert.throws(()=>D.reviewedRules(D.reviewedDigest,tables(),b,k.affixReplacement),/詞條/);
});
test('set rules preservation requires all source and rule data, not only tz fingerprint',()=>{
 assert.equal(D.canPreserve(k,structuredClone(k)),true);
 const other=structuredClone(k);other.setEquipmentLevel.items[28].slot=2;assert.equal(D.canPreserve(k,other),false);
 other.setEquipmentLevel=k.setEquipmentLevel;other.fingerprints['data.json']='changed';assert.equal(D.canPreserve(k,other),false);
});
