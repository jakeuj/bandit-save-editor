#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {evaluate,waitMain,loadCore}=require('./verify-game.cjs');
const prefix=`const r=self.__banditValidationRuntime,a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();const call=(name,...args)=>{const f=r.GetEventSheetManager().GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};`;
function externalState(state){const rel=path.relative(path.resolve(__dirname,'..'),state.dir),child=path.relative(state.dir,state.game);if(!rel||!rel.startsWith('..')&&!path.isAbsolute(rel)||!child||child.startsWith('..')||path.isAbsolute(child))throw Error('External disposable state required');}
async function nativeSnapshot(state,ids){return evaluate(state,`(()=>{${prefix}return ${JSON.stringify(ids)}.map(id=>({id,raw:[10,11,12].map(y=>a.At(id,y,2)),bonuses:[13,14,15].map(y=>a.At(id,y,2)),talents:[1,2,3,21,22,23].map(y=>a.At(id,y,12)),base:[104,105,106].map(v=>call('属性计算',id,v)),caps:['力量','敏捷','智力'].map(v=>call('角色资质上限',id,v)),totals:[1,2,3].map(v=>call('角色资质计算',id,v))}));})()`);}
const near=(actual,expected,label)=>{assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-8,`${label}: ${actual} != ${expected}`);};
const loadStateCore=state=>loadCore(JSON.parse(fs.readFileSync(state.catalogPath||path.join(__dirname,'../knowledge/catalog.json'),'utf8')));
async function verify(state,scenario,compare=false){
 externalState(state);if(compare)assert.ok(state.restarted&&state.pid!==state.previousPid,'Reload must use a different PID');await waitMain(state);const ids=scenario.growthCharacters;
 if(!Array.isArray(ids)||!ids.length)throw Error('No growth characters');
 const result=await nativeSnapshot(state,ids),C=loadStateCore(state),model=C.parse(fs.readFileSync(path.join(state.game,'savedir/ea1save.dat'),'utf8'));
 for(const row of result){const info=C.randomCharacterGrowthInfo(model,{characterId:row.id});assert.ok(info.eligible,info.reasons.join());assert.deepEqual(row.raw,Array.from(info.baseRaw));for(let i=0;i<3;i++){near(row.base[i],info.aptitudes[i].base,'native A');near(row.caps[i],info.aptitudes[i].cap,'native C');near(row.totals[i],info.aptitudes[i].total,'native total');}}
 const file=path.join(state.dir,'random-growth-effects.json');if(compare)assert.deepEqual(result,JSON.parse(fs.readFileSync(file,'utf8')));else fs.writeFileSync(file,JSON.stringify(result,null,2));
 console.log(`PASS: ${ids.length} random characters, raw values and native A/B/C agree${compare?' after new-PID reload':''}`);return result;
}
async function main(){const args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1];await verify(JSON.parse(fs.readFileSync(opt('--state'))),JSON.parse(fs.readFileSync(opt('--scenario'))),args.includes('--compare'));}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={loadStateCore,prefix,externalState,nativeSnapshot,near,verify};
