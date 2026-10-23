'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('../scripts/treasure-level-proof.cjs'),D=require('../scripts/treasure-level-data.cjs'),R=require('../scripts/verification-requirements.cjs'),S=require('../scripts/verification-suite.cjs'),M=require('../scripts/migration-proof.cjs');
const k=JSON.parse(fs.readFileSync(path.join(__dirname,'../knowledge/catalog.json'),'utf8')),proof=JSON.parse(fs.readFileSync(path.join(__dirname,'../knowledge/verification.json'),'utf8')),source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
const hex=c=>c.repeat(64);
const record=group=>({group,coverage:'initial-matrix',fingerprints:{...k.fingerprints,...k.batch2Fingerprints},coreHash:require('../scripts/core-source-proof.cjs').hash(source),coreHashAlgorithm:require('../scripts/core-source-proof.cjs').algorithm,dataHash:D.hash(k.treasureLevel),manifestHash:hex('a'),evidenceHash:hex('b'),...P.expected[group]});
const results=group=>({completed:true,checks:{[group]:Object.fromEntries(R.requiredChecks(group).map(c=>[c,true]))},copies:[{name:'initial'}]});

test('both treasure groups are registered, closed and covered by the migration suite',()=>{
 assert.deepEqual(D.groups,['backpackTreasureLevel','treasureLevel']);
 for(const g of D.groups){assert.equal(k.verification[g],false);assert.equal(R.sectionOf(g),'treasureLevel');assert.equal(S.familyOf(g),'treasureLevel');assert.deepEqual(R.requiredChecks(g),['load','save','restart','originalHashes','nativeEffects','lifecycle']);}
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
test('a true flag without its own composite initial proof is refused; closed flags pass',()=>{
 assert.equal(P.problem(k,proof,source),null);
 for(const g of D.groups){const open=structuredClone(k);open.verification[g]=true;assert.match(P.problem(open,proof,source,g),/首次|證據|證明/);}
});
test('merging a validated record opens only that group; the other group keeps no proof',()=>{
 const g='backpackTreasureLevel',merged=P.mergeProof({catalog:k,proof,group:g,record:{date:'2026-10-23',initialVerification:{[g]:record(g)}},results:results(g),source});
 assert.equal(merged.groups[g],true);assert.notEqual(merged.groups.treasureLevel,true);
 assert.equal(merged.treasureLevel.initialVerification[g].group,g);assert.equal(merged.treasureLevel.initialVerification.treasureLevel,undefined);
 assert.equal(proof.treasureLevel,undefined,'來源證明不得被就地修改');
 const open=structuredClone(k);open.verification[g]=true;assert.equal(P.problem(open,merged,source,g),null);
 const other=structuredClone(k);other.verification.treasureLevel=true;assert.match(P.problem(other,merged,source,'treasureLevel'),/treasureLevel/);
 const stale=structuredClone(merged);stale.treasureLevel.dataHash=hex('c');assert.match(P.problem(open,stale,source,g),/backpackTreasureLevel/);
 const both=P.mergeProof({catalog:k,proof:merged,group:'treasureLevel',record:{date:'2026-10-23',initialVerification:{treasureLevel:record('treasureLevel')}},results:results('treasureLevel'),source});
 assert.deepEqual(Object.keys(both.treasureLevel.initialVerification).sort(),['backpackTreasureLevel','treasureLevel']);
 // A different core binding for the second group refuses instead of mixing proofs.
 assert.throws(()=>P.mergeProof({catalog:k,proof:merged,group:'treasureLevel',record:{initialVerification:{treasureLevel:record('treasureLevel')}},results:results('treasureLevel'),source:source+';0;'}),/綁定/);
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
