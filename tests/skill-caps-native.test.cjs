'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup}=require('./helpers/batch-fixture.cjs');
const {buildSkillCapScenarios,matrixManifest}=require('../scripts/random-character-skill-caps-scenarios.cjs');
const {validateEffects,skillNeed}=require('../scripts/verify-random-character-skill-caps.cjs');
const {validateLifecycle,validateNativeExperience}=require('../scripts/verify-skill-caps-lifecycle.cjs');
const {createEffects,createLifecycle}=require('./helpers/skill-caps-proof-fixture.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
let copies;
const fixtures=()=>copies??=(f=>buildSkillCapScenarios({catalog:f.k,saveText:f.rawWith(),representative:false}))(setup(221,2));
test('initial skill-cap matrix covers 6 qualities, every primary/secondary position, both directions and exact-level zero remainder',()=>{
 const [matrix,life]=fixtures();assert.equal(matrix.cases,108);assert.equal(life.cases,2);assert.deepEqual(matrix.scenario.skillCapManifest,matrixManifest());
 for(let q=1;q<=6;q++)for(const d of ['up','down']){const group=matrix.scenario.skillCapCases.filter(c=>c.quality===q&&c.direction===d);assert.equal(group.length,9);assert.equal(new Set(group.map(c=>c.primary)).size,9);assert.equal(new Set(group.map(c=>c.secondary)).size,9);assert.ok(group.every(c=>c.primary!==c.secondary&&c.beforeCaps.every((v,i)=>d==='up'?v<c.afterCaps[i]:v>c.afterCaps[i])));}
 const boundary=matrix.scenario.skillCapCases.find(c=>c.atLevelBoundary);assert.deepEqual(boundary.levels,boundary.afterCaps);assert.ok(boundary.remainders.every(v=>v===0));assert.equal(matrix.batchRequests[0].kind,'skillExperience');
});
test('representative migration uses a distinct two-role matrix and retains full lifecycle without claiming initial coverage',()=>{
 const f=setup(221,2),actual=buildSkillCapScenarios({catalog:f.k,saveText:f.rawWith()});assert.equal(actual[0].cases,2);assert.equal(actual[0].scenario.skillCapCoverage,'representative');assert.equal(actual[1].cases,2);assert.notEqual(actual[0].name,fixtures()[0].name);
});
test('native effects validation requires actual 27-cell snapshots, native formula, batch targets and distinct reload PID',()=>{
 const scenario=fixtures()[0].scenario,good=createEffects(scenario,{batch:true});assert.deepEqual(validateEffects(good,{scenario,compareRequired:true}),{nativeEffects:true,batchCompatibility:true});
 for(const mutate of [r=>r.observed.pop(),r=>r.reload.pid=r.load.pid,r=>r.reload.observed[0].skills[0].cap++,r=>r.nativeNeeds[0].needs[0]++,r=>r.expected[2].skills[0].level++,r=>r.batchResults[0].targets=8,r=>r.batchResults[0].blocked=1]){const bad=clone(good);mutate(bad);assert.throws(()=>validateEffects(bad,{scenario,compareRequired:true}));}
 assert.equal(skillNeed(1),10000);assert.equal(skillNeed(2),11000);
});
test('native lifecycle rejects absent/mislinked stage evidence, stale PID, skipped calls and fake all-true checks',()=>{
 const scenario=fixtures()[1].scenario,good=createLifecycle(scenario);assert.equal(validateLifecycle(good,{scenario,compareRequired:true}).stageRoundtrips,true);
 for(const mutate of [r=>r.stages.pop(),r=>r.stages[2].afterPid=r.stages[2].beforePid,r=>r.stages[3].assertions[1].savedHash='b'.repeat(64),r=>r.stages[5].expected=[],r=>r.stages[6].before[0].skills[0].cap++,r=>r.numericUpdate.before=[],r=>r.timing.reached.pop(),r=>r.timing.capped[0].after.experience=1,r=>r.timing.raised.after.skills[0].experience=0,r=>r.recruitment.recruited.skills[0].cap++,r=>r.dismissed.cleared=false,r=>delete r.reload]){const bad=clone(good);mutate(bad);assert.throws(()=>validateLifecycle(bad,{scenario,compareRequired:true}));}
 assert.throws(()=>validateLifecycle({schema:1,checks:Object.fromEntries(['nativeEffects','nativeRecruitment','stageRoundtrips'].map(k=>[k,true]))},{scenario,compareRequired:true}));
 for(const mutate of [r=>r.initial[0].skills[0].cap++,r=>{r.transfer.skillsBefore=[];r.transfer.skillsAfter=[];},r=>{r.transfer.before=1000;r.transfer.after=1001;},r=>r.transfer.skillsBefore[0].talents[0]=999,r=>r.transfer.skillsAfter[0].talents[0]=999]){const bad=clone(good);mutate(bad);assert.throws(()=>validateLifecycle(bad,{scenario,compareRequired:true}));}
 assert.notStrictEqual(good.initial,good.numericUpdate.before);assert.notStrictEqual(good.initial[0],good.numericUpdate.before[0]);assert.notStrictEqual(good.transfer.skillsBefore[0],good.stages.find(s=>s.tag==='transfer').before[0]);
});
test('original experience timing keeps first cap overflow, clears on next capped event and then accepts growth after a raise',()=>{
 const report=createLifecycle(fixtures()[1].scenario);validateNativeExperience(report.timing.reached,'reached');validateNativeExperience(report.timing.capped,'capped');validateNativeExperience(report.timing.afterRaise,'afterRaise');
 assert.ok(report.timing.reached.every(r=>r.after.experience===9));assert.ok(report.timing.capped.every(r=>r.after.experience===0));assert.ok(report.timing.afterRaise.every(r=>r.after.experience===19));
 const invalid=clone(report.timing.reached);invalid[0].after.experience=0;assert.throws(()=>validateNativeExperience(invalid,'reached'));
});
