'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const Core=require('./core-source-proof.cjs');
const A=require('./migration-analysis.cjs'),P=require('./migration-proof.cjs'),Source=require('./migration-source.cjs');
const {availableCopies,validateNames,buildScenarios}=require('./migration-scenarios.cjs');
const root=path.resolve(__dirname,'..');
function selectNames(plan) {
  return Object.entries(availableCopies).filter(([name,family])=>{
    const s=plan.families[family];if(!s)return false;
    if(name==='advanced-followup')return s.lifecycle;
    if(name.startsWith('advanced-'))return s.effects;
    if(/-(?:matrix|representative)$/.test(name))return s.effects;
    if(name.endsWith('-lifecycle'))return s.lifecycle;
    return s.effects||s.lifecycle;
  }).map(([name])=>name);
}
function inputIdentity({catalog,copies,runtime,saveText,plan}) {
  const scripts=fs.readdirSync(path.join(root,'scripts')).filter(n=>n.endsWith('.cjs')).sort().map(n=>[n,A.sha(fs.readFileSync(path.join(root,'scripts',n)))]);
  const runtimeDir=path.dirname(path.resolve(runtime)),runtimeFiles=fs.readdirSync(runtimeDir,{withFileTypes:true}).filter(d=>d.isFile()&&(/\.(dll|pak|bin)$/i.test(d.name)||['icudtl.dat',path.basename(runtime)].includes(d.name))).map(d=>d.name);
  if(fs.existsSync(path.join(runtimeDir,'locales')))runtimeFiles.push(...fs.readdirSync(path.join(runtimeDir,'locales')).map(n=>'locales/'+n));
  const runtimeHashes=runtimeFiles.sort().map(n=>[n,A.sha(fs.readFileSync(path.join(runtimeDir,n)))]);
  if(process.platform==='darwin'){
    runtimeHashes.length=0;const app=path.resolve(runtime,'../../..');
    const walk=dir=>{for(const name of fs.readdirSync(dir).sort()){const file=path.join(dir,name),stat=fs.lstatSync(file);if(stat.isDirectory())walk(file);else runtimeHashes.push([path.relative(app,file),stat.isSymbolicLink()?fs.readlinkSync(file):A.sha(fs.readFileSync(file))]);}};
    walk(app);
  }
  return A.sha({catalog,plan,scripts,runtime:runtimeHashes,save:A.sha(saveText),core:A.sha(fs.readFileSync(path.join(root,'src/core.js'))),coreIdentityPolicy:['scripts/vendor/acorn.cjs','knowledge/core-ast-baselines.json'].map(n=>[n,fs.existsSync(path.join(root,n))?A.sha(fs.readFileSync(path.join(root,n))):null]),copies:copies.map(c=>({name:c.name,scenario:c.scenario,batch:c.batchRequests,lifecycle:c.lifecycle,formulas:c.formulas}))});
}
function writeSelective({dir=root,catalog,previous,base,current,plan,results,steamBuild,expectedState,exec=(args)=>spawnSync(process.execPath,['scripts/build-editor.cjs',...args],{cwd:dir,encoding:'utf8'})}) {
  if(A.same(base.fingerprints,current.fingerprints)&&Core.same(base,current)&&A.same(base.roles,current.roles)&&A.same(base.dataHashes,current.dataHashes))return {action:'compared',consistent:results.completed};
  if(!results.completed||!A.same(results.copies.map(c=>c.name).sort(),selectNames(plan).sort()))return {action:'skipped',reason:'選跑副本尚未完整完成'};
  if(plan.families.equipmentQuality?.formulas&&!results.copies.some(c=>c.family==='equipmentQuality'&&c.steps.some(s=>s.step==='formulas'&&s.ok)))return {action:'skipped',reason:'缺少共用公式比對'};
  const M=require('./verify-migration.cjs'),derived=M.provenChecks(results.copies,{},results.skillCapsBinding,catalog);
  if(!A.same(derived,results.checks))return {action:'skipped',reason:'傳入 checks 與完成步驟／原生觀察不符'};
  let next;
  try{next=P.compose({catalog,previous,base,current,plan,results,steamBuild});}catch(e){return {action:'skipped',reason:e.message};}
  const gated={...catalog,verification:{...next.groups}},issue=P.problem(gated,next,fs.readFileSync(path.join(dir,'src/core.js'),'utf8'));
  if(issue)return {action:'skipped',reason:issue};
  const names=['knowledge/catalog.json','knowledge/verification.json','knowledge/migration-baseline.json','index.html','sw.js'],files=names.map(n=>path.join(dir,n));
  if(expectedState&&Object.entries(expectedState).some(([name,hash])=>!fs.existsSync(path.join(dir,name))||A.sha(fs.readFileSync(path.join(dir,name)))!==hash))return {action:'skipped',reason:'驗證期間知識、證明或發布來源已改變，拒絕覆寫'};
  const backups=files.map(f=>fs.existsSync(f)?fs.readFileSync(f):null);
  try {
    for(const [file,value]of [[files[0],gated],[files[1],next],[files[2],current]])fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
    for(const args of [[],['--check']]){const r=exec(args);if(r.status!==0)throw Error(String(r.stderr||r.stdout||r.error));}
  }catch(e){files.forEach((f,i)=>backups[i]===null?fs.rmSync(f,{force:true}):fs.writeFileSync(f,backups[i]));return {action:'restored',reason:e.message};}
  return {action:'written',opened:Object.keys(next.groups).filter(g=>next.groups[g]),ui:'deferred'};
}
async function main(M) {
  const args=process.argv.slice(2),opt=key=>args.includes(key)?args[args.indexOf(key)+1]:undefined;
  if(args.includes('--help')||!opt('--artifacts')||(!opt('--source')&&!opt('--package'))){
    console.log('verify-migration.cjs --source GAME_OR_STATIC_SOURCE (or --package STEAM_GAME_DIR) --artifacts EXTERNAL_DIR [--catalog CANDIDATE.json] [--mode auto|full] [--plan] [--baseline] [--previous-source GAME (plan only)] [--runtime NWJS --save-file BASE.dat] [--resume RUN_DIR] [--copies name,name] [--keep-copies] [--verbose]');return;
  }
  const mode=opt('--mode')||'auto';if(!['auto','full'].includes(mode))throw Error('Unknown migration mode: '+mode);
  const only=opt('--copies')?.split(',');validateNames(only);
  if(opt('--previous-source')&&!args.includes('--plan'))throw Error('--previous-source is for replay planning only');
  const artifacts=Source.external(opt('--artifacts')),catalog=JSON.parse(fs.readFileSync(opt('--catalog')||path.join(root,'knowledge/catalog.json'),'utf8'));
  const previous=JSON.parse(fs.readFileSync(path.join(root,'knowledge/verification.json'),'utf8')),core=fs.readFileSync(path.join(root,'src/core.js'),'utf8');
  const expectedState=Object.fromEntries(['knowledge/catalog.json','knowledge/verification.json','knowledge/migration-baseline.json','knowledge/core-ast-baselines.json','index.html','sw.js'].filter(n=>fs.existsSync(path.join(root,n))).map(n=>[n,A.sha(fs.readFileSync(path.join(root,n)))]));
  const reportFile=path.join(artifacts,'migration-plan.json');
  let source=opt('--source')||Source.prepare(opt('--package'),artifacts).source,current;
  try {
    const analysisSource=process.platform==='darwin'&&opt('--package')?Source.prepare(opt('--package'),artifacts).source:source;
    const game=require('./extract-game.cjs').inspectGame(analysisSource);
    current={...A.snapshot(game,core),gameVersion:catalog.gameVersion,dataHashes:Object.fromEntries(Object.keys(catalog.verification).map(g=>[g,P.dataHash(catalog,g)]))};
  }catch(e){fs.writeFileSync(reportFile,JSON.stringify({blocked:true,reason:e.message,computerUse:false},null,2));throw Error('靜態分析失敗，保留既有發布版；見 '+reportFile+': '+e.message);}
  const baselineFile=path.join(root,'knowledge/migration-baseline.json');
  if(args.includes('--baseline')){
    const verified=spawnSync(process.execPath,['scripts/build-editor.cjs','--check'],{cwd:root,encoding:'utf8'});
    if(verified.status!==0)throw Error('既有證明未通過建置檢查：'+verified.stderr);
    const b=previous.schemaVersion===2?previous.migration.snapshot:P.baseline(catalog,previous,current);
    if(!A.same(b.fingerprints,current.fingerprints)||!Core.same(b,current))throw Error('基準來源與現有證明不符');
    fs.writeFileSync(baselineFile,JSON.stringify(b,null,2)+'\n');console.log('BASELINE: 相符已驗證來源；未啟動遊戲');return;
  }
  let base=JSON.parse(fs.readFileSync(baselineFile,'utf8'));
  if(opt('--previous-source')){
    const oldGame=require('./extract-game.cjs').inspectGame(opt('--previous-source'));
    base={...A.snapshot(oldGame,core),gameVersion:'previous-source',dataHashes:current.dataHashes};
  }
  const groups=Object.keys(previous.groups).filter(g=>previous.groups[g]),plan=P.selection(base,current,groups,{mode});
  const names=only||selectNames(plan);
  fs.writeFileSync(reportFile,JSON.stringify({gameVersion:catalog.gameVersion,announcement:opt('--announcement')||null,plan,copies:names,previous:base,current},null,2));
  console.log(JSON.stringify({mode,sameSource:plan.sameSource,blocked:plan.blocked,copies:names,formulaMatrices:Object.values(plan.families).filter(f=>f.formulas).length,computerUse:false,report:reportFile}));
  if(plan.blocked)throw Error('無法解析相依資訊；保留既有發布版');
  if(args.includes('--plan'))return;
  if(mode==='auto'&&plan.sameSource&&!names.length&&!only){console.log('UNCHANGED: 沿用既有證明；未啟動遊戲');return;}
  if(!A.same(P.allSources(catalog),current.fingerprints))throw Error('候選 catalog 尚未對齊實際來源；請先檢查分析報告並重建知識');
  if(names.length&&(!opt('--runtime')||!opt('--save-file')))throw Error('選跑原生測試需要 --runtime 與 --save-file');
  if(names.length&&process.platform==='darwin'&&!opt('--source'))throw Error('Mac 原生測試需 --source 指定依 launcher 指引準備的完整副本');
  if(names.length&&!fs.existsSync(path.join(source,'package.json'))){if(!opt('--package'))throw Error('原生測試需要完整來源或 --package');source=Source.prepare(opt('--package'),artifacts,{full:true}).source;}
  const saveText=names.length?fs.readFileSync(opt('--save-file'),'utf8'):'';
  const copies=names.length?buildScenarios({catalog,saveText,names}):[];
  for(const copy of copies){const spec=plan.families[copy.family];if(!only){copy.lifecycle=copy.lifecycle&&!!spec?.lifecycle;copy.formulas=!!spec?.formulas;}}
  const runDir=opt('--resume')?Source.external(opt('--resume')):fs.mkdtempSync(path.join(artifacts,'migration-'));
  const setupArgs=['--source',source,'--runtime',opt('--runtime')||'','--save-file',opt('--save-file')||'','--artifacts',runDir,'--catalog',path.resolve(opt('--catalog')||path.join(root,'knowledge/catalog.json')),...(opt('--package')?['--package',opt('--package')]:[])];
  const identity=names.length?inputIdentity({catalog,copies,runtime:opt('--runtime'),saveText,plan}):A.sha({catalog,plan,current});
  const results=await M.runMigration({catalog,proof:previous,copies,runDir,setupArgs,identity,resume:!!opt('--resume'),keepCopies:args.includes('--keep-copies'),log:args.includes('--verbose')?console.log:()=>{}});
  const packageInput=opt('--package');
  const packageDir=packageInput?(fs.statSync(packageInput).isDirectory()?packageInput:path.dirname(packageInput)):null;
  const manifest=packageDir&&path.resolve(packageDir,'../../appmanifest_4267800.acf');
  const steamBuild=manifest&&fs.existsSync(manifest)?/"buildid"\s+"(\d+)"/.exec(fs.readFileSync(manifest,'utf8'))?.[1]:null;
  if(!only)results.writeBack=writeSelective({catalog,previous,base,current,plan,results,steamBuild,expectedState});
  fs.writeFileSync(path.join(runDir,'results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({completed:results.completed,copies:results.copies.length,warnings:results.warnings.length,writeBack:results.writeBack&&{action:results.writeBack.action,reason:results.writeBack.reason,opened:results.writeBack.opened?.length},failure:results.copies.find(c=>!c.ok)?.steps.at(-1)?.error,results:path.join(runDir,'results.json')}));
  if(!results.completed||['skipped','restored'].includes(results.writeBack?.action))process.exitCode=1;
}
module.exports={selectNames,inputIdentity,writeSelective,main};
