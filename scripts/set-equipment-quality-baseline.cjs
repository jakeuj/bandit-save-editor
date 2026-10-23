#!/usr/bin/env node
'use strict';
// B1: verify and supplement native baselines for set-equipment quality. Native generation reuses the reviewed
// set-level driver; this file adds native same-slot refining (词条洗练) and a two-launch IO readback.
// Never edits native results: every generated or refined record is kept as observed, misses stay missing.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const O=require('./set-equipment-quality-oracle.cjs');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Columns a synthesis may change (set-level B rule) and the three columns one refine may change.
const synthesisColumns=[1,23,24,26,27],refineColumns=s=>[O.col.id(s),O.col.coef(s),O.col.flag(s)];

// Every file of both cache manifests plus the 15 analysis fingerprints of the catalog.
function verifySources(entry,catalog){
 const out={};
 for(const [key,base,manifest]of [['source',entry.source,entry.sourceManifest],['runtime',entry.runtimeDirectory,entry.runtimeManifest]]){
  const files=JSON.parse(fs.readFileSync(manifest,'utf8')).files;
  for(const [name,expected]of Object.entries(files))assert.equal(sha(path.join(base,name)),expected,`${key} manifest: ${name}`);
  out[key+'Files']=Object.keys(files).length;out[key+'ManifestHash']=sha(manifest);
 }
 const fingerprints={...catalog.fingerprints,...catalog.batch2Fingerprints};
 assert.equal(Object.keys(fingerprints).length,15,'catalog 指紋數不是 15');
 for(const [name,expected]of Object.entries(fingerprints)){assert.equal(entry.fingerprints[name],expected,'索引指紋不符 '+name);assert.equal(sha(path.join(entry.source,name)),expected,'來源指紋不符 '+name);}
 return {...out,fingerprints,runtimeHash:entry.runtimeHash,packageHash:entry.packageHash};
}

