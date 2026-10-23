#!/usr/bin/env node
'use strict';
// Treasure-level native runner. `calibrate` is a small shard that checks driver assumptions in a disposable hidden copy;
// it never counts as first-proof evidence. Outputs stay outside the repo.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {evaluate,waitMain}=require('./verify-game.cjs'),{nativeDriver}=require('./treasure-level-native.cjs'),O=require('./treasure-level-oracle.cjs');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),write=(p,v)=>{fs.writeFileSync(p+'.tmp',JSON.stringify(v,null,1)+'\n');fs.renameSync(p+'.tmp',p);};
const rpc=(state,request)=>evaluate(state,`(${nativeDriver.toString()})(${JSON.stringify(request)})`);
function command(args){const p=spawnSync(process.execPath,[path.join(__dirname,'verify-game.cjs'),...args],{encoding:'utf8',windowsHide:true,maxBuffer:2e6,timeout:120000});if(p.status!==0)throw Error(p.stderr||p.stdout);return p.stdout;}
const firstOf=(k,tier)=>+Object.keys(k.treasureLevel.items).find(i=>k.treasureLevel.items[i].tier===tier);
const diff=(a,b)=>a.map((v,y)=>v===b[y]?null:[y,v,b[y]]).filter(Boolean);
// Each probe is isolated: a failure is recorded as an observation so one wrong assumption does not hide the others.
async function probe(report,name,fn){try{report.probes[name]={ok:true,...await fn()};}catch(e){report.probes[name]={ok:false,error:String(e.message||e).slice(0,400)};}}
async function calibrate({state,k,out}){
 await waitMain(state);const report={schemaVersion:1,mode:'calibration',nativeProofCounted:false,pid:state.pid,probes:{}};
 await probe(report,'initialize',async()=>({value:await rpc(state,{op:'initialize'})}));
 const items=[[1,1,1],[1,3,5],[1,6,35],[3,3,7],[6,6,1]].map(([tier,quality,level])=>({templateId:firstOf(k,tier),tier,quality,level}));
 let generated=[];
 await probe(report,'generate',async()=>{generated=await rpc(state,{op:'generate',items});return {records:generated.map(g=>({templateId:g.templateId,quality:g.quality,asked:g.level,attempts:g.attempts,y:g.record.slice(0,30)}))};});
 const rec=i=>generated[i]?.record;
 await probe(report,'generated-shape',async()=>({checks:generated.map((g,i)=>({i,level:g.record[6],levelHonored:g.record[6]===items[i].level,tier:g.record[3]===items[i].tier,qty:g.record[2],y4:g.record[4],y7:g.record[7],y8:g.record[8],y22:g.record[22],y0:g.record[0]}))}));
 for(const state0 of ['backpack','stored','equipped'])await probe(report,'level-'+state0,async()=>{
  const before=rec(1).slice();before[6]=3;const got=await rpc(state,{op:'level',items:[{id:'cal-'+state0,state:state0,before,from:3,to:5,souls:1e9}]});
  const v=got[0],expectedCost=O.souls(before[3],3)+O.souls(before[3],4);
  return {soulCost:v.soulCost,expectedCost,costMatches:v.soulCost===expectedCost,moveDiff:diff(before,v.moved),levelDiff:diff(v.moved,v.upgraded),refs:v.refs};
 });
 await probe(report,'cost-single-and-max',async()=>{
  const row=rec(0).slice();row[6]=1;const out={};
  const got=await rpc(state,{op:'costs',items:[{id:'single',record:row,souls:1e9,maximum:false},{id:'max',record:row,souls:1e9,maximum:true},{id:'poor',record:row,souls:O.souls(1,1)-1,maximum:false}]});
  for(const g of got)out[g.id]={level:g.record[6],souls:g.souls,levelDiff:diff(row,g.record).filter(d=>d[0]!==6)};
  return {out,expected:{single:O.upgrade({tier:1,quality:1,level:1,souls:1e9}),max:O.upgrade({tier:1,quality:1,level:1,souls:1e9},true)}};
 });
 await probe(report,'decompose',async()=>{
  const rows=[0,3,4].map(i=>rec(i).slice());
  const got=await rpc(state,{op:'decompose',items:rows.map((r,i)=>({id:'d'+i,mode:'single',rows:[r],souls:1000}))});
  return {results:got.map((g,i)=>({tier:rows[i][3],gain:g.souls-1000,expected:O.ransom[rows[i][3]],rowCleared:g.rows[0].every(v=>v===0)}))};
 });
 await probe(report,'effects',async()=>{
  const row=rec(1).slice();const got=await rpc(state,{op:'effects',attributes:k.treasureLevel.items[row[1]].mainAttributes.filter(Boolean),items:[{id:'e',record:row}]});
  return {values:got[0].values};
 });
 await probe(report,'single-main',async()=>{
  const grid=[];for(const attribute of [17,12,13])for(const tier of [1,2,3])for(const level of [1,5,10])for(const coefficient of [95,155])grid.push({id:`${attribute}:${tier}:${level}:${coefficient}`,attribute,tier,level,coefficient,setting:100,quality:coefficient===95?1:3});
  const got=await rpc(state,{op:'single',items:grid});return {grid:got.map((g,i)=>({...grid[i],value:g.value}))};
 });
 write(path.join(out,'calibration.json'),report);return report;
}
async function main(argv){
 const opt=n=>argv.includes(n)?argv[argv.indexOf(n)+1]:undefined,cfg=read(opt('--config')),k=read(path.join(root,'knowledge/catalog.json')),out=require('./migration-source.cjs').external(cfg.out);
 let stateFile;
 try{
  const setup=command(['--setup','--source',cfg.source,'--runtime',cfg.runtime,'--save-file',cfg.baseline,'--artifacts',out,'--port',String(opt('--port')||19489)]);
  stateFile=setup.match(/STATE (.+)/)[1].trim();command(['--state',stateFile,'--load']);
  const report=await calibrate({state:read(stateFile),k,out});
  console.log(JSON.stringify(report,null,1));
 }finally{if(stateFile)try{command(['--state',stateFile,'--stop']);}catch(e){console.error('stop failed: '+e.message);}}
}
if(require.main===module)main(process.argv.slice(2)).then(()=>process.stdout.write('',()=>process.exit(0))).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={rpc,command,calibrate,firstOf};
