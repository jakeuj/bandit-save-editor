#!/usr/bin/env node
'use strict';
// Native experiment: what happens to the stale owner (y7=1) left on a treasure displaced from slot 6?
// Observation only, disposable hidden copy, never counted as first-proof evidence.
const fs=require('node:fs'),path=require('node:path');
const {evaluate,waitMain}=require('./verify-game.cjs'),V=require('./verify-treasure-level-native.cjs'),L=require('./verify-treasure-level-lifecycle.cjs'),O=require('./treasure-level-oracle.cjs');
const {rpc,command,firstOf}=V,root=path.resolve(__dirname,'..');
async function probeDriver(request){
 const r=self.__banditValidationRuntime,m=r.GetEventSheetManager(),a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();
 const call=(name,...args)=>{const f=m.GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};
 const pause=()=>new Promise(resolve=>setTimeout(resolve,500)),rec=(id,z)=>Array.from({length:60},(_,y)=>a.At(id,y,z)),refs=()=>Array.from({length:6},(_,s)=>a.At(1,16+s,2));
 const rows=(z)=>{const out=[];for(let id=1;id<=12;id++)if(a.At(id,0,z)>0)out.push({id,tpl:a.At(id,1,z),owner:a.At(id,7,z),level:a.At(id,6,z)});return out;};
 const find=(z,tpl)=>{for(let id=1;id<a.GetWidth();id++)if(a.At(id,0,z)>0&&a.At(id,1,z)===tpl)return id;return 0;};
 const gen=item=>{call('获得物品',true,item.template,item.quality,item.level,item.tier,95+30*(item.quality-1),1,false,0,'特定装备',false,false);return find(7,item.template);};
 const log=[],snap=label=>log.push({label,z7:rows(7),z9:rows(9),refs:refs(),souls:a.At(3,2,0)});
 for(let id=1;id<=12;id++)for(const z of [7,9]){for(let y=0;y<60;y++)a.Set(id,y,z,0);}for(let s=1;s<=6;s++)a.Set(1,15+s,2,0);a.Set(3,2,0,1000);
 const X=gen(request.x),Y=gen(request.y);snap('generated');
 call('穿戴装备',6,X,1,false,false);await pause();snap('wear X');
 call('穿戴装备',6,Y,1,false,false);await pause();snap('wear Y over X (X displaced)');
 const staleX=find(7,request.x.template);const staleRecord=rec(staleX,7);
 call('装备库存入',staleX,true,0);await pause();snap('store stale X into z9');
 const storedX=find(9,request.x.template);const storedRecord=storedX?rec(storedX,9):null;
 if(storedX){call('装备库取出',storedX,true,0);await pause();snap('take stale X back out');}
 const bagX=find(7,request.x.template);
 call('穿戴装备',6,bagX,1,false,false);await pause();snap('re-wear stale X over Y');
 const sold=find(7,request.y.template);const before=a.At(3,2,0);
 if(sold){call('分解宝物',sold,false,false);await pause();}
 snap('decompose displaced Y (stale owner)');
 return {log,staleRecord,storedRecord,decomposeGain:a.At(3,2,0)-before,yTier:request.y.tier};
}
async function main(argv){
 const opt=n=>argv.includes(n)?argv[argv.indexOf(n)+1]:undefined,cfg=JSON.parse(fs.readFileSync(opt('--config'))),k=JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'))),out=require('./migration-source.cjs').external(cfg.out);
 let stateFile;try{
  stateFile=command(['--setup','--source',cfg.source,'--runtime',cfg.runtime,'--save-file',cfg.baseline,'--artifacts',out,'--port','19470']).match(/STATE (.+)/)[1].trim();
  command(['--state',stateFile,'--load']);let s=JSON.parse(fs.readFileSync(stateFile));await waitMain(s);await rpc(s,{op:'initialize'});
  const x=firstOf(k,1),y=firstOf(k,2),request={x:{template:x,tier:1,quality:3,level:5},y:{template:y,tier:2,quality:3,level:5}};
  const result=await evaluate(s,`(${probeDriver.toString()})(${JSON.stringify(request)})`);
  // Persistence of the stale state through an original-format save and a new PID.
  s=await L.checkpoint(stateFile);const after=await evaluate(s,`(()=>{const a=self.__banditValidationRuntime.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();const o=[];for(let id=1;id<=12;id++)for(const z of [7,9])if(a.At(id,0,z)>0)o.push({id,z,tpl:a.At(id,1,z),owner:a.At(id,7,z)});return {rows:o,refs:Array.from({length:6},(_,i)=>a.At(1,16+i,2))};})()`);
  const report={mode:'owner-probe',nativeProofCounted:false,result,afterReload:after};
  fs.writeFileSync(path.join(out,'owner-probe.json'),JSON.stringify(report,null,1));console.log(JSON.stringify(report.result.log.map(l=>({label:l.label,z7:l.z7.map(r=>`${r.id}:${r.tpl}:o${r.owner}`),z9:l.z9.map(r=>`${r.id}:${r.tpl}:o${r.owner}`),refs:l.refs.join('')})),null,1));
  console.log('decomposeGain',result.decomposeGain,'expected',O.ransom[2],'storedRecord y7',result.storedRecord&&result.storedRecord[7]);console.log('after reload',JSON.stringify(after));
 }finally{if(stateFile)try{command(['--state',stateFile,'--stop']);}catch{}}
}
if(require.main===module)main(process.argv.slice(2)).then(()=>process.stdout.write('',()=>process.exit(0))).catch(e=>{console.error(e.stack);process.exitCode=1;});