const poolsOf=(k,templateId,originId)=>({origin:k.setEquipmentLevel.origins[originId].affixIds,set:k.setEquipmentQuality.pools[templateId].affixIds});
// Same-tier/same-slot origin rows that the set-level baselines (one origin per template) do not cover.
function missingOriginRows(k,levelResults){
 const covered=new Set(levelResults.map(v=>v.templateId+':'+v.origin));
 return O.reachabilityCensus(k.setEquipmentQuality,k.setEquipmentLevel).filter(r=>!covered.has(r.templateId+':'+r.originId))
  .map(r=>({id:`${r.templateId}:${r.originId}:6:3`,templateId:r.templateId,origin:r.originId,quality:6,points:3,tier:r.tier}));
}
// A native acquisition + in-place synthesis. Returns problems; an affix outside P原 is a spec conflict, not a miss.
function checkGeneration(v,c,k){
 const problems=[],conflicts=[];
 if(v.templateId!==c.templateId||v.origin!==c.origin)problems.push('案例不符');
 if(v.before[1]!==c.origin||v.before[5]!==c.quality)problems.push('取得品質或範本不符');
 if(v.after[1]!==c.templateId||v.after[27]!==c.origin||v.after[23]!==v.material[4]||v.after[26]!==v.material[10])problems.push('合成 metadata 不符');
 for(let y=0;y<60;y++)if(!synthesisColumns.includes(y)&&v.before[y]!==v.after[y])conflicts.push('合成改變欄 '+y);
 const pools=poolsOf(k,c.templateId,c.origin),q=v.after[5],[lo,hi]=O.mainRange(q),[slo,shi]=O.subRange(q);
 if(!(v.after[8]>=lo&&v.after[8]<=hi))problems.push('主係數超出區間');
 for(let s=1;s<=5;s++){
  const id=v.after[O.col.id(s)],coef=v.after[O.col.coef(s)],flag=v.after[O.col.flag(s)];
  if(s>O.slots(q)){if(id||coef||flag)conflicts.push('品質外尾槽有資料 '+s);continue;}
  if(!pools.origin.includes(id))conflicts.push(`取得槽 ${s} 不在 P原: ${id}`);
  if(!(coef>=slo&&coef<=shi))problems.push('副係數超出區間 '+s);
  if(flag!==0)problems.push('取得即有旗標 '+s);
 }
 return {problems,conflicts};
}
// Refine targets: Q6 baselines whose set pool has ids the origin pool lacks.
function refineTargets(k,records){
 return records.filter(v=>v.after[5]>=2).map(v=>{const pools=poolsOf(k,v.templateId,v.origin),setOnly=pools.set.filter(id=>!pools.origin.includes(id));return {key:`${v.templateId}:${v.origin}`,templateId:v.templateId,origin:v.origin,record:v.after,setOnly};}).filter(t=>t.setOnly.length);
}
// One native refine sequence on one slot. A result outside P套 or a change outside the slot is a spec conflict.
function checkRefine(seq,target,k,plane){
 const pools=poolsOf(k,target.templateId,target.origin),problems=[],conflicts=[];let prev=target.record.slice();prev[7]=0;
 const s=seq.slot,q=prev[5],[lo,hi]=O.subRange(q);
 if(!seq.attempts.length)problems.push('沒有洗練結果');
 seq.attempts.forEach((a,i)=>{
  const row=a.row;
  for(let y=0;y<60;y++)if(!refineColumns(s).includes(y)&&row[y]!==prev[y])conflicts.push(`第 ${i+1} 次洗練改變欄 ${y}`);
  if(!pools.set.includes(row[O.col.id(s)]))conflicts.push(`第 ${i+1} 次洗練結果不在 P套: ${row[O.col.id(s)]}`);
  if(!(row[O.col.coef(s)]>=lo&&row[O.col.coef(s)]<=hi))problems.push(`第 ${i+1} 次係數超出 Q${q} 區間`);
  if(row[O.col.flag(s)]!==1)problems.push(`第 ${i+1} 次未標已洗旗標`);
  if(!(a.soulCost>0))problems.push(`第 ${i+1} 次沒有魂魄成本`);
  prev=row;
 });
 const last=seq.attempts.at(-1),hit=!!last&&target.setOnly.includes(last.row[O.col.id(s)]);
 if(seq.hit!==hit)problems.push('命中標示與結果不符');
 return {problems,conflicts,hit,plane};
}
// W1–W7 for B1 only: acquired, missing (with reason) or not applicable here (owned by a later B task).
function witnessStatus(r){
 const qs=new Set(r.levelQualities),allQ=[1,2,3,4,5,6].every(q=>qs.has(q));
 return [
  {id:'W1',status:allQ&&r.generationOk?'acquired':'missing',note:allQ?`Q1–Q6 起點／目標生成履歷 ${r.levelCount} 份＋補原池 ${r.generated} 份`:'缺部分 Q'},
  {id:'W2',status:r.generationOk&&r.originPoolOk?'acquired':'missing',note:'取得與合成後全部有效槽皆在 y27 原池、旗標 0；品質編輯新增尾槽本身屬 B4'},
  {id:'W3',status:r.setOnlyHits>0?'acquired':'missing',note:`套裝池專有 ID 命中 ${r.setOnlyHits}／${r.refineTargets} 組（z7 ${r.hitsByPlane[7]||0}、z9 ${r.hitsByPlane[9]||0}）`},
  {id:'W4',status:'not-applicable',note:'品質平移後讀回屬 B2／B4；B1 只做原生紀錄的兩輪啟動讀回'},
  {id:'W5',status:'not-applicable',note:'降品刪尾槽屬 B4'},
  {id:'W6',status:'not-applicable',note:'品質與等級交錯屬 B2／B4／B6；B1 只提供洗後套裝池專有 ID 的起點'},
  {id:'W7',status:'not-applicable',note:'穿卸／搬移歸屬屬 B2／B4'}
 ];
}

