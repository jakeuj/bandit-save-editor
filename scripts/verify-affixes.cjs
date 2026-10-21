#!/usr/bin/env node
'use strict';
// Native oracle; only disposable states created by verify-game are accepted.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {evaluate,waitMain}=require('./verify-game.cjs');
const args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1];
async function main(){
 const state=JSON.parse(fs.readFileSync(opt('--state'))),scenario=JSON.parse(fs.readFileSync(opt('--scenario')));
 if(!state.dir||!state.game.startsWith(state.dir)||!state.fingerprints||!scenario.items)throw Error('Disposable validation state required');
 await waitMain(state);
 const result=await evaluate(state,`(()=>{
 const r=self.__banditValidationRuntime,a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance(),wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance();
 const call=(name,...args)=>{const f=r.GetEventSheetManager().GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};
 const items=${JSON.stringify(scenario.items)},ids=${JSON.stringify(Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname,'../knowledge/catalog.json'))).affixReplacement.attributes).map(Number))};
 const total=(record,id)=>{let n=0;for(let s=0;s<3;s++)if(wp.At(record[1],8+s,0)===id)n+=call('装备主属性',record[6],record[3],id,record[8],wp.At(record[1],11+s,0),'主属性',0,record[5]);for(let s=1;s<=6;s++)if(record[8+s]===id)n+=call('装备主属性',record[6],record[3],id,record[14+s],100,'副词条',0,record[5]);return n;};
 const refs=Array.from({length:6},(_,s)=>a.At(1,16+s,2)),results=[];
 try{for(const item of items){
  const record=Array.from({length:60},(_,y)=>a.At(item.id,y,item.options?.plane??9));
  const plane=item.options?.plane??9;if(plane===9)for(let s=1;s<=6;s++)a.Set(1,15+s,2,s===item.equipSlot?item.id:0);
  const effects=ids.map(id=>({id,before:total(item.before,id),after:total(record,id),equipped:plane===9?call('装备属性计算',1,id,0,0,0,0,0,0,0):null}));
  results.push({id:item.id,plane,effects});
 }}finally{refs.forEach((id,s)=>a.Set(1,16+s,2,id));}
 return results;})()`);
 for(const item of scenario.items){const found=result.find(v=>v.id===item.id&&v.plane===(item.options?.plane??9));for(const effect of found.effects){assert.ok([effect.before,effect.after,...(effect.equipped===null?[]:[effect.equipped])].every(Number.isFinite));assert.ok(effect.equipped===null||Math.abs(effect.after-effect.equipped)<1e-8,'Native aggregate mismatch '+JSON.stringify({item:item.id,...effect}));const predicted=item.preview.effects.find(v=>v.attributeId===effect.id);if(predicted){assert.ok(Math.abs(predicted.before-effect.before)<1e-8,'Preview before mismatch');assert.ok(Math.abs(predicted.after-effect.after)<1e-8,'Preview after mismatch');}else if(!item.levelCase)assert.equal(effect.after,effect.before,'Unaffected attribute changed');}}
 const out=path.join(state.dir,'affix-effects.json');if(args.includes('--compare'))assert.equal(JSON.stringify(result),fs.readFileSync(out,'utf8'),'Native effects changed after restart');else fs.writeFileSync(out,JSON.stringify(result));
 console.log('PASS: '+scenario.items.length+' cases; 38 native preview attributes, z9 equipped aggregate only'+(args.includes('--compare')?' after restart':''));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
