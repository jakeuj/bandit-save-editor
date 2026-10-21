#!/usr/bin/env node
'use strict';
// Runs only against a state produced by verify-game.cjs; private results stay with that state.
const fs=require('node:fs'),path=require('node:path');
const {evaluate,waitMain}=require('./verify-game.cjs');
const args=process.argv.slice(2),value=(flag,fallback)=>{const i=args.indexOf(flag);return i<0?fallback:args[i+1];};
async function run(){
 const statePath=value('--state');if(!statePath)throw Error('--state is required');
 const state=JSON.parse(fs.readFileSync(statePath,'utf8')),item=Number(value('--item','3'));
 await waitMain(state);
 const result=await evaluate(state,`(()=>{
  const r=self.__banditValidationRuntime,a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();
  if(r.GetMainRunningLayout().GetName()!=='主界面')throw Error('Main layout not ready');
  const call=(name,...args)=>{const f=r.GetEventSheetManager().GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};
  const item=${item},owner=a.At(item,7,9);
  const equipment=Array.from({length:115},(_,id)=>call('装备属性计算',owner,id,0,0,0,0,0,0,0));
  const bonuses=Array.from({length:70},(_,id)=>call('加成属性效果',id));
  return {equipment,bonuses,allFinite:equipment.every(Number.isFinite)&&bonuses.every(Number.isFinite),level:a.At(item,6,9),owner};
 })()`);
 if(!result.allFinite)throw Error('Non-finite native effects');
 const file=path.join(state.dir,'advanced-effects.json');
 if(args.includes('--compare')){
  const expected=JSON.parse(fs.readFileSync(file,'utf8'));
  if(JSON.stringify(result)!==JSON.stringify(expected))throw Error('Native effects differ after restart');
 }else fs.writeFileSync(file,JSON.stringify(result,null,2));
 console.log('PASS: finite native equipment attributes and technology bonuses'+(args.includes('--compare')?', identical after restart':''));
}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
