'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Cost=require('../scripts/reproof-cost.cjs');
const base=()=>({version:1,thresholds:{windowDays:60,bigRatio:0.5,bigRuns:2,minutes:30},suggestion:{candidate:'並行副本',status:'pending'},runs:[]});
const run=(date,copies,minutes,total=21)=>({date,trigger:'core-change',copies,total,minutes});

test('the tracked ledger is valid and below the threshold today',()=>{
 const ledger=Cost.validate(Cost.load());
 assert.equal(ledger.suggestion.candidate,'降低原生重證成本 C：並行副本');
 assert.equal(Cost.check(ledger,{today:'2026-10-23'}).triggered,false);
});
test('two big runs or enough minutes inside the window trigger the hint',()=>{
 let l=Cost.record(base(),run('2026-09-01',21,12));
 assert.equal(Cost.check(l,{today:'2026-10-01'}).triggered,false);
 l=Cost.record(l,run('2026-10-01',11,7));
 const r=Cost.check(l,{today:'2026-10-02'});assert.equal(r.triggered,true);assert.equal(r.bigRuns,2);
 assert.match(Cost.hint(r),/並行副本/);
 // Outside the 60-day window the old run no longer counts.
 assert.equal(Cost.check(l,{today:'2026-11-15'}).triggered,false);
 // Many small selective runs add up by minutes.
 let m=base();for(const d of ['2026-10-01','2026-10-05','2026-10-09','2026-10-13','2026-10-17'])m=Cost.record(m,run(d,4,6));
 const s=Cost.check(m,{today:'2026-10-20'});assert.equal(s.triggered,true);assert.equal(s.bigRuns,0);assert.match(s.reasons.join(),/30 分鐘/);
});
test('a planned big re-proof after one recent big run triggers before it starts',()=>{
 const l=Cost.record(base(),run('2026-10-23',19,12,19));
 assert.equal(Cost.check(l,{today:'2026-10-24',planned:3,total:21}).triggered,false);
 const r=Cost.check(l,{today:'2026-10-24',planned:15,total:21});assert.equal(r.triggered,true);assert.match(r.reasons.join(),/15／21/);
 assert.equal(Cost.check(base(),{today:'2026-10-24',planned:21,total:21}).triggered,false);
});
test('decline waits for a newer run; done suppresses for good',()=>{
 let l=Cost.record(Cost.record(base(),run('2026-10-01',21,12)),run('2026-10-10',21,12));
 const declined={...l,suggestion:{...l.suggestion,status:'declined',at:'2026-10-11'}};
 const r=Cost.check(declined,{today:'2026-10-12'});assert.equal(r.triggered,false);assert.equal(r.suppressed,true);
 assert.equal(Cost.check(Cost.record(declined,run('2026-10-20',21,12)),{today:'2026-10-21'}).triggered,true);
 const done={...l,suggestion:{...l.suggestion,status:'done',at:'2026-10-11'}};
 assert.equal(Cost.check(Cost.record(done,run('2026-10-20',21,12)),{today:'2026-10-21'}).triggered,false);
});
test('malformed entries are rejected',()=>{
 for(const bad of [{date:'2026/10/01',trigger:'core-change',copies:1,total:2,minutes:1},{date:'2026-10-01',trigger:'x',copies:1,total:2,minutes:1},{date:'2026-10-01',trigger:'release',copies:3,total:2,minutes:1},{date:'2026-10-01',trigger:'release',copies:1,total:2,minutes:-1}])
  assert.throws(()=>Cost.record(base(),bad),/格式不符/);
 assert.throws(()=>Cost.validate({...base(),thresholds:{...base().thresholds,bigRatio:2}}),/門檻/);
});
