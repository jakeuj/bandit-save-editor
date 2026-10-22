#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {evaluate,waitMain}=require('./verify-game.cjs');
const {prefix,externalState}=require('./verify-random-character-growth.cjs');
const {checkpoint}=require('./verify-random-character-lifecycle.cjs');
const {nativeTalents,TALENT_CELLS}=require('./verify-random-character-talents.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Each stage runs one native function, checks the edited talents stay put, then saves and reloads under a new PID.
async function lifecycle(statePath,state,scenario,compare=false){
 externalState(state);await waitMain(state);const file=path.join(state.dir,'talents-lifecycle.json'),[kept,dismissed]=scenario.talentCharacters;
 const catalog=JSON.parse(fs.readFileSync(state.catalogPath||path.join(__dirname,'../knowledge/catalog.json'),'utf8'));
 const cleared=()=>evaluate(state,`(()=>{${prefix}return [2,4,5,12,16,20].every(z=>Array.from({length:a.GetHeight()},(_,y)=>a.At(${dismissed},y,z)).every(v=>v===0));})()`);
 if(compare){const prior=JSON.parse(fs.readFileSync(file,'utf8'));assert.deepEqual(await nativeTalents(state,[kept],catalog),prior.final);assert.equal(await cleared(),true);console.log('PASS: lifecycle result re-read after new-PID reload');return prior;}
 const initial=await nativeTalents(state,[kept,dismissed],catalog),events=[];
 for(const id of [kept,dismissed]){for(let y=0;y<60;y++)state.cells.push([id,y,2]);for(const y of TALENT_CELLS)state.cells.push([id,y,12]);}
 const stable=async(ids=[kept,dismissed])=>{const rows=await nativeTalents(state,ids,catalog);rows.forEach(r=>assert.deepEqual(r,initial.find(i=>i.id===r.id),`talents changed for ${r.id}`));return rows;};
 const stage=async(tag,event,body)=>{await evaluate(state,`(()=>{${prefix}${body};return true;})()`);await pause(300);await stable(tag==='dismissed'?[kept]:undefined);await checkpoint(statePath,state,tag);events.push(event);};
 // Template 0: 数值更新 must not refill talents from js.json.
 await stage('numeric-update','numericUpdate',"call('数值更新')");
 const transfer=await evaluate(state,`(()=>{${prefix}const before=a.At(${dismissed},1,4);call('获得职业经验',${dismissed},0,'工作',1,0,0);const after=a.At(${dismissed},1,4),eligible=call('转职条件判断',${dismissed},3,0,0);if(after!==before+1||eligible!==1)throw Error('One-step transfer prerequisite failed');call('转职',${dismissed},3,true);return {before,after,job:a.At(${dismissed},6,2)};})()`);
 assert.equal(transfer.job,3);state.cells.push([dismissed,1,4],[dismissed,1,5],[dismissed,3,4],[dismissed,3,5]);await stable();await checkpoint(statePath,state,'transfer');events.push('transfer');
 await stage('imprisoned','prison',`call('角色下狱',${kept});if(a.At(${kept},55,2)!==2)throw Error('Prison did not take effect')`);
 await stage('recalled','recall',`call('召回监牢人员',${kept});if(a.At(${kept},55,2)!==0)throw Error('Prison recall did not take effect')`);
 await stage('rebirth','rebirth',`call('角色重生',${kept},0,0)`);
 await evaluate(state,`(()=>{${prefix}call('角色解雇',${dismissed},0,0,false);return true;})()`);await pause(300);
 assert.equal(await cleared(),true,'Dismiss must clear every character plane');await stable([kept]);
 for(const z of [4,5,12,16,20])for(let y=0;y<60;y++)state.cells.push([dismissed,y,z]);await checkpoint(statePath,state,'dismissed');events.push('dismiss');
 const result={scenario:path.basename(process.argv[process.argv.indexOf('--scenario')+1]||''),events,transfer,initial,final:await nativeTalents(state,[kept],catalog),pids:state.assertions.map(a=>a.pid)};
 fs.writeFileSync(file,JSON.stringify(result,null,2));console.log('PASS: numeric update, transfer, prison/recall, rebirth and dismissal keep or clear talents natively');return result;
}
async function main(){const args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1],p=opt('--state');await lifecycle(p,JSON.parse(fs.readFileSync(p)),JSON.parse(fs.readFileSync(opt('--scenario'))),args.includes('--compare'));}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={lifecycle};
