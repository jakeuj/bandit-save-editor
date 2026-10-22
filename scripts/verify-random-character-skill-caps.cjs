#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {evaluate,waitMain}=require('./verify-game.cjs');
const {prefix,externalState,loadStateCore}=require('./verify-random-character-growth.cjs');
const snapshotBody=`id=>({id,quality:a.At(id,49,2),template:a.At(id,2,2),prison:a.At(id,55,2),stage:a.At(id,50,2),raw:[10,11,12].map(y=>a.At(id,y,2)),talents:[1,2,3].map(y=>a.At(id,y,12)),talentLevels:[21,22,23].map(y=>a.At(id,y,12)),stageRecords:Array.from({length:16},(_,i)=>a.At(id,i+1,16)),skills:Array.from({length:9},(_,i)=>({id:i+1,cap:a.At(id,22+i,2),level:a.At(id,31+i,2),experience:a.At(id,40+i,2)}))})`;
const skillNeed=level=>Math.round(Math.round(10000*1.05**(level-1)+500*(level-1))/500)*500;
const resources=['伐木','采矿','种植','锻造','工艺','炼丹','建造','研究','操练'];
function independentGrowth(value,amount){const result={...value};result.experience=Math.round(Math.floor(result.experience)+amount);while(result.level<result.cap&&result.experience>=skillNeed(result.level)){result.experience-=skillNeed(result.level);result.level++;}if(result.level>=result.cap)result.experience=0;return result;}
function expectedEditedSkills(scenario,spec){
 let values=spec.beforeCaps.map((cap,i)=>({id:i+1,cap,level:spec.levels[i],experience:spec.remainders[i]}));
 // verify-game's common smoke performs this single skill operation before scenario cap changes.
 if(spec.id===1)values[0]=independentGrowth(values[0],21500);
 values=values.map((v,i)=>({...v,cap:spec.afterCaps[i]}));
 for(const request of scenario.skillCapBatchRequests||[])if(request.characterId===spec.id)values=values.map(v=>independentGrowth(v,request.amount));
 return values;
}
async function nativeExperience(state,ids){return evaluate(state,`(()=>{${prefix}const t=r.GetObjectClassByName('属性临时').GetInstances()[0].GetSdkInstance(),out=[];for(const id of ${JSON.stringify(ids)})for(let skill=1;skill<=9;skill++){const read=()=>({cap:a.At(id,21+skill,2),level:a.At(id,30+skill,2),experience:a.At(id,39+skill,2)}),before=read(),bonuses=[t.At(37,id,0),t.At(80+skill,id,0)],gain=Math.round(10*(100+bonuses[0]+bonuses[1])/100),need=call('技艺升级经验',before.level);call('获得技艺经验',id,0,0,skill,${JSON.stringify(resources)}[skill-1]);out.push({id,skill,before,bonuses,gain,need,after:read()});}return out;})()`);}
function validateNativeEvent(event){const {before,after,gain,need,bonuses}=event;assert.equal(bonuses.length,2);assert.equal(gain,Math.round(10*(100+bonuses[0]+bonuses[1])/100));assert.ok(gain>0);assert.equal(need,skillNeed(before.level));assert.equal(after.cap,before.cap);if(before.level>=before.cap){assert.equal(after.level,before.level);assert.equal(after.experience,0);}else{const sum=Math.round(Math.floor(before.experience)+gain),advanced=sum>=need;assert.equal(after.level,before.level+(advanced?1:0));assert.equal(after.experience,sum-(advanced?need:0));}}
const snapshotData=(data,id)=>{const a={At:(x,y,z)=>data[x][y][z]};return eval('('+snapshotBody+')')(id);};
async function nativeSnapshot(state,ids){return evaluate(state,`(()=>{${prefix}return ${JSON.stringify(ids)}.map(${snapshotBody});})()`);}
async function nativeNeeds(state,ids){return evaluate(state,`(()=>{${prefix}return ${JSON.stringify(ids)}.map(id=>({id,needs:Array.from({length:9},(_,i)=>call('技艺升级经验',a.At(id,31+i,2)))}));})()`);}
function validateSnapshot(rows,ids){
 assert.ok(Array.isArray(rows));assert.deepEqual(rows.map(r=>r.id),ids);
 for(const r of rows){assert.equal(r.skills.length,9);for(const [i,s]of r.skills.entries()){assert.equal(s.id,i+1);assert.ok(Number.isSafeInteger(s.cap)&&Number.isSafeInteger(s.level)&&s.level>=1&&s.cap>=s.level);assert.ok(Number.isFinite(s.experience)&&s.experience>=0);}assert.equal(r.raw.length,3);assert.equal(r.talents.length,3);assert.equal(r.talentLevels.length,3);assert.equal(r.stageRecords.length,16);}
}
function validateEffects(report,{scenario,compareRequired=false}){
 assert.equal(report.schema,1);assert.equal(report.matrixVersion,scenario.skillCapMatrixVersion);assert.equal(report.coverage,scenario.skillCapCoverage);assert.deepEqual(report.manifest,scenario.skillCapManifest);
 const ids=scenario.skillCapCharacters;assert.ok(ids.length);validateSnapshot(report.expected,ids);validateSnapshot(report.observed,ids);assert.deepEqual(report.observed,report.expected);
 assert.ok(Number.isSafeInteger(report.load?.pid)&&report.load.pid>0);
 for(const [i,row]of report.expected.entries()){
  const spec=scenario.skillCapCases[i];assert.equal(row.id,spec.id);assert.equal(row.quality,spec.quality);assert.equal(row.template,0);assert.equal(row.prison,0);assert.equal(row.stage,0);
  assert.deepEqual(row.skills.map(s=>s.cap),spec.afterCaps);assert.deepEqual(row.raw,spec.raw);assert.deepEqual(row.talents,spec.talents);assert.deepEqual(row.talentLevels,spec.talentLevels);
  assert.deepEqual(row.skills,expectedEditedSkills(scenario,spec));
 }
 const needs=()=>report.expected.map(row=>({id:row.id,needs:row.skills.map(s=>skillNeed(s.level))}));
 assert.deepEqual(report.nativeNeeds,needs());
 if(compareRequired){assert.ok(report.reload);assert.equal(report.reload.previousPid,report.load.pid);assert.ok(Number.isSafeInteger(report.reload.pid)&&report.reload.pid>0&&report.reload.pid!==report.load.pid);assert.deepEqual(report.reload.observed,report.expected);assert.deepEqual(report.reload.nativeNeeds,needs());}
 assert.deepEqual(report.numericUpdate.before,report.observed);assert.deepEqual(report.numericUpdate.after,report.observed);
 const checks={nativeEffects:true};
 if(scenario.skillCapBatchRequests){
  assert.deepEqual(report.batchRequests,scenario.skillCapBatchRequests);assert.deepEqual(report.batchRequests,[{kind:'skillExperience',characterId:ids[0],amount:20000}]);assert.equal(report.batchResults.length,1);const b=report.batchResults[0];assert.equal(b.kind,'skillExperience');assert.equal(b.targets,9);assert.equal(b.blocked,0);assert.ok(b.changed>0);
  if(compareRequired){const f=report.batchFollowup;assert.ok(f);assert.deepEqual(f.before,report.expected);assert.equal(f.events.length,9);const expected=JSON.parse(JSON.stringify(f.before));for(const [i,e]of f.events.entries()){assert.equal(e.id,ids[0]);assert.equal(e.skill,i+1);assert.deepEqual({id:e.skill,...e.before},expected[0].skills[i]);validateNativeEvent(e);expected[0].skills[i]={id:e.skill,...e.after};}assert.deepEqual(f.after,expected);assert.deepEqual(f.reloaded,expected);assert.equal(f.beforePid,report.reload.pid);assert.ok(Number.isSafeInteger(f.afterPid)&&f.afterPid>0&&f.afterPid!==f.beforePid);assert.equal(f.assertions.length,2);assert.deepEqual(f.assertions.map(a=>a.pid),[f.beforePid,f.afterPid]);assert.ok(f.assertions.every(a=>a.passed&&/^[0-9a-f]{64}$/.test(a.savedHash)));assert.equal(f.assertions[0].savedHash,f.assertions[1].savedHash);checks.batchCompatibility=true;}
 }

 return checks;
}
async function verify(state,scenario,compare=false,statePath){
 externalState(state);await waitMain(state);const ids=scenario.skillCapCharacters,C=loadStateCore(state),file=path.join(state.dir,'skill-caps-effects.json');
 const data=JSON.parse(fs.readFileSync(path.join(state.game,'savedir/ea1save.dat'),'utf8')).data;
 const expected=ids.map(id=>snapshotData(data,id)),beforeUpdate=await nativeSnapshot(state,ids);if(!compare)await evaluate(state,`(()=>{${prefix}call('数值更新');return true;})()`);const observed=await nativeSnapshot(state,ids),needs=await nativeNeeds(state,ids);
 // Qualification and the native requirement formula are distinct checks; the serialized target is compared exactly.
 const m=C.parse(fs.readFileSync(path.join(state.game,'savedir/ea1save.dat'),'utf8'));
 for(const id of ids){const info=C.randomCharacterSkillCapsInfo(m,{characterId:id});assert.ok(info.eligible,info.reasons.join(';'));}
 let report;
 if(compare){assert.ok(state.restarted&&state.pid!==state.previousPid);report=JSON.parse(fs.readFileSync(file,'utf8'));assert.deepEqual(expected,report.expected);report.reload={pid:state.pid,previousPid:state.previousPid,observed,nativeNeeds:needs};}
 else report={schema:1,matrixVersion:scenario.skillCapMatrixVersion,coverage:scenario.skillCapCoverage,manifest:scenario.skillCapManifest,expected,observed,nativeNeeds:needs,numericUpdate:{before:beforeUpdate,after:observed},...(scenario.skillCapBatchRequests?{batchRequests:scenario.skillCapBatchRequests}:{}),...(state.batchResults?{batchResults:state.batchResults}:{}),load:{pid:state.pid}};
 if(compare&&scenario.skillCapBatchRequests){if(!statePath)throw Error('Batch follow-up requires external state path');const beforePid=state.pid,count=state.assertions.length,events=await nativeExperience(state,[ids[0]]),after=await nativeSnapshot(state,ids);await require('./verify-random-character-lifecycle.cjs').checkpoint(statePath,state,'batch-next-native-experience');report.batchFollowup={before:observed,events,after,reloaded:await nativeSnapshot(state,ids),beforePid,afterPid:state.pid,assertions:state.assertions.slice(count)};}
 const checks=validateEffects(report,{scenario,compareRequired:compare});fs.writeFileSync(file,JSON.stringify(report,null,2));console.log(`PASS: ${ids.length} skill-cap characters, 27 cells and native requirements${compare?' after new-PID reload':''}`);return checks;
}
async function main(){const args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1];await verify(JSON.parse(fs.readFileSync(opt('--state'),'utf8')),JSON.parse(fs.readFileSync(opt('--scenario'),'utf8')),args.includes('--compare'),opt('--state'));}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={prefix,externalState,loadStateCore,snapshotBody,snapshotData,nativeSnapshot,nativeNeeds,skillNeed,independentGrowth,expectedEditedSkills,nativeExperience,validateNativeEvent,validateSnapshot,validateEffects,verify};
