#!/usr/bin/env node
'use strict';
// B4: first-matrix runner for set-equipment quality. Shards the fixed A9 manifest (base / effect / coefficient / level-cap / pool / reject
// kinds; lifecycle cases have their own runner), resumes from a checkpoint bound to the exact inputs and tools, and writes per-case results
// {id,caseHash,status,passed,nativeCompared,observation}. Results, supply and logs live outside the repo; this never opens a group flag.
//   --output DIR            artifacts directory outside the repo (required)
//   --mode plan|native      plan = offline core-vs-oracle preflight on cases whose starts exist; native = isolated game
//   --shards a-b            shard indexes (default 0-0)   --shard-total N   --kinds k1,k2   --groups g1,g2   --limit N   --batch N
//   --report                print the reconciliation of everything stored under DIR and exit
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const X=require('./set-equipment-quality-matrix.cjs'),M=require('./set-equipment-quality-scenarios.cjs'),D=require('./set-equipment-quality-data.cjs');
const {hash}=D,sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const filler=Object.fromEntries(['baselineHash','runtimeHash','sourceManifestHash','runtimeManifestHash'].map(k=>[k,'0'.repeat(64)]));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),writeAtomic=(p,v)=>{fs.writeFileSync(p+'.tmp',JSON.stringify(v)+'\n');fs.renameSync(p+'.tmp',p);};
const lines=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8').split('\n').filter(Boolean).map(JSON.parse):[];

// ---- pure helpers (unit-tested) ---------------------------------------------------------------------------------------------
function parseShards(text,total){
 const m=/^(\d+)(?:-(\d+))?$/.exec(text||'0');assert.ok(m,'非法 --shards');const a=+m[1],b=m[2]===undefined?a:+m[2];
 assert.ok(a<=b&&b<total,'分片超出範圍');return Array.from({length:b-a+1},(_,i)=>a+i);
}
const shardName=(index,total,kinds,groups)=>`shard-${index}-of-${total}-${hash({kinds,groups:groups??null}).slice(0,8)}`;
function selectionOf(argv){
 const opt=n=>argv.includes(n)?argv[argv.indexOf(n)+1]:undefined;
 return {total:Number(opt('--shard-total')||40),kinds:opt('--kinds')?opt('--kinds').split(','):X.matrixKinds,groups:opt('--groups')?opt('--groups').split(','):undefined};
}
// Reconcile stored result lines with the manifest: every executable matrix case is exactly one of passed / failed / miss / unknown (not run).
function reconcile(manifest,resultLines,kinds=X.matrixKinds){
 const byId=new Map();for(const l of resultLines){const c=X.validateResultLine(manifest,l);assert.ok(!byId.has(l.id)||byId.get(l.id).status!=='passed','重複的通過結果 '+l.id);byId.set(l.id,l);void c;}
 const groups={};
 for(const c of manifest.cases){
  if(!kinds.includes(c.kind))continue;const g=groups[c.group]??={total:0,notApplicable:0,executable:0,passed:0,failed:0,miss:0,unknown:0,contractOnly:0,rejectedByDesign:0,byKind:{}};
  const kd=g.byKind[c.kind]??={executable:0,passed:0,failed:0,miss:0,unknown:0};g.total++;
  if(c.classification===M.classes.na){g.notApplicable++;continue;}
  g.executable++;kd.executable++;const l=byId.get(c.id);
  if(!l){g.unknown++;kd.unknown++;continue;}
  if(l.status==='passed'){g.passed++;kd.passed++;if(l.nativeCompared===false)g.contractOnly++;if(l.observation?.outcome==='reject')g.rejectedByDesign++;}else if(l.status==='failed'){g.failed++;kd.failed++;}else{g.miss++;kd.miss++;}
 }
 const sum=key=>Object.values(groups).reduce((n,g)=>n+g[key],0);
 return {groups,totals:{executable:sum('executable'),passed:sum('passed'),failed:sum('failed'),miss:sum('miss'),unknown:sum('unknown'),contractOnly:sum('contractOnly'),rejectedByDesign:sum('rejectedByDesign')}};
}
// A10 per-case rows for everything passed with a native comparison; the rest is listed, never dropped.
function a10Rows(resultLines){return resultLines.filter(l=>l.status==='passed'&&l.nativeCompared===true).map(l=>({id:l.id,caseHash:l.caseHash,passed:true,nativeCompared:true}));}

