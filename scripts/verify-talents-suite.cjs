#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const P=require('./random-character-talents-proof.cjs');
const root=path.resolve(__dirname,'..');
// Evidence of each passing copy, found by the scenario file name its oracle recorded.
function attachEvidence(results,runDir){
 const states=fs.readdirSync(runDir).map(n=>path.join(runDir,n,'state.json')).filter(f=>fs.existsSync(f));
 for(const copy of results.copies.filter(c=>c.family===P.group&&!c.evidence)){
  const matches=states.filter(f=>{const e=P.readEvidence(f);return (copy.lifecycle?e.lifecycle?.scenario:e.effects?.scenario)===copy.name+'.json'&&(copy.lifecycle?!e.effects?.coverage||e.effects.coverage==='lifecycle':!e.lifecycle);});
  if(matches.length!==1)throw Error('Evidence for '+copy.name+' not found exactly once');
  copy.evidence=P.readEvidence(matches[0]);
 }
 return results;
}
function mergeProof({catalog,proof,results,coreSource,proofText}){
 const native=P.validateResults(catalog,coreSource,results,{initial:true});
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(results.date));
 const record=P.record(catalog,coreSource,{date,platform:results.platform,...native,coverage:'initial-matrix'});
 const next=JSON.parse(JSON.stringify(proof));next.groups[P.group]=true;next[P.group]=record;
 require('./migration-proof.cjs').mergeInitial(catalog,next,P.group,record,results,coreSource);
 const merged={...catalog,verification:{...catalog.verification,[P.group]:true}},problem=P.problem(merged,next,coreSource);if(problem)throw Error(problem);
 const {[P.group]:added,...rest}=next,groups={...rest.groups};if(Object.hasOwn(proof.groups,P.group))groups[P.group]=proof.groups[P.group];else delete groups[P.group];
 assert.deepEqual({...rest,groups},proof,'every existing proof section must be retained');
 // Insert the new section and flag into the original bytes; all existing text stays verbatim.
 let text=null;
 if(proofText&&proof.schemaVersion!==2){
  const eol=proofText.includes('\r\n')?'\r\n':'\n',flag=`"${P.group}": false`;
  assert.equal(proofText.split(flag).length,proofText.includes(flag)?2:1);
  const withFlag=proofText.includes(flag)?proofText.replace(flag,`"${P.group}": true`):proofText.replace(/("groups": \{)/,`$1${eol}    "${P.group}": true,`);
  const end=withFlag.lastIndexOf('}');text=withFlag.slice(0,end).replace(/\s*$/,'')+`,${eol}  "${P.group}": `+JSON.stringify(record,null,2).replace(/\n/g,eol+'  ')+eol+withFlag.slice(end);
  assert.deepEqual(JSON.parse(text),next,'byte-preserving insert must equal the merged proof');
 }
 return {catalog:merged,proof:next,text,record};
}
async function main(){
 const args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1],merge=args.includes('--merge-results');
 if(args.includes('--help')||!merge&&!['--source','--runtime','--save-file','--artifacts'].every(k=>args.includes(k)))throw Error('Usage: verify-talents-suite.cjs --source GAME --runtime NWJS --save-file BASE --artifacts OUTSIDE [--keep-copies] [--record]\n       verify-talents-suite.cjs --merge-results RUN_DIR --record');
 const k=JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'),'utf8')),proofText=fs.readFileSync(path.join(root,'knowledge/verification.json'),'utf8'),proof=JSON.parse(proofText),coreSource=fs.readFileSync(path.join(root,'src/core.js'),'utf8');
 let runDir,results;
 if(merge){runDir=fs.realpathSync(opt('--merge-results'));results=JSON.parse(fs.readFileSync(path.join(runDir,'results.json'),'utf8'));}
 else{
  const artifacts=fs.realpathSync(opt('--artifacts')),relative=path.relative(root,artifacts);if(!relative||!relative.startsWith('..')&&!path.isAbsolute(relative))throw Error('External artifacts required');
  const {runMigration}=require('./verify-migration.cjs'),{inspectGame,eventDigest}=require('./extract-game.cjs'),{buildTalentScenarios}=require('./random-character-talents-scenarios.cjs');
  const copies=buildTalentScenarios({catalog:k,saveText:fs.readFileSync(opt('--save-file'),'utf8')});runDir=fs.mkdtempSync(path.join(artifacts,'random-talents-'));
  console.log('ARTIFACTS '+runDir);
  const setupArgs=['--source',opt('--source'),'--runtime',opt('--runtime'),'--save-file',opt('--save-file'),'--artifacts',runDir];
  results=await runMigration({catalog:k,proof,copies,runDir,setupArgs,keepCopies:args.includes('--keep-copies'),digest:(dir,sids)=>eventDigest(inspectGame(dir),sids)});
 }
 attachEvidence(results,runDir);
 const merged=mergeProof({catalog:k,proof,results,coreSource,proofText});
 fs.writeFileSync(path.join(runDir,'talents-validation.json'),JSON.stringify({checks:merged.record.groups[P.group].checks,validation:merged.record.validation,initialVerification:merged.record.initialVerification},null,2));
 if(args.includes('--record')){
  const files=['knowledge/catalog.json','knowledge/verification.json','index.html','sw.js'].map(f=>path.join(root,f)),backup=files.map(f=>fs.readFileSync(f));
  try{
   const catalogText=backup[0].toString('utf8'),flag=`"${P.group}": false`;assert.equal(catalogText.split(flag).length,2,'catalog flag must appear once');
   fs.writeFileSync(files[0],catalogText.replace(flag,`"${P.group}": true`));fs.writeFileSync(files[1],merged.text??JSON.stringify(merged.proof,null,2)+'\n');
   for(const mode of [[],['--check']]){const r=spawnSync(process.execPath,[path.join(__dirname,'build-editor.cjs'),...mode],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||r.stdout);}
  }catch(e){files.forEach((f,i)=>fs.writeFileSync(f,backup[i]));throw e;}
  console.log('RECORDED: new talent proof section and flag only; all existing proofs retained');
 }
 console.log('PASS: initial talent matrix, 535 native formulas and lifecycle; '+path.join(runDir,'talents-validation.json'));
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={attachEvidence,mergeProof};
