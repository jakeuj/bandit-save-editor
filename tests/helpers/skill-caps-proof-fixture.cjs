'use strict';
// Synthetic evidence documents for validating rejection paths. These are never game proof or production inputs.
const {skillNeed,expectedEditedSkills}=require('../../scripts/verify-random-character-skill-caps.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
const fromCase=c=>({id:c.id,quality:c.quality,template:0,prison:0,stage:0,raw:clone(c.raw),talents:clone(c.talents),talentLevels:clone(c.talentLevels),stageRecords:Array(16).fill(0),skills:c.afterCaps.map((cap,i)=>({id:i+1,cap,level:c.levels[i],experience:c.remainders[i]}))});
function createEffects(scenario,{pid=100,reloadPid=101,batch=!!scenario.skillCapBatchRequests}={}){
 const expected=scenario.skillCapCases.map(c=>({...fromCase(c),skills:expectedEditedSkills(scenario,c)})),nativeNeeds=expected.map(r=>({id:r.id,needs:r.skills.map(s=>skillNeed(s.level))}));
 const report={schema:1,matrixVersion:scenario.skillCapMatrixVersion,coverage:scenario.skillCapCoverage,manifest:clone(scenario.skillCapManifest),expected,observed:clone(expected),numericUpdate:{before:clone(expected),after:clone(expected)},nativeNeeds,load:{pid},reload:{pid:reloadPid,previousPid:pid,observed:clone(expected),nativeNeeds:clone(nativeNeeds)}};
 if(batch){report.batchRequests=clone(scenario.skillCapBatchRequests);report.batchResults=[{kind:'skillExperience',targets:9,changed:9,blocked:0}];const after=clone(expected),events=after[0].skills.map(s=>{const before={cap:s.cap,level:s.level,experience:s.experience},need=skillNeed(s.level);s.experience=Math.floor(s.experience)+10;if(s.level>=s.cap)s.experience=0;else if(s.experience>=need){s.level++;s.experience-=need;}return {id:after[0].id,skill:s.id,before,bonuses:[0,0],gain:10,need,after:{cap:s.cap,level:s.level,experience:s.experience}};});report.batchFollowup={before:clone(expected),events,after,reloaded:clone(after),beforePid:reloadPid,afterPid:reloadPid+1,assertions:[{passed:true,restarted:true,pid:reloadPid,savedHash:'c'.repeat(64)},{passed:true,restarted:true,pid:reloadPid+1,savedHash:'c'.repeat(64)}]};}
 return report;
}

function createLifecycle(scenario,{pid=101}={}){
 let current=scenario.skillCapCases.map(fromCase),before=clone(current),lastPid=pid;
 const report={schema:1,manifest:clone(scenario.skillCapManifest),initialPid:pid,initial:clone(current),stages:[],tracked:[10,11,12,13]},get=id=>current.find(r=>r.id===id);
 const stage=tag=>{const expected=clone(current),afterPid=lastPid+1,hash='a'.repeat(64);report.stages.push({tag,beforePid:lastPid,afterPid,before,expected,reloaded:clone(expected),assertions:[{passed:true,restarted:true,pid:lastPid,savedHash:hash},{passed:true,restarted:true,pid:afterPid,savedHash:hash}]});lastPid=afterPid;before=clone(current);};
 const named={...clone(get(10)),id:12,template:1,skills:get(10).skills.map((s,i)=>({...s,cap:20+i}))};current.push(named);
 report.numericUpdate={before:clone(report.initial),after:clone(report.initial),named:{template:1,beforeCaps:Array(9).fill(99),expectedCaps:named.skills.map(s=>s.cap),afterCaps:named.skills.map(s=>s.cap)}};stage('numeric-update');
 const recruited={...clone(get(10)),id:13},candidate={...clone(recruited),id:1};current.push(recruited);report.recruitment={candidate,recruited:clone(recruited),witnesses:[{primary:1,secondary:2,orientation:'通用'}]};stage('recruited');
 for(const id of [10,11])for(const s of get(id).skills){s.level=s.cap-1;s.experience=skillNeed(s.level)-1;}stage('experience-ready');
 const experience=(ids,capped=false)=>ids.flatMap(id=>get(id).skills.map(s=>{const b={cap:s.cap,level:s.level,experience:s.experience},need=skillNeed(s.level);if(capped)s.experience=0;else{s.experience+=10;if(s.experience>=need){s.experience-=need;s.level++;}}return {id,skill:s.id,before:b,bonuses:[0,0],gain:10,need,after:{cap:s.cap,level:s.level,experience:s.experience}};}));
 report.timing={reached:experience([10,11])};stage('just-reached-cap');report.timing.capped=experience([10],true);stage('already-capped');
 report.timing.raised={before:clone(get(11)),changedCells:9,editorHistory:1};for(const s of get(11).skills)s.cap++;report.timing.raised.after=clone(get(11));stage('raised-cap');
 report.timing.afterRaise=experience([11]);stage('growth-after-raise');report.transfer={before:4,after:5,eligible:1,job:3,skillsBefore:clone(current.slice(0,2)),skillsAfter:clone(current.slice(0,2))};stage('transfer');
 report.prison={before:clone(get(10))};get(10).prison=2;report.prison.after=clone(get(10));stage('imprisoned');report.recall={before:clone(get(10))};get(10).prison=0;report.recall.after=clone(get(10));stage('recalled');stage('rebirth-ready');
 report.rebirth={before:clone(get(10)),after:clone(get(10)),bonusesBefore:[1,1,1],bonusesAfter:[0,0,0],levelBefore:2,levelAfter:1};stage('reborn');
 const dismissed=get(11);Object.assign(dismissed,{quality:0,raw:[0,0,0],talents:[0,0,0],talentLevels:[0,0,0],skills:Array.from({length:9},(_,i)=>({id:i+1,cap:0,level:0,experience:0}))});report.dismissed={id:11,cleared:true};stage('dismissed');report.final=clone(current);report.reload={pid:lastPid+1,previousPid:lastPid,final:clone(current),dismissedCleared:true};return report;
}
module.exports={createEffects,createLifecycle};
