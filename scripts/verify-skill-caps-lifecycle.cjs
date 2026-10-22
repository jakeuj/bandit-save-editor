#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {evaluate,waitMain}=require('./verify-game.cjs');
const {checkpoint}=require('./verify-random-character-lifecycle.cjs');
const {prefix,externalState,loadStateCore,nativeSnapshot,snapshotData,snapshotBody,skillNeed,validateSnapshot,nativeExperience}=require('./verify-random-character-skill-caps.cjs');
const stages=['numeric-update','recruited','experience-ready','just-reached-cap','already-capped','raised-cap','growth-after-raise','transfer','imprisoned','recalled','rebirth-ready','reborn','dismissed'];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const idsRows=(rows,ids)=>ids.map(id=>rows.find(r=>r.id===id));
const skills=rows=>rows.map(r=>({id:r.id,skills:r.skills}));
const assertUnchangedSkills=(before,after)=>assert.deepEqual(skills(after),skills(before));
function validateNativeExperience(rows,mode){
 assert.ok(Array.isArray(rows)&&rows.length===(mode==='reached'?18:9));
 const expectedIds=mode==='reached'?[10,11]:mode==='capped'?[10]:[11];
 assert.deepEqual(rows.map(r=>[r.id,r.skill]),expectedIds.flatMap(id=>Array.from({length:9},(_,i)=>[id,i+1])));
 for(const row of rows){const {before,after,gain,need}=row;assert.equal(need,skillNeed(before.level));assert.equal(after.cap,before.cap);assert.ok(Number.isSafeInteger(gain)&&gain>0);assert.equal(row.bonuses.length,2);assert.equal(gain,Math.round(10*(100+row.bonuses[0]+row.bonuses[1])/100));
  if(mode==='capped'){assert.equal(before.level,before.cap);assert.ok(before.experience>0);assert.equal(after.level,before.level);assert.equal(after.experience,0);}
  else{assert.ok(before.level<before.cap);const accumulated=Math.round(Math.floor(before.experience)+gain),leveled=accumulated>=need;assert.equal(after.level,before.level+(leveled?1:0));assert.equal(after.experience,accumulated-(leveled?need:0));
   if(mode==='reached'){assert.equal(before.level,before.cap-1);assert.equal(before.experience,need-1);assert.equal(after.level,after.cap);assert.ok(after.experience>0);}
   else{assert.ok(after.experience>before.experience);assert.equal(before.level,before.cap-1);}
  }
 }
}
function validateLifecycle(report,{scenario,compareRequired=false}){
 assert.equal(report.schema,1);assert.deepEqual(report.manifest,scenario.skillCapManifest);assert.deepEqual(scenario.skillCapCharacters,[10,11]);
 assert.deepEqual(report.stages.map(s=>s.tag),stages);assert.ok(Number.isSafeInteger(report.initialPid)&&report.initialPid>0);validateSnapshot(report.initial,[10,11]);
 assert.equal(report.tracked.length,4);assert.deepEqual(report.tracked.slice(0,3),[10,11,12]);assert.equal(new Set(report.tracked).size,4);let prior=report.initialPid;
 for(const [index,stage]of report.stages.entries()){const expectedIds=index===0?[10,11,12]:report.tracked;assert.deepEqual(stage.expected.map(r=>r.id),expectedIds);validateSnapshot(stage.expected.filter(r=>stage.tag!=='dismissed'||r.id!==11),expectedIds.filter(id=>stage.tag!=='dismissed'||id!==11));assert.equal(stage.beforePid,prior);assert.ok(Number.isSafeInteger(stage.afterPid)&&stage.afterPid>0&&stage.afterPid!==stage.beforePid);assert.deepEqual(stage.expected,stage.reloaded);assert.equal(stage.assertions.length,2);assert.ok(stage.assertions.every(a=>a.passed&&/^[0-9a-f]{64}$/.test(a.savedHash)));assert.deepEqual(stage.assertions.map(a=>a.pid),[stage.beforePid,stage.afterPid]);assert.equal(stage.assertions[0].savedHash,stage.assertions[1].savedHash);prior=stage.afterPid;}
 const n=report.numericUpdate;validateSnapshot(n.before,[10,11]);validateSnapshot(n.after,[10,11]);assert.deepEqual(n.before,report.initial);assertUnchangedSkills(n.before,n.after);assert.ok(n.named.beforeCaps.some((v,i)=>v!==n.named.expectedCaps[i]));assert.deepEqual(n.named.afterCaps,n.named.expectedCaps);assert.equal(n.named.template,1);
 const r=report.recruitment;assert.equal(r.candidate.template,0);assert.equal(r.recruited.template,0);assert.ok(r.candidate.skills.length===9);assert.deepEqual(r.recruited.skills,r.candidate.skills);assert.deepEqual(r.recruited.raw,r.candidate.raw);assert.deepEqual(r.recruited.talents,r.candidate.talents);assert.deepEqual(r.recruited.talentLevels,r.candidate.talentLevels);assert.equal(r.recruited.quality,r.candidate.quality);assert.equal(r.recruited.prison,0);assert.ok(r.witnesses.length);
 validateNativeExperience(report.timing.reached,'reached');validateNativeExperience(report.timing.capped,'capped');validateNativeExperience(report.timing.afterRaise,'afterRaise');
 const raised=report.timing.raised;assert.equal(raised.before.id,11);assert.equal(raised.after.id,11);for(let i=0;i<9;i++){const a=raised.before.skills[i],b=raised.after.skills[i];assert.equal(b.cap,a.cap+1);assert.equal(b.level,a.level);assert.equal(b.experience,a.experience);assert.ok(b.experience>0);}assert.ok(raised.changedCells===9&&raised.editorHistory===1);
 assert.equal(scenario.baseline.filter(([x,y,z])=>x===11&&y===1&&z===4).at(-1)?.[3],4,'轉職矩陣須使用已驗證的差一步前置');
 assert.equal(report.transfer.before,4);assert.equal(report.transfer.after,5);assert.equal(report.transfer.eligible,1);assert.equal(report.transfer.job,3);validateSnapshot(report.transfer.skillsBefore,[10,11]);validateSnapshot(report.transfer.skillsAfter,[10,11]);assertUnchangedSkills(report.transfer.skillsBefore,report.transfer.skillsAfter);
 assert.equal(report.prison.before.prison,0);assert.equal(report.prison.after.prison,2);assertUnchangedSkills([report.prison.before],[report.prison.after]);assert.equal(report.recall.after.prison,0);assertUnchangedSkills([report.recall.before],[report.recall.after]);
 assertUnchangedSkills([report.rebirth.before],[report.rebirth.after]);assert.deepEqual(report.rebirth.bonusesBefore,[1,1,1]);assert.deepEqual(report.rebirth.bonusesAfter,[0,0,0]);assert.equal(report.rebirth.levelBefore,2);assert.equal(report.rebirth.levelAfter,1);assert.equal(report.dismissed.id,11);assert.equal(report.dismissed.cleared,true);
 const at=tag=>report.stages.find(s=>s.tag===tag),row=(tag,id)=>at(tag).expected.find(r=>r.id===id);
 for(let i=1;i<report.stages.length;i++)assert.deepEqual(report.stages[i].before,report.stages[i-1].expected);
 assert.deepEqual(report.numericUpdate.after,idsRows(at('numeric-update').expected,[10,11]));assert.deepEqual(row('numeric-update',12).skills.map(s=>s.cap),n.named.afterCaps);assert.deepEqual(row('recruited',r.recruited.id),r.recruited);
 assert.deepEqual(report.transfer.skillsBefore,idsRows(at('transfer').before,[10,11]));assert.deepEqual(report.transfer.skillsAfter,idsRows(at('transfer').expected,[10,11]));
 for(const [tag,events]of [['just-reached-cap',report.timing.reached],['already-capped',report.timing.capped],['growth-after-raise',report.timing.afterRaise]])for(const event of events){assert.deepEqual(at(tag).before.find(r=>r.id===event.id).skills[event.skill-1],{id:event.skill,...event.before});assert.deepEqual(row(tag,event.id).skills[event.skill-1],{id:event.skill,...event.after});}
 assert.deepEqual(at('raised-cap').before.find(r=>r.id===11),raised.before);assert.deepEqual(row('raised-cap',11),raised.after);assert.deepEqual(row('imprisoned',10),report.prison.after);assert.deepEqual(row('recalled',10),report.recall.after);assert.deepEqual(row('reborn',10),report.rebirth.after);assert.ok(row('dismissed',11).skills.every(s=>s.cap===0&&s.level===0&&s.experience===0));
 assert.deepEqual(report.final,report.stages.at(-1).reloaded);
 if(compareRequired){assert.ok(report.reload&&Number.isSafeInteger(report.reload.pid)&&report.reload.pid>0&&report.reload.pid!==prior);assert.equal(report.reload.previousPid,prior);assert.deepEqual(report.reload.final,report.final);assert.equal(report.reload.dismissedCleared,true);}
 return {numericUpdate:true,nativeRecruitment:true,nativeSkillExperience:true,capRemainderTiming:true,nativeTransfer:true,nativePrison:true,nativeRebirth:true,nativeDismiss:true,stageRoundtrips:true};
}

