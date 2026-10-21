#!/usr/bin/env node
'use strict';
// Native checks only for disposable states; all outputs stay beside the private state.
const fs=require('fs'),path=require('path');const {evaluate,waitMain}=require('./verify-game.cjs');
const args=process.argv.slice(2),option=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
async function main(){
 const state=JSON.parse(fs.readFileSync(option('--state'))),character=Number(option('--character','1'));await waitMain(state);
 const result=await evaluate(state,`(()=>{const r=self.__banditValidationRuntime,a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();const call=(name,...args)=>{const f=r.GetEventSheetManager().GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};const id=${character};return {base:[104,105,106].map(v=>call('属性计算',id,v)),caps:['力量','敏捷','智力'].map(v=>call('角色资质上限',id,v)),aptitudes:[1,2,3].map(v=>call('角色资质计算',id,v)),bonuses:[13,14,15].map(y=>a.At(id,y,2)),equipment:Array.from({length:115},(_,v)=>call('装备属性计算',id,v,0,0,0,0,0,0,0))};})()`);
 if(!Object.values(result).flat().every(Number.isFinite))throw Error('Non-finite native effects');
 result.base.forEach((base,i)=>{if(Math.abs(result.caps[i]-Math.round(base*1.5*100)/100)>1e-8||Math.abs(result.aptitudes[i]-Math.round((base+result.bonuses[i]/10)*100)/100)>1e-8)throw Error('Native aptitude formula mismatch');});
 const file=path.join(state.dir,'batch2-effects.json');if(args.includes('--compare')){if(JSON.stringify(result)!==fs.readFileSync(file,'utf8'))throw Error('Effects changed after restart');}else fs.writeFileSync(file,JSON.stringify(result));
 console.log('PASS: native aptitude formulas and 115 equipment attributes'+(args.includes('--compare')?' identical after restart':''));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
