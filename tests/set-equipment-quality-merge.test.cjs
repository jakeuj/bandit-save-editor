'use strict';
// B8 merge contract on synthetic results: the pinned B7 equivalence for B4's old-core evidence, the two-stage UI record owed to
// B9, the cross-pool first proofs and the undelivered snapshot build. Nothing here reads the native artifacts or runs the game.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const P=require('../scripts/set-equipment-quality-proof.cjs'),CP=require('../scripts/set-equipment-level-cross-pool-proof.cjs'),E=require('../scripts/set-equipment-quality-equivalence.cjs');
const D=require('../scripts/set-equipment-quality-data.cjs'),MP=require('../scripts/migration-proof.cjs'),R=require('../scripts/verification-requirements.cjs');
const root=path.join(__dirname,'..'),k=JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'),'utf8')),proof=JSON.parse(fs.readFileSync(path.join(root,'knowledge/verification.json'),'utf8'));
const source=fs.readFileSync(path.join(root,'src/core.js'),'utf8'),data=fs.readFileSync(path.join(root,'scripts/set-equipment-quality-data.cjs'),'utf8').replace(/\r\n/g,'\n');
const {hash}=D,hex=c=>c.repeat(64),clone=o=>structuredClone(o);
const codeHash=f=>hash(fs.readFileSync(path.join(root,'scripts',f),'utf8').replace(/\r\n/g,'\n'));
const ui=Object.fromEntries(P.uiKeys.map(x=>[x,true])),io={rounds:2,newPidReadback:true,shiftedColumns:50,tailColumns:10};
const checks=g=>({[g]:Object.fromEntries(R.requiredChecks(g).map(c=>[c,true]))});
const b4Run=()=>({label:'B4',manifestHash:E.B4.from.manifestHash,coreHash:E.B4.from.coreHash,evidenceSha256:E.B4.a10ResultsSha256,bindingSha256:E.B4.bindingSha256,equivalence:E.describe(k,source)});
const finalRun=e=>({label:'B6',manifestHash:e.manifestHash,coreHash:P.textHash(source),evidenceSha256:hex('6')});
// Same shape as the real merge: the group's own cases from B4 (old core, via the equivalence), the level regression from B6.
function quality(g,{pending=true}={}){
 const e=P.expected(k,source,g);
 return {completed:true,checks:checks(g),copies:[],native:{[g]:{coverage:'initial-matrix',manifestHash:e.manifestHash,
  cases:e.cases.map(c=>({id:c.id,caseHash:hash(c),passed:true,nativeCompared:true,run:c.kind==='level-regression'?1:0})),runs:[b4Run(),finalRun(e)],io,ui:pending?{pending:'B9'}:ui,
  oracles:{transactionOracleHash:codeHash('set-equipment-quality-oracle.cjs'),effectOracleHash:codeHash('set-equipment-quality-effects-oracle.cjs')},
  inputs:{baselineHash:hex('a'),runtimeHash:hex('b'),sourceManifestHash:hex('c'),runtimeManifestHash:hex('d')}}}};
}
function crossPool(g,{pending=true}={}){
 const e=CP.expected(k,source,g);
 return {completed:true,checks:checks(g),copies:[],native:{[g]:{coverage:'initial-matrix',manifestHash:e.manifestHash,cases:e.cases.map(c=>({id:c.id,caseHash:hash(c),passed:true,nativeCompared:true})),
  run:finalRun(e),io,ui:pending?{pending:'B9'}:ui,levelOracleHash:codeHash('set-equipment-level-oracle.cjs'),runnerHash:codeHash('verify-set-equipment-level-cross-pool.cjs'),
  inputs:Object.fromEntries(CP.inputKeys.map((x,i)=>[x,hex(String(i+1))]))}}};
}

