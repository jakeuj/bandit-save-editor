'use strict';
// Independent expected values for set-equipment quality transactions and generation reachability.
// Never imports SaveCore, its preview, or a native observation as the answer. Rules come from reviewed
// source expressions (Q1 ranges, Q2 cap) and from catalog pools passed in as plain data.
const assert=require('node:assert/strict');
const isQ=q=>Number.isSafeInteger(q)&&q>=1&&q<=6;
// Q1 (expressions 5289-5300): main 80+30(Q-1)..80+30Q, sub 10(Q-1)..60+10Q, slots Q-1. Q2 (5326, 3010-3012): cap 10+5(Q-1).
const slots=q=>{assert.ok(isQ(q),'非法品質');return q-1;};
const cap=q=>{assert.ok(isQ(q),'非法品質');return 10+5*(q-1);};
const mainRange=q=>{assert.ok(isQ(q),'非法品質');return [80+30*(q-1),80+30*q];};
const subRange=q=>{assert.ok(isQ(q),'非法品質');return [10*(q-1),60+10*q];};
// Record columns: y5 quality, y6 level, y8 main coefficient, y(8+s) affix id, y(14+s) coefficient, y(27+s) refine flag (s=1..5).
const col={quality:5,level:6,main:8,origin:27,id:s=>8+s,coef:s=>14+s,flag:s=>27+s};
// Hundredths-integer arithmetic: policy is exact, never float addition.
const cents=v=>{const c=Math.round(v*100);assert.ok(Math.abs(c-v*100)<1e-6,'係數超過百分之一精度');return c;};
const shifted=(v,delta)=>(cents(v)+delta*100)/100;
const within=(v,[lo,hi])=>Number.isFinite(v)&&v>=lo&&v<=hi;
const poolsOf=(rules,setLevel,record)=>{
 const set=rules.pools[record[1]],origin=setLevel.origins[record[col.origin]];
 if(!set)return {error:'未知套裝範本'};if(!origin)return {error:'未知原裝備範本'};
 if(origin.tier!==set.tier||origin.slot!==set.slot||record[3]!==set.tier)return {error:'原裝備與套裝同階／部位不符'};
 return {origin:origin.affixIds,set:set.affixIds};
};
// Why a record is not a state the transaction may start from. Returns null when the source is valid.
function sourceProblem(record,rules,setLevel){
 if(!Array.isArray(record)||record.length!==60)return '欄位長度不符';
 const q=record[col.quality];if(!isQ(q))return '品質不在 Q1–Q6';
 const lvl=record[col.level];if(!Number.isSafeInteger(lvl)||lvl<1||lvl>cap(q))return '等級超出現品質上限';
 const pools=poolsOf(rules,setLevel,record);if(pools.error)return pools.error;
 if(!within(record[col.main],mainRange(q)))return '主係數不在品質區間';
 const n=slots(q);let selected=0;
 for(let s=1;s<=5;s++){
  const id=record[col.id(s)],c=record[col.coef(s)],f=record[col.flag(s)];
  if(s>n){if(id||c||f)return '品質外尾槽有資料';continue;}
  if(!Number.isSafeInteger(id)||id<=0)return '槽位缺詞條 ID';
  if(!within(c,subRange(q)))return '副係數不在品質區間';
  if(f!==0&&f!==1)return '旗標非 0／1';
  if(f===1)selected++;
 }
 if(selected>1)return '多旗標';
 for(let s=1;s<=n;s++){
  const id=record[col.id(s)],sel=record[col.flag(s)]===1;
  if(!(pools.origin.includes(id)||(sel&&pools.set.includes(id))))return sel?'已選槽 ID 池外':'未選槽 ID 不在原池';
 }
 return null;
}
// tail: explicit [{id,coefficient}] for each new slot, in slot order. Upgrade only; must be empty on downgrade.
function transition(record,target,{tail=[]}={},rules,setLevel){
 const fail=reason=>({ok:false,reason});
 const bad=sourceProblem(record,rules,setLevel);if(bad)return fail(bad);
 const from=record[col.quality];
 if(!isQ(target))return fail('目標品質非法');
 if(target===from)return fail('無變更');
 if(record[col.level]>cap(target))return fail('等級超過目標上限，請先降低等級');
 const delta=target-from,keep=Math.min(slots(from),slots(target)),next=record.slice();
 const pools=poolsOf(rules,setLevel,record);
 if(delta<0){
  if(tail.length)return fail('降品不接受新槽');
  for(let s=keep+1;s<=slots(from);s++){
   if(record[col.flag(s)]===1)return fail('不得移除已選槽');
   next[col.id(s)]=0;next[col.coef(s)]=0;next[col.flag(s)]=0;
  }
 }else{
  const need=slots(target)-slots(from);
  if(tail.length!==need)return fail('新增尾槽數量不符');
  const seen=new Set();
  for(let s=1;s<=keep;s++)seen.add(record[col.id(s)]);
  for(const [i,t] of tail.entries()){
   const s=keep+1+i;
   if(!pools.origin.includes(t.id))return fail('新增槽 ID 不在原池');
   if(seen.has(t.id))return fail('新增重複詞條');
   if(!within(t.coefficient,subRange(target)))return fail('新增槽係數不在目標區間');
   cents(t.coefficient);seen.add(t.id);
   next[col.id(s)]=t.id;next[col.coef(s)]=t.coefficient;next[col.flag(s)]=0;
  }
 }
 next[col.quality]=target;
 next[col.main]=shifted(record[col.main],30*delta);
 for(let s=1;s<=keep;s++)next[col.coef(s)]=shifted(record[col.coef(s)],10*delta);
 // Shifting never leaves the target range when the source was in its range; check anyway rather than trust it.
 if(!within(next[col.main],mainRange(target)))return fail('平移後主係數超出區間');
 for(let s=1;s<=keep;s++)if(!within(next[col.coef(s)],subRange(target)))return fail('平移後副係數超出區間');
 const changed=next.map((v,y)=>v===record[y]?null:y).filter(y=>y!==null);
 return {ok:true,record:next,changed};
}
// Preserved columns the transaction must never touch (y6 stays; y23/y26 are not synced to the new quality).
const preserved=[0,1,2,3,6,7,23,24,25,26,27];
const assertPreserved=(before,after)=>{for(const y of preserved)assert.equal(after[y],before[y],`保留欄 y${y} 被改寫`);};
// The 30 ordered transitions between Q1-Q6; 15 up, 15 down.
const conversions=()=>{const out=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)if(a!==b)out.push({from:a,to:b,direction:b>a?'up':'down'});return out;};
// Generation reachability. A reachable tail state for a set piece = an ordinary equipment of the target Q acquired
// from the origin template (pool P原), then synthesized: id in P原, coefficient inside the target range, flag 0, no duplicates.
const tailCandidates=(retainedIds,originPool)=>originPool.filter(id=>!retainedIds.includes(id));
function reachabilityCensus(rules,setLevel){
 const rows=[];
 for(const [key,set] of Object.entries(rules.pools)){
  for(const [oid,o] of Object.entries(setLevel.origins)){
   if(o.tier!==set.tier||o.slot!==set.slot)continue;
   const shared=o.affixIds.filter(a=>set.affixIds.includes(a)).length;
   rows.push({templateId:+key,originId:+oid,tier:set.tier,slot:set.slot,originCount:o.affixIds.length,setCount:set.affixIds.length,
    originOnly:o.affixIds.length-shared,setOnly:set.affixIds.length-shared,shared,
    // A Q6 piece holds 5 distinct ids, so P原 needs at least 5 to make a full tail reachable by the unique-id rule.
    q6Capable:o.affixIds.length>=5});
  }
 }
 return rows;
}
// Native witnesses required before reachability may be claimed. Pending items are a todo list, never results.
const nativeFunctionKnown=null; // no deterministic native quality up/down function is known; none may be invented.
const witnessTodo=[
 {id:'W1',topic:'起點與目標 Q 的生成履歷',need:'原生「特定装备」明確指定 Q/T/主係數，取得合法材料後原位合成，保存起始與目標 Q 的槽數、ID、係數、旗標、y23／y26／y27',sources:['Q1','Q3'],status:'pending-native'},
 {id:'W2',topic:'新增尾槽採 P原 的可達性',need:'目標 Q 普通裝備取得後再合成的實例，確認尾槽 ID 來自 y27 原池、旗標 0；不得強制同 seed',sources:['Q1','Q3','Q10'],status:'pending-native'},
 {id:'W3',topic:'套裝池專有 ID 的洗練見證',need:'原生同槽洗練取得 P套 專有 ID，保存洗前後全槽、旗標、效果、成本與 metadata，驗其他槽保持',sources:['Q4','Q10'],status:'pending-native'},
 {id:'W4',topic:'保留槽平移後原生讀回',need:'平移後載入、刷新、原版存檔、停止、新 PID 讀回，係數與槽數保持',sources:['Q1','Q8'],status:'pending-native'},
 {id:'W5',topic:'降品移除未選尾槽',need:'移除尾槽後原生載入刷新無殘留效果；已選槽被拒絕的案例不入原生',sources:['Q1','Q10'],status:'pending-native'},
 {id:'W6',topic:'品質與等級交錯',need:'洗練後套裝池專有 ID 經品質→等級→品質仍可處理，兩輪 IO 與不同 PID',sources:['Q2','Q4'],status:'pending-native'},
 {id:'W7',topic:'穿戴與搬移後的歸屬',need:'z9 穿戴者 owner 與部位指標一致；搬移只複製 y0–49，不假定 y50–59 也被複製',sources:['Q8','Q9'],status:'pending-native'}
];
module.exports={isQ,slots,cap,mainRange,subRange,col,cents,shifted,sourceProblem,transition,preserved,assertPreserved,conversions,tailCandidates,reachabilityCensus,nativeFunctionKnown,witnessTodo};
