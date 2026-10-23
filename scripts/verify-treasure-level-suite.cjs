#!/usr/bin/env node
'use strict';
// First-opening of the two treasure-level groups. Re-validates every raw native result, merges each group's own initial
// record into the composite proof, opens only those flags and rebuilds. Any failure restores all touched files byte for byte.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const D=require('./treasure-level-data.cjs'),P=require('./treasure-level-proof.cjs'),E=require('./treasure-level-evidence.cjs'),R=require('./verification-requirements.cjs');
const root=path.resolve(__dirname,'..'),files=['knowledge/catalog.json','knowledge/verification.json','knowledge/migration-baseline.json','index.html','sw.js'];
function openFlags(text,groups){
 const eol=text.includes('\r\n')?'\r\n':'\n';let next=text;
 for(const g of groups){const closed=`"${g}": false`;if(!next.includes(closed))throw Error('旗標不是關閉狀態：'+g);next=next.replace(closed,`"${g}": true`);}
 return next.split('\r\n').join('\n').split('\n').join(eol);
}
function mergeAll({catalog,proof,validated,core}){
 let next=proof;
 for(const group of D.groups){
  const results={completed:true,checks:{[group]:Object.fromEntries(R.requiredChecks(group).map(c=>[c,true]))},copies:[{name:'treasure-initial-matrix',evidenceHash:validated.stats.evidenceHash}]};
  next=P.mergeProof({catalog,proof:next,group,record:validated.record,results,source:core});
 }
 return next;
}
function record({dir=root,cfg,matrixDir,lifecycleDir,exec=(args)=>spawnSync(process.execPath,[path.join(dir,'scripts/build-editor.cjs'),...args],{cwd:dir,encoding:'utf8'})}){
 const abs=f=>path.join(dir,f),backup=files.map(f=>fs.readFileSync(abs(f))),core=fs.readFileSync(abs('src/core.js'),'utf8');
 const catalogText=backup[0].toString('utf8'),catalog=JSON.parse(catalogText),proof=JSON.parse(backup[1].toString('utf8'));
 if(proof.schemaVersion!==2)throw Error('寶物首次證明只合併到複合證明；請先完成既有群組的遷移寫回');
 if(D.groups.some(g=>catalog.verification[g]!==false))throw Error('寶物群組已不是關閉狀態');
 const validated=E.validate({k:catalog,core,cfg,matrixDir,lifecycleDir}),merged=mergeAll({catalog,proof,validated,core});
 const eol=backup[1].toString('utf8').includes('\r\n')?'\r\n':'\n';
 try{
  fs.writeFileSync(abs(files[0]),openFlags(catalogText,D.groups));
  fs.writeFileSync(abs(files[1]),JSON.stringify(merged,null,2).split('\n').join(eol)+eol);
  fs.writeFileSync(abs(files[2]),JSON.stringify(merged.migration.snapshot,null,2).split('\n').join(eol)+eol);
  for(const args of [[],['--check']]){const r=exec(args);if(r.status!==0)throw Error(String(r.stderr||r.stdout||'build failed').trim());}
  const opened=JSON.parse(fs.readFileSync(abs(files[0]),'utf8')),problem=P.problem(opened,merged,core);
  if(problem)throw Error(problem);
 }catch(error){files.forEach((f,i)=>fs.writeFileSync(abs(f),backup[i]));throw error;}
 return {stats:validated.stats,groups:D.groups};
}
if(require.main===module){
 const opt=n=>process.argv.includes(n)?process.argv[process.argv.indexOf(n)+1]:undefined;
 const cfg=JSON.parse(fs.readFileSync(opt('--config'),'utf8')),base=require('./migration-source.cjs').external(cfg.out);
 const result=record({cfg,matrixDir:path.join(base,'matrix'),lifecycleDir:path.join(base,'lifecycle')});
 console.log(JSON.stringify({opened:result.groups,level:result.stats.level,lifecycle:result.stats.lifecycle,evidenceHash:result.stats.evidenceHash}));
}
module.exports={record,mergeAll,openFlags};
