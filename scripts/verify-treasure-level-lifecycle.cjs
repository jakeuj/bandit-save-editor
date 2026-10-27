#!/usr/bin/env node
'use strict';
// Treasure lifecycle IO shard: native equip / unequip / replace slot 6, original-format save and new-PID reload.
// Disposable hidden copies only. Calibration-grade until the final matrix runs against the final core.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {evaluate,waitMain}=require('./verify-game.cjs'),V=require('./verify-treasure-level-native.cjs'),O=require('./treasure-level-oracle.cjs'),D=require('./treasure-level-data.cjs');
const {rpc,command,firstOf}=V,root=path.resolve(__dirname,'..');
const SLOT=6,POINTER=15+SLOT;
async function nativeCycle(request){
 const r=self.__banditValidationRuntime,m=r.GetEventSheetManager(),a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();
 const call=(name,...args)=>{const f=m.GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};
 const pause=()=>new Promise(resolve=>setTimeout(resolve,500)),record=(id,z)=>Array.from({length:60},(_,y)=>a.At(id,y,z)),refs=()=>Array.from({length:6},(_,s)=>a.At(1,16+s,2));
 const initial=record(1,request.plane),steps=[];let bag=1,z9=1;
 const find=z=>{for(let id=1;id<a.GetWidth();id++)if(a.At(id,0,z)>0&&a.At(id,1,z)===initial[1])return id;throw Error('Cycle destination absent '+z+' refs '+JSON.stringify(refs()));};
 if(request.plane===9){if(request.worn)call('卸下装备',request.slot,1,1,false,false,7);else call('装备库取出',1,true,0,7);await pause();bag=find(7);steps.push({phase:'takeout',id:bag,plane:7,record:record(bag,7),refs:refs(),source:record(1,9)});}
 call('穿戴装备',request.slot,bag,1,false,false,7);await pause();z9=a.At(1,15+request.slot,2);steps.push({phase:'equip',id:z9,plane:9,record:record(z9,9),refs:refs(),source:record(bag,7)});
 if(!z9)throw Error('Native equip did not set role pointer '+JSON.stringify(steps));
 call('刷新单角色全属性',1,true,0);call('卸下装备',request.slot,z9,1,false,false,7);await pause();bag=find(7);steps.push({phase:'unequip',id:bag,plane:7,record:record(bag,7),refs:refs(),source:record(z9,9)});
 return {initial,steps,worn:!!request.worn,locations:[{id:bag,plane:7},{id:z9,plane:9}]};
}
// Wear the unequipped item, generate a different treasure natively, wear it over slot 6 and observe the swap.
async function nativeReplace(request){
 const r=self.__banditValidationRuntime,m=r.GetEventSheetManager(),a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();
 const call=(name,...args)=>{const f=m.GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};
 const pause=()=>new Promise(resolve=>setTimeout(resolve,500)),record=(id,z)=>Array.from({length:60},(_,y)=>a.At(id,y,z)),refs=()=>Array.from({length:6},(_,s)=>a.At(1,16+s,2));
 const find=(z,tpl)=>{for(let id=1;id<a.GetWidth();id++)if(a.At(id,0,z)>0&&a.At(id,1,z)===tpl)return id;throw Error('Replace row absent '+tpl+' / '+z+' refs '+JSON.stringify(refs()));};
 const first=record(request.bag,7);call('穿戴装备',request.slot,request.bag,1,false,false,7);await pause();
 const firstRow=a.At(1,15+request.slot,2),firstWorn=record(firstRow,9);
 call('获得物品',true,request.template,request.quality,request.level,request.tier,95+30*(request.quality-1),1,false,0,'特定装备',false,false);
 const second=find(7,request.template),secondBefore=record(second,7);
 call('穿戴装备',request.slot,second,1,false,false,7);await pause();
 const pointer=a.At(1,15+request.slot,2),worn=record(pointer,9),returned=find(7,first[1]),returnedRecord=record(returned,7);
 return {first,firstWorn,secondBefore,pointer,worn,returned,returnedRecord,refs:refs(),stillWornFirst:a.At(firstRow,0,9)>0&&a.At(firstRow,1,9)===first[1]?record(firstRow,9):null};
}
const near=(a,b)=>a.every((v,y)=>v===b[y]);
function validateCycle(report,expected){
 assert.deepEqual(report.initial,expected);const final=report.steps.at(-1);assert.equal(final.phase,'unequip');
 for(const step of report.steps){for(let y=0;y<50;y++)if(y!==7)assert.equal(step.record[y],expected[y],'搬移欄位 '+y);assert.equal(step.record[7],step.phase==='equip'?1:step.phase==='takeout'?(report.worn?0:expected[7]):0,'owner '+step.phase);// 裝備庫取出 keeps the stored owner (stale owner included); taking a worn item off (worn) and unequip clear it.
  if(step.phase==='equip')assert.equal(step.refs[SLOT-1],step.id);else assert.equal(step.refs[SLOT-1],0);
  // Moves copy and clear y0-49 only; the source keeps y50-59 and the destination does not receive them (observed below, pinned per run).
  for(let y=0;y<50;y++)assert.equal(step.source[y],0,'來源搬移後未清除 y'+y);}
 assert.ok(report.steps.some(s=>s.phase==='equip'));return true;
}
// y50-59 monitoring: markers seeded in the source row must stay at the source and never appear in the destination.
function monitorTail(report,markers){
 return report.steps.map(step=>({phase:step.phase,destination:step.record.slice(50),source:step.source.slice(50),sourceKeepsMarkers:markers.every((v,i)=>step.source[50+i]===v||step.source[50+i]===0),destinationHasMarkers:markers.some((v,i)=>step.record[50+i]===v)}));
}
function validateReplace(v,secondTemplate){
 assert.equal(v.refs[SLOT-1],v.pointer,'第 6 槽指標');assert.equal(v.worn[1],secondTemplate);assert.equal(v.worn[7],1);
 for(let y=0;y<50;y++)if(y!==7)assert.equal(v.worn[y],v.secondBefore[y],'新穿戴欄位 '+y);
 // Observed native behaviour: the displaced treasure returns to z7 keeping its stale owner y7=1 (not cleared by the replace path).
 assert.equal(v.returnedRecord[7],1,'被替換者原生保留舊 owner');for(let y=0;y<50;y++)if(y!==7)assert.equal(v.returnedRecord[y],v.first[y],'被替換欄位 '+y);
 assert.equal(v.stillWornFirst,null,'被替換者不應留在 z9 原列');return true;
}
function cases(k){
 const tiers={'1:up':1,'1:down':4,'6:up':6,'6:down':2},out=[];
 for(const state of ['backpack','stored','equipped'])for(const quality of [1,6])for(const direction of ['up','down']){
  const tier=tiers[quality+':'+direction],cap=O.cap(quality),from=direction==='up'?1:cap;
  out.push({id:`${state}-${quality}-${direction}`,state,quality,direction,tier,templateId:firstOf(k,tier),from,to:direction==='up'?2:cap-1});
 }
 // Observed native stale owner: replaced treasures keep y7=1 without any slot pointer (z7 or stored z9).
 for(const [state,quality,direction] of [['stale-backpack',1,'up'],['stale-backpack',6,'down'],['stale-stored',1,'down'],['stale-stored',6,'up']]){
  const tier=tiers[quality+':'+direction],cap=O.cap(quality),from=direction==='up'?1:cap;
  out.push({id:`${state}-${quality}-${direction}`,state,quality,direction,tier,templateId:firstOf(k,tier),from,to:direction==='up'?2:cap-1});
 }
 return out;
}
const SMOKE=['backpack-1-up','stored-6-down','equipped-1-up'];
async function checkpoint(stateFile){
 let s=JSON.parse(fs.readFileSync(stateFile));await waitMain(s);const cells=[];
 for(let id=1;id<=12;id++)for(const z of [7,9])for(let y=0;y<60;y++)cells.push([id,y,z]);for(let slot=1;slot<=6;slot++)cells.push([1,15+slot,2]);
 s.cells=cells;s.expected=await evaluate(s,`(()=>{const a=self.__banditValidationRuntime.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();return ${JSON.stringify(cells)}.map(([x,y,z])=>a.At(x,y,z));})()`);
 fs.writeFileSync(stateFile,JSON.stringify(s));
 command(['--state',stateFile,'--save']);command(['--state',stateFile,'--assert']);command(['--state',stateFile,'--stop']);command(['--state',stateFile,'--restart']);command(['--state',stateFile,'--load','--mode','存档']);command(['--state',stateFile,'--assert']);
 return JSON.parse(fs.readFileSync(stateFile));
}
async function ensureBaselines({k,cfg,out,list}){
 const file=path.join(out,'treasure-baselines.json'),have=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{results:{}};
 const need=list.filter(c=>!have.results[`${c.templateId}:${c.quality}:${c.from}`]);
 if(!need.length)return have.results;
 let stateFile;try{
  stateFile=command(['--setup','--source',cfg.source,'--runtime',cfg.runtime,'--save-file',cfg.baseline,'--artifacts',out,'--port','19480']).match(/STATE (.+)/)[1].trim();
  command(['--state',stateFile,'--load']);const state=JSON.parse(fs.readFileSync(stateFile));await waitMain(state);await rpc(state,{op:'initialize'});
  const got=await rpc(state,{op:'generate',items:need.map(c=>({templateId:c.templateId,tier:c.tier,quality:c.quality,level:c.from}))});
  got.forEach((g,i)=>{assert.equal(g.record[6],need[i].from);assert.equal(g.record[5],need[i].quality);have.results[`${need[i].templateId}:${need[i].quality}:${need[i].from}`]=g.record;});
 }finally{if(stateFile)try{command(['--state',stateFile,'--stop']);}catch{}}
 fs.writeFileSync(file,JSON.stringify(have));return have.results;
}
async function runCase({k,cfg,out,c,baselines,index,replace}){
 const plane=['backpack','stale-backpack'].includes(c.state)?7:9,equipped=c.state==='equipped',stale=c.state.startsWith('stale'),native=baselines[`${c.templateId}:${c.quality}:${c.from}`];
 const markers=Array.from({length:10},(_,i)=>100+i),record=native.map((v,y)=>y===7?(equipped||stale?1:0):y>=50?markers[y-50]:v),expected=record.map((v,y)=>y===6?c.to:v);
 const baselineCells=[],size=JSON.parse(fs.readFileSync(cfg.baseline,'utf8').replace(/^﻿/,'')).size;
 for(let x=1;x<size[0];x++){for(const z of [7,9,18])for(let y=0;y<60;y++)baselineCells.push([x,y,z,0]);for(let s=1;s<=6;s++)baselineCells.push([x,15+s,2,0]);}
 record.forEach((v,y)=>baselineCells.push([1,y,plane,v]));if(equipped)baselineCells.push([1,POINTER,2,1]);
 const scenario={baseline:baselineCells,operations:[{method:'setEquipmentLevel',options:{itemId:1,plane,level:c.to}}],observe:Array.from({length:60},(_,y)=>[1,y,plane])};
 const scenarioFile=path.join(out,'life-'+c.id+'.json');fs.writeFileSync(scenarioFile,JSON.stringify(scenario));
 // The disposable copy's loader opens every group that exists in the catalog, so register both treasure groups as closed candidates.
 const candidate=structuredClone(k);candidate.verification.backpackTreasureLevel=false;candidate.verification.treasureLevel=false;
 const catalogFile=path.join(out,'candidate.json');fs.writeFileSync(catalogFile,JSON.stringify(candidate));
 let stateFile;try{
  stateFile=command(['--setup','--source',cfg.source,'--runtime',cfg.runtime,'--save-file',cfg.baseline,'--catalog',catalogFile,'--artifacts',out,'--scenario',scenarioFile,'--port',String(19500+index)]).match(/STATE (.+)/)[1].trim();
  command(['--state',stateFile,'--load']);let s=JSON.parse(fs.readFileSync(stateFile));await waitMain(s);
  const initial=await rpc(s,{op:'observe',locations:[{id:1,plane}]});assert.deepEqual(initial.records[0].record,expected,'編輯後存檔載入列');
  s=await checkpoint(stateFile);const reload=await rpc(s,{op:'observe',locations:[{id:1,plane}]});assert.deepEqual(reload,initial,'新 PID 讀回');
  if(plane===7)await evaluate(s,`(()=>{const a=self.__banditValidationRuntime.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();${JSON.stringify(record)}.forEach((v,y)=>a.Set(1,y,9,v));return true;})()`);
  const cycle=await evaluate(s,`(${nativeCycle.toString()})(${JSON.stringify({plane,slot:SLOT,worn:equipped})})`);validateCycle(cycle,expected);const tail=monitorTail(cycle,markers);
  if(plane===7)assert.notEqual(cycle.steps.find(v=>v.phase==='equip').id,expected[0],'搬移應選不同目的列');
  let replaced=null;
  if(replace){
   const other=firstOf(k,c.tier===6?5:c.tier+1);
   replaced=await evaluate(s,`(${nativeReplace.toString()})(${JSON.stringify({slot:SLOT,bag:cycle.steps.at(-1).id,template:other,tier:k.treasureLevel.items[other].tier,quality:c.quality,level:1})})`);fs.writeFileSync(path.join(out,'replace-observation-'+c.id+'.json'),JSON.stringify(replaced));validateReplace(replaced,other);
  }
  const locations=replaced?[{id:replaced.pointer,plane:9},{id:replaced.returned,plane:7}]:cycle.locations;
  const beforeFinal=await rpc(s,{op:'observe',locations});s=await checkpoint(stateFile);const afterFinal=await rpc(s,{op:'observe',locations});assert.deepEqual(afterFinal,beforeFinal,'最終新 PID 讀回');
  const entry={id:c.id,case:c,expected,initial,reload,cycle,tail,replaced,beforeFinal,afterFinal,assertions:s.assertions,originalHashes:Object.values(s.before||{}),pids:[...new Set((s.assertions||[]).map(v=>v.pid))]};
  return entry;
 }finally{if(stateFile)try{command(['--state',stateFile,'--stop']);}catch{}}
}
async function main(argv){
 const opt=n=>argv.includes(n)?argv[argv.indexOf(n)+1]:undefined,cfg=JSON.parse(fs.readFileSync(opt('--config'))),k=JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'))),out=require('./migration-source.cjs').external(cfg.out+'/lifecycle');
 const only=(opt('--only')==='all'?cases(k).map(c=>c.id):opt('--only')?opt('--only').split(','):SMOKE),list=cases(k).filter(c=>only.includes(c.id));assert.equal(list.length,only.length,'未知案例');
 const baselines=await ensureBaselines({k,cfg,out,list}),file=path.join(out,'treasure-lifecycle.json'),core=fs.readFileSync(path.join(root,'src/core.js'),'utf8'),binding={coreHash:D.hash(core),dataHash:D.hash(k.treasureLevel),fingerprints:{...k.fingerprints,...k.batch2Fingerprints},runnerHash:D.hash(fs.readFileSync(__filename,'utf8').split(String.fromCharCode(13)).join('')),driverHash:D.hash(require('./treasure-level-native.cjs').nativeDriver.toString())},
  result=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{mode:'native',binding,copies:[]};
 assert.deepEqual(result.binding,binding,'生命週期結果的核心／規則／runner 綁定與目前不符，須刪除重建');
 for(const [index,c] of list.entries()){
  if(result.copies.some(v=>v.id===c.id))continue;
  result.copies.push(await runCase({k,cfg,out,c,baselines,index,replace:c.state==='equipped'}));fs.writeFileSync(file+'.tmp',JSON.stringify(result));fs.renameSync(file+'.tmp',file);console.log('treasure lifecycle '+result.copies.length+'/'+list.length+' '+c.id);
 }
}
module.exports={checkpoint,nativeCycle,nativeReplace,validateCycle,validateReplace,cases,SMOKE};
if(require.main===module)main(process.argv.slice(2)).then(()=>process.stdout.write('',()=>process.exit(0))).catch(e=>{console.error(e.stack);process.exitCode=1;});
