#!/usr/bin/env node
'use strict';
// Treasure-level first-proof matrix runner (task 9). Hidden, muted, isolated game copy; results live outside the repo.
// Phases are resumable shards: `baselines` natively acquires every template × Q1–Q6, `levels` replays the level matrix.
const fs=require('node:fs'),path=require('node:path');
const {waitMain}=require('./verify-game.cjs'),V=require('./verify-treasure-level-native.cjs'),D=require('./treasure-level-data.cjs'),{nativeDriver}=require('./treasure-level-native.cjs');
const {rpc,command}=V,root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),write=(p,v)=>{fs.writeFileSync(p+'.tmp',JSON.stringify(v));fs.renameSync(p+'.tmp',p);};
const sources=k=>({...k.fingerprints,...k.batch2Fingerprints});
const driverHash=()=>D.hash(nativeDriver.toString());
const baselineBinding=k=>({fingerprints:sources(k),dataHash:D.hash(k.treasureLevel),driverHash:driverHash()});
const combos=k=>Object.keys(k.treasureLevel.items).map(Number).flatMap(templateId=>[1,2,3,4,5,6].map(quality=>({templateId,quality,tier:k.treasureLevel.items[templateId].tier})));

// Native acquisition of every template × quality at level 1. An unreachable combination is a recorded gap, never invented.
async function baselines({state,k,out,limit=Infinity,batch=20,log=console.log}){
 const file=path.join(out,'native-baselines.json'),binding=baselineBinding(k),all=combos(k);
 let doc=fs.existsSync(file)?read(file):{schemaVersion:1,binding,results:[]};
 if(JSON.stringify(doc.binding)!==JSON.stringify(binding))throw Error('取得基準的綁定與目前來源／規則／driver 不符，須刪除重建');
 const done=new Set(doc.results.map(r=>`${r.templateId}:${r.quality}`)),todo=all.filter(c=>!done.has(`${c.templateId}:${c.quality}`)).slice(0,limit);
 await rpc(state,{op:'initialize'});
 for(let i=0;i<todo.length;i+=batch){
  const slice=todo.slice(i,i+batch);let got;
  try{got=await rpc(state,{op:'generate',items:slice.map(c=>({...c,level:1}))});}
  catch{got=[];for(const c of slice){try{got.push((await rpc(state,{op:'generate',items:[{...c,level:1}]}))[0]);}catch(e){got.push({templateId:c.templateId,quality:c.quality,gap:String(e.message||e).slice(0,200)});}}}
  doc.results.push(...got.map(g=>g.gap?g:{templateId:g.templateId,quality:g.quality,attempts:g.attempts,record:g.record}));
  write(file,doc);log(`baselines ${doc.results.length}/${all.length}`);
 }
 return {done:doc.results.length,total:all.length,gaps:doc.results.filter(r=>r.gap).length};
}

