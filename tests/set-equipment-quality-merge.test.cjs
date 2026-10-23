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
// The composite proof as it was before any of the six groups merged, whatever the checkout currently carries.
function unmerged(p){
 const u=clone(p),six=[...P.groups,...CP.groups];
 for(const g of six){delete u.groups[g];delete u.migration.evidence[g];delete u.migration.snapshot.dataHashes[g];delete u.setEquipmentQuality?.initialVerification?.[g];delete u.migration.qualityInitialVerification?.[g];delete u.migration.crossPoolInitialVerification?.[g];}
 u.migration.enabledBefore=u.migration.enabledBefore.filter(g=>!six.includes(g));
 return u;
}
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
test('driver digests accept only the LF and CRLF forms of the same function source',()=>{
 const {driverDigests}=require('../scripts/merge-set-equipment-quality-proof.cjs'),f=new Function('a','return a+1'),g=new Function('a','return a+2');
 const [a,b]=driverDigests(f);assert.notEqual(a,b);assert.ok(!driverDigests(g).includes(a)&&!driverDigests(g).includes(b));
});
test('the six groups are closed or carry their merged records; outputs are marked undelivered exactly while UI is owed to B9',()=>{
 const S=require('./helpers/set-quality-shipped.cjs');S.assertShipped(k,proof);
 const records=[...Object.values(proof.migration.qualityInitialVerification||{}),...Object.values(proof.migration.crossPoolInitialVerification||{})];
 const owed=records.some(r=>P.uiPending(r.ui));
 for(const file of ['index.html','sw.js'])assert.equal(fs.readFileSync(path.join(root,file),'utf8').includes('bandit-delivery:undelivered-pending-ui'),owed,file);
 assert.match(fs.readFileSync(path.join(root,'scripts/merge-set-equipment-quality-proof.cjs'),'utf8'),/只能在不推送的快照分支寫入開閘結果/);
});
