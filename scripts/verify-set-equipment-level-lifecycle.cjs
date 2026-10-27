#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const {evaluate,waitMain}=require('./verify-game.cjs'),{rpc}=require('./verify-set-equipment-level-native.cjs'),D=require('./set-equipment-level-data.cjs');
function storedConversion(request){
 const r=self.__banditValidationRuntime,m=r.GetEventSheetManager(),a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();
 const call=(name,...args)=>{const f=m.GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};
 const row=request.before.slice();row[7]=request.owner;row.forEach((v,y)=>a.Set(1,y,9,v));request.material.forEach((v,y)=>a.Set(1,y,18,v));
 for(let slot=1;slot<=6;slot++)a.Set(1,15+slot,2,slot===request.slot&&request.owner?1:0);
 a.Set(1,2,0,1e12);m.GetEventVariableBySID(551767285314451).SetValue(1);m.GetEventVariableBySID(990563423582099).SetValue(1);m.GetEventVariableBySID(158219813858328).SetValue(9);
 call('套装合成',request.templateId);
 return {before:row,after:Array.from({length:60},(_,y)=>a.At(1,y,9)),refs:Array.from({length:6},(_,s)=>a.At(1,16+s,2))};
}
function validateCycle(report,expected,slot){
 assert.deepEqual(report.initial,expected);const final=report.steps.at(-1);assert.equal(final.phase,'unequip');
 for(const step of report.steps){for(let y=0;y<60;y++)if(y!==7)assert.equal(step.record[y],expected[y],'搬移欄位 '+y);assert.equal(step.record[7],step.phase==='equip'?1:0);if(step.phase==='equip')assert.equal(step.refs[slot-1],step.id);else assert.equal(step.refs[slot-1],0);}
 assert.ok(report.steps.some(s=>s.phase==='equip'));assert.ok(report.steps.some(s=>s.phase==='unequip'));return true;
}
function validateStored(v,g,owner,slot){assert.deepEqual(v.before,g.before.map((x,y)=>y===7?owner:x));const after=g.after.map((x,y)=>y===7?owner:x);assert.deepEqual(v.after,after);assert.equal(v.refs[slot-1],owner?1:0);return true;}
async function nativeCycle(request){
 const r=self.__banditValidationRuntime,m=r.GetEventSheetManager(),a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();
 const call=(name,...args)=>{const f=m.GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};
 const pause=()=>new Promise(resolve=>setTimeout(resolve,500)),record=(id,z)=>Array.from({length:60},(_,y)=>a.At(id,y,z)),refs=()=>Array.from({length:6},(_,s)=>a.At(1,16+s,2));
 const initial=record(1,request.plane),steps=[];let bag=1,z9=1;const find=z=>{for(let id=1;id<a.GetWidth();id++)if(a.At(id,0,z)>0&&a.At(id,1,z)===initial[1])return id;throw Error('Cycle destination absent '+z+' refs '+JSON.stringify(refs()));};
 if(request.plane===9){if(initial[7])call('卸下装备',request.slot,1,1,false,false,7);else call('装备库取出',1,true,0,7);await pause();bag=find(7);steps.push({phase:'takeout',id:bag,plane:7,record:record(bag,7),refs:refs()});}
 call('穿戴装备',request.slot,bag,1,false,false,7);await pause();z9=a.At(1,15+request.slot,2);steps.push({phase:'equip',id:z9,plane:9,record:record(z9,9),refs:refs()});
 if(!z9)throw Error('Native equip did not set role pointer '+JSON.stringify(steps));
 call('刷新单角色全属性',1,true,0);call('卸下装备',request.slot,z9,1,false,false,7);await pause();bag=find(7);steps.push({phase:'unequip',id:bag,plane:7,record:record(bag,7),refs:refs()});return {initial,steps,locations:[{id:bag,plane:7},{id:z9,plane:9}]};
}
function cases(k,baselines){const result=[];for(const state of ['backpack','stored','equipped'])for(const quality of [1,6])for(const direction of ['up','down']){
 const index=result.length,tier=(quality===6?1:0)^(direction==='down'?1:0)?9:1,format=['百分比','倍率','整数'][Math.floor(index/4)];
 const select=exact=>Object.keys(k.setEquipmentLevel.items).map(Number).find(id=>{const t=k.setEquipmentLevel.items[id];return (!exact||t.tier===tier)&&k.setEquipmentLevel.sets[t.setLink].effects.some(e=>e.format===format);});const templateId=select(true)||select(false);assert.ok(templateId,'缺生命週期代表');
 const native=baselines.find(v=>v.templateId===templateId&&v.quality===quality&&v.after[23]===3);assert.ok(native);
 const from=direction==='up'?1:10+5*(quality-1),to=direction==='up'?2:from-1;result.push({id:`${state}-${quality}-${direction}`,state,quality,direction,tier:k.setEquipmentLevel.items[templateId].tier,format,templateId,from,to,native});
 }assert.equal(result.length,12);return result;}
