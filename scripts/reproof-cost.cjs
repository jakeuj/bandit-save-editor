#!/usr/bin/env node
'use strict';
// Ledger of native re-proof runs and the trigger that tells the agent when parallel copies (core-slice-reproof §3) pay off.
// Static and offline: never starts a game. The ledger is tracked and de-identified (dates, counts, minutes, family names).
const fs=require('node:fs'),path=require('node:path');
const LEDGER=path.join(__dirname,'..','docs','research','reproof-ledger.json');
const TRIGGERS=['game-update','core-change','release','other'];
const DAY=86400000;

function load(file=LEDGER){return JSON.parse(fs.readFileSync(file,'utf8'));}
function save(ledger,file=LEDGER){fs.writeFileSync(file,JSON.stringify(ledger,null,1)+'\n');}
const isDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'));
const ms=s=>Date.parse(s+'T00:00:00Z');

function validate(ledger){
 if(ledger?.version!==1||!Array.isArray(ledger.runs))throw Error('重證紀錄格式不符');
 const t=ledger.thresholds;
 if(!t||![t.windowDays,t.bigRuns,t.minutes].every(n=>Number.isSafeInteger(n)&&n>0)||!(t.bigRatio>0&&t.bigRatio<=1))throw Error('重證門檻格式不符');
 for(const r of ledger.runs){
  if(!isDate(r.date)||!TRIGGERS.includes(r.trigger)||!Number.isSafeInteger(r.copies)||!Number.isSafeInteger(r.total)||r.copies<0||r.total<1||r.copies>r.total||!(r.minutes>=0))throw Error('重證紀錄項目格式不符：'+JSON.stringify(r));
 }
 if(!['pending','declined','done'].includes(ledger.suggestion?.status))throw Error('建議狀態格式不符');
 return ledger;
}
function record(ledger,run){
 const entry={date:run.date,trigger:run.trigger,copies:run.copies,total:run.total,minutes:run.minutes,...(run.families?.length?{families:[...run.families]}:{}),...(run.note?{note:run.note}:{})};
 validate({...ledger,runs:[...ledger.runs,entry]});
 return {...ledger,runs:[...ledger.runs,entry]};
}
// A run is "big" when it re-ran at least bigRatio of all representative copies (a full re-proof is ratio 1).
function check(ledger,{today,planned,total}={}){
 validate(ledger);
 const t=ledger.thresholds,s=ledger.suggestion,now=ms(today||new Date().toISOString().slice(0,10)),from=now-t.windowDays*DAY;
 const recent=ledger.runs.filter(r=>ms(r.date)>from&&ms(r.date)<=now),big=r=>r.copies/r.total>=t.bigRatio;
 const bigRuns=recent.filter(big).length,minutes=recent.reduce((n,r)=>n+r.minutes,0);
 const plannedBig=Number.isSafeInteger(planned)&&Number.isSafeInteger(total)&&total>0&&planned/total>=t.bigRatio;
 const reasons=[];
 if(bigRuns>=t.bigRuns)reasons.push(`近 ${t.windowDays} 天有 ${bigRuns} 次大量重證（≥${Math.round(t.bigRatio*100)}% 副本）`);
 if(minutes>=t.minutes)reasons.push(`近 ${t.windowDays} 天原生重證累計約 ${Math.round(minutes)} 分鐘`);
 if(plannedBig&&bigRuns+1>=t.bigRuns)reasons.push(`接下來的重證預估 ${planned}／${total} 份副本，會是近期第 ${bigRuns+1} 次大量重證`);
 // A decline is honoured until a newer run is recorded; done suppresses for good.
 const declinedAt=s.status==='declined'&&isDate(s.at)?ms(s.at):null;
 const suppressed=s.status==='done'||declinedAt!==null&&!ledger.runs.some(r=>ms(r.date)>declinedAt);
 return {triggered:reasons.length>0&&!suppressed,suppressed:reasons.length>0&&suppressed,reasons,bigRuns,minutes,window:t.windowDays,candidate:s.candidate};
}
function hint(result){
 if(!result.triggered)return null;
 return `提示：${result.reasons.join('；')}。建議提出「${result.candidate}」（見 sdd/core-slice-reproof/proposal.md 第 3 節）。`;
}

if(require.main===module){
 const args=process.argv.slice(2),value=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
 const ledger=validate(load());
 if(args.includes('--record')){
  const next=record(ledger,{date:value('--date')||new Date().toISOString().slice(0,10),trigger:value('--trigger'),copies:Number(value('--copies')),total:Number(value('--total')),minutes:Number(value('--minutes')),families:value('--families')?.split(',').filter(Boolean),note:value('--note')});
  save(next);console.log(`已記錄重證：${next.runs.at(-1).copies}／${next.runs.at(-1).total} 份，約 ${next.runs.at(-1).minutes} 分鐘`);
 }else if(args.includes('--decline')||args.includes('--done')){
  save({...ledger,suggestion:{...ledger.suggestion,status:args.includes('--done')?'done':'declined',at:value('--date')||new Date().toISOString().slice(0,10)}});
  console.log('已更新建議狀態');
 }else{
  const r=check(ledger,{today:value('--today'),planned:value('--planned')===undefined?undefined:Number(value('--planned')),total:value('--total')===undefined?undefined:Number(value('--total'))});
  console.log(hint(r)||`重證成本未達門檻（近 ${r.window} 天大量重證 ${r.bigRuns} 次、累計約 ${Math.round(r.minutes)} 分鐘）${r.suppressed?'；使用者已暫緩，等下一次重證再提':''}`);
  if(args.includes('--json'))console.log(JSON.stringify(r,null,1));
 }
}
module.exports={load,validate,record,check,hint,LEDGER};
