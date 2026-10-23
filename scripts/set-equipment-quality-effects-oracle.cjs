'use strict';
// Independent expected effects and lifecycle assertions for set-equipment quality (A8).
// Never imports the core module, its preview or a native observation as the answer. Per-piece effect formulas come from the
// independent set-equipment-level oracle; quality shift, cap, slot counts and set-summary invariance are derived here from Q1/Q2/Q6/Q7.
const assert=require('node:assert/strict');
const E=require('./set-equipment-level-oracle.cjs');
// Q1: main coefficient 80+30(Q-1)..80+30Q; sub coefficient 10(Q-1)..60+10Q; slots clamp(Q,1,6)-1. Q2: level cap 10+5(Q-1).
const checkQuality=q=>{assert.ok(Number.isSafeInteger(q)&&q>=1&&q<=6,'非法品質');return q;};
const cap=q=>E.cap(checkQuality(q));
const slots=q=>Math.min(Math.max(checkQuality(q),1),6)-1;
const mainRange=q=>[80+30*(checkQuality(q)-1),80+30*q];
const subRange=q=>[10*(checkQuality(q)-1),60+10*q];
// Hundredths integers keep coefficient arithmetic exact; a coefficient with more than two decimals is not a legal roll.
const hundredths=v=>{assert.ok(Number.isFinite(v),'係數非有限值');const h=Math.round(v*100);assert.ok(Math.abs(h-v*100)<1e-6,'係數超過兩位小數');return h;};
// slot s (1-6): id at y8+s, coefficient at y14+s, selected flag at y27+s.
const idAt=(r,s)=>r[8+s],coefAt=(r,s)=>r[14+s],flagAt=(r,s)=>r[27+s];
// Expected record after a quality transition. `added` lists explicit tail slots {slot,attributeId,coefficient}; shrinking needs `confirmRemoved`.
function transition(record,target,{added=[],confirmRemoved=false}={}){
 assert.equal(record.length,60);const from=checkQuality(record[5]);checkQuality(target);
 const before=slots(from),after=slots(target),delta=target-from;
 assert.ok(record[6]>=1&&record[6]<=cap(from),'原等級超過原品質上限');
 assert.ok(record[6]<=cap(target),'目標品質上限低於目前等級');
 for(let s=1;s<=6;s++){
  const present=s<=before;
  assert.equal(present?idAt(record,s)>0:idAt(record,s)===0&&coefAt(record,s)===0&&flagAt(record,s)===0,true,'品質外槽資料不符 '+s);
 }
 const flags=[1,2,3,4,5,6].filter(s=>flagAt(record,s)===1);assert.ok(flags.length<=1&&[1,2,3,4,5,6].every(s=>[0,1].includes(flagAt(record,s))),'旗標不符');
 if(after<before){
  assert.ok(confirmRemoved,'降品須確認刪除尾槽');
  assert.ok(flags.every(s=>s<=after),'不可移除已選槽');
 }
 const out=record.slice();out[5]=target;out[8]=record[8]+30*delta;
 const required=Math.max(0,after-before);assert.equal(added.length,required,'新增尾槽數不符');
 const kept=new Set();for(let s=1;s<=Math.min(before,after);s++)kept.add(idAt(record,s));
 const seen=new Set();
 for(const a of added){
  assert.ok(Number.isSafeInteger(a.slot)&&a.slot>before&&a.slot<=after&&!seen.has(a.slot),'新增槽須為連續尾槽');seen.add(a.slot);
  assert.ok(Number.isSafeInteger(a.attributeId)&&a.attributeId>0&&!kept.has(a.attributeId),'不可新增重複詞條');kept.add(a.attributeId);
  const [lo,hi]=subRange(target),h=hundredths(a.coefficient);assert.ok(h>=lo*100&&h<=hi*100,'新增係數超出目標品質範圍');
 }
 for(let s=1;s<=6;s++){
  if(s<=Math.min(before,after)){
   const h=hundredths(coefAt(record,s))+1000*delta;out[14+s]=h/100;
   const [lo,hi]=subRange(target);assert.ok(h>=lo*100&&h<=hi*100,'平移後係數超出目標品質範圍');
  }else if(s<=after){const a=added.find(v=>v.slot===s);out[8+s]=a.attributeId;out[14+s]=a.coefficient;out[27+s]=0;}
  else{out[8+s]=0;out[14+s]=0;out[27+s]=0;}
 }
 const [mlo,mhi]=mainRange(target);assert.ok(out[8]>=mlo&&out[8]<=mhi,'平移後主係數超出目標品質範圍');
 return out;
}
// Only y5, y8, slot ids/coefficients/flags may differ; everything else (y0-4, y6, y7, y23-27 and the rest) is preserved exactly.
function assertQualityOnly(before,after,target){
 assert.equal(before.length,60);assert.equal(after.length,60);
 const allowed=new Set([5,8,...[1,2,3,4,5,6].flatMap(s=>[8+s,14+s,27+s])]);
 before.forEach((v,y)=>{if(!allowed.has(y))assert.equal(after[y],v,'品質外欄位被改寫 y'+y);});
 assert.equal(after[5],target);
}
// Effects. Main attack carries the L×Q term; sub slots carry no level term; equal ids from main and sub accumulate.
const effects=(record,rules)=>E.itemEffects(record,rules);
function effectChange(before,after,rules){
 const a=effects(before,rules),b=effects(after,rules),out={};
 for(const id of new Set([...Object.keys(a),...Object.keys(b)])){const x=a[id]??0,y=b[id]??0;out[id]={before:x,after:y,delta:y-x,removed:y===0&&x!==0};}
 return out;
}
// Attack at level L with quality Q = floor(base(1+.04L)·coef·setting + L·Q): per extra quality at fixed coefficient the term grows by exactly L.
const attackQualityTerm=(level,quality)=>level*checkQuality(quality);
// Old contribution of a replaced or removed slot must disappear from the total: expected total = Σ slots now present.
function withoutSlot(record,slot){const r=record.slice();r[8+slot]=0;r[14+slot]=0;r[27+slot]=0;return r;}
// Set summary S/N/parts and extra set effects depend on y1, y23 and wear combination only, never on y5 or slot content.
function assertSetInvariant(before,after,rules,setId){
 assert.deepEqual(after.map(r=>[r[1],r[23]]),before.map(r=>[r[1],r[23]]),'y1／y23 不應被品質交易改寫');
 assert.deepEqual(E.setSummary(after,rules,setId),E.setSummary(before,rules,setId),'S／N／部位數不應變');
 assert.deepEqual(E.characterEffects(after,rules).sets,E.characterEffects(before,rules).sets,'額外套裝效果不應變');
}
const characterEffects=(records,rules)=>E.characterEffects(records,rules);
// Lifecycle. Two native IO rounds: (1) edited save loads, saved in original format, new PID reloads equal; (2) after equip/unequip cycle, same again.
const ioRounds=[
 {round:1,label:'edit',steps:['load-edited','observe','save-original-format','assert','stop','restart','load','assert','observe-equal']},
 {round:2,label:'cycle',steps:['move-cycle','observe','save-original-format','assert','stop','restart','load','assert','observe-equal']}
];
const moveColumns=50,tailColumns=[50,51,52,53,54,55,56,57,58,59];
// Moves copy and clear y0-49 only. The source keeps y50-59; the destination does not receive them. Owner y7 differs per phase.
function movedRecord(source,destination=Array(60).fill(0)){
 assert.equal(source.length,60);assert.equal(destination.length,60);
 return {source:source.map((v,y)=>y<moveColumns?0:v),destination:destination.map((v,y)=>y<moveColumns?source[y]:v)};
}
function validateCycle(report,expected,{slot,worn=false}){
 assert.deepEqual(report.initial,expected);assert.equal(report.steps.at(-1).phase,'unequip');
 assert.ok(report.steps.some(s=>s.phase==='equip'));
 for(const step of report.steps){
  for(let y=0;y<moveColumns;y++)if(y!==7)assert.equal(step.record[y],expected[y],'搬移欄位 '+y);
  const owner=step.phase==='equip'?1:step.phase==='takeout'?(worn?0:expected[7]):0;assert.equal(step.record[7],owner,'owner '+step.phase);
  if(step.phase==='equip')assert.equal(step.refs[slot-1],step.id);else assert.equal(step.refs[slot-1],0);
  for(let y=0;y<moveColumns;y++)assert.equal(step.source[y],0,'來源搬移後未清除 y'+y);
 }
 return true;
}
// Tail ten columns: markers seeded in the source stay at the source and never appear in the destination.
function monitorTail(report,markers){
 assert.equal(markers.length,tailColumns.length);
 return report.steps.map(step=>({phase:step.phase,destination:step.record.slice(50),source:step.source.slice(50),
  sourceKeepsMarkers:markers.every((v,i)=>step.source[50+i]===v||step.source[50+i]===0),destinationHasMarkers:markers.some((v,i)=>step.record[50+i]===v)}));
}
function validateTail(report,markers){
 for(const t of monitorTail(report,markers)){assert.equal(t.destinationHasMarkers,false,'尾十欄不得進入目的列 '+t.phase);assert.equal(t.sourceKeepsMarkers,true,'尾十欄來源不得被改寫 '+t.phase);}
 return true;
}
// Round report: {label,observed,reloaded,pids:[before,after]}; reloaded must equal observed and come from a different PID.
function validateIO(rounds,expected,finalLocations){
 assert.equal(rounds.length,2,'須有兩輪 IO');
 rounds.forEach((r,i)=>{
  assert.equal(r.label,ioRounds[i].label);assert.deepEqual(r.reloaded,r.observed,'新 PID 讀回不一致 '+r.label);
  assert.equal(r.pids.length,2);assert.notEqual(r.pids[0],r.pids[1],'兩次讀取須為不同 PID '+r.label);
 });
 assert.deepEqual(rounds[0].observed,expected,'第一輪編輯後讀回須等於預期');
 assert.ok(Array.isArray(finalLocations)&&finalLocations.length>=2,'第二輪須監看背包與裝備庫位置');
 assert.notEqual(rounds[0].pids[1],rounds[1].pids[1],'兩輪不得共用重啟後 PID');
 return true;
}
// Lifecycle starts: 3 states × up/down = 6 classes, extra coverage listed (the actual copy count is decided by coverage in A9).
const states=['backpack','stored','equipped'];
function lifecycleStarts(){
 const base=[];for(const state of states)for(const direction of ['up','down'])base.push({id:`${state}-${direction}`,state,direction});
 const extras=[
  {id:'tier-1',axis:'tier',value:1},{id:'tier-9',axis:'tier',value:9},
  {id:'q1-q6',axis:'transition',from:1,to:6},{id:'q6-q1',axis:'transition',from:6,to:1},{id:'q5-q6',axis:'transition',from:5,to:6},{id:'q6-q5',axis:'transition',from:6,to:5},
  {id:'origin-pool-slot',axis:'pool',value:'origin'},{id:'set-pool-slot',axis:'pool',value:'set'},{id:'selected-slot',axis:'selected'},
  {id:'synthesis-in-place-z9',axis:'path',value:'z9'},{id:'synthesis-from-bag-z7',axis:'path',value:'z7'}
 ];
 return {base,extras};
}
module.exports={cap,slots,mainRange,subRange,hundredths,transition,assertQualityOnly,effects,effectChange,attackQualityTerm,withoutSlot,assertSetInvariant,characterEffects,
 setSummary:E.setSummary,rawSetEffect:E.rawSetEffect,ioRounds,moveColumns,tailColumns,movedRecord,validateCycle,monitorTail,validateTail,validateIO,lifecycleStarts,idAt,coefAt,flagAt};
