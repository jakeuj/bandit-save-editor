#!/usr/bin/env node
'use strict';
// Static, seconds-fast: which families' core slices differ between the proven snapshot and a core source, and how many
// representative copies a selective migration would therefore run. Never starts a game or writes a proof.
const fs=require('node:fs'),path=require('node:path');
const C=require('./core-source-proof.cjs'),A=require('./migration-analysis.cjs'),{availableCopies}=require('./migration-scenarios.cjs');
function report(source,snapshot,catalog){
 const table=A.sliceTable(snapshot),current=C.slices(source,A.coreRoots),open=new Set(Object.keys(catalog.verification).filter(g=>catalog.verification[g]));
 const S=require('./verification-suite.cjs'),R=require('./verification-requirements.cjs');
 const families=Object.keys(S.families).filter(f=>S.families[f].groups.some(g=>open.has(g)));
 // Families whose groups are open also own checks of other open groups through shared proof sections.
 const owners=new Set([...open].flatMap(g=>R.requiredChecks(g).filter(c=>c!==R.uiChecks[g]).flatMap(c=>A.owners(g,c))));
 const copies=f=>Object.values(availableCopies).filter(v=>v===f).length;
 if(!table||!current||table.algorithm!==current.algorithm){
  const same=C.matches(source,snapshot.coreHash,snapshot.coreHashAlgorithm);
  return {mode:'full-core',reason:!current?'core 無法切片：'+C.sliceProblem(source):'證明快照沒有切片基準',unchanged:same,changed:same?[]:[...owners].sort(),copies:same?0:[...owners].reduce((n,f)=>n+copies(f),0)};
 }
 const changed=[...owners].filter(f=>table.hashes[f]!==current.hashes[f]).sort();
 return {mode:'slices',unchanged:!changed.length,changed,carried:[...owners].filter(f=>!changed.includes(f)).sort(),families:families.length,copies:changed.reduce((n,f)=>n+copies(f),0)};
}
if(require.main===module){
 const args=process.argv.slice(2),value=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined,root=path.resolve(__dirname,'..');
 const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8')),proof=read('knowledge/verification.json');
 if(proof.schemaVersion!==2)throw Error('需要複合證明（schemaVersion 2）');
 const r=report(fs.readFileSync(value('--source')||path.join(root,'src/core.js'),'utf8'),proof.migration.snapshot,read('knowledge/catalog.json'));
 console.log(r.unchanged?'core 切片未變：既有群組沿用，不需選跑':`需重證 family：${r.changed.join('、')}（約 ${r.copies} 份代表副本）`);
 if(r.mode!=='slices')console.log('退回整份 core 比對：'+r.reason);
 if(args.includes('--json'))console.log(JSON.stringify(r,null,1));
}
module.exports={report};
