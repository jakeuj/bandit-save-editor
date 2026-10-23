'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),P=require('../scripts/random-character-growth-proof.cjs'),R=require('../scripts/verification-requirements.cjs'),{mergeProof}=require('../scripts/verify-random-character-suite.cjs');
const L=require('./helpers/legacy-release.cjs'),k=L.catalog(),old=L.proof(),core=L.core;// 凍結的舊版證明＋對應 core
const checks=()=>Object.fromEntries(R.requiredChecks('randomCharacterBaseAptitudes').map(c=>[c,true]));
const results=()=>({date:'2026-10-22T00:00:00Z',platform:'darwin-arm64',completed:true,copies:[{name:'random-growth-matrix',cases:24,ok:true},{name:'random-growth-lifecycle',cases:2,ok:true}],checks:{randomCharacterBaseAptitudes:checks()}});
test('initial proof merges only new group and preserves all previous sections, including complete matrix coverage',()=>{
 const merged=mergeProof({catalog:k,proof:old,results:results(),coreSource:core});assert.equal(merged.catalog.verification.randomCharacterBaseAptitudes,true);assert.equal(P.problem(k,merged.proof,core),null);
 for(const name of Object.keys(old).filter(n=>n!=='groups'&&n!=='randomCharacterGrowth'))assert.deepEqual(merged.proof[name],old[name]);
 for(const g of Object.keys(k.verification).filter(g=>g!=='randomCharacterBaseAptitudes'))assert.equal(merged.proof.groups[g],old.groups[g]);
 for(const check of R.requiredChecks('randomCharacterBaseAptitudes')){const r=results();r.checks.randomCharacterBaseAptitudes[check]=false;assert.throws(()=>mergeProof({catalog:k,proof:old,results:r,coreSource:core}));}
});
test('new growth gate binds all 15 sources, rules, relevant tables and actual calculation code',()=>{
 const p=mergeProof({catalog:k,proof:old,results:results(),coreSource:core}).proof;
 for(const f of Object.keys(p.randomCharacterGrowth.fingerprints)){const changed=structuredClone(p);changed.randomCharacterGrowth.fingerprints[f]='0'.repeat(64);assert.match(P.problem(k,changed,core),/獨立驗證/);}
 for(const check of R.requiredChecks('randomCharacterBaseAptitudes')){const changed=structuredClone(p);delete changed.randomCharacterGrowth.groups.randomCharacterBaseAptitudes.checks[check];assert.ok(P.problem(k,changed,core));}
 const rules=structuredClone(k);rules.randomCharacterGrowth.totals[0][0]++;assert.ok(P.problem(rules,p,core));
 assert.ok(P.problem(k,p,core.replace(' // Exact recruitment feasibility.',' // Exact recruitment feasibility. changed')));
});
test('migration oracle uses the selected candidate catalog from private state',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bandit-growth-candidate-'));
 try{const file=path.join(dir,'candidate.json');fs.writeFileSync(file,JSON.stringify({...k,gameVersion:'candidate-only'}));const {loadStateCore}=require('../scripts/verify-random-character-growth.cjs');assert.equal(loadStateCore({catalogPath:file}).KNOWLEDGE.gameVersion,'candidate-only');assert.equal(loadStateCore({}).KNOWLEDGE.gameVersion,k.gameVersion);}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