// ---- supply (native-derived starting rows) ----------------------------------------------------------------------------------
function loadSupply(levelResults,file){
 const supply=new Map();
 for(const v of levelResults)supply.set('gen:'+X.sk({t:v.templateId,o:v.origin,q:v.quality,p:v.after[23]}),v.after);
 for(const l of lines(file))supply.set(l.key,l.record);
 return supply;
}
const missingNeeds=(cases,k,supply)=>{const out=new Map();for(const c of cases)for(const r of X.needs(c,k)){const key=X.needKey(r);if(!supply.has(key)&&!out.has(key))out.set(key,r);}return [...out.entries()];};

// ---- one case offline / native ----------------------------------------------------------------------------------------------
async function offline(C,m,k,c,supply,source){
 if(c.kind==='reject'&&['stale-proof','incomplete-proof'].includes(c.rejection))return {contract:true,sc:{pieces:[],contractOnly:true,id:c.id,kind:'reject',expect:'reject',injected:[],target:c.to,plane:0,state:null}};
 const sc=X.build(c,k,supply),core=X.runCore(C,m,sc);if(core.pending)core.message=await core.pending;return {sc,core};
}

// ---- game session -----------------------------------------------------------------------------------------------------------
function session({entry,fixedSave,catalogPath,out,root}){
 const {execFileSync}=require('node:child_process'),{evaluate,waitMain}=require('./verify-game.cjs'),harness=path.join(__dirname,'verify-game.cjs');
 const cli=args=>{const o=execFileSync(process.execPath,[harness,...args],{cwd:root,encoding:'utf8',windowsHide:true,timeout:180000});fs.appendFileSync(path.join(out,'steps.log'),JSON.stringify(args)+'\n'+o+'\n');return o;};
 let state,stateFile;
 return {
  async start(){
   const port=19400+Math.floor(Math.random()*400);
   const setup=cli(['--setup','--source',entry.source,'--runtime',entry.runtime,'--save-file',fixedSave,'--catalog',catalogPath,'--artifacts',out,'--port',String(port)]);
   stateFile=setup.match(/STATE (.+)/)[1].trim();state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
   cli(['--state',stateFile,'--load','--mode','云存档']);await waitMain(state);
   const init=await evaluate(state,`(${X.matrixDriver.toString()})(${JSON.stringify({op:'initialize'})})`);return {pid:state.pid,init};
  },
  rpc:request=>evaluate(state,`(${X.matrixDriver.toString()})(${JSON.stringify(request)})`),
  info:()=>state,
  stop(){if(stateFile)try{cli(['--state',stateFile,'--stop']);}catch{}}
 };
}
function acquireLock(out){
 const file=path.join(out,'.game.lock');
 if(fs.existsSync(file)){const pid=Number(fs.readFileSync(file,'utf8'));let alive=false;try{process.kill(pid,0);alive=true;}catch{}if(alive&&pid!==process.pid)throw Error('另一個原生長跑仍在執行（PID '+pid+'）；同時只能開一份遊戲');}
 fs.writeFileSync(file,String(process.pid));return ()=>{try{fs.unlinkSync(file);}catch{}};
}

