'use strict';
// Independent expected values. Never imports SaveCore, its preview, or a native observation as the answer.
const assert=require('node:assert/strict');
const ransom={1:20,2:200,3:1000,4:10000,5:50000,6:500000};
const cap=q=>{assert.ok(Number.isSafeInteger(q)&&q>=1&&q<=6,'非法品質');return 10+5*(q-1);};
// Source expression: round(10*1.05^((T-1)*30+4*L)-1), with the -1 inside round and outside the exponent.
const souls=(tier,level)=>{
 assert.ok(Number.isSafeInteger(tier)&&tier>=1&&tier<=6&&Number.isSafeInteger(level)&&level>=1&&level<=35,'非法升級參數');
 return Math.round(10*1.05**((tier-1)*30+4*level)-1);
};
function upgrade({tier,quality,level,souls:balance},maximum=false){
 assert.ok(Number.isSafeInteger(level)&&level>=1&&level<=cap(quality),'非法原等級');
 assert.ok(Number.isSafeInteger(balance)&&balance>=0,'非法資源');assert.equal(typeof maximum,'boolean');
 const costs=[];let current=level,left=balance;
 while(current<cap(quality)){
  const cost=souls(tier,current);if(left<cost)break;
  left-=cost;costs.push(cost);current++;if(!maximum)break;
 }
 return {level:current,souls:left,costs};
}
// Disassembly pays by tier only: level, quality and coefficient are passed in the source but unused in the sell branch.
function decompose(record,{souls:balance=0}={}){
 assert.equal(record.length,60);const tier=record[3];assert.ok(ransom[tier],'非法等階');
 return {souls:balance+ransom[tier],gain:ransom[tier]};
}
function batchDecompose(rows,{quality,souls:balance=0}){
 const hit=rows.filter(r=>r[5]<=quality&&r[22]===0);
 return {removed:hit.length,gain:hit.reduce((n,r)=>n+ransom[r[3]],0),souls:balance+hit.reduce((n,r)=>n+ransom[r[3]],0)};
}
// Only the percent branch with reviewed coefficients is derivable from static data; others stay native-observation-only.
function itemEffects(record,rules,affix){
 const t=rules.items[record[1]];assert.ok(t,'缺寶物範本');
 const tier=record[3],level=record[6],coefficient=record[8],values={},uncovered=[];
 t.mainAttributes.forEach(id=>{
  if(!id)return;const rule=affix.attributes[id];
  if(!rule){uncovered.push(id);return;}
  values[id]=(values[id]||0)+Math.floor((rule.base+rule.tier*tier+rule.level*level)*(coefficient/100)*100)/100;
 });
 for(const v of Object.values(values))assert.ok(Number.isFinite(v),'單件效果不是有限值');
 return {values,uncovered};
}
function movedRecord(source,destination=Array(60).fill(0)){
 assert.equal(source.length,60);assert.equal(destination.length,60);
 return {source:source.map((v,y)=>y<50?0:v),destination:destination.map((v,y)=>y<50?source[y]:v)};
}
function assertLevelOnly(before,after,target){
 assert.equal(before.length,60);assert.equal(after.length,60);
 assert.deepEqual(after,before.map((v,y)=>y===6?target:v),'等級外欄位被改寫');
}
module.exports={ransom,cap,souls,upgrade,decompose,batchDecompose,itemEffects,movedRecord,assertLevelOnly};
