#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{evaluate,waitMain}=require('./verify-game.cjs');
const args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1];
const prefix=`const r=self.__banditValidationRuntime,a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();const call=(name,...args)=>{const f=r.GetEventSheetManager().GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};`;
async function main(){
 const statePath=opt('--state'),state=JSON.parse(fs.readFileSync(statePath)),scenario=JSON.parse(fs.readFileSync(opt('--scenario'))),first=scenario.items[0];await waitMain(state);
 const before=await evaluate(state,`(()=>{${prefix}r.SetTimeScale(0);const id=a.At(1,${15+first.equipSlot},2);if(id!==${first.id})throw Error('Expected isolated equipped target');const record=Array.from({length:50},(_,y)=>a.At(id,y,9));call('卸下装备',${first.equipSlot},id,1,false,false);return record;})()`);
 await new Promise(resolve=>setTimeout(resolve,500));
 const bag=await evaluate(state,`(()=>{${prefix}if(a.At(1,${15+first.equipSlot},2)!==0)throw Error('Unequip failed');for(let id=1;id<2501;id++)if(a.At(id,0,7)>0&&a.At(id,1,7)===${before[1]}&&a.At(id,${8+first.options.slot},7)===${before[8+first.options.slot]}&&a.At(id,${14+first.options.slot},7)===${before[14+first.options.slot]}&&a.At(id,${27+first.options.slot},7)===1)return id;throw Error('Unequipped record missing');})()`);
 await evaluate(state,`(()=>{${prefix}call('穿戴装备',${first.equipSlot},${bag},1,false,false);return true;})()`);
 await new Promise(resolve=>setTimeout(resolve,500));
 const after=await evaluate(state,`(()=>{${prefix}const id=a.At(1,${15+first.equipSlot},2);return {id,record:Array.from({length:50},(_,y)=>a.At(id,y,9))};})()`);
 for(let y=1;y<50;y++)if(y!==7)assert.equal(after.record[y],before[y],'Equip cycle field '+y);assert.equal(after.record[7],1);
 const items=scenario.items.map((i,n)=>({...i,id:n===0?after.id:i.id}));
 const wash=await evaluate(state,`(()=>{${prefix}return ${JSON.stringify(items)}.map(item=>{const before=Array.from({length:50},(_,y)=>a.At(item.id,y,9)),soul=a.At(3,2,0),cost=call('词条洗练魂魄',before[3],1);call('词条洗练',item.id,item.options.slot,9);return {id:item.id,slot:item.options.slot,cost,soulBefore:soul,soulAfter:a.At(3,2,0),before,after:Array.from({length:50},(_,y)=>a.At(item.id,y,9))};});})()`);
 const k=JSON.parse(fs.readFileSync(path.join(__dirname,'../knowledge/catalog.json')));
 for(const w of wash){assert.equal(w.cost,100);assert.equal(w.soulBefore-w.soulAfter,100);for(let y=0;y<50;y++)if(![8+w.slot,14+w.slot].includes(y))assert.equal(w.after[y],w.before[y],'Wash changed unrelated field '+y);const pool=k.batch2Data.items[w.after[1]].affixIds;assert.ok(pool.includes(w.after[8+w.slot]));assert.ok(w.after[14+w.slot]>=10*(w.after[5]-1)&&w.after[14+w.slot]<=60+10*w.after[5]);}
 for(let y=0;y<50;y++)state.cells.push([after.id,y,9]);state.cells.push([1,15+first.equipSlot,2],[3,2,0]);
 state.expected=await evaluate(state,`(()=>{${prefix}return ${JSON.stringify(state.cells)}.map(([x,y,z])=>a.At(x,y,z));})()`);
 fs.writeFileSync(statePath,JSON.stringify(state,null,2));fs.writeFileSync(path.join(state.dir,'affix-lifecycle.json'),JSON.stringify({before,after,wash},null,2));
 console.log('PASS: native equip cycle and '+wash.length+' subsequent washes, exact 100 soul cost and unchanged flags');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
