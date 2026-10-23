'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../scripts/random-character-talents-proof.cjs'),{mergeProof}=require('../scripts/verify-talents-suite.cjs');
const {rawTokens}=require('../scripts/verify-random-character-talents.cjs'),{buildTalentScenarios,triples}=require('../scripts/random-character-talents-scenarios.cjs');
// Merges start from the state before the first talent proof, even after the real proof is recorded.
const L=require('./helpers/legacy-release.cjs'),k=L.catalog(),proof=L.proof(),source=L.core;
k.verification.randomCharacterTalents=false;delete proof.randomCharacterTalents;delete proof.groups.randomCharacterTalents;
const proofText=JSON.stringify(proof,null,2)+String.fromCharCode(10);
const ctx={setTimeout};vm.runInNewContext(source.replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
const all={...k.fingerprints,...k.batch2Fingerprints};
// Native-shaped evidence computed independently from the reviewed rules; only the merger decides the checks.
function characters(rows){return rows.map(r=>{const sums={};r.ids.forEach((id,i)=>k.batch2Data.talents[id].attributes.forEach((a,s)=>{if(a)sums[a]=(sums[a]||0)+C.talentEffect(a,k.batch2Data.talents[id].coefficients[s],r.to[i]);}));return {id:r.id,cells:[...r.ids,...r.to],sums};});}
function aptitudes(rows){return rows.filter(r=>r.aptitude).map(r=>{const raw=Math.round(k.randomCharacterGrowth.totals[r.q-1][0]/3),base=[1,2,3].map(a=>raw/10+(a===r.aptitude?r.to[0]*0.5:0));return {id:r.id,base,caps:base.map(b=>Math.round(100*b*1.5)/100),totals:base};});}
function formulas(){const out=[];for(const [id,t]of Object.entries(k.batch2Data.talents))t.attributes.forEach((a,s)=>{if(a)for(let L=1;L<=5;L++)out.push([Number(id),s,a,t.coefficients[s],L,C.talentEffect(a,t.coefficients[s],L)]);});return out;}
const sourceEvidence=pids=>({fingerprints:all,sourceHashes:all,originalFileHashes:['a'.repeat(64)],assertions:pids.map((pid,i)=>({pid,restarted:i>0,passed:true}))});
const steps=['setup','load','oracle','save','assert','stop','restart','restartLoad','reload','oracleCompare'].map(step=>({step,script:'x',ok:true}));
function fixture(initial=true){
 const rows=P.expectedRows(k,initial?'initial-matrix':'representative'),life=P.expectedRows(k,'lifecycle'),f=formulas();
 const matrix={name:initial?'random-talents-matrix':'random-talents-representative',family:P.group,cases:rows.length,lifecycle:false,ok:true,steps,
  evidence:{source:sourceEvidence([1,2]),effects:{scenario:'m.json',coverage:initial?'initial-matrix':'representative',pid:1,characters:characters(rows),aptitudes:aptitudes(rows),formulas:f},reload:{pid:2,previousPid:1,tokenTypes:{integer:rows.length*6},characters:characters(rows),aptitudes:aptitudes(rows)}}};
 const lifecycle={name:'random-talents-lifecycle',family:P.group,cases:2,lifecycle:true,ok:true,steps,
  evidence:{source:sourceEvidence([3,4,5,6,7,8,9,10]),effects:{scenario:'l.json',coverage:'lifecycle',characters:characters(life),aptitudes:[],formulas:[]},lifecycle:{scenario:'l.json',events:[...P.LIFECYCLE_EVENTS],initial:characters(life),final:characters(life.slice(0,1)),pids:[3,4,5,6,7,8,9]}}};
 return {date:'2026-10-23T03:00:00.000Z',platform:'win32-x64',completed:true,copies:[matrix,lifecycle],checks:{}};
}
test('scenario builder covers every branch as a changed slot and keeps both coverage shapes',()=>{
 const data=Array.from({length:2501},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][1][0]='山寨';data[1][0][2]=1;data[1][1][2]='驗證甲';data[1][3][2]=1;
 const saveText=JSON.stringify({c2array:true,size:[2501,60,22],data});
 const initial=buildTalentScenarios({catalog:k,saveText}),representative=buildTalentScenarios({catalog:k,saveText,representative:true});
 assert.deepEqual(initial.map(c=>[c.name,c.cases,c.lifecycle]),[['random-talents-matrix',33,false],['random-talents-lifecycle',2,true]]);
 assert.deepEqual(representative.map(c=>[c.name,c.cases]),[['random-talents-representative',3],['random-talents-lifecycle',2]]);
 const changed=new Set(),forms=new Set();let double=0,single=0;
 for(const r of P.expectedRows(k,'initial-matrix').filter(r=>!r.aptitude)){const s=r.ids.findIndex((id,i)=>r.to[i]!==r.ids.map(()=>k.randomCharacterTalents.talentLevels[r.q-1][0])[i]||r.to[i]!==(r.to[i]===k.randomCharacterTalents.talentLevels[r.q-1][0]?r.to[i]:-1));changed.add(r.ids.join()+':'+s);}
 for(const t of triples.flat()){const at=k.batch2Data.talents[t].attributes.filter(Boolean);at.length>1?double++:single++;for(const a of at)forms.add(k.randomCharacterTalents.attributes[a].formula);}
 for(const a of [1,2,3])forms.add(k.randomCharacterTalents.attributes[103+a].formula);
 assert.deepEqual([...forms].sort(),['coefficientPlusTwoLevels','coefficientTimesLevel','growth','levelTenth','multiplier','regeneration']);
 assert.ok(single>0&&double>0);assert.equal(new Set(triples.flat()).size,30);
 // Every triple position moves once: each (triple, slot) pair appears in exactly one up or down row.
 const moved=P.expectedRows(k,'initial-matrix').filter(r=>!r.aptitude).map(r=>r.ids.join()+':'+r.to.findIndex((v,i)=>v!==r.to[(i+1)%3]&&v!==r.to[(i+2)%3]||r.to.every(x=>x===v)&&false));
 assert.equal(moved.length,30);
});
test('raw save tokens are read by coordinate without parsing numbers',()=>{
 const text='{"c2array":true,"size":[2,2,2],"data":[[[0,1.0],[2,3]],[[4,5e0],["x",7]]]}';
 assert.deepEqual(JSON.parse(JSON.stringify(rawTokens(text,[[0,0,1],[1,0,1],[1,1,0],[1,1,1]]))),{'0,0,1':'1.0','1,0,1':'5e0','1,1,0':'"x"','1,1,1':'7'});
});
test('complete native-shaped evidence merges only the new section and flag, bytes preserved',()=>{
 const merged=mergeProof({catalog:k,proof,results:fixture(),coreSource:source,proofText});
 assert.equal(P.problem(merged.catalog,merged.proof,source),null);assert.equal(merged.catalog.verification[P.group],true);
 assert.equal(merged.record.coverage,'initial-matrix');assert.equal(P.initialProblem(merged.record.initialVerification),false);
 assert.ok(merged.text.startsWith(proofText.slice(0,proofText.indexOf('"groups": {'))));
 const {[P.group]:added,...rest}=merged.proof;assert.deepEqual({...rest,groups:{...rest.groups}},{...proof,groups:{...proof.groups,[P.group]:true}});
 assert.deepEqual(Object.keys(added.groups[P.group].checks).sort(),[...require('../scripts/verification-requirements.cjs').requiredChecks(P.group)].sort());
});
test('caller checks are ignored and tampered, partial or stale evidence fails',()=>{
 const forged=fixture();forged.copies[0].evidence.effects.formulas.pop();forged.checks={[P.group]:Object.fromEntries(require('../scripts/verification-requirements.cjs').requiredChecks(P.group).map(c=>[c,true]))};
 assert.throws(()=>mergeProof({catalog:k,proof,results:forged,coreSource:source,proofText}));
 const tamper=[r=>{r.copies[0].evidence.effects.formulas[0][5]+=1;},r=>{r.copies[0].evidence.reload.tokenTypes={integer:197,'1.0':1};},r=>{r.copies[0].evidence.effects.characters[3].cells[4]+=1;},r=>{r.copies[0].evidence.effects.aptitudes[0].caps[0]+=0.01;},
  r=>{r.copies[0].evidence.reload.previousPid=r.copies[0].evidence.reload.pid;},r=>{r.copies[0].evidence.source.fingerprints={...all,'tf.json':'0'};},r=>{r.copies[1].evidence.lifecycle.events.pop();},r=>{r.copies[1].evidence.lifecycle.final[0].sums['104']+=1;},
  r=>{r.copies[1].evidence.lifecycle.pids=[3,3,3,3,3,3,3];},r=>{r.copies.pop();},r=>{r.completed=false;},r=>{r.copies[0].cases=32;},r=>{r.copies[0].evidence.source.assertions=[{pid:1,passed:true}];}];
 for(const [i,change]of tamper.entries()){const r=fixture();change(r);assert.throws(()=>mergeProof({catalog:k,proof,results:r,coreSource:source,proofText}),undefined,'tamper '+i);}
 // A representative run can be validated for migration but never creates the first proof.
 assert.throws(()=>mergeProof({catalog:k,proof,results:fixture(false),coreSource:source,proofText}));
 assert.ok(P.validateResults(k,source,fixture(false),{initial:false}).checks.aptitudeCap);
 // A proof recorded against one core is stale once the talent block changes.
 const fresh=mergeProof({catalog:k,proof,results:fixture(),coreSource:source,proofText});
 assert.match(P.problem(fresh.catalog,fresh.proof,source.replace('三槽天賦等級調整','三槽天賦等級修改')),/天賦/);
 assert.equal(P.problem(fresh.catalog,fresh.proof,source.replace('經驗總量超出安全範圍。','經驗總量超出範圍。')),null);
});
test('migration tooling carries but never creates the talent first proof',()=>{
 const M=require('../scripts/verify-migration.cjs'),S=require('../scripts/verification-suite.cjs');
 assert.equal(S.families[P.group].pendingReason,undefined);assert.equal(S.families[P.group].initialProofRequired,true);
 assert.doesNotThrow(()=>P.requireNativeRunner());
 const results={...fixture(false),gameVersion:k.gameVersion},merged=mergeProof({catalog:k,proof,results:fixture(),coreSource:source,proofText});
 // Skill caps validate their own copies; leave them out of this talent-only migration fixture.
 delete merged.proof.randomCharacterSkillCaps;const previous=structuredClone(proof);delete previous.randomCharacterSkillCaps;
 // Even an all-true check map cannot open the group without a validated talent evidence set.
 const R=require('../scripts/verification-requirements.cjs'),checks=Object.fromEntries(Object.keys(merged.catalog.verification).map(g=>[g,Object.fromEntries(R.requiredChecks(g).map(c=>[c,true]))]));
 const built=M.buildProof({catalog:merged.catalog,results:{...results,checks,ui:{}},coreSource:source,previous:merged.proof});
 assert.equal(built.groups[P.group],true);
 assert.equal(built.randomCharacterTalents.coverage,'representative');assert.deepEqual(built.randomCharacterTalents.initialVerification,merged.record.initialVerification);
 const none=M.buildProof({catalog:k,results:{...results,checks,ui:{}},coreSource:source,previous});assert.equal(none.randomCharacterTalents,undefined);assert.equal(none.groups[P.group],false);
 const broken=structuredClone(results);broken.copies[0].evidence.effects.formulas.pop();
 const blocked=M.buildProof({catalog:merged.catalog,results:{...broken,checks,ui:{}},coreSource:source,previous:merged.proof});assert.equal(blocked.groups[P.group],false);assert.equal(blocked.randomCharacterTalents,undefined);
});
