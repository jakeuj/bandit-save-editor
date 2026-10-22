#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const {evaluate,waitMain}=require('./verify-game.cjs');
const {prefix,externalState,nativeSnapshot,near}=require('./verify-random-character-growth.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function checkpoint(statePath,state,tag){
 state.cells=[...new Map(state.cells.map(c=>[c.join(','),c])).values()];
 state.expected=await evaluate(state,`(()=>{${prefix}return ${JSON.stringify(state.cells)}.map(([x,y,z])=>a.At(x,y,z));})()`);
 fs.writeFileSync(statePath,JSON.stringify(state,null,2));
 for(const action of [['--save'],['--assert','--quiet'],['--stop'],['--restart'],['--load','--mode','存档'],['--assert','--quiet']]){
  let r;for(let attempt=0;attempt<8;attempt++){if(attempt)await pause(1000);r=spawnSync(process.execPath,[path.join(__dirname,'verify-game.cjs'),'--state',statePath,...action],{encoding:'utf8',timeout:60000});if(r.status===0)break;if(!['--restart','--load'].includes(action[0]))break;}
  if(r.status!==0)throw Error(`${tag} ${action[0]}: ${r.stderr||r.stdout}`);
 }
 Object.assign(state,JSON.parse(fs.readFileSync(statePath,'utf8')));assert.notEqual(state.pid,state.previousPid,'Checkpoint must use new PID');console.log('PASS: lifecycle checkpoint '+tag+' saved and reloaded with new PID');
}
async function lifecycle(statePath,state,scenario,compare=false){
 externalState(state);await waitMain(state);const file=path.join(state.dir,'random-growth-lifecycle.json');
 if(compare){const prior=JSON.parse(fs.readFileSync(file,'utf8'));const current=await nativeSnapshot(state,[1]);assert.deepEqual(current,prior.final);const cleared=await evaluate(state,`(()=>{${prefix}return [2,4,5,12,16,20].every(z=>Array.from({length:a.GetHeight()},(_,y)=>a.At(2,y,z)).every(v=>v===0));})()`);assert.equal(cleared,true);return;}
 const initial=await nativeSnapshot(state,[1,2]),events=[];
 for(const id of [1,2]){for(let y=0;y<60;y++)state.cells.push([id,y,2]);for(const y of [1,2,3,21,22,23])state.cells.push([id,y,12]);}
 const stable=async()=>{const rows=await nativeSnapshot(state,[1,2]);rows.forEach((r,i)=>{assert.deepEqual(r.raw,initial[i].raw);assert.deepEqual(r.talents,initial[i].talents);});return rows;};
 await evaluate(state,`(()=>{${prefix}call('数值更新');return true;})()`);await stable();await checkpoint(statePath,state,'numeric-update');events.push('numericUpdate');
 const pills=await evaluate(state,`(()=>{${prefix}return ${JSON.stringify(scenario.growthPills)}.map(p=>{const before={count:a.At(p.id,6,0),bonus:a.At(1,12+p.aptitude,2),raw:a.At(1,9+p.aptitude,2),base:call('属性计算',1,103+p.aptitude),cap:call('角色资质上限',1,['力量','敏捷','智力'][p.aptitude-1])};call('服用普通丹药',p.id,1,1);return {p,before,count:a.At(p.id,6,0),bonus:a.At(1,12+p.aptitude,2)};});})()`);
 for(const row of pills){const {p,before}=row;assert.equal(row.count,before.count-1,'native pill consumed');const expected=Math.min(Math.max(Math.min(Math.max(before.bonus+p.effect*10,0),p.cap*10-before.raw),0),(before.cap-before.base)*10);near(row.bonus,expected,'native double clamp');state.cells.push([p.id,6,0]);}
 await stable();await checkpoint(statePath,state,'pills');events.push('pills');
 const transfer=await evaluate(state,`(()=>{${prefix}const before=a.At(2,1,4);call('获得职业经验',2,0,'工作',1,0,0);const after=a.At(2,1,4),eligible=call('转职条件判断',2,3,0,0);if(after!==before+1||eligible!==1)throw Error('One-step transfer prerequisite failed');call('转职',2,3,true);return {before,after,job:a.At(2,6,2)};})()`);assert.equal(transfer.job,3);state.cells.push([2,1,4],[2,1,5],[2,3,4],[2,3,5]);await stable();await checkpoint(statePath,state,'transfer');events.push('transfer');
 await evaluate(state,`(()=>{${prefix}call('角色下狱',1);if(a.At(1,55,2)!==2)throw Error('Prison did not take effect');return true;})()`);await stable();await checkpoint(statePath,state,'imprisoned');events.push('prison');
 await evaluate(state,`(()=>{${prefix}call('召回监牢人员',1);if(a.At(1,55,2)!==0)throw Error('Prison recall did not take effect');return true;})()`);await stable();await checkpoint(statePath,state,'recalled');events.push('recall');
 await evaluate(state,`(()=>{${prefix}call('角色重生',1,0,0);return true;})()`);await pause(300);const reborn=await stable();assert.deepEqual(reborn[0].bonuses,[0,0,0]);await checkpoint(statePath,state,'rebirth');events.push('rebirth');
 await evaluate(state,`(()=>{${prefix}call('角色解雇',2,0,0,false);return true;})()`);await pause(300);
 const clear=await evaluate(state,`(()=>{${prefix}return [2,4,5,12,16,20].every(z=>Array.from({length:a.GetHeight()},(_,y)=>a.At(2,y,z)).every(v=>v===0));})()`);assert.equal(clear,true,'Dismiss must clear every character plane');
 for(const z of [4,5,12,16,20])for(let y=0;y<60;y++)state.cells.push([2,y,z]);await checkpoint(statePath,state,'dismissed');events.push('dismiss');
 const result={events,pills,transfer,final:await nativeSnapshot(state,[1]),checks:{numericUpdate:true,nativePills:true,nativeTransfer:true,nativePrison:true,nativeRebirth:true,nativeDismiss:true,stageRoundtrips:true}};
 fs.writeFileSync(file,JSON.stringify(result,null,2));console.log('PASS: numeric update, pills, transfer, prison/recall, rebirth and dismissal');return result;
}
async function main(){const args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1],p=opt('--state');await lifecycle(p,JSON.parse(fs.readFileSync(p)),JSON.parse(fs.readFileSync(opt('--scenario'))),args.includes('--compare'));}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={lifecycle,checkpoint};