test('the pinned B7 equivalence rebuilds the B4 tree from the current files and matches commit 5271ce4',()=>{
 const eq=E.describe(k,source);
 assert.deepEqual({core:eq.core.from,data:eq.dataScript.from,manifest:eq.manifest.from},{core:E.B4.from.coreHash,data:E.B4.from.dataScriptHash,manifest:E.B4.from.manifestHash});
 assert.equal(eq.core.to,P.textHash(source));assert.notEqual(eq.core.from,eq.core.to);assert.notEqual(eq.manifest.from,eq.manifest.to);
 assert.equal(E.problem(eq,k,source),null);
 const git=spawnSync('git',['cat-file','-e','5271ce4^{commit}'],{cwd:root});
 if(git.status===0)assert.equal(E.gitProblem(root),null);
});
test('a missing or tampered equivalence, or one beyond the cross-pool patch, is refused',()=>{
 const eq=E.describe(k,source);
 assert.match(E.problem(undefined,k,source),/缺漏/);
 for(const edit of [e=>{e.core.to=hex('1');},e=>{e.manifest.from=hex('2');},e=>{e.basis=[...e.basis,'x'];},e=>{delete e.dataScript;},e=>{e.patchHash=hex('3');},e=>{e.a10ResultsSha256=hex('4');}]){
  const bad=clone(eq);edit(bad);assert.match(E.problem(bad,k,source),/缺漏|不符/);
 }
 // Another core change: a record made for that core still cannot reproduce the pinned old digests.
 const other=source.replace('function setEquipmentQualityCandidateInfo(','function  setEquipmentQualityCandidateInfo(');assert.notEqual(other,source);
 assert.match(E.problem(E.describe(k,other),k,other),/超出/);
 const otherData=data+'\n// unrelated change\n';assert.match(E.problem(E.describe(k,source,otherData),k,source,otherData),/超出/);
 // The patch itself must be present exactly once.
 const unpatched=E.reverse(source.replace(/\r\n/g,'\n'),E.patches['src/core.js']);assert.match(E.problem(eq,k,unpatched),/找不到/);
 // Rules or manifest changes also leave the pinned old manifest.
 const rules=clone(k);rules.setEquipmentQuality.sourceDigest=hex('5');assert.match(E.problem(E.describe(rules,source),rules,source),/超出/);
});
test('the equivalence carries only the B4 evidence; current-core runs may not carry it',()=>{
 const run=b4Run();assert.equal(E.runProblem(run,k,source),null);
 for(const [key,value] of [['evidenceSha256',hex('e')],['bindingSha256',hex('e')],['manifestHash',hex('e')],['coreHash',hex('e')]])assert.match(E.runProblem({...run,[key]:value},k,source),/只適用 B4/,key);
 const e=P.expected(k,source,P.groups[0]);
 assert.equal(P.runProblem(finalRun(e),e.manifestHash,k,source),null);
 assert.match(P.runProblem({...finalRun(e),equivalence:E.describe(k,source)},e.manifestHash,k,source),/不可帶等價/);
 assert.match(P.runProblem({...run,equivalence:undefined},e.manifestHash,k,source),/缺漏/);
});
test('old-core evidence is never bound to the current core without the equivalence',()=>{
 const g='setEquipmentQualityUpgrade',base=quality(g);
 const rec=P.buildRecord(k,source,base,g);
 assert.equal(P.recordProblem(rec,g,k,source,{pendingUi:true}),null);
 assert.deepEqual(rec.nativeRuns.map(r=>r.count),[rec.executed-8,8]);assert.equal(rec.nativeRuns[0].coreHash,E.B4.from.coreHash);assert.equal(rec.coreHash,require('../scripts/core-source-proof.cjs').hash(source));
 let r=clone(base);delete r.native[g].runs[0].equivalence;assert.throws(()=>P.validateResults(k,source,r,g),/缺漏/);
 r=clone(base);r.native[g].runs[0].evidenceSha256=hex('7');assert.throws(()=>P.validateResults(k,source,r,g),/只適用 B4/);
 r=clone(base);r.native[g].runs=[base.native[g].runs[0]];assert.throws(()=>P.validateResults(k,source,r,g),/執行來源/);
 r=clone(base);delete r.native[g].runs;assert.throws(()=>P.validateResults(k,source,r,g),/執行/);
 const stripped=clone(rec);delete stripped.nativeRuns[0].equivalence;assert.match(P.recordProblem(stripped,g,k,source,{pendingUi:true}),/缺漏/);
 const recount=clone(rec);recount.nativeRuns[1].count=7;assert.match(P.recordProblem(recount,g,k,source,{pendingUi:true}),/原生執行/);
 const none=clone(rec);delete none.nativeRuns;assert.match(P.recordProblem(none,g,k,source,{pendingUi:true}),/原生執行/);
});
test('UI owed to B9 opens only the snapshot gate; B9 completes it for the normal gate',()=>{
 const g='backpackSetEquipmentQualityDowngrade',rec=P.buildRecord(k,source,quality(g),g);
 assert.deepEqual(rec.ui,{pending:'B9'});
 assert.match(P.recordProblem(rec,g,k,source),/UI/);assert.equal(P.recordProblem(rec,g,k,source,{pendingUi:true}),null);
 for(const bad of [{pending:'B9',desktop:true},{pending:'B10'},{...ui,pwa:false},{}]){const b=clone(rec);b.ui=bad;assert.match(P.initialProblem(b,g,{pendingUi:true}),/UI/);}
 assert.throws(()=>P.finalizeUi(rec,ui),/證據摘要/);assert.throws(()=>P.finalizeUi(rec,{...ui,pwa:false,evidenceHash:hex('8')}),/五項/);
 const done=P.finalizeUi(rec,{...ui,evidenceHash:hex('8')});assert.equal(P.recordProblem(done,g,k,source),null);
 assert.throws(()=>P.finalizeUi(done,{...ui,evidenceHash:hex('9')}),/待 B9/);
 const r=quality(g);r.native[g].ui={pending:'B9',desktop:true};assert.throws(()=>P.validateResults(k,source,r,g),/UI/);
});
test('each cross-pool group has its own record from its own library on the current core',()=>{
 for(const g of CP.groups){
  const e=CP.expected(k,source,g),level=CP.levelGroupOf(g);
  assert.equal(e.cases.length,8);assert.ok(e.cases.every(c=>c.kind==='level-regression'&&c.group===level));
  const rec=CP.buildRecord(k,source,crossPool(g),g);
  assert.equal(CP.recordProblem(rec,g,k,source,{pendingUi:true}),null);assert.match(CP.recordProblem(rec,g,k,source),/UI/);
  assert.match(CP.recordProblem(rec,CP.groups.find(x=>x!==g),k,source,{pendingUi:true}),/不完整|不符/,'另一庫不能沿用');
  assert.equal(CP.recordProblem(CP.finalizeUi(rec,{...ui,evidenceHash:hex('8')}),g,k,source),null);
 }
 const g=CP.groups[0],base=crossPool(g),other=crossPool(CP.groups[1]);
 let r=clone(base);r.native[g].cases[0]=other.native[CP.groups[1]].cases[0];assert.throws(()=>CP.validateResults(k,source,r,g),/錯庫|未知/);
 r=clone(base);r.native[g].cases.pop();assert.throws(()=>CP.validateResults(k,source,r,g),/漏案/);
 r=clone(base);r.native[g].run={...b4Run()};assert.throws(()=>CP.validateResults(k,source,r,g),/不可沿用等價/);
 r=clone(base);r.native[g].run.coreHash=E.B4.from.coreHash;assert.throws(()=>CP.validateResults(k,source,r,g),/目前 core/);
 r=clone(base);r.native[g].runnerHash=hex('1');assert.throws(()=>CP.validateResults(k,source,r,g),/runner/);
 r=clone(base);r.checks[g].lifecycle=false;assert.throws(()=>CP.validateResults(k,source,r,g),/checks/);
 assert.throws(()=>CP.validateResults(k,source,base,P.groups[0]),/未知跨池/);
 assert.throws(()=>CP.mergeProof({catalog:k,proof:{schemaVersion:1,groups:{}},group:g,results:base,source}),/複合證明/);
 assert.ok(CP.problem({...k,verification:{...k.verification,[g]:true}},{schemaVersion:1,groups:{}},source));
});
test('merging all six groups into the composite proof: quality records never open cross-pool, and the gates read each record',()=>{
 const before=JSON.stringify(proof);let p=clone(proof);
 for(const g of P.groups)p=P.mergeProof({catalog:k,proof:p,group:g,results:quality(g),source});
 const open=clone(k);for(const g of [...P.groups,...CP.groups])open.verification[g]=true;
 for(const g of CP.groups){assert.notEqual(p.groups[g],true);assert.match(MP.problem(open,p,source,g,{pendingUi:true}),/缺少既有群組|跨池/);}
 for(const g of CP.groups)p=CP.mergeProof({catalog:k,proof:p,group:g,results:crossPool(g),source});
 assert.deepEqual(Object.keys(p.migration.crossPoolInitialVerification).sort(),[...CP.groups].sort());
 assert.equal(MP.problem(open,p,source,undefined,{pendingUi:true}),null);
 assert.match(MP.problem(open,p,source),/首次/);
 const swapped=clone(p);swapped.migration.crossPoolInitialVerification[CP.groups[0]]=swapped.migration.crossPoolInitialVerification[CP.groups[1]];
 assert.match(MP.problem(open,swapped,source,CP.groups[0],{pendingUi:true}),/跨池/);
 assert.ok(MP.problem(open,p,source.replace('let selected=0;','let selected=0; '),undefined,{pendingUi:true}),'core 再變就失效');
 assert.equal(JSON.stringify(proof),before,'合併不改輸入');
});
test('the snapshot build marks its outputs undelivered; plain builds and --check (pre-push, Pages) refuse them',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bandit-b8-snapshot-'));
 try{
  for(const file of ['scripts','src','knowledge','assets','index.html','sw.js','manifest.webmanifest'])fs.cpSync(path.join(root,file),path.join(dir,file),{recursive:true});
  const build=(...args)=>spawnSync(process.execPath,['scripts/build-editor.cjs',...args],{cwd:dir,encoding:'utf8'});
  const catalogPath=path.join(dir,'knowledge/catalog.json'),proofPath=path.join(dir,'knowledge/verification.json'),html=()=>fs.readFileSync(path.join(dir,'index.html'),'utf8'),sw=()=>fs.readFileSync(path.join(dir,'sw.js'),'utf8');
  let p=clone(proof);const open=clone(k);
  for(const g of P.groups){p=P.mergeProof({catalog:k,proof:p,group:g,results:quality(g),source});open.verification[g]=true;}
  for(const g of CP.groups){p=CP.mergeProof({catalog:k,proof:p,group:g,results:crossPool(g),source});open.verification[g]=true;}
  fs.writeFileSync(catalogPath,JSON.stringify(open,null,2)+'\n');fs.writeFileSync(proofPath,JSON.stringify(p,null,2)+'\n');
  let r=build();assert.notEqual(r.status,0);assert.match(r.stderr,/首次/);
  r=build('--pending-ui-snapshot');assert.equal(r.status,0,r.stderr);
  assert.match(html(),/<meta name="bandit-delivery" content="bandit-delivery:undelivered-pending-ui">/);assert.match(sw(),/^\/\/ bandit-delivery:undelivered-pending-ui\n/);
  r=build('--check');assert.equal(r.status,1);assert.match(r.stderr,/未交付快照產物/);
  assert.equal(build('--check','--pending-ui-snapshot').status,0);
  // B9 completes the UI part of every record; then only the normal build is in sync and the marker is gone.
  const finalize=(m,mod)=>{for(const g of Object.keys(m))m[g]=mod.finalizeUi(m[g],{...ui,evidenceHash:hex('8')});};
  finalize(p.migration.qualityInitialVerification,P);finalize(p.migration.crossPoolInitialVerification,CP);
  for(const g of P.groups)p.setEquipmentQuality.initialVerification[g]=p.migration.qualityInitialVerification[g];
  fs.writeFileSync(proofPath,JSON.stringify(p,null,2)+'\n');
  r=build();assert.equal(r.status,0,r.stderr);assert.doesNotMatch(html(),/bandit-delivery/);assert.doesNotMatch(sw(),/bandit-delivery/);
  assert.equal(build('--check').status,0);
  // The snapshot mode refuses to run on main.
  if(spawnSync('git',['--version']).status===0){
   assert.equal(spawnSync('git',['init','-q','-b','main'],{cwd:dir}).status,0);
   r=build('--pending-ui-snapshot');assert.notEqual(r.status,0);assert.match(r.stderr,/main/);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('driver digests accept only the LF and CRLF forms of the same function source',()=>{
 const {driverDigests}=require('../scripts/merge-set-equipment-quality-proof.cjs'),f=new Function('a','return a+1'),g=new Function('a','return a+2');
 const [a,b]=driverDigests(f);assert.notEqual(a,b);assert.ok(!driverDigests(g).includes(a)&&!driverDigests(g).includes(b));
});
test('the shipped catalog keeps all six groups closed and the merge tool refuses to write on main',()=>{
 for(const g of [...P.groups,...CP.groups])assert.equal(k.verification[g],false,g);
 assert.match(fs.readFileSync(path.join(root,'scripts/merge-set-equipment-quality-proof.cjs'),'utf8'),/只能在不推送的快照分支寫入開閘結果/);
 for(const file of ['index.html','sw.js'])assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/bandit-delivery/);
});
