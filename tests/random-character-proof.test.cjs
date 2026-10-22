'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),P=require('../scripts/random-character-growth-proof.cjs'),R=require('../scripts/verification-requirements.cjs'),{mergeProof}=require('../scripts/verify-random-character-suite.cjs');
const k=JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'))),old=JSON.parse(fs.readFileSync(path.join(root,'knowledge/verification.json'))),core=fs.readFileSync(path.join(root,'src/core.js'),'utf8');
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
test('real build rejects a candidate flag without new proof and rejects changed formula or rules',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bandit-growth-gate-'));
 try{
  fs.cpSync(root,dir,{recursive:true,filter:p=>!/[\\/](\.git|graphify-out|node_modules)([\\/]|$)/.test(p)});
  const kp=path.join(dir,'knowledge/catalog.json'),pp=path.join(dir,'knowledge/verification.json');
  const merged=mergeProof({catalog:k,proof:old,results:results(),coreSource:core});fs.writeFileSync(kp,JSON.stringify(merged.catalog));
  const missing=structuredClone(old);delete missing.randomCharacterGrowth;fs.writeFileSync(pp,JSON.stringify(missing));
  const build=()=>spawnSync(process.execPath,['scripts/build-editor.cjs'],{cwd:dir,encoding:'utf8'});
  assert.match(build().stderr,/獨立驗證/);fs.writeFileSync(pp,JSON.stringify(merged.proof));assert.equal(build().status,0);
  const changed=structuredClone(merged.catalog);changed.randomCharacterGrowth.totals[0][0]++;fs.writeFileSync(kp,JSON.stringify(changed));assert.match(build().stderr,/獨立驗證/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('migration oracle uses the selected candidate catalog from private state',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bandit-growth-candidate-'));
 try{const file=path.join(dir,'candidate.json');fs.writeFileSync(file,JSON.stringify({...k,gameVersion:'candidate-only'}));const {loadStateCore}=require('../scripts/verify-random-character-growth.cjs');assert.equal(loadStateCore({catalogPath:file}).KNOWLEDGE.gameVersion,'candidate-only');assert.equal(loadStateCore({}).KNOWLEDGE.gameVersion,k.gameVersion);}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
