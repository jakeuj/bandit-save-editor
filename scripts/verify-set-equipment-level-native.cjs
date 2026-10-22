#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {evaluate,waitMain}=require('./verify-game.cjs'),{nativeDriver}=require('./set-equipment-level-native.cjs'),D=require('./set-equipment-level-data.cjs'),S=require('./set-equipment-level-scenarios.cjs'),O=require('./set-equipment-level-oracle.cjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),write=(p,v)=>{fs.writeFileSync(p+'.tmp',JSON.stringify(v)+'\n');fs.renameSync(p+'.tmp',p);};
const rpc=(state,request)=>evaluate(state,`(${nativeDriver.toString()})(${JSON.stringify(request)})`);
function generationCases(k){const out=[];for(const templateId of Object.keys(k.setEquipmentLevel.items).map(Number))for(let quality=1;quality<=6;quality++)for(const points of quality===1?[1,2,3,4]:[3]){const t=k.setEquipmentLevel.items[templateId],origin=Object.keys(k.setEquipmentLevel.origins).map(Number).find(id=>{const o=k.setEquipmentLevel.origins[id];return o.slot===t.slot&&o.tier===t.tier;});out.push({id:`${templateId}:${quality}:${points}`,templateId,quality,points,origin,tier:t.tier});}assert.equal(out.length,1944);return out;}
function validateGeneration(v,c,k){
 assert.equal(v.templateId,c.templateId);assert.equal(v.quality,c.quality);assert.equal(v.before[1],c.origin);assert.equal(v.before[5],c.quality);assert.equal(v.before[6],1);assert.ok(v.attempts>0&&v.attempts<=512);
 assert.equal(v.after[1],c.templateId);assert.equal(v.after[23],v.material[4]);assert.equal(v.after[23],c.points);assert.equal(v.after[26],v.material[10]);assert.equal(v.after[27],c.origin);assert.ok(v.spirit>0);
 for(let y=0;y<60;y++)if(![1,23,24,26,27].includes(y))assert.equal(v.before[y],v.after[y],'合成改變額外欄 '+y);
 assert.equal(v.after[24],1);assert.equal(v.after[3],k.setEquipmentLevel.items[c.templateId].tier);
 return true;
}
function almost(a,b,label){assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b)),label+': '+a+' != '+b);}
function validateLevel(v,c,k,before,after){
 const expectedBefore=before.slice();expectedBefore[7]=c.state==='equipped'?1:0;
 assert.equal(v.id,c.id);assert.deepEqual(v.loaded,expectedBefore);assert.deepEqual(v.moved,expectedBefore);
 const expectedAfter=after.slice();expectedAfter[7]=expectedBefore[7];assert.deepEqual(v.after,expectedAfter);
 const high=Math.max(c.from,c.to),upgraded=expectedBefore.slice();upgraded[6]=high;assert.deepEqual(v.upgraded,upgraded);
 const e0=O.itemEffects(expectedBefore,k.setEquipmentLevel),e1=O.itemEffects(expectedAfter,k.setEquipmentLevel);
 for(const [id,value]of v.beforeEffects)almost(value,e0[id]||0,'native before '+id);
 for(const [id,value]of v.effects)almost(value,e1[id]||0,'native after '+id);
 assert.equal(v.beforeEffects.length,Object.keys(k.setEquipmentLevel.attributes).length);assert.equal(v.effects.length,v.beforeEffects.length);
 let cost=0;for(let l=Math.min(c.from,c.to);l<high;l++)cost+=O.money(expectedBefore[3],l);assert.equal(v.cost,cost);assert.equal(v.soulCost,0);return true;
}
function validateEffect(v,c,k,records){
 assert.equal(v.id,c.id);assert.deepEqual(v.records,records);const e=O.characterEffects(records,k.setEquipmentLevel),summary=e.summaries[c.setId];
 assert.deepEqual(v.summary,[summary.parts,summary.score,summary.count]);
 for(const [id,value]of v.values)almost(value,(e.singles[id]||0)+(e.sets[id]||0),'native full set '+id);
 assert.equal(v.values.length,new Set([...Object.keys(k.setEquipmentLevel.attributes),...Object.values(k.setEquipmentLevel.sets).flatMap(t=>t.effects.map(e=>String(e.attributeId)))]).size);return true;
}
function candidateCore(k,source){const candidate=structuredClone(k);for(const g of D.groups)candidate.verification[g]=true;const ctx={};vm.runInNewContext(source.replace('/*__KNOWLEDGE__*/null',JSON.stringify(candidate)),ctx);const C=ctx.SaveCore,data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='驗證角色';const m=C.parse(JSON.stringify({c2array:true,size:[221,60,22],data}));return {C,m};}
function coreEdit(ctx,before,c,k){const {C,m}=ctx,z=c.state==='backpack'?7:9;for(const p of [7,9])for(let y=0;y<60;y++)m.original.data[1][y][p]=0;for(let s=1;s<=6;s++)m.original.data[1][15+s][2]=0;const row=before.slice();row[7]=c.state==='equipped'?1:0;row.forEach((v,y)=>m.original.data[1][y][z]=v);if(row[7])m.original.data[1][15+k.setEquipmentLevel.items[c.templateId].slot][2]=1;m.changes.clear();m.history=[];C.setEquipmentLevel(m,{itemId:1,plane:z,level:c.to});assert.equal(m.changes.size,1);const after=row.map((_,y)=>C.get(m,{x:1,y,z}));O.assertLevelOnly(row,after,c.to);return after;}
async function run({state,k,source,out,phase,inputs}){
 require('./migration-source.cjs').external(out);await waitMain(state);
 const binding={fingerprints:{...k.fingerprints,...k.batch2Fingerprints},dataHash:D.hash(k.setEquipmentLevel),driverHash:D.hash(nativeDriver.toString())};
 const baselineFile=path.join(out,'native-baselines.json');
 if(phase==='generate'){
  const cases=generationCases(k),report=fs.existsSync(baselineFile)?read(baselineFile):{binding,pid:state.pid,results:[]};assert.deepEqual(report.binding,binding);await rpc(state,{op:'initialize'});
  for(let off=report.results.length;off<cases.length;off+=12){const selected=cases.slice(off,off+12),got=await rpc(state,{op:'generate',items:selected});got.forEach((v,i)=>validateGeneration(v,selected[i],k));report.results.push(...got);write(baselineFile,report);if(off%120===0)console.log('native baselines '+report.results.length+'/'+cases.length);}
  return {baselines:report.results.length};
 }
 const baselines=read(baselineFile);assert.deepEqual(baselines.binding,binding);const generation=generationCases(k);assert.equal(baselines.results.length,generation.length);baselines.results.forEach((v,i)=>validateGeneration(v,generation[i],k));const lookup=new Map(baselines.results.map((v,i)=>[generation[i].id,v.after]));
 const manifest=S.createManifest(k,source,inputs),byKind=manifest.cases.filter(c=>phase==='matrix'?c.kind==='level':phase==='effects'?c.kind==='effect':c.kind==='cost');
 const reportFile=path.join(out,`native-${phase}.json`),runBinding={...binding,coreHash:D.hash(source),manifestHash:manifest.manifestHash};
 const spool=reportFile+'.jsonl',meta=reportFile+'.meta';
 const report=fs.existsSync(reportFile)?read(reportFile):fs.existsSync(meta)?{...read(meta),results:fs.readFileSync(spool,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)}:{binding:runBinding,pid:state.pid,results:[]};assert.deepEqual(report.binding,runBinding);
 if(!fs.existsSync(meta)){write(meta,{binding:runBinding,pid:state.pid});fs.writeFileSync(spool,'');}const ctx=candidateCore(k,source),attributes=Object.keys(k.setEquipmentLevel.attributes).map(Number),effectAttributes=[...new Set([...attributes,...Object.values(k.setEquipmentLevel.sets).flatMap(t=>t.effects.map(e=>e.attributeId))])];
 for(let off=report.results.length;off<byKind.length;off+=20){
  const selected=byKind.slice(off,off+20),items=selected.map(c=>{
   if(phase==='matrix'){const before=lookup.get(`${c.templateId}:${c.quality}:3`).slice();before[6]=c.from;return {...c,slot:k.setEquipmentLevel.items[c.templateId].slot,before,after:coreEdit(ctx,before,c,k)};}
   if(phase==='effects'){const records=k.setEquipmentLevel.sets[c.setId].members.slice(0,c.parts).map((id,i)=>{const row=lookup.get(`${id}:1:${c.score==='mixed'?i+1:3}`).slice();row[6]=c.to;row[7]=1;return row;});return {...c,records,slots:records.map(r=>k.setEquipmentLevel.items[r[1]].slot)};}
   const templateId=Object.keys(k.setEquipmentLevel.items).find(id=>k.setEquipmentLevel.items[id].tier===c.tier),row=lookup.get(`${templateId}:${c.quality}:3`).slice();row[6]=c.mode==='at-cap'?O.cap(c.quality):1;const cost=O.money(c.tier,row[6]),copper=c.mode==='insufficient'?cost-1:['exact','partial-max'].includes(c.mode)?cost:1e12;return {...c,record:row,copper,souls:999,maximum:['partial-max','maximum','at-cap'].includes(c.mode)};
  });
  const got=await rpc(state,{op:phase==='matrix'?'matrix':phase==='effects'?'effects':'costs',items,attributes:phase==='effects'?effectAttributes:attributes});
  got.forEach((v,i)=>{const c=selected[i],input=items[i];if(phase==='matrix')validateLevel(v,c,k,input.before,input.after);else if(phase==='effects')validateEffect(v,c,k,input.records);else{const e=O.upgrade({tier:c.tier,quality:c.quality,level:input.record[6],copper:input.copper,souls:input.souls},input.maximum);assert.equal(v.record[6],e.level);assert.equal(v.copper,e.copper);assert.equal(v.souls,e.souls);O.assertLevelOnly(input.record,v.record,e.level);}});
  const added=got.map((v,i)=>({case:selected[i],input:items[i],observed:v}));report.results.push(...added);fs.appendFileSync(spool,added.map(v=>JSON.stringify(v)).join('\n')+'\n');if(off%400===0)console.log('native '+phase+' '+report.results.length+'/'+byKind.length);
 }
 write(reportFile,report);return {phase,cases:report.results.length};
}
if(require.main===module){const argv=process.argv.slice(2),opt=n=>argv.includes(n)?argv[argv.indexOf(n)+1]:undefined;const state=read(opt('--state')),k=read(opt('--catalog')||path.join(__dirname,'../knowledge/catalog.json')),source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8'),inputs=read(opt('--inputs'));run({state,k,source,out:opt('--output'),phase:opt('--phase'),inputs}).then(v=>{console.log(JSON.stringify(v));process.stdout.write('',()=>process.exit(0));}).catch(e=>{console.error(e.stack);process.stderr.write('',()=>process.exit(1));});}
module.exports={rpc,generationCases,validateGeneration,validateLevel,validateEffect,candidateCore,coreEdit,run};
