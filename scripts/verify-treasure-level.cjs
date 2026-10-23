#!/usr/bin/env node
'use strict';
// Migration oracle step: read-only native observation of the edited treasure rows, compared with the independent oracle.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{evaluate,waitMain}=require('./verify-game.cjs'),O=require('./treasure-level-oracle.cjs');
function nativeObserve(items,rules){
 const r=self.__banditValidationRuntime,m=r.GetEventSheetManager(),a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();
 const call=(name,...args)=>{const f=m.GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};
 return items.map(i=>{
  const record=Array.from({length:60},(_,y)=>a.At(i.id,y,i.plane)),t=rules.items[record[1]];
  // 装备主属性(等级,等阶,属性,系数,设置,'主属性',0,品质): per-item main attribute, isolated from character totals.
  const effects=t.mainAttributes.map((id,s)=>id?[id,t.mainSettings[s],call('装备主属性',record[6],record[3],id,record[8],t.mainSettings[s],'主属性',0,record[5])]:null).filter(Boolean);
  return {id:i.id,plane:i.plane,record,effects};
 });
}
// Static formulas exist only for the percent branch; other attributes are checked for finiteness and recorded as native-only.
function validateEffects(results,items,k){
 assert.equal(results.length,items.length);let compared=0,observedOnly=0;
 results.forEach((v,i)=>{
  assert.equal(v.id,items[i].id);assert.equal(v.plane,items[i].plane);assert.deepEqual(v.record,items[i].after);
  const expected=O.itemEffects(v.record,k.treasureLevel,k.affixReplacement),t=k.treasureLevel.items[v.record[1]];
  assert.equal(v.effects.length,t.mainAttributes.filter(Boolean).length);
  for(const [id,setting,value] of v.effects){
   assert.ok(Number.isFinite(value),'原生主屬性不是有限值');
   if(expected.uncovered.includes(id)||setting!==100){observedOnly++;continue;}
   assert.ok(Math.abs(value-expected.values[id])<1e-8,`主屬性 ${id} 與 oracle 不符`);compared++;
  }
 });
 return {compared,observedOnly};
}
async function run(argv){
 const opt=n=>argv[argv.indexOf(n)+1],state=JSON.parse(fs.readFileSync(opt('--state'))),scenario=JSON.parse(fs.readFileSync(opt('--scenario'))),k=JSON.parse(fs.readFileSync(path.join(__dirname,'../knowledge/catalog.json')));
 require('./migration-source.cjs').external(state.dir);await waitMain(state);
 const got=await evaluate(state,`(${nativeObserve.toString()})(${JSON.stringify(scenario.items)},${JSON.stringify(k.treasureLevel)})`);
 const stats=validateEffects(got,scenario.items,k),file=path.join(state.dir,'treasure-level-effects.json');
 if(argv.includes('--compare'))assert.deepEqual(got,JSON.parse(fs.readFileSync(file)));else fs.writeFileSync(file,JSON.stringify(got));
 console.log('PASS treasure level native effects '+got.length+' compared '+stats.compared+' observed '+stats.observedOnly);
}
module.exports={nativeObserve,validateEffects,run};
if(require.main===module)run(process.argv.slice(2)).then(()=>process.stdout.write('',()=>process.exit(0))).catch(e=>{console.error(e.stack);process.exitCode=1;});
