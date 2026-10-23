'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('../scripts/treasure-level-proof.cjs'),D=require('../scripts/treasure-level-data.cjs'),R=require('../scripts/verification-requirements.cjs'),S=require('../scripts/verification-suite.cjs'),M=require('../scripts/migration-proof.cjs');
const k=JSON.parse(fs.readFileSync(path.join(__dirname,'../knowledge/catalog.json'),'utf8')),proof=JSON.parse(fs.readFileSync(path.join(__dirname,'../knowledge/verification.json'),'utf8')),source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
const L=require('./helpers/legacy-release.cjs'),hex=c=>c.repeat(64);
const record=(group,src=source)=>({group,coverage:'initial-matrix',fingerprints:{...k.fingerprints,...k.batch2Fingerprints},coreHash:require('../scripts/core-source-proof.cjs').hash(src),coreHashAlgorithm:require('../scripts/core-source-proof.cjs').algorithm,dataHash:D.hash(k.treasureLevel),manifestHash:hex('a'),evidenceHash:hex('b'),...P.expected[group]});
const results=group=>({completed:true,checks:{[group]:Object.fromEntries(R.requiredChecks(group).map(c=>[c,true]))},copies:[{name:'initial'}]});

test('both treasure groups are registered, covered by the migration suite and opened only with their own records',()=>{
 assert.deepEqual(D.groups,['backpackTreasureLevel','treasureLevel']);
 for(const g of D.groups){assert.equal(k.verification[g],true);assert.equal(R.sectionOf(g),'treasureLevel');assert.equal(S.familyOf(g),'treasureLevel');assert.deepEqual(R.requiredChecks(g),['load','save','restart','originalHashes','nativeEffects','lifecycle']);assert.equal(proof.groups[g],true);assert.equal(P.initialProblem(proof.migration.treasureInitialVerification[g],g),null);}
 assert.equal(S.families.treasureLevel.initialProofRequired,true);assert.deepEqual(S.uncovered(D.groups),[]);
 for(const script of [S.families.treasureLevel.oracle,...S.families.treasureLevel.lifecycle])assert.ok(fs.existsSync(path.join(__dirname,'../scripts',script)),script);
});
test('initial records are exact per group; counts, order and binding cannot be borrowed across groups',()=>{
 for(const g of D.groups)assert.equal(P.initialProblem(record(g),g),null);
 assert.ok(P.initialProblem(record('backpackTreasureLevel'),'treasureLevel'));
 for(const [key,bad] of [['coverage','representative'],['matrixCases',1],['lifecycleCases',0],['effectTemplates',169],['rejects',0],['manifestHash','x'],['evidenceHash',undefined],['coreHash',hex('G')],['dataHash',undefined]]){const r=record('treasureLevel');if(bad===undefined)delete r[key];else r[key]=bad;assert.ok(P.initialProblem(r,'treasureLevel'),key);}
 const short=record('treasureLevel');delete short.fingerprints['data.json'];assert.ok(P.initialProblem(short,'treasureLevel'));
 assert.ok(P.initialProblem(null,'treasureLevel'));assert.ok(P.initialProblem(record('treasureLevel'),'unknown'));
});
test('the repository proof opens each group only through its own composite record',()=>{
 assert.equal(proof.schemaVersion,2);assert.equal(P.problem(k,proof,source),null);assert.equal(M.problem(k,proof,source),null);
 for(const g of D.groups){
  const missing=structuredClone(proof);delete missing.migration.treasureInitialVerification[g];assert.match(M.problem(k,missing,source,g),/寶物等級首次/);
  const swapped=structuredClone(proof),other=D.groups.find(x=>x!==g);swapped.migration.treasureInitialVerification[g]=swapped.migration.treasureInitialVerification[other];assert.match(M.problem(k,swapped,source,g),/寶物等級首次/);
  const stale=structuredClone(proof);stale.migration.treasureInitialVerification[g].dataHash=hex('c');assert.match(M.problem(k,stale,source,g),/寶物等級首次/);
  const closed=structuredClone(k);closed.verification[g]=false;assert.equal(P.problem(closed,proof,source,g),null);
 }
 const changed=source+';0;';assert.match(P.problem(k,proof,changed),/不相符|無效/);
});
test('merging a validated record into a legacy proof opens only that group; the other group keeps no proof',()=>{
 const lk=L.catalog(),lp=L.proof(),lsrc=L.core,g='backpackTreasureLevel';
 const merged=P.mergeProof({catalog:lk,proof:lp,group:g,record:{date:'2026-10-23',initialVerification:{[g]:record(g,lsrc)}},results:results(g),source:lsrc});
 assert.equal(merged.groups[g],true);assert.notEqual(merged.groups.treasureLevel,true);
 assert.equal(merged.treasureLevel.initialVerification[g].group,g);assert.equal(merged.treasureLevel.initialVerification.treasureLevel,undefined);
 assert.equal(lp.treasureLevel,undefined,'來源證明不得被就地修改');
 const open=structuredClone(lk);open.verification[g]=true;assert.equal(P.problem(open,merged,lsrc,g),null);
 const other=structuredClone(lk);other.verification.treasureLevel=true;assert.match(P.problem(other,merged,lsrc,'treasureLevel'),/treasureLevel/);
 const stale=structuredClone(merged);stale.treasureLevel.dataHash=hex('c');assert.match(P.problem(open,stale,lsrc,g),/backpackTreasureLevel/);
 const both=P.mergeProof({catalog:lk,proof:merged,group:'treasureLevel',record:{date:'2026-10-23',initialVerification:{treasureLevel:record('treasureLevel',lsrc)}},results:results('treasureLevel'),source:lsrc});
 assert.deepEqual(Object.keys(both.treasureLevel.initialVerification).sort(),['backpackTreasureLevel','treasureLevel']);
 assert.throws(()=>P.mergeProof({catalog:lk,proof:merged,group:'treasureLevel',record:{initialVerification:{treasureLevel:record('treasureLevel',lsrc)}},results:results('treasureLevel'),source:lsrc+';0;'}),/綁定/);
});
test('a composite proof carries per-group initial records and the build gate checks them',()=>{
 const g='treasureLevel',v2={schemaVersion:2,groups:{},migration:{version:2,snapshot:{dataHashes:{}},anchors:{},evidence:{},enabledBefore:[]}};
 const merged=P.mergeProof({catalog:k,proof:v2,group:g,record:{initialVerification:{[g]:record(g)}},results:results(g),source});
 assert.equal(merged.groups[g],true);assert.deepEqual(merged.migration.treasureInitialVerification[g],record(g));assert.equal(merged.migration.treasureInitialVerification.backpackTreasureLevel,undefined);
 assert.ok(merged.migration.enabledBefore.includes(g));assert.deepEqual(Object.keys(merged.migration.evidence[g]),R.requiredChecks(g));
 assert.equal(v2.migration.enabledBefore.length,0);
});
test('merge refuses incomplete records, stale rules, unfinished checks and unknown groups',()=>{
 const g='treasureLevel',ok={initialVerification:{[g]:record(g)}};
 assert.throws(()=>P.mergeProof({catalog:k,proof,group:g,record:{initialVerification:{}},results:results(g),source}),/不完整/);
 assert.throws(()=>P.mergeProof({catalog:k,proof,group:g,record:{initialVerification:{[g]:{...record(g),dataHash:hex('c')}}},results:results(g),source}),/規則摘要/);
 const partial=results(g);partial.checks[g].lifecycle=false;assert.throws(()=>P.mergeProof({catalog:k,proof,group:g,record:ok,results:partial,source}),/checks/);
 assert.throws(()=>P.mergeProof({catalog:k,proof,group:g,record:ok,results:{...results(g),completed:false},source}),/checks/);
 assert.throws(()=>P.mergeProof({catalog:k,proof,group:'setEquipmentLevel',record:ok,results:results(g),source}),/未知/);
});
test('representative copies are validated structurally and can never stand in for a first proof',()=>{
 assert.throws(()=>P.validateMigrationCopy({name:'treasure-level-7-representative',family:'treasureLevel',ok:true,steps:[{step:'load',ok:true}],evidence:{scenario:{treasureLevelCoverage:'representative'}}},k));
 assert.throws(()=>P.validateMigrationCopy({family:'treasureLevel',ok:false,steps:[],evidence:null},k));
 const V=require('../scripts/verify-migration.cjs');
 const done={completed:true,date:'2026-10-23',platform:'win32',checks:{},copies:[],ui:{}};
 assert.ok(done&&V.buildProof,'buildProof 存在');
});
test('migration steps re-read the treasure lifecycle after the new PID and run the oracle before and after reload',()=>{
 const V=require('../scripts/verify-migration.cjs'),list=V.steps({name:'treasure-level-7-representative',family:'treasureLevel',oracleArgs:[],lifecycle:true,scenarioFile:'x.json'},[]);
 const life=list.filter(s=>s.step==='lifecycle'&&/treasure-level-migration-lifecycle/.test(s.script));
 assert.equal(life.length,2);assert.ok(life[1].args.includes('--compare'));assert.ok(!life[0].args.includes('--compare'));
 assert.deepEqual(list.filter(s=>/oracle/.test(s.step)).map(s=>s.step),['oracle','oracleCompare']);
});