// Executed only inside the disposable worker; calls the native refine function and reads rows. Never patches the game.
function refineDriver(request){
 const runtime=self.__banditValidationRuntime,manager=runtime.GetEventSheetManager(),a=runtime.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();
 const call=(name,...args)=>{const f=manager.GetFunctionBlockByName(name);if(!f)throw Error('Missing native function '+name);const b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};
 const read=(id,z)=>Array.from({length:60},(_,y)=>a.At(id,y,z)),put=(id,z,row)=>row.forEach((v,y)=>a.Set(id,y,z,v));
 const clear=(n)=>{for(let id=1;id<=n;id++)for(const z of [7,9])put(id,z,Array(60).fill(0));};
 if(request.op==='refine')return request.items.map(item=>{
  clear(12);const row=item.record.slice();row[7]=0;put(1,item.plane,row);a.Set(3,2,0,1e9);
  const attempts=[];let hit=false;
  while(!hit&&attempts.length<item.maxAttempts){const souls=a.At(3,2,0);call('词条洗练',1,item.slot,item.plane);const r=read(1,item.plane);attempts.push({row:r,soulCost:souls-a.At(3,2,0)});hit=item.setOnly.includes(r[8+item.slot]);}
  return {key:item.key,plane:item.plane,slot:item.slot,hit,attempts};
 });
 if(request.op==='place'){clear(request.clear);for(const p of request.items)put(p.row,p.plane,p.record);return request.items.map(p=>read(p.row,p.plane));}
 if(request.op==='read')return request.items.map(p=>read(p.row,p.plane));
 throw Error('Unknown refine request '+request.op);
}

