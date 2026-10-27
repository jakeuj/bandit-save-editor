#!/usr/bin/env node
'use strict';
// Native lifecycle checks for private states created by verify-game; never use player originals.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {evaluate,waitMain}=require('./verify-game.cjs');
const args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1];
const prefix=`const r=self.__banditValidationRuntime,a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance(),wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance();const call=(name,...args)=>{const f=r.GetEventSheetManager().GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};const record=(id,z)=>Array.from({length:50},(_,y)=>a.At(id,y,z));`;
async function main(){
 const statePath=opt('--state'),state=JSON.parse(fs.readFileSync(statePath)),output=path.join(state.dir,'equipment-workflow-lifecycle.json');
 const relative=path.relative(path.resolve(__dirname,'..'),path.resolve(state.dir)),child=path.relative(path.resolve(state.dir),path.resolve(state.game));
 if(relative===''||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep))||!child||path.isAbsolute(child)||child==='..'||child.startsWith('..'+path.sep))throw Error('External disposable state required');
 await waitMain(state);
 if(args.includes('--compare')){const previous=JSON.parse(fs.readFileSync(output));const got=await evaluate(state,`(()=>{${prefix}return ${JSON.stringify(previous.locations)}.map(v=>({id:v.id,plane:v.plane,record:record(v.id,v.plane)}));})()`);assert.deepEqual(got,previous.finalRecords);console.log('PASS: lifecycle records persist after native save and new-PID restart');return;}
 const scenario=JSON.parse(fs.readFileSync(opt('--scenario'))),items=scenario.items;
 const wash=await evaluate(state,`(()=>{${prefix}return ${JSON.stringify(items.filter(v=>!v.levelCase))}.map(item=>{const z=item.options.plane??9,before=record(item.id,z),soul=a.At(3,2,0),cost=call('词条洗练魂魄',before[3],1);call('词条洗练',item.id,item.options.slot,z);return {id:item.id,z,slot:item.options.slot,cost,soulBefore:soul,soulAfter:a.At(3,2,0),before,after:record(item.id,z)};});})()`);
 for(const w of wash){assert.equal(w.cost,100);assert.equal(w.soulBefore-w.soulAfter,100);for(let y=0;y<50;y++)if(![8+w.slot,14+w.slot].includes(y))assert.equal(w.after[y],w.before[y],'Native wash changed other field '+y);}
 const first=items.find(v=>(v.options.plane??9)===7&&!v.levelCase),before=wash.find(v=>v.id===first.id&&v.z===7).after;
 await evaluate(state,`(()=>{${prefix}call('穿戴装备',${first.equipSlot},${first.id},1,false,false,7);return true;})()`);await new Promise(resolve=>setTimeout(resolve,500));
 const equipped=await evaluate(state,`(()=>{${prefix}const id=a.At(1,${15+first.equipSlot},2);return {id,record:record(id,9),effects:${JSON.stringify(Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname,'../knowledge/catalog.json'))).affixReplacement.attributes).map(Number))}.map(attr=>({attr,actual:call('装备属性计算',1,attr,0,0,0,0,0,0,0),expected:(()=>{let total=0;const v=record(id,9);for(let s=0;s<3;s++)if(wp.At(v[1],8+s,0)===attr)total+=call('装备主属性',v[6],v[3],attr,v[8],wp.At(v[1],11+s,0),'主属性',0,v[5]);for(let s=1;s<=6;s++)if(v[8+s]===attr)total+=call('装备主属性',v[6],v[3],attr,v[14+s],100,'副词条',0,v[5]);return total;})()}))};})()`);
 for(let y=0;y<50;y++)if(y!==7)assert.equal(equipped.record[y],before[y]);assert.equal(equipped.record[7],1);for(const e of equipped.effects)assert.ok(Number.isFinite(e.actual)&&Math.abs(e.actual-e.expected)<1e-8);
 await evaluate(state,`(()=>{${prefix}call('卸下装备',${first.equipSlot},${equipped.id},1,false,false,7);return true;})()`);await new Promise(resolve=>setTimeout(resolve,500));
 const bag=await evaluate(state,`(()=>{${prefix}for(let id=1;id<a.GetWidth();id++)if(a.At(id,0,7)===${before[0]}&&a.At(id,1,7)===${before[1]})return {id,record:record(id,7)};throw Error('Returned backpack record missing');})()`);assert.deepEqual(bag.record,before);
 const locations=items.map(v=>({id:v===first?bag.id:v.id,plane:v.options.plane??9}));
 const finalRecords=await evaluate(state,`(()=>{${prefix}const locations=${JSON.stringify(locations)},before=locations.map(v=>({id:v.id,plane:v.plane,record:record(v.id,v.plane)}));call('装备排序',7);const after=locations.map(v=>({id:v.id,plane:v.plane,record:record(v.id,v.plane)}));return {before,after};})()`);assert.deepEqual(finalRecords.before,finalRecords.after);
 for(const v of [{id:first.id,plane:7},{id:equipped.id,plane:9},{id:bag.id,plane:7}])for(let y=0;y<50;y++)state.cells.push([v.id,y,v.plane]);for(let slot=1;slot<=6;slot++)state.cells.push([1,15+slot,2]);state.cells.push([3,2,0]);
 state.expected=await evaluate(state,`(()=>{${prefix}return ${JSON.stringify(state.cells)}.map(([x,y,z])=>a.At(x,y,z));})()`);
 fs.writeFileSync(statePath,JSON.stringify(state,null,2));fs.writeFileSync(output,JSON.stringify({locations,finalRecords:finalRecords.after,wash,equipped,bag},null,2));
 console.log('PASS: '+wash.length+' native washes with 100 soul; actual backpack equip/unequip, effects, new row and display sorting preserve payload');
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