// ---- Level matrix ---------------------------------------------------------------------------------------------
const crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict');
const S=require('./treasure-level-scenarios.cjs'),O=require('./treasure-level-oracle.cjs');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// Re-hash the cached source and runtime before trusting any native result.
function checkInputs(cfg){
 assert.equal(sha(cfg.baseline),cfg.baselineHash,'原始基準已改變');
 for(const [manifest,dir,count] of [[cfg.sourceManifest,cfg.source,cfg.sourceFiles],[cfg.runtimeManifest,path.dirname(cfg.runtime),cfg.runtimeFiles]]){
  const m=read(manifest);assert.equal(Object.keys(m.files||{}).length,count,'快取 manifest 檔案數不符');
  for(const [name,h] of Object.entries(m.files))assert.equal(sha(path.join(dir,name)),h,'快取內容改變：'+name);
 }
 return {baselineHash:cfg.baselineHash,runtimeHash:cfg.sourceEntry.runtimeHash,sourceManifestHash:sha(cfg.sourceManifest)};
}
const wpRows=cfg=>read(path.join(cfg.source,'wp.json')).data.map(row=>row.map(c=>c[0]));
function manifestFor(cfg,k){const inputs=checkInputs(cfg);return {inputs,manifest:S.createManifest(k,wpRows(cfg),inputs)};}
// The final core with both treasure flags opened in a throwaway context; the repository catalog stays closed.
function candidateCore(k,core){
 const candidate=structuredClone(k);candidate.verification.backpackTreasureLevel=candidate.verification.treasureLevel=true;
 const ctx={};vm.runInNewContext(core.replace('/*__KNOWLEDGE__*/null',JSON.stringify(candidate)),ctx);return ctx.SaveCore;
}
const planeOf=state=>state==='backpack'?7:9;
function coreEdit(C,before,c){
 const plane=planeOf(c.state),data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));
 data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='合成角色';
 before.forEach((v,y)=>data[20][y][plane]=v);if(c.state==='equipped')data[1][21][2]=20;
 const model=C.parse(JSON.stringify({c2array:true,size:[221,60,22],data}));
 C.setEquipmentLevel(model,{itemId:20,plane,level:c.to});
 assert.equal(model.changes.size,1);
 return Array.from({length:60},(_,y)=>C.get(model,{x:20,y,z:plane}));
}
const beforeRecord=(baseline,c)=>{const r=baseline.get(`${c.templateId}:${c.quality}`).slice();r[6]=c.from;r[7]=c.state==='equipped'?1:0;return r;};
// Raw observation → verdict. Expectations come from the oracle and the native upgrade, never from the edited record alone.
function validateLevel(observed,c,before,after,k){
 O.assertLevelOnly(before,after,c.to);
 const expected=O.components(after,k.treasureLevel,k.affixReplacement);
 // Per-slot function values are compared with the oracle where a static formula exists; the character-level total only has to be finite.
 assert.equal(observed.components.length,expected.length,'成分數量不符');
 expected.forEach((e,i)=>{const o=observed.components[i];assert.deepEqual([o.kind,o.id,o.coefficient,o.setting],[e.kind,e.id,e.coefficient,e.setting],'成分輸入不符');assert.ok(Number.isFinite(o.value),'原生成分不是有限值');if(e.value!==null)assert.ok(Math.abs(o.value-e.value)<1e-8,`${e.kind} ${e.id} 與 oracle 不符`);});
 assert.ok(observed.totals.every(v=>Number.isFinite(v[1])),'原生總值不是有限值');
 if(c.to===c.from+1){
  const u=observed.upgrade;assert.ok(u,'缺原生升級觀察');
  assert.equal(u.soulCost,O.souls(c.tier,c.from),'原生魂魄成本與 oracle 不符');
  const upto=c.state==='backpack'?50:60;
  for(let y=0;y<upto;y++)assert.equal(u.upgraded[y],after[y],'原生升級結果與編輯結果不同 y'+y);
  for(let y=0;y<upto;y++)if(y!==6)assert.equal(u.upgraded[y],u.moved[y],'原生升級改動了等級外欄位 y'+y);
 }else assert.ok(!observed.upgrade,'降級沒有原生路徑');
 return true;
}
function levelCases(manifest){return manifest.cases.filter(c=>c.kind==='level');}
async function levels({state,k,cfg,out,shard={index:0,total:1},core,batchSize=0,log=console.log}){
 const {manifest}=manifestFor(cfg,k),baselines=read(path.join(out,'native-baselines.json'));
 assert.equal(JSON.stringify(baselines.binding),JSON.stringify(baselineBinding(k)),'取得基準綁定不符');assert.equal(baselines.results.length,1020);
 const baseline=new Map(baselines.results.map(r=>{assert.ok(r.record,'取得缺口：'+r.templateId+':'+r.quality);return [`${r.templateId}:${r.quality}`,r.record];}));
 const C=candidateCore(k,core),file=path.join(out,`native-levels-${shard.index}-of-${shard.total}.json`),binding={...baselineBinding(k),manifestHash:manifest.manifestHash,coreHash:D.hash(core)};
 let doc=fs.existsSync(file)?read(file):{schemaVersion:1,mode:'native',binding,shard,results:[]};
 assert.equal(JSON.stringify(doc.binding),JSON.stringify(binding),'分片綁定與目前來源／核心／manifest 不符，須刪除重建');
 const mine=S.shard(manifest,{...shard,kinds:['level']}),done=new Set(doc.results.map(r=>r.id)),todo=mine.filter(c=>!done.has(c.id)),byTemplate=new Map();
 for(const c of todo)(byTemplate.get(c.templateId)||byTemplate.set(c.templateId,[]).get(c.templateId)).push(c);
 await rpc(state,{op:'initialize'});
 for(const [templateId,cases] of byTemplate){
  const t=k.treasureLevel.items[templateId],before=cases.map(c=>beforeRecord(baseline,c)),after=cases.map((c,i)=>coreEdit(C,before[i],c));
  const totals=await rpc(state,{op:'effects',attributes:t.mainAttributes.filter(Boolean),items:cases.map((c,i)=>({id:c.id,record:after[i]}))});
  const parts=cases.flatMap((c,i)=>O.components(after[i],k.treasureLevel,k.affixReplacement).map((p,j)=>({id:`${i}:${j}`,level:after[i][6],tier:after[i][3],attribute:p.id,coefficient:p.coefficient,setting:p.setting,mode:p.kind,quality:after[i][5],meta:p})));
  const native=await rpc(state,{op:'single',items:parts.map(({meta,...p})=>p)}),componentsOf=cases.map(()=>[]);
  parts.forEach((p,n)=>componentsOf[+p.id.split(':')[0]].push({kind:p.meta.kind,id:p.meta.id,coefficient:p.meta.coefficient,setting:p.meta.setting,value:native[n].value}));
  const up=cases.map((c,i)=>({c,i})).filter(({c})=>c.to===c.from+1);
  const upgrades=up.length?await rpc(state,{op:'level',items:up.map(({c,i})=>({id:c.id,state:c.state,before:before[i],from:c.from,to:c.to,souls:1e12}))}):[];
  const upMap=new Map(up.map(({c},j)=>[c.id,upgrades[j]]));
  cases.forEach((c,i)=>{
   const observed={totals:totals[i].values,components:componentsOf[i],...(upMap.has(c.id)?{upgrade:{moved:upMap.get(c.id).moved,upgraded:upMap.get(c.id).upgraded,soulCost:upMap.get(c.id).soulCost}}:{})};
   let passed=true,error;try{validateLevel(observed,c,before[i],after[i],k);}catch(e){passed=false;error=String(e.message).slice(0,300);}
   doc.results.push({id:c.id,caseHash:S.hash(c),passed,...(error?{error}:{}),before:before[i],after:after[i],observed,nativeCompared:true});
  });
  write(file,doc);
  if(doc.results.length%1000<cases.length)log(`levels ${doc.results.length}/${mine.length} failed ${doc.results.filter(r=>!r.passed).length}`);
 }
 return {shard,total:mine.length,done:doc.results.length,failed:doc.results.filter(r=>!r.passed).length};
}


