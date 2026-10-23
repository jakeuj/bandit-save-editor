#!/usr/bin/env node
'use strict';
// Native observation of 宝物批量分解: which rows go for a given quality argument, lock handling and fixed prices.
// Disposable hidden copy, observation only (never first-proof evidence); outputs stay outside the repo.
const fs=require('node:fs'),path=require('node:path');
const {waitMain}=require('./verify-game.cjs'),V=require('./verify-treasure-level-native.cjs'),O=require('./treasure-level-oracle.cjs');
const {rpc,command,firstOf}=V,root=path.resolve(__dirname,'..');
async function batchDriver(request){
 const r=self.__banditValidationRuntime,m=r.GetEventSheetManager(),a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();
 const call=(name,...args)=>{const f=m.GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};
 const pause=()=>new Promise(resolve=>setTimeout(resolve,500));
 const rows=()=>{const out=[];for(let id=1;id<a.GetWidth()&&out.length<40;id++)if(a.At(id,0,7)>0&&a.At(id,1,7)>0)out.push({id,tpl:a.At(id,1,7),tier:a.At(id,3,7),q:a.At(id,5,7),lock:a.At(id,22,7),owner:a.At(id,7,7)});return out;};
 const find=tpl=>{for(let id=1;id<a.GetWidth();id++)if(a.At(id,0,7)>0&&a.At(id,1,7)===tpl)return id;return 0;};
 for(let id=1;id<=40;id++)for(let y=0;y<60;y++)a.Set(id,y,7,0);a.Set(3,2,0,0);
 for(const item of request.items){call('获得物品',true,item.template,item.quality,1,item.tier,95+30*(item.quality-1),1,false,0,'特定装备',false,false);const id=find(item.template);if(item.lock)a.Set(id,22,7,1);if(item.owner)a.Set(id,7,7,item.owner);}
 const seeded=rows(),steps=[];
 for(const q of request.calls){const before=a.At(3,2,0),beforeRows=rows(),ret=call('宝物批量分解',q,0,0);await pause();steps.push({quality:q,returned:ret,gain:a.At(3,2,0)-before,before:beforeRows,after:rows()});}
 return {seeded,steps};
}
async function main(argv){
 const opt=n=>argv.includes(n)?argv[argv.indexOf(n)+1]:undefined,cfg=JSON.parse(fs.readFileSync(opt('--config'))),k=JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'))),out=require('./migration-source.cjs').external(cfg.out);
 let stateFile;try{
  stateFile=command(['--setup','--source',cfg.source,'--runtime',cfg.runtime,'--save-file',cfg.baseline,'--artifacts',out,'--port','19471']).match(/STATE (.+)/)[1].trim();
  command(['--state',stateFile,'--load']);const s=JSON.parse(fs.readFileSync(stateFile));await waitMain(s);await rpc(s,{op:'initialize'});
  const t=tier=>Object.keys(k.treasureLevel.items).map(Number).filter(i=>k.treasureLevel.items[i].tier===tier);
  const items=[[1,1,0,0],[1,2,0,0],[2,3,1,0],[3,2,0,0],[1,4,0,0],[2,1,0,1],[4,5,0,0],[2,6,0,0]].map(([tier,quality,lock,owner],i)=>({template:t(tier)[i%t(tier).length],tier,quality,lock,owner}));
  const result=await require('./verify-game.cjs').evaluate(s,`(${batchDriver.toString()})(${JSON.stringify({items,calls:[2,4]})})`);
  const report={mode:'batch-observation',nativeProofCounted:false,items,result};fs.writeFileSync(path.join(out,'batch-observation.json'),JSON.stringify(report,null,1));
  console.log(JSON.stringify({seeded:result.seeded.map(r=>`${r.id}:T${r.tier}Q${r.q}L${r.lock}o${r.owner}`),steps:result.steps.map(x=>({quality:x.quality,returned:x.returned,gain:x.gain,removed:x.before.filter(b=>!x.after.some(a=>a.id===b.id)).map(r=>`T${r.tier}Q${r.q}L${r.lock}o${r.owner}`)}))},null,1));
 }finally{if(stateFile)try{command(['--state',stateFile,'--stop']);}catch{}}
}
if(require.main===module)main(process.argv.slice(2)).then(()=>process.stdout.write('',()=>process.exit(0))).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={batchDriver};