async function loadEditedCaps(state,id,caps){
 // Consume a game-written file, execute the actual editor, and load its bytes with the original read function.
 const C=loadStateCore(state),model=C.parse(fs.readFileSync(path.join(state.game,'save\\ea1save.dat'),'utf8')),before=snapshotData(model.original.data,id),options={characterId:id,caps};
 const preview=C.previewCharacterSkillCaps(model,options);assert.ok(preview.canApply,preview.reasons.join(';'));C.setCharacterSkillCaps(model,options,{preview});const changedCells=model.changes.size,editorHistory=model.history.length,text=C.serialize(model),after=snapshotData(JSON.parse(text).data,id);
 fs.writeFileSync(path.join(state.game,'savedir/ea1save.dat'),text);await evaluate(state,`(()=>{${prefix}call('读取进度',1,'云存档');return true;})()`);
 const deadline=Date.now()+30000;while(Date.now()<deadline){try{const now=(await nativeSnapshot(state,[id]))[0];if(JSON.stringify(now)===JSON.stringify(after))return {before,after,changedCells,editorHistory};}catch{}await pause(200);}
 throw Error('原版讀檔沒有載入編輯器提高上限後的實際bytes');
}
async function lifecycle(statePath,state,scenario,compare=false){
 externalState(state);await waitMain(state);const file=path.join(state.dir,'skill-caps-lifecycle.json'),ids=scenario.skillCapCharacters;assert.deepEqual(ids,[10,11]);
 const cleared=()=>evaluate(state,`(()=>{${prefix}return [2,4,5,12,16,20].every(z=>Array.from({length:a.GetHeight()},(_,y)=>a.At(11,y,z)).every(v=>v===0));})()`);
 if(compare){const report=JSON.parse(fs.readFileSync(file,'utf8'));report.reload={pid:state.pid,previousPid:state.previousPid,final:await nativeSnapshot(state,report.tracked),dismissedCleared:await cleared()};const checks=validateLifecycle(report,{scenario,compareRequired:true});fs.writeFileSync(file,JSON.stringify(report,null,2));return checks;}
 const report={schema:1,manifest:scenario.skillCapManifest,initialPid:state.pid,initial:await nativeSnapshot(state,ids),stages:[],tracked:[...ids,12]};
 const observe=id=>{for(const z of [2,4,5,12,16,20])for(let y=0;y<60;y++)state.cells.push([id,y,z]);};ids.forEach(observe);observe(12);
 const capture=()=>nativeSnapshot(state,report.tracked);
 const saveStage=async(tag,before)=>{const expected=await capture(),beforePid=state.pid,count=state.assertions.length;await checkpoint(statePath,state,tag);const reloaded=await capture();assert.deepEqual(reloaded,expected);report.stages.push({tag,beforePid,afterPid:state.pid,before,expected,reloaded,assertions:state.assertions.slice(count)});fs.writeFileSync(file,JSON.stringify(report,null,2));};
 let before=await capture();const ordinaryBefore=await nativeSnapshot(state,ids);
 const named=await evaluate(state,`(()=>{${prefix}const j=r.GetObjectClassByName('js').GetInstances()[0].GetSdkInstance();for(const z of [2,4,5,12,16,20])for(let y=0;y<60;y++)a.Set(12,y,z,a.At(10,y,z));a.Set(12,0,2,12);a.Set(12,1,2,'有名回填對照');a.Set(12,2,2,1);for(let y=22;y<=30;y++)a.Set(12,y,2,99);const expectedCaps=Array.from({length:9},(_,i)=>j.At(1,22+i,0));call('数值更新');return {template:1,beforeCaps:Array(9).fill(99),expectedCaps,afterCaps:Array.from({length:9},(_,i)=>a.At(12,22+i,2))};})()`);
 report.numericUpdate={before:ordinaryBefore,after:await nativeSnapshot(state,ids),named};assertUnchangedSkills(report.numericUpdate.before,report.numericUpdate.after);assert.deepEqual(named.afterCaps,named.expectedCaps);await saveStage('numeric-update',before);
 before=await capture();
 report.recruitment=await evaluate(state,`(()=>{${prefix}for(let id=1;id<=3;id++)for(let y=0;y<60;y++)a.Set(id,y,3,0);call('新刷新招募数据',1,0,0,0,'',0,0,0,0,0,0,0,0,0,0,false,0,0,0);const candidateId=[1,2,3].find(id=>a.At(id,0,3)>0&&a.At(id,2,3)===0);if(!candidateId)throw Error('本次三名原生候選皆非範本0，沒有招募證明');const candidate={id:candidateId,quality:a.At(candidateId,49,3),template:a.At(candidateId,2,3),raw:[10,11,12].map(y=>a.At(candidateId,y,3)),talents:[51,52,53].map(y=>a.At(candidateId,y,3)),talentLevels:[54,55,56].map(y=>a.At(candidateId,y,3)),skills:Array.from({length:9},(_,i)=>({id:i+1,cap:a.At(candidateId,22+i,3),level:a.At(candidateId,31+i,3),experience:a.At(candidateId,40+i,3)}))};const active=Array.from({length:a.GetWidth()},(_,id)=>a.At(id,0,2)>0);call('招募随机角色2',candidateId,true,0,0);const added=active.flatMap((was,id)=>!was&&a.At(id,0,2)>0?[id]:[]);if(added.length!==1)throw Error('原生招募未新增恰好一個角色');const recruited=(${snapshotBody})(added[0]);return {candidate,recruited};})()`);
 const q=report.recruitment.recruited,C=loadStateCore(state);report.recruitment.witnesses=Array.from(C.skillCapCombinations(q.quality,q.raw,q.talents,q.talentLevels,q.skills.map(s=>s.cap)));assert.ok(report.recruitment.witnesses.length,'Native generated recruit must have a common witness');report.tracked.push(q.id);observe(q.id);await saveStage('recruited',before);
 before=await capture();await evaluate(state,`(()=>{${prefix}for(const id of [10,11])for(let skill=1;skill<=9;skill++){const level=a.At(id,21+skill,2)-1;a.Set(id,30+skill,2,level);a.Set(id,39+skill,2,call('技艺升级经验',level)-1);}return true;})()`);await saveStage('experience-ready',before);
 report.timing={};before=await capture();report.timing.reached=await nativeExperience(state,[10,11]);validateNativeExperience(report.timing.reached,'reached');await saveStage('just-reached-cap',before);
 before=await capture();report.timing.capped=await nativeExperience(state,[10]);validateNativeExperience(report.timing.capped,'capped');await saveStage('already-capped',before);
 before=await capture();const old=(await nativeSnapshot(state,[11]))[0];report.timing.raised=await loadEditedCaps(state,11,old.skills.map(s=>s.cap+1));await saveStage('raised-cap',before);
 before=await capture();report.timing.afterRaise=await nativeExperience(state,[11]);validateNativeExperience(report.timing.afterRaise,'afterRaise');await saveStage('growth-after-raise',before);
 before=await capture();const transferSkills=await nativeSnapshot(state,ids);report.transfer=await evaluate(state,`(()=>{${prefix}const before=a.At(11,1,4);call('获得职业经验',11,0,'工作',1,0,0);const after=a.At(11,1,4),eligible=call('转职条件判断',11,3,0,0);if(after!==before+1||eligible!==1)throw Error('一次原生經驗未達轉職前置');call('转职',11,3,true);return {before,after,eligible,job:a.At(11,6,2)};})()`);report.transfer.skillsBefore=transferSkills;report.transfer.skillsAfter=await nativeSnapshot(state,ids);assertUnchangedSkills(transferSkills,report.transfer.skillsAfter);await saveStage('transfer',before);
 before=await capture();report.prison={before:(await nativeSnapshot(state,[10]))[0]};await evaluate(state,`(()=>{${prefix}call('角色下狱',10);return true;})()`);report.prison.after=(await nativeSnapshot(state,[10]))[0];assert.equal(report.prison.after.prison,2);await saveStage('imprisoned',before);
 before=await capture();report.recall={before:(await nativeSnapshot(state,[10]))[0]};await evaluate(state,`(()=>{${prefix}if(!(call('山寨人数',0)<call('山寨人数上限',0)))throw Error('召回缺少山寨名額前置');call('召回监牢人员',10);return true;})()`);report.recall.after=(await nativeSnapshot(state,[10]))[0];assert.equal(report.recall.after.prison,0);await saveStage('recalled',before);
 before=await capture();await evaluate(state,`(()=>{${prefix}for(const y of [13,14,15])a.Set(10,y,2,1);a.Set(10,3,2,2);return true;})()`);await saveStage('rebirth-ready',before);
 before=await capture();report.rebirth={before:(await nativeSnapshot(state,[10]))[0],bonusesBefore:[1,1,1],levelBefore:2};await evaluate(state,`(()=>{${prefix}call('角色重生',10,0,0);return true;})()`);await pause(300);report.rebirth.after=(await nativeSnapshot(state,[10]))[0];Object.assign(report.rebirth,await evaluate(state,`(()=>{${prefix}return {bonusesAfter:[13,14,15].map(y=>a.At(10,y,2)),levelAfter:a.At(10,3,2)};})()`));assertUnchangedSkills([report.rebirth.before],[report.rebirth.after]);await saveStage('reborn',before);
 before=await capture();await evaluate(state,`(()=>{${prefix}call('角色解雇',11,0,0,false);return true;})()`);await pause(300);report.dismissed={id:11,cleared:await cleared()};assert.equal(report.dismissed.cleared,true);await saveStage('dismissed',before);
 report.final=await capture();validateLifecycle(report,{scenario});fs.writeFileSync(file,JSON.stringify(report,null,2));console.log('PASS: native recruitment, named reset, all nine skill remainder phases and lifecycle with per-stage new-PID readback');return report;
}
async function main(){const args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1],p=opt('--state');await lifecycle(p,JSON.parse(fs.readFileSync(p,'utf8')),JSON.parse(fs.readFileSync(opt('--scenario'),'utf8')),args.includes('--compare'));}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={stages,validateNativeExperience,validateLifecycle,nativeExperience,loadEditedCaps,lifecycle};
