#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {runMigration}=require('./verify-migration.cjs'),{inspectGame,eventDigest}=require('./extract-game.cjs');
const {buildGrowthScenarios}=require('./random-character-growth-scenarios.cjs'),P=require('./random-character-growth-proof.cjs');
const root=path.resolve(__dirname,'..');
function mergeProof({catalog,proof,results,coreSource}){
 const checks=results.checks?.randomCharacterBaseAptitudes,required=require('./verification-requirements.cjs').requiredChecks('randomCharacterBaseAptitudes');
 if(!results.completed||results.copies.length!==2||!results.copies.every(c=>c.ok)||!required.every(c=>checks?.[c]===true))throw Error('新群組隔離矩陣或必要 checks 未完成');
 const next=JSON.parse(JSON.stringify(proof));next.groups.randomCharacterBaseAptitudes=true;
 next.randomCharacterGrowth=P.record(catalog,coreSource,{date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(results.date)),platform:results.platform,checks,coverage:'initial-matrix',copies:results.copies.map(c=>({name:c.name,operations:c.cases}))});
 require('./migration-proof.cjs').mergeInitial(catalog,next,'randomCharacterBaseAptitudes',next.randomCharacterGrowth,results,coreSource);
 const problem=P.problem(catalog,next,coreSource);if(problem)throw Error(problem);
 return {catalog:{...catalog,verification:{...catalog.verification,randomCharacterBaseAptitudes:true}},proof:next};
}
async function main(){
 const args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1];
 if(args.includes('--help')||!['--source','--runtime','--save-file','--artifacts'].every(k=>args.includes(k)))throw Error('Usage: verify-random-character-suite.cjs --source GAME --runtime NWJS --save-file BASE --artifacts OUTSIDE [--package STEAM_GAME_DIR] [--record]');
 const artifacts=fs.realpathSync(opt('--artifacts')),relative=path.relative(root,artifacts);if(!relative||!relative.startsWith('..')&&!path.isAbsolute(relative))throw Error('External artifacts required');
 const k=JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'),'utf8')),proof=JSON.parse(fs.readFileSync(path.join(root,'knowledge/verification.json'),'utf8'));
 const copies=buildGrowthScenarios({catalog:k,saveText:fs.readFileSync(opt('--save-file'),'utf8')}),runDir=fs.mkdtempSync(path.join(artifacts,'random-growth-'));
 console.log('ARTIFACTS '+runDir);
 const setupArgs=['--source',opt('--source'),'--runtime',opt('--runtime'),'--save-file',opt('--save-file'),'--artifacts',runDir,...(args.includes('--package')?['--package',opt('--package')]:[])];
 const results=await runMigration({catalog:k,proof,copies,runDir,setupArgs,keepCopies:args.includes('--keep-copies'),digest:(dir,sids)=>eventDigest(inspectGame(dir),sids)});
 fs.writeFileSync(path.join(runDir,'results.json'),JSON.stringify(results,null,2));
 const merged=mergeProof({catalog:k,proof,results,coreSource:fs.readFileSync(path.join(root,'src/core.js'),'utf8')});
 if(args.includes('--record')){
  const files=['knowledge/catalog.json','knowledge/verification.json','index.html','sw.js',...(proof.schemaVersion===2?['knowledge/migration-baseline.json']:[])].map(f=>path.join(root,f)),backup=files.map(f=>fs.readFileSync(f));
  try{fs.writeFileSync(files[0],JSON.stringify(merged.catalog,null,2)+'\n');fs.writeFileSync(files[1],JSON.stringify(merged.proof,null,2)+'\n');if(merged.proof.schemaVersion===2)fs.writeFileSync(files[4],JSON.stringify(merged.proof.migration.snapshot,null,2)+'\n');for(const mode of [[],['--check']]){const r=spawnSync(process.execPath,[path.join(__dirname,'build-editor.cjs'),...mode],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||r.stdout);}}
  catch(e){files.forEach((f,i)=>fs.writeFileSync(f,backup[i]));throw e;}
  console.log('RECORDED: new group proof only; all existing proofs retained');
 }
 console.log('PASS: initial random growth matrix and lifecycle; '+path.join(runDir,'results.json'));
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={mergeProof};
