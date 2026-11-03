#!/usr/bin/env node
'use strict';
// Representative smoke only, on a disposable verify-game state. Never opens catalog flags or records a public proof.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {evaluate,waitMain}=require('./verify-game.cjs');
const {prefix,externalState,nativeSnapshot,nativeExperience,validateNativeEvent,validateSnapshot}=require('./verify-random-character-skill-caps.cjs');
const {checkpoint}=require('./verify-random-character-lifecycle.cjs');
async function verify(statePath,scenario){
 const state=JSON.parse(fs.readFileSync(statePath,'utf8'));externalState(state);await waitMain(state);
 const {expected,boundaryCharacters}=scenario.skillCapModes,ids=expected.map(r=>r.id);
 validateSnapshot(expected,ids);assert.equal(new Set(ids).size,ids.length);
 assert.ok(boundaryCharacters.length&&boundaryCharacters.every(id=>ids.includes(id)));
 const report={gameVersion:state.gameVersion,initialPid:state.pid,expected,before:await nativeSnapshot(state,ids),stages:[]};
 const output=path.join(state.dir,'skill-caps-modes.json'),write=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
 assert.deepEqual(report.before,expected,'Edited caps, levels, experience, aptitudes, talents and ascension records');
 await evaluate(state,`(()=>{${prefix}r.SetTimeScale(0);call('数值更新');return true;})()`);
 report.numericUpdate=await nativeSnapshot(state,ids);assert.deepEqual(report.numericUpdate,expected);
 for(const id of ids){for(let y=0;y<60;y++)state.cells.push([id,y,2]);for(const y of [1,2,3,21,22,23])state.cells.push([id,y,12]);for(let y=1;y<=16;y++)state.cells.push([id,y,16]);}
 const saveStage=async tag=>{
  const before=await nativeSnapshot(state,ids),priorPid=state.pid;write();
  await checkpoint(statePath,state,tag);const after=await nativeSnapshot(state,ids);
  assert.deepEqual(after,before,'Native save and new-PID readback: '+tag);
  report.stages.push({tag,priorPid,pid:state.pid,before,after});write();
 };
 await saveStage('skill-cap-modes-edited');
 report.reached=await nativeExperience(state,boundaryCharacters);report.reached.forEach(validateNativeEvent);
 for(const id of boundaryCharacters){const event=report.reached.find(e=>e.id===id&&e.skill===1);assert.deepEqual([event.before.cap,event.before.level,event.before.experience],[100,99,event.need-1]);assert.equal(event.after.level,100);assert.equal(event.after.experience,event.gain-1);}
 await saveStage('skill-cap-modes-reached-100');
 report.capped=await nativeExperience(state,boundaryCharacters);report.capped.forEach(validateNativeEvent);
 for(const id of boundaryCharacters){const event=report.capped.find(e=>e.id===id&&e.skill===1);assert.deepEqual(event.after,{cap:100,level:100,experience:0});}
 const final=await nativeSnapshot(state,ids);
 for(let i=0;i<ids.length;i++){
  for(const key of ['quality','template','prison','stage','raw','talents','talentLevels','stageRecords'])assert.deepEqual(final[i][key],expected[i][key],'Unchanged '+key);
  assert.deepEqual(final[i].skills.map(s=>s.cap),expected[i].skills.map(s=>s.cap));
  if(!boundaryCharacters.includes(ids[i]))assert.deepEqual(final[i],expected[i]);
 }
 await saveStage('skill-cap-modes-capped');report.completed=true;write();
 console.log('PASS: initial, advanced plain/ascended, level 100 timing and three native new-PID roundtrips');
 return report;
}
if(require.main===module){const args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1];verify(opt('--state'),JSON.parse(fs.readFileSync(opt('--scenario'),'utf8'))).then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1);});}
module.exports={verify};
