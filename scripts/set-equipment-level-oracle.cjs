'use strict';
// Independent expected values. Never imports SaveCore, its preview, or a native observation as the answer.
const assert=require('node:assert/strict');
const cap=q=>{assert.ok(Number.isSafeInteger(q)&&q>=1&&q<=6,'非法品質');return 10+5*(q-1);};
const money=(tier,level)=>{
 assert.ok(Number.isSafeInteger(tier)&&tier>=1&&tier<=9&&Number.isSafeInteger(level)&&level>=1&&level<=35,'非法升級參數');
 const d=(tier-1)*30+level;
 return Math.round(.05*(Math.ceil((150*d**1.7*1.009**d)/100)*100));
};
function upgrade({tier,quality,level,copper,souls},maximum=false){
 assert.ok(Number.isSafeInteger(level)&&level>=1&&level<=cap(quality),'非法原等級');
 assert.ok(Number.isSafeInteger(copper)&&copper>=0&&Number.isSafeInteger(souls)&&souls>=0,'非法資源');
 assert.equal(typeof maximum,'boolean');
 const costs=[];let current=level,balance=copper;
 while(current<cap(quality)){
  const cost=money(tier,current);if(balance<cost)break;
  balance=Math.round(balance-cost);costs.push(cost);current++;if(!maximum)break;
 }
 return {level:current,copper:balance,souls,costs};
}
function itemEffects(record,rules){
 const t=rules.items[record[1]];assert.ok(t,'缺套裝範本');
 const tier=record[3],q=record[5];cap(q);
 function value(id,coefficient,setting,level){
  const rule=rules.attributes[id];assert.ok(rule,'缺單件公式 '+id);let result;
  switch(rule.kind){
   case 'attack':{const n=(tier-1)*30+1,base=Math.ceil(5*n+65*1.036**n-55);result=Math.floor(base*(1+.04*level)*(coefficient/100)*(setting/100)+level*q);break;}
   case 'aptitude':result=Math.floor((100*.003*tier**1.6*(1+.04*level)*100)*(coefficient/100)*(setting/100))/100;break;
   case 'work':{const base=Math.round(8+2*((tier-1)*10+1)**1.2);result=Math.floor(.4*base*(1+.04*level)*(coefficient/100)*(setting/100)+level);break;}
   case 'percent':result=Math.floor((rule.base+rule.tier*tier+rule.level*level)*(coefficient/100)*100)/100;break;
   default:throw Error('未知單件效果分支');
  }
  assert.ok(Number.isFinite(result),'單件效果不是有限值');return result;
 }
 const totals={};const add=(id,n)=>{totals[id]=(totals[id]||0)+n;};
 t.mainAttributes.forEach((id,s)=>{if(id)add(id,value(id,record[8],t.mainSettings[s],record[6]));});
 for(let s=1;s<=6;s++)if(record[8+s])add(record[8+s],value(record[8+s],record[14+s],100,0));
 return totals;
}
function setSummary(records,rules,setId){
 assert.ok(rules.sets[setId],'未知套裝');const maxima=Array(6).fill(0);let count=0;
 for(const row of records){const t=rules.items[row[1]];if(!t||t.setLink!==setId)continue;count++;assert.ok(Number.isFinite(row[23])&&row[23]>=0,'積分不符');maxima[t.part-1]=Math.max(maxima[t.part-1],row[23]);}
 return {parts:maxima.filter(n=>n>0).length,score:maxima.reduce((a,b)=>a+b,0),count,divisor:Math.min(6,Math.max(1,count)),maxima};
}
function rawSetEffect({coefficient,format},score){
 assert.ok(Number.isFinite(score)&&score>=0&&Number.isFinite(coefficient)&&coefficient>=0,'非法套裝效果');
 const n=Math.max(score,4);
 if(format==='百分比')return coefficient/10/4*n;
 if(format==='倍率')return Math.round(1000*(coefficient/1000/4)*n)/1000;
 if(format==='整数')return coefficient/5*n;
 throw Error('未知套裝效果單位');
}
function characterEffects(records,rules){
 const singles={},sets={},summaries={},add=(o,id,v)=>{o[id]=(o[id]||0)+v;};
 for(const row of records){for(const [id,v]of Object.entries(itemEffects(row,rules)))add(singles,id,v);}
 for(const row of records){const id=rules.items[row[1]].setLink,summary=summaries[id]??=setSummary(records,rules,id);
  for(const effect of rules.sets[id].effects)if(summary.parts>=effect.pieces)add(sets,effect.attributeId,rawSetEffect(effect,summary.score)/summary.divisor);
 }
 return {singles,sets,summaries};
}
// These are expected movement values only, never a replacement for native movement evidence.
function movedRecord(source,destination=Array(60).fill(0)){
 assert.equal(source.length,60);assert.equal(destination.length,60);
 return {source:source.map((v,y)=>y<50?0:v),destination:destination.map((v,y)=>y<50?source[y]:v)};
}
function assertLevelOnly(before,after,target){
 assert.equal(before.length,60);assert.equal(after.length,60);
 assert.deepEqual(after,before.map((v,y)=>y===6?target:v),'等級外欄位被改寫');
}
module.exports={cap,money,upgrade,itemEffects,setSummary,rawSetEffect,characterEffects,movedRecord,assertLevelOnly};
