#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const P=require('./random-character-skill-caps-proof.cjs');
const root=path.resolve(__dirname,'..');
// First opening is independent of representative migration: revalidate raw native reports and the full manifest.
function mergeProof({catalog,proof,results,coreSource}){
 P.requireNativeRunner();
 const validated=P.validateResults(catalog,coreSource,results,{initial:true});
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(results.date));
 const next=structuredClone(proof);next.groups={...next.groups,[P.group]:true};
 next[P.group]=P.record(catalog,coreSource,{date,platform:results.platform,...validated,coverage:'initial-matrix',copies:results.copies.map(c=>({name:c.name,operations:c.cases}))});
 require('./migration-proof.cjs').mergeInitial(catalog,next,P.group,next[P.group],results,coreSource);
 const problem=P.problem(catalog,next,coreSource);if(problem)throw Error(problem);
 return {catalog:{...catalog,verification:{...catalog.verification,[P.group]:true}},proof:next};
}
// A failed write, build or synchronization check restores all four files byte for byte.
function recordProof({dir=root,catalog,proof,results,exec=(script,args)=>spawnSync(process.execPath,[path.join(dir,'scripts',script),...args],{cwd:dir,encoding:'utf8'})}){
 for(const [file,expected]of [['catalog.json',catalog],['verification.json',proof]])if(JSON.stringify(JSON.parse(fs.readFileSync(path.join(dir,'knowledge',file),'utf8')))!==JSON.stringify(expected))throw Error('驗證期間知識或既有證明已改變，拒絕覆寫：'+file);
 const merged=mergeProof({catalog,proof,results,coreSource:fs.readFileSync(path.join(dir,'src/core.js'),'utf8')});
 const files=['knowledge/catalog.json','knowledge/verification.json','index.html','sw.js',...(proof.schemaVersion===2?['knowledge/migration-baseline.json']:[])].map(f=>path.join(dir,f)),backup=files.map(f=>fs.readFileSync(f));
 try{
  fs.writeFileSync(files[0],JSON.stringify(merged.catalog,null,2)+'\n');fs.writeFileSync(files[1],JSON.stringify(merged.proof,null,2)+'\n');
  if(merged.proof.schemaVersion===2)fs.writeFileSync(files[4],JSON.stringify(merged.proof.migration.snapshot,null,2)+'\n');
  for(const args of [[],['--check']]){const result=exec('build-editor.cjs',args);if(result.status!==0)throw Error(String(result.stderr||result.stdout||'build failed').trim());}
 }catch(error){files.forEach((f,i)=>fs.writeFileSync(f,backup[i]));throw error;}
 return merged;
}
async function main(){
 const args=process.argv.slice(2),opt=k=>{const i=args.indexOf(k);return i<0?undefined:args[i+1];};
 const usage='verify-skill-caps-suite.cjs --source PREPARED_GAME --runtime NWJS --save-file BASE.dat --artifacts OUTSIDE_REPO [--package STEAM_GAME_DIR] [--record] [--keep-copies]';
 if(args.includes('--help')){console.log(usage);return;}
 if(!['--source','--runtime','--save-file','--artifacts'].every(k=>opt(k)))throw Error(usage);
 P.requireNativeRunner();
 const artifacts=fs.realpathSync(opt('--artifacts')),relative=path.relative(root,artifacts);
 if(!relative||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep)))throw Error('Validation artifacts must stay outside the repo');
 const catalog=JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'),'utf8')),proof=JSON.parse(fs.readFileSync(path.join(root,'knowledge/verification.json'),'utf8'));
 const copies=require('./random-character-skill-caps-scenarios.cjs').buildSkillCapScenarios({catalog,saveText:fs.readFileSync(opt('--save-file'),'utf8'),representative:false});
 const runDir=fs.mkdtempSync(path.join(artifacts,'skill-caps-'));console.log('ARTIFACTS '+runDir);
 const setupArgs=['--source',opt('--source'),'--runtime',opt('--runtime'),'--save-file',opt('--save-file'),'--artifacts',runDir,...(opt('--package')?['--package',opt('--package')]:[])];
 const {inspectGame,eventDigest}=require('./extract-game.cjs');
 const results=await require('./verify-migration.cjs').runMigration({catalog,proof,copies,runDir,setupArgs,keepCopies:args.includes('--keep-copies'),digest:(dir,sids)=>eventDigest(inspectGame(dir),sids)});
 mergeProof({catalog,proof,results,coreSource:fs.readFileSync(path.join(root,'src/core.js'),'utf8')});
 if(args.includes('--record')){recordProof({catalog,proof,results});console.log('RECORDED: full initial skill-cap proof; existing groups retained');}
 console.log('PASS: full initial skill-cap matrix and lifecycle; '+path.join(runDir,'results.json'));
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={mergeProof,recordProof};