// ---- A10-shaped output ------------------------------------------------------------------------------------------------------
// Everything stored under DIR as one file: the per-case rows for what passed natively, plus explicit lists for what did not. Not a merge.
function emit(out,manifest,a10Manifest,binding,kinds=X.matrixKinds){
 const all=[];for(const d of fs.readdirSync(out).sort())if(d.startsWith('shard-'))all.push(...lines(path.join(out,d,'results.jsonl')));
 const life=path.join(out,'lifecycle','lifecycle-results.json'),lifeReport=path.join(out,'lifecycle','b4-lifecycle-report.json');
 const lifeLines=[];
 if(fs.existsSync(life)&&fs.existsSync(lifeReport)){
  const rep=read(lifeReport),res=read(life);
  for(const v of res.copies){const c=manifest.cases.find(x=>x.id===v.caseId);assert.ok(c,'未知生命週期案例');lifeLines.push({id:c.id,caseHash:hash(c),status:v.passed?'passed':v.miss?'miss':'failed',passed:v.passed,nativeCompared:true,observation:{attempts:v.attempts,error:v.error}});}
  assert.equal(rep.binding.coreHash,binding.tools.coreHash,'生命週期結果的核心與目前不符');assert.equal(rep.manifestHash,a10Manifest.manifestHash,'生命週期結果的 manifest 與目前不符');
 }
 const rec=reconcile(manifest,[...all,...lifeLines],[...kinds,'lifecycle']);
 const rows=a10Rows([...all,...lifeLines]);
 const notPassed=[...all,...lifeLines].filter(l=>l.status!=='passed').map(l=>({id:l.id,status:l.status,stage:l.stage,error:l.observation?.error||l.observation?.reason}));
 const contractOnly=all.filter(l=>l.status==='passed'&&l.nativeCompared===false).map(l=>l.id);
 const rejectedByDesign=all.filter(l=>l.status==='passed'&&l.observation?.outcome==='reject').length;
 return {schemaVersion:1,task:'set-equipment-quality-B4',mergesProof:false,levelRegression:'B6',manifestHash:a10Manifest.manifestHash,binding,reconciliation:rec,cases:rows,notPassed,contractOnly,rejectedByDesign};
}

