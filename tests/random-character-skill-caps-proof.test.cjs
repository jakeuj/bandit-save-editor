'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const P=require('../scripts/random-character-skill-caps-proof.cjs'),R=require('../scripts/verification-requirements.cjs'),S=require('../scripts/verification-suite.cjs'),M=require('../scripts/verify-migration.cjs');
const k=require('../knowledge/catalog.json'),old=require('../knowledge/verification.json'),core=fs.readFileSync('src/core.js','utf8'),root=path.resolve(__dirname,'..');
const checks=()=>Object.fromEntries(R.requiredChecks(P.group).map(c=>[c,true]));
const record=()=>P.record(k,core,{date:'2026-10-22',platform:'synthetic-test-only',checks:checks(),coverage:'synthetic-test-only',copies:[]});
test('cap proof separately binds all 15 fingerprints, selection data, rules, every required check and entire write implementation',()=>{
 const proof={...old,[P.group]:record()};assert.equal(P.problem(k,proof,core),null);assert.ok(P.problem(k,old,core));
 for(const file of Object.keys(record().fingerprints))for(const missing of [false,true]){
  const p=structuredClone(proof);if(missing)delete p[P.group].fingerprints[file];else p[P.group].fingerprints[file]='f'.repeat(64);assert.ok(P.problem(k,p,core),file);
 }
 for(const check of R.requiredChecks(P.group)){const p=structuredClone(proof);delete p[P.group].groups[P.group].checks[check];assert.ok(P.problem(k,p,core),check);}
 for(const change of [n=>n.randomCharacterSkillCaps.ranges[0].primary[0]++,n=>n.randomCharacterSkillCaps.talents[1].excludedPrimary.push(1),n=>n.randomCharacterSkillCaps.weights[0][0][0]++,n=>delete n.batch2Fingerprints['yx.json']]){
  const n=structuredClone(k);change(n);if(JSON.stringify(n)!==JSON.stringify(k))assert.ok(P.problem(n,proof,core));
 }
 for(const token of ['function skillCapCombinations','function transaction','function addExperience','function serialize','function resolveField'])assert.ok(P.problem(k,proof,core.replace(token,token+'Changed')));
 assert.equal(require('../scripts/random-character-growth-proof.cjs').problem(k,old,core),null);
});
test('pending native runners cannot execute setup, claim any checks or merge a fabricated success',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bandit-caps-pending-')),before=JSON.stringify(old),family=P.group;
 try{
  const copy={name:'pending',family,oracleArgs:[],lifecycle:true,cases:2,steps:S.steps.map(step=>({step,ok:true})),ok:true};
  assert.ok(Object.values(M.provenChecks([copy])[family]).every(v=>v===false));
  const run=await M.runMigration({catalog:k,proof:old,copies:[copy],runDir:dir,setupArgs:[],exec:()=>{throw Error('must not launch');},log:()=>{}});
  assert.equal(run.completed,false);assert.ok(Object.values(run.checks[family]).every(v=>v===false));
  const {mergeProof}=require('../scripts/verify-skill-caps-suite.cjs');
  for(const completed of [false,true])assert.throws(()=>mergeProof({catalog:k,proof:old,coreSource:core,results:{completed,checks:{[family]:checks()},copies:[copy]}}),/不可產生或合併/);
  assert.equal(JSON.stringify(old),before);
  for(const script of [S.families[family].oracle,...S.families[family].lifecycle])assert.notEqual(spawnSync(process.execPath,[path.join(root,'scripts',script),'--compare']).status,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('migration wiring covers cap scenario and whitelist with complete observations and pending lifecycle comparison',()=>{
 const {saveFixture}=require('./helpers/save-fixture.cjs'),{buildSkillCapScenarios}=require('../scripts/random-character-skill-caps-scenarios.cjs');
 const copies=buildSkillCapScenarios({catalog:k,saveText:saveFixture({characters:2}).raw});
 assert.deepEqual(S.uncovered([P.group]),[]);assert.equal(copies.length,1);assert.equal(copies[0].family,P.group);
 assert.equal(copies[0].cases,2);assert.ok(copies[0].scenario.observe.some(c=>c.join(',')==='2,48,2'));
 const steps=M.steps({...copies[0],scenarioFile:'/synthetic/scenario.json'},[]);
 assert.ok(steps.some(s=>s.script==='verify-skill-caps-lifecycle.cjs'&&s.args.includes('--compare')));
 const C=require('../scripts/verify-game.cjs').loadCore(k);
 assert.throws(()=>require('../scripts/verify-game.cjs').editSave(C,saveFixture({characters:2}).raw,{operations:[{method:'set',options:{}}]}),/Unsupported/);
 const family=S.families[P.group],oracle=family.oracle;try{delete family.oracle;assert.ok(S.uncovered([P.group]).some(s=>s.includes('nativeRecruitment')));}finally{family.oracle=oracle;}
});
test('actual builder rejects the new flag with missing or synthetic proof, and same-fingerprint migration never writes it',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bandit-caps-gate-'));
 try{
  fs.cpSync(root,dir,{recursive:true,filter:p=>!/[\\/](\.git|graphify-out|node_modules)([\\/]|$)/.test(p)});
  const kp=path.join(dir,'knowledge/catalog.json'),pp=path.join(dir,'knowledge/verification.json'),candidate=structuredClone(k);candidate.verification[P.group]=true;
  fs.writeFileSync(kp,JSON.stringify(candidate));const build=()=>spawnSync(process.execPath,['scripts/build-editor.cjs'],{cwd:dir,encoding:'utf8'});
  assert.match(build().stderr,/技藝上限缺少相符/);
  fs.writeFileSync(pp,JSON.stringify({...old,groups:{...old.groups,[P.group]:true},[P.group]:record()}));assert.match(build().stderr,/B 階段/);
  const proofBytes=fs.readFileSync(pp,'utf8'),results={completed:true,checks:Object.fromEntries(Object.keys(k.verification).map(g=>[g,Object.fromEntries(R.requiredChecks(g).map(c=>[c,true]))]))};
  assert.equal(M.writeBack({dir,catalog:k,proof:old,results,exec:()=>{throw Error('must not build');}}).action,'compared');assert.equal(fs.readFileSync(pp,'utf8'),proofBytes);
  assert.equal(M.writeBack({dir,catalog:candidate,proof:old,results}).action,'skipped');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