// ---- Cost / decompose / reject phases -------------------------------------------------------------------------
const firstOfTier=(k,tier)=>+Object.keys(k.treasureLevel.items).find(i=>k.treasureLevel.items[i].tier===tier);
function costInput(baseline,k,c){
 const record=baseline.get(`${firstOfTier(k,c.tier)}:${c.quality}`).slice(),level=c.mode==='at-cap'?O.cap(c.quality):1;record[6]=level;
 const cost=O.souls(c.tier,level),souls=c.mode==='insufficient'?cost-1:['exact','partial-max'].includes(c.mode)?cost:1e12;
 return {record,souls,maximum:['partial-max','maximum','at-cap'].includes(c.mode)};
}
function validateCost(observed,c,input){
 const e=O.upgrade({tier:c.tier,quality:c.quality,level:input.record[6],souls:input.souls},input.maximum);
 assert.equal(observed.record[6],e.level);assert.equal(observed.souls,e.souls);O.assertLevelOnly(input.record,observed.record,e.level);return true;
}
function decomposeInput(baseline,k,c){
 const row=baseline.get(`${firstOfTier(k,c.tier)}:${c.quality}`).slice();row[6]=c.level;row[22]=c.mode==='batch-locked'?1:0;
 return {row,mode:c.mode==='single'?'single':'batch',quality:6,souls:c.souls};
}
function validateDecompose(observed,c,input){
 const expected=c.mode==='single'?O.decompose(input.row,{souls:input.souls}):O.batchDecompose([input.row],{quality:input.quality,souls:input.souls});
 assert.equal(observed.souls,expected.souls);
 const cleared=observed.rows[0].every(v=>v===0);
 if(c.mode==='batch-locked'){assert.equal(expected.removed,0);assert.deepEqual(observed.rows[0],input.row,'鎖定列不應被批次分解');}
 else assert.ok(cleared,'分解後背包列未清空');
 return true;
}
function baselineMap(out,k){
 const baselines=read(path.join(out,'native-baselines.json'));
 assert.equal(JSON.stringify(baselines.binding),JSON.stringify(baselineBinding(k)),'取得基準綁定不符');assert.equal(baselines.results.length,1020);
 return new Map(baselines.results.map(r=>{assert.ok(r.record,'取得缺口：'+r.templateId+':'+r.quality);return [`${r.templateId}:${r.quality}`,r.record];}));
}
async function simplePhase({name,kind,state,k,cfg,out,core,run}){
 const {manifest}=manifestFor(cfg,k),baseline=baselineMap(out,k),file=path.join(out,`native-${name}.json`),binding={...baselineBinding(k),manifestHash:manifest.manifestHash,coreHash:D.hash(core)};
 const cases=manifest.cases.filter(c=>c.kind===kind),results=await run({cases,baseline});
 write(file,{schemaVersion:1,mode:name==='rejects'?'synthetic':'native',binding,results});
 return {name,total:cases.length,failed:results.filter(r=>!r.passed).length};
}
const costsPhase=args=>simplePhase({...args,name:'costs',kind:'cost',run:async({cases,baseline})=>{
 await rpc(args.state,{op:'initialize'});const inputs=cases.map(c=>costInput(baseline,args.k,c));
 const got=await rpc(args.state,{op:'costs',items:cases.map((c,i)=>({id:c.id,...inputs[i]}))});
 return cases.map((c,i)=>{const observed={record:got[i].record,souls:got[i].souls};let passed=true,error;try{validateCost(observed,c,inputs[i]);}catch(e){passed=false;error=String(e.message).slice(0,300);}return {id:c.id,caseHash:S.hash(c),passed,...(error?{error}:{}),input:inputs[i],observed,nativeCompared:true};});
}});
const decomposePhase=args=>simplePhase({...args,name:'decompose',kind:'decompose',run:async({cases,baseline})=>{
 await rpc(args.state,{op:'initialize'});const inputs=cases.map(c=>decomposeInput(baseline,args.k,c));
 const got=await rpc(args.state,{op:'decompose',items:cases.map((c,i)=>({id:c.id,mode:inputs[i].mode,quality:inputs[i].quality,souls:inputs[i].souls,rows:[inputs[i].row]}))});
 return cases.map((c,i)=>{const observed={rows:got[i].rows,souls:got[i].souls};let passed=true,error;try{validateDecompose(observed,c,inputs[i]);}catch(e){passed=false;error=String(e.message).slice(0,300);}return {id:c.id,caseHash:S.hash(c),passed,...(error?{error}:{}),input:inputs[i],observed,nativeCompared:true};});
}});
// Policy rejections need no game: the final core must refuse every one and leave bytes and history unchanged.
const rejectsPhase=args=>simplePhase({...args,name:'rejects',kind:'reject',run:async({cases})=>{
 const run=require('./treasure-level-synthetic.cjs').createSyntheticRunner(args.k,args.core);
 return cases.map(c=>{let passed=true,error;try{assert.equal(run(c).rejected,true);}catch(e){passed=false;error=String(e.message).slice(0,300);}return {id:c.id,caseHash:S.hash(c),passed,...(error?{error}:{}),nativeCompared:false};});
}});