// ---- main -------------------------------------------------------------------------------------------------------------------
async function run(argv=process.argv.slice(2)){
 const opt=n=>argv.includes(n)?argv[argv.indexOf(n)+1]:undefined,root=path.resolve(__dirname,'..'),log=m=>{console.log(m);if(out)fs.appendFileSync(path.join(out,'b4.log'),m+'\n');};
 if(!opt('--output')){console.error('套裝品質首次矩陣需要 --output（repo 外的 artifacts 目錄）；未提供，不產生任何驗證結果');process.exitCode=1;return;}
 const out=path.resolve(opt('--output'));if(!path.relative(root,out).startsWith('..'))throw Error('Artifacts must stay outside the repo');fs.mkdirSync(out,{recursive:true});
 const index=read(path.join(root,'.local/game-sources.json')),entry=index.entries.find(e=>e.id===index.preferredDevelopmentSourceId),catalogPath=path.join(root,'knowledge/catalog.json');
 const k=read(catalogPath),source=fs.readFileSync(path.join(root,'src/core.js'),'utf8'),B1=require('./set-equipment-quality-baseline.cjs');
 const sources=B1.verifySources(entry,k),levelFile=path.join(entry.artifactsRoot,'set-equipment-level-B','native-baselines.json'),level=read(levelFile);
 assert.deepEqual(level.binding.fingerprints,sources.fingerprints,'等級基準指紋不符');
 const fixedSave=path.join(entry.artifactsRoot,'native-cache-smoke-4IKtSE','baseline','savedir','ea3save.dat'),playerSave=path.join(index.installedGameDirectory,'savedir','ea3save.dat');
 const b1=read(path.join(entry.artifactsRoot,'set-equipment-quality-B1','run1','b1-report.json'));
 const inputs={baselineHash:b1.baselineHash,runtimeHash:entry.runtimeHash,sourceManifestHash:sources.sourceManifestHash,runtimeManifestHash:sources.runtimeManifestHash};
 const manifest=M.createManifest(k,source,inputs),a10Manifest=M.createManifest(k,source,filler),tools=X.toolBinding(source);
 const sel=selectionOf(argv),mode=opt('--mode')||'plan',binding0={manifestHash:manifest.manifestHash,a10ManifestHash:a10Manifest.manifestHash,inputs,tools};
 if(argv.includes('--emit')){
  const r=emit(out,manifest,a10Manifest,binding0,sel.kinds);const file=path.join(out,'a10-results.json');writeAtomic(file,r);console.log(JSON.stringify({file,sha256:sha(file),totals:r.reconciliation.totals,cases:r.cases.length,notPassed:r.notPassed.length,contractOnly:r.contractOnly.length}));return r;
 }
 if(argv.includes('--report')){
  const all=[];for(const d of fs.readdirSync(out))if(d.startsWith('shard-'))all.push(...lines(path.join(out,d,'results.jsonl')));
  const r=reconcile(manifest,all,sel.kinds);console.log(JSON.stringify(r,null,1));return r;
 }
 const guarded={fixedSave:sha(fixedSave),playerSave:sha(playerSave),levelBaselines:sha(levelFile)};
 const supplyFile=path.join(out,'supply.jsonl'),supply=loadSupply(level.results,supplyFile);
 const C=X.candidateCore(k,source),m=X.sandbox(C),batchSize=Number(opt('--batch')||20),limit=Number(opt('--limit')||Infinity);
 const shards=parseShards(opt('--shards'),sel.total);let release=()=>{},game=null,stopRun=false;
 const binding=binding0;
 writeAtomic(path.join(out,'binding.json'),binding);
 if(mode==='native'){release=acquireLock(out);game=session({entry,fixedSave,catalogPath,out,root});const s=await game.start();log('game started pid '+s.pid);}
 const summaryAll={};
 try{
  for(const index of shards){
   if(stopRun)break;
   const selection={index,total:sel.total,kinds:sel.kinds,groups:sel.groups},cases=M.shard(manifest,selection),dir=path.join(out,shardName(index,sel.total,sel.kinds,sel.groups));fs.mkdirSync(dir,{recursive:true});
   const cpFile=path.join(dir,'checkpoint.json'),resultFile=path.join(dir,'results.jsonl'),cp=X.makeCheckpoint(manifest,selection,tools);
   if(fs.existsSync(cpFile)){const old=read(cpFile);X.validateResumable(manifest,old,tools);assert.deepEqual(old,cp,'checkpoint 與目前選取條件不符');}else writeAtomic(cpFile,cp);
   const done=new Map(lines(resultFile).map(l=>{X.validateResultLine(manifest,l);return [l.id,l];}));
   const pending=cases.filter(c=>!done.has(c.id)).slice(0,limit);let work=0;
   const progress=()=>({shard:index,...X.progressOf(manifest,[...done.values()],cases)});
   for(let off=0;off<pending.length&&!stopRun;off+=batchSize){
    const batch=pending.slice(off,off+batchSize),outLines=[];
    // 1. native-derived starts that are not stored yet
    if(mode==='native'){
     const missing=missingNeeds(batch,k,supply),gens=missing.filter(([,r])=>r.type==='generate'),refs=missing.filter(([,r])=>r.type==='refine');
     for(let i=0;i<gens.length;i+=12){
      const part=gens.slice(i,i+12),got=await game.rpc({op:'generate',items:part.map(([key,r])=>({key,t:r.t,o:r.o,q:r.q,p:r.p,main:r.main||undefined,tier:k.setEquipmentLevel.items[r.t].tier}))});
      got.forEach((v,j)=>{const r=part[j][1];assert.ok(v.after[1]===r.t&&v.after[5]===r.q&&v.after[27]===r.o&&v.after[23]===r.p,'原生取得結果與要求不符 '+v.key);supply.set(v.key,v.after);fs.appendFileSync(supplyFile,JSON.stringify({key:v.key,record:v.after,before:v.before,material:v.material,attempts:v.attempts})+'\n');});
     }
     for(const [key,r] of refs){
      const base=supply.get(X.needKey({type:'generate',t:r.t,o:r.o,q:r.q,p:3}));if(!base)continue;
      const pools=X.poolsOf(k,r.t,r.o),[got]=await game.rpc({op:'refine',items:[{key,record:base,slot:r.slot,setOnly:pools.setOnly,max:X.refineMax}]});
      if(got.hit){const row=got.attempts.at(-1).row;supply.set(key,row);fs.appendFileSync(supplyFile,JSON.stringify({key,record:row,attempts:got.attempts.length})+'\n');}
      else fs.appendFileSync(supplyFile,JSON.stringify({key,miss:true,attempts:got.attempts.length})+'\n');
     }
    }
    // 2. offline: scenario + candidate core vs oracle
    const live=[];
    for(const c of batch){
     const base={id:c.id,caseHash:hash(c)};
     try{
      if(X.needs(c,k).some(r=>!supply.has(X.needKey(r)))){
       const miss=X.needs(c,k).filter(r=>!supply.has(X.needKey(r)));
       if(mode==='native'&&miss.every(r=>r.type==='refine'))outLines.push({...base,status:'miss',passed:false,nativeCompared:false,observation:{reason:'native refine did not reach a P套-only id within '+X.refineMax+' attempts',needs:miss.map(X.needKey)}});
       else if(mode==='native')outLines.push({...base,status:'failed',passed:false,nativeCompared:false,stage:'supply',observation:{error:'缺少原生起點',needs:miss.map(X.needKey)}});
       else live.push(null);
       continue;
      }
      const r=await offline(C,m,k,c,supply,source);
      if(r.contract){const info=X.runContract(c,k,source);outLines.push({...base,status:'passed',passed:true,nativeCompared:false,observation:{outcome:'reject',contractOnly:true,message:info.message}});continue;}
      live.push({c,sc:r.sc,core:r.core,base});
     }catch(e){outLines.push({...base,status:'failed',passed:false,nativeCompared:false,stage:'offline',observation:{error:e.message}});}
    }
    const todo=live.filter(Boolean);
    // 3. native comparison (plan mode keeps the offline result only, never counted as native)
    if(mode==='native'&&todo.length){
     const got=await game.rpc({op:'cases',items:todo.map(v=>X.nativeItem(v.sc,k))});
     todo.forEach((v,i)=>{
      try{const summary=X.validate(C,m,k,v.sc,got[i]);outLines.push({...v.base,status:'passed',passed:true,nativeCompared:true,observation:X.observation(v.sc,summary)});}
      catch(e){
       outLines.push({...v.base,status:'failed',passed:false,nativeCompared:true,stage:'native',refutation:e instanceof X.Refutation,observation:{error:e.message,state:v.sc.state,kind:v.sc.kind,hashes:{start:hash(v.sc.pieces.map(p=>p.record))},raw:got[i]}});
       if(e instanceof X.Refutation&&!argv.includes('--no-stop-on-failure')){stopRun=true;log('REFUTATION '+v.base.id+' '+e.message);}
      }
     });
    }else if(mode==='plan')for(const v of todo)summaryAll.offlineOk=(summaryAll.offlineOk||0)+1;
    // 4. persist: results first, then the progress record (the checkpoint's companion)
    if(mode==='native'&&outLines.length){fs.appendFileSync(resultFile,outLines.map(l=>JSON.stringify(l)).join('\n')+'\n');outLines.forEach(l=>done.set(l.id,l));}
    else for(const l of outLines)if(l.status==='failed'){summaryAll.offlineFailed=(summaryAll.offlineFailed||[]);if(summaryAll.offlineFailed.length<20)summaryAll.offlineFailed.push({id:l.id,error:l.observation.error});summaryAll.offlineFailedCount=(summaryAll.offlineFailedCount||0)+1;}
    work+=batch.length;writeAtomic(path.join(dir,'progress.json'),{...progress(),finished:progress().unknown===0,updatedBy:process.pid});
    if(work%200===0||off+batchSize>=pending.length)log(`shard ${index}/${sel.total}: ${JSON.stringify(progress())}`);
   }
  }
 }finally{if(game)game.stop();release();}
 if(mode==='native'){
  const after={fixedSave:sha(fixedSave),playerSave:sha(playerSave),levelBaselines:sha(levelFile)};assert.deepEqual(after,guarded,'原檔或既有基準雜湊改變');assert.deepEqual(B1.verifySources(entry,k),sources,'快取雜湊改變');
  log('guards unchanged: '+JSON.stringify(after));
 }
 if(mode==='plan')console.log(JSON.stringify(summaryAll));
 return summaryAll;
}
module.exports={session,emit,parseShards,shardName,selectionOf,reconcile,a10Rows,loadSupply,missingNeeds,offline,run};
if(require.main===module)run().then(()=>process.stdout.write('',()=>process.exit(process.exitCode||0))).catch(e=>{console.error(e.stack);process.stderr.write('',()=>process.exit(1));});