function command(args){const p=spawnSync(process.execPath,[path.join(__dirname,'verify-game.cjs'),...args],{encoding:'utf8',windowsHide:true,maxBuffer:2e6,timeout:90000});if(p.status!==0)throw Error(p.stderr||p.stdout);return p.stdout;}
async function checkpoint(stateFile){let s=JSON.parse(fs.readFileSync(stateFile));await waitMain(s);const cells=[];for(let id=1;id<=12;id++)for(const z of [7,9])for(let y=0;y<60;y++)cells.push([id,y,z]);for(let slot=1;slot<=6;slot++)cells.push([1,15+slot,2]);s.cells=cells;s.expected=await evaluate(s,`(()=>{const a=self.__banditValidationRuntime.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();return ${JSON.stringify(cells)}.map(([x,y,z])=>a.At(x,y,z));})()`);fs.writeFileSync(stateFile,JSON.stringify(s));command(['--state',stateFile,'--save']);command(['--state',stateFile,'--assert']);command(['--state',stateFile,'--stop']);command(['--state',stateFile,'--restart']);command(['--state',stateFile,'--load','--mode','存档']);command(['--state',stateFile,'--assert']);return JSON.parse(fs.readFileSync(stateFile));}
async function runSuite({k,source,inputs,out,sourceEntry}){
 const baseline=JSON.parse(fs.readFileSync(path.join(out,'native-baselines.json'))),copyCases=cases(k,baseline.results),file=path.join(out,'lifecycle-results.json'),binding={coreHash:D.hash(source),dataHash:D.hash(k.setEquipmentLevel),fingerprints:{...k.fingerprints,...k.batch2Fingerprints},runnerHash:D.hash(fs.readFileSync(__filename,'utf8'))};
 const result=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{binding,copies:[]};assert.deepEqual(result.binding,binding);
 for(const [index,c]of copyCases.entries()){
  if(result.copies.some(v=>v.id===c.id))continue;const plane=c.state==='backpack'?7:9,slot=k.setEquipmentLevel.items[c.templateId].slot,record=c.native.after.map((v,y)=>y===6?c.from:y===7&&c.state==='equipped'?1:v);
  const baselineCells=[];const size=JSON.parse(fs.readFileSync(inputs.baseline,'utf8').replace(/^\uFEFF/,'')).size;
  for(let x=1;x<size[0];x++){for(const z of [7,9,18])for(let y=0;y<60;y++)baselineCells.push([x,y,z,0]);for(let s=1;s<=6;s++)baselineCells.push([x,15+s,2,0]);}
  record.forEach((v,y)=>baselineCells.push([1,y,plane,v]));if(c.state==='equipped')baselineCells.push([1,15+slot,2,1]);
  const scenario={baseline:baselineCells,operations:[{method:'setEquipmentLevel',options:{itemId:1,plane,level:c.to}}],observe:Array.from({length:60},(_,y)=>[1,y,plane])};
  const scenarioFile=path.join(out,'life-'+c.id+'.json');fs.writeFileSync(scenarioFile,JSON.stringify(scenario));const candidate=structuredClone(k);for(const group of D.groups)candidate.verification[group]=false;const catalogFile=path.join(out,'candidate.json');fs.writeFileSync(catalogFile,JSON.stringify(candidate));
  let stateFile;try{
   const setup=command(['--setup','--source',sourceEntry.source,'--runtime',sourceEntry.runtime,'--save-file',inputs.baseline,'--catalog',catalogFile,'--artifacts',out,'--scenario',scenarioFile,'--port',String(19400+index)]);stateFile=setup.match(/STATE (.+)/)[1].trim();command(['--state',stateFile,'--load']);let s=JSON.parse(fs.readFileSync(stateFile));await waitMain(s);
   const expected=record.map((v,y)=>y===6?c.to:v),initial=await rpc(s,{op:'observe',locations:[{id:1,plane}]});assert.deepEqual(initial.records[0].record,expected);
   s=await checkpoint(stateFile);const reload=await rpc(s,{op:'observe',locations:[{id:1,plane}]});assert.deepEqual(reload,initial);
   // Occupy z9 row 1 for backpack cases so the real move must choose a different row than retained y0.
   if(plane===7)await evaluate(s,`(()=>{const a=self.__banditValidationRuntime.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();${JSON.stringify(c.native.before)}.forEach((v,y)=>a.Set(1,y,9,v));return true;})()`);
   const cycle=await evaluate(s,`(${nativeCycle.toString()})(${JSON.stringify({plane,slot})})`);validateCycle(cycle,expected,slot);if(plane===7)assert.notEqual(cycle.steps.find(v=>v.phase==='equip').id,expected[0]);
   let conversion=null;if(plane===9){conversion=await evaluate(s,`(${storedConversion.toString()})(${JSON.stringify({before:c.native.before,material:c.native.material,templateId:c.templateId,slot,owner:c.state==='equipped'?1:0})})`);validateStored(conversion,c.native,c.state==='equipped'?1:0,slot);}
   const beforeFinal=await rpc(s,{op:'observe',locations:cycle.locations});s=await checkpoint(stateFile);const afterFinal=await rpc(s,{op:'observe',locations:cycle.locations});assert.deepEqual(afterFinal,beforeFinal);
   const copy={id:c.id,group:plane===7?D.groups[0]:D.groups[1],case:c,slot,expected,initial,reload,cycle,conversion,beforeFinal,afterFinal,stateFile,source:{fingerprints:s.fingerprints,sourceHashes:s.sourceHashes,originalHashes:Object.values(s.before),assertions:s.assertions},steam:JSON.parse(fs.readFileSync(path.join(s.dir,'steam-init.json')))};
   command(['--state',stateFile,'--stop']);result.copies.push(copy);fs.writeFileSync(file+'.tmp',JSON.stringify(result));fs.renameSync(file+'.tmp',file);console.log('set lifecycle '+result.copies.length+'/12 '+c.id);
  }finally{if(stateFile)try{command(['--state',stateFile,'--stop']);}catch{}}
 }return result;
}
module.exports={storedConversion,nativeCycle,validateCycle,validateStored,cases,command,checkpoint,runSuite};
if(require.main===module){const args=process.argv.slice(2),opt=n=>args[args.indexOf(n)+1],cfg=JSON.parse(fs.readFileSync(opt('--config'))),k=JSON.parse(fs.readFileSync(path.join(__dirname,'../knowledge/catalog.json'))),source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');runSuite({k,source,inputs:cfg,out:cfg.out,sourceEntry:cfg.sourceEntry}).then(()=>process.stdout.write('',()=>process.exit(0))).catch(e=>{console.error(e.stack);process.stderr.write('',()=>process.exit(1));});}