async function run({entry,catalogPath,out,playerSave,maxAttempts=400}){
 const {execFileSync}=require('node:child_process'),{evaluate,waitMain}=require('./verify-game.cjs'),{nativeDriver}=require('./set-equipment-level-native.cjs');
 const k=JSON.parse(fs.readFileSync(catalogPath,'utf8')),root=path.resolve(__dirname,'..'),harness=path.join(__dirname,'verify-game.cjs');
 const write=(name,v)=>{const p=path.join(out,name);fs.writeFileSync(p,JSON.stringify(v)+'\n');return sha(p);},log=m=>{fs.appendFileSync(path.join(out,'b1.log'),m+'\n');console.log(m);};
 const sources=verifySources(entry,k),levelFile=path.join(entry.artifactsRoot,'set-equipment-level-B','native-baselines.json'),level=JSON.parse(fs.readFileSync(levelFile,'utf8'));
 assert.deepEqual(level.binding.fingerprints,sources.fingerprints,'等級基準指紋不符');assert.equal(level.results.length,1944);
 const fixedSave=path.join(entry.artifactsRoot,'native-cache-smoke-4IKtSE','baseline','savedir','ea3save.dat');
 const guarded={fixedSave:sha(fixedSave),playerSave:sha(playerSave),levelBaselines:sha(levelFile)};
 // Re-check every existing baseline offline before reuse; any conflict stops B1.
 const levelChecks=level.results.map((v,i)=>checkGeneration(v,{templateId:v.templateId,origin:v.origin,quality:v.quality},k));
 const levelConflicts=levelChecks.flatMap(c=>c.conflicts),levelProblems=levelChecks.flatMap(c=>c.problems);
 if(levelConflicts.length)throw Error('既有基準反證規格: '+levelConflicts.slice(0,5).join('; '));
 log(`level baselines reused: ${level.results.length}, problems ${levelProblems.length}`);
 const port=19400+Math.floor(Math.random()*400),cli=args=>{const o=execFileSync(process.execPath,[harness,...args],{cwd:root,encoding:'utf8',windowsHide:true,timeout:120000});fs.appendFileSync(path.join(out,'steps.log'),JSON.stringify(args)+'\n'+o+'\n');return o;};
 const setupOut=cli(['--setup','--source',entry.source,'--runtime',entry.runtime,'--save-file',fixedSave,'--catalog',catalogPath,'--artifacts',out,'--port',String(port)]);
 const stateFile=setupOut.match(/STATE (.+)/)[1].trim();let state=JSON.parse(fs.readFileSync(stateFile,'utf8'));const firstPid=state.pid;
 const gen=req=>evaluate(state,`(${nativeDriver.toString()})(${JSON.stringify(req)})`),ref=req=>evaluate(state,`(${refineDriver.toString()})(${JSON.stringify(req)})`);
 const report={schemaVersion:1,task:'set-equipment-quality-B1',sourceId:entry.id,sources,guarded,levelBaselines:{file:'set-equipment-level-B/native-baselines.json',count:level.results.length,problems:levelProblems.length},firstPid};
 try{
  cli(['--state',stateFile,'--load','--mode','云存档']);await waitMain(state);await gen({op:'initialize'});
  const missing=missingOriginRows(k,level.results),generated=[];
  for(let off=0;off<missing.length;off+=12){const sel=missing.slice(off,off+12),got=await gen({op:'generate',items:sel});got.forEach((v,i)=>{v.id=sel[i].id;v.points=sel[i].points;});generated.push(...got);if(off%240===0)log(`generated ${generated.length}/${missing.length}`);}
  const genChecks=generated.map((v,i)=>checkGeneration(v,missing[i],k)),genConflicts=genChecks.flatMap(c=>c.conflicts);
  report.generation={hash:write('b1-generation.json',{binding:{fingerprints:sources.fingerprints,driverHash:hash(nativeDriver.toString())},pid:firstPid,cases:missing,results:generated}),count:generated.length,problems:genChecks.flatMap(c=>c.problems).length,conflicts:genConflicts};
  if(genConflicts.length)throw Error('原生取得反證規格: '+genConflicts.slice(0,5).join('; '));
  const q6=[...level.results.filter(v=>v.quality===6),...generated],targets=refineTargets(k,q6),sequences=[];
  // z7 for every target; z9 (unworn) for the set-level baseline origins, so both planes carry a witness.
  const firstOrigins=new Set(level.results.map(v=>v.templateId+':'+v.origin)),jobs=[...targets.map(t=>({t,plane:7})),...targets.filter(t=>firstOrigins.has(t.key)).map(t=>({t,plane:9}))];
  for(let off=0;off<jobs.length;off+=8){const sel=jobs.slice(off,off+8),got=await ref({op:'refine',items:sel.map(j=>({key:j.t.key,record:j.t.record,plane:j.plane,slot:1,setOnly:j.t.setOnly,maxAttempts}))});sequences.push(...got);if(off%160===0)log(`refined ${sequences.length}/${jobs.length}`);}
  const refineChecks=sequences.map((seq,i)=>checkRefine(seq,jobs[i].t,k,jobs[i].plane)),refineConflicts=refineChecks.flatMap(c=>c.conflicts);
  const hitsByPlane={};refineChecks.forEach(c=>{if(c.hit)hitsByPlane[c.plane]=(hitsByPlane[c.plane]||0)+1;});
  report.refine={hash:write('b1-refine.json',{binding:{fingerprints:sources.fingerprints,driverHash:hash(refineDriver.toString())},pid:firstPid,jobs:jobs.map(j=>({key:j.t.key,plane:j.plane,setOnly:j.t.setOnly})),results:sequences}),jobs:jobs.length,hits:refineChecks.filter(c=>c.hit).length,hitsByPlane,misses:refineChecks.filter(c=>!c.hit).length,attempts:sequences.reduce((n,s)=>n+s.attempts.length,0),problems:refineChecks.flatMap(c=>c.problems).length,conflicts:refineConflicts};
  if(refineConflicts.length)throw Error('原生洗練反證規格: '+refineConflicts.slice(0,5).join('; '));
  // IO: place native hits (z7 and z9) plus generated records, native save, stop, new PID, load, read back.
  const hits=sequences.filter((s,i)=>refineChecks[i].hit),pick=(p,n)=>hits.filter(s=>s.plane===p).slice(0,n).map(s=>s.attempts.at(-1).row);
  const ioRecords=[...pick(7,30).map(r=>({plane:7,r})),...pick(9,30).map(r=>({plane:9,r})),...generated.slice(0,10).map(v=>({plane:7,r:v.after}))];
  const counters={7:0,9:0},io=ioRecords.map(({plane,r})=>({plane,row:++counters[plane],record:r}));
  const placed=await ref({op:'place',clear:Math.max(...io.map(p=>p.row)),items:io});assert.deepEqual(placed,io.map(p=>p.record),'放置後讀值不符');
  cli(['--state',stateFile,'--save']);cli(['--state',stateFile,'--stop']);cli(['--state',stateFile,'--restart']);
  state=JSON.parse(fs.readFileSync(stateFile,'utf8'));assert.notEqual(state.pid,firstPid,'重啟 PID 未改變');
  cli(['--state',stateFile,'--load','--mode','存档']);await waitMain(state);
  const back=await ref({op:'read',items:io.map(({plane,row})=>({plane,row}))}),mismatch=io.filter((p,i)=>JSON.stringify(back[i])!==JSON.stringify(p.record)).length;
  report.io={hash:write('b1-io.json',{firstPid,secondPid:state.pid,items:io,readBack:back}),records:io.length,mismatch,firstPid,secondPid:state.pid,saveFileHash:sha(path.join(state.game,'save','ea1save.dat'))};
  const qualities=[...new Set(level.results.map(v=>v.quality))];
  report.witnesses=witnessStatus({levelQualities:qualities,levelCount:level.results.length,generated:generated.length,generationOk:!genConflicts.length,originPoolOk:!genConflicts.length&&!levelConflicts.length,setOnlyHits:report.refine.hits,refineTargets:jobs.length,hitsByPlane});
 }finally{try{cli(['--state',stateFile,'--stop']);}catch{}}
 const after={fixedSave:sha(fixedSave),playerSave:sha(playerSave),levelBaselines:sha(levelFile)};assert.deepEqual(after,guarded,'原檔或既有基準雜湊改變');
 const recheck=verifySources(entry,k);assert.deepEqual(recheck,sources,'快取雜湊改變');report.guardedAfter=after;report.cacheUnchanged=true;
 report.passed=report.io.mismatch===0&&report.refine.hits>0;
 // The B1 baseline bundle: these three result files plus the reused level baselines and the fixed save.
 report.baselineHash=hash({level:guarded.levelBaselines,fixedSave:guarded.fixedSave,generation:report.generation.hash,refine:report.refine.hash,io:report.io.hash});
 fs.writeFileSync(path.join(out,'b1-report.json'),JSON.stringify(report,null,1)+'\n');
 return report;
}
if(require.main===module){
 const argv=process.argv.slice(2),opt=n=>argv.includes(n)?argv[argv.indexOf(n)+1]:undefined,root=path.resolve(__dirname,'..');
 const index=JSON.parse(fs.readFileSync(path.join(root,'.local/game-sources.json'),'utf8')),entry=index.entries.find(e=>e.id===index.preferredDevelopmentSourceId);
 const out=path.resolve(opt('--output'));if(!path.relative(root,out).startsWith('..'))throw Error('Artifacts must stay outside the repo');fs.mkdirSync(out,{recursive:true});
 run({entry,catalogPath:path.join(root,'knowledge/catalog.json'),out,playerSave:path.join(index.installedGameDirectory,'savedir','ea3save.dat'),maxAttempts:Number(opt('--max-attempts')||400)})
  .then(r=>{console.log(JSON.stringify({passed:r.passed,baselineHash:r.baselineHash,generation:r.generation.count,refine:{jobs:r.refine.jobs,hits:r.refine.hits,hitsByPlane:r.refine.hitsByPlane},io:r.io,witnesses:r.witnesses.map(w=>w.id+':'+w.status)}));process.stdout.write('',()=>process.exit(0));})
  .catch(e=>{console.error(e.stack);process.stderr.write('',()=>process.exit(1));});
}
module.exports={verifySources,missingOriginRows,checkGeneration,refineTargets,checkRefine,witnessStatus,refineDriver,synthesisColumns,refineColumns};