async function main(argv){
 const opt=n=>argv.includes(n)?argv[argv.indexOf(n)+1]:undefined,cfg=read(opt('--config')),k=read(path.join(root,'knowledge/catalog.json')),out=require('./migration-source.cjs').external(cfg.out+'/matrix');
 const phase=opt('--phase'),limit=opt('--limit')?Number(opt('--limit')):Infinity;
 let stateFile;
 try{
  stateFile=command(['--setup','--source',cfg.source,'--runtime',cfg.runtime,'--save-file',cfg.baseline,'--artifacts',out,'--port',String(opt('--port')||19490)]).match(/STATE (.+)/)[1].trim();
  command(['--state',stateFile,'--load']);const state=read(stateFile);await waitMain(state);
  if(phase==='baselines')console.log(JSON.stringify(await baselines({state,k,out,limit})));
  else if(phase==='levels'){const total=Number(opt('--shard-total')||1),index=Number(opt('--shard-index')||0);console.log(JSON.stringify(await levels({state,k,cfg,out,shard:{index,total},core:fs.readFileSync(path.join(root,'src/core.js'),'utf8')})));}
  else if(['costs','decompose','rejects'].includes(phase)){const core=fs.readFileSync(path.join(root,'src/core.js'),'utf8');console.log(JSON.stringify(await({costs:costsPhase,decompose:decomposePhase,rejects:rejectsPhase})[phase]({state,k,cfg,out,core})));}
  else throw Error('未知階段 '+phase);
 }finally{if(stateFile)try{command(['--state',stateFile,'--stop']);}catch(e){console.error('stop failed: '+e.message);}}
}
if(require.main===module)main(process.argv.slice(2)).then(()=>process.stdout.write('',()=>process.exit(0))).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={costsPhase,decomposePhase,rejectsPhase,validateCost,validateDecompose,costInput,decomposeInput,baselineMap,baselines,levels,validateLevel,coreEdit,candidateCore,beforeRecord,manifestFor,baselineBinding,combos,sources};
