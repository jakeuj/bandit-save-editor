'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const P=require('../scripts/random-character-talents-proof.cjs'),S=require('../scripts/verification-suite.cjs'),R=require('../scripts/verification-requirements.cjs');
const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),core=fs.readFileSync('src/core.js','utf8');
test('the talent group opens only with a matching first proof; native entries require a state',()=>{
 if(!k.verification.randomCharacterTalents)assert.match(P.problem(k,proof,core),/獨立首次驗證/);
 assert.equal(S.families.randomCharacterTalents.initialProofRequired,true);assert.doesNotThrow(()=>P.requireNativeRunner());
 for(const script of [S.families.randomCharacterTalents.oracle,...S.families.randomCharacterTalents.lifecycle]){
  const run=spawnSync(process.execPath,[path.join('scripts',script)],{encoding:'utf8'});assert.equal(run.status,1,script);assert.doesNotMatch(run.stderr,/尚未實作/);
 }
 assert.ok(R.requiredChecks('randomCharacterTalents').includes('aptitudeCap'));
});
test('a forged all-true record without a first-proof binding is rejected',()=>{
 const checks=Object.fromEntries(R.requiredChecks(P.group).map(c=>[c,true])),validation={version:1,evidenceHash:'a'.repeat(64),manifestHash:'b'.repeat(64),...P.INITIAL};
 const record=P.record(k,core,{date:'2026-10-23',platform:'win32-x64',checks,coverage:'initial-matrix',copies:[],validation});
 assert.equal(P.problem(k,{randomCharacterTalents:record},core),null);
 for(const change of [r=>{r.coverage='representative';r.initialVerification=undefined;},r=>{r.dataHash='0';},r=>{r.groups[P.group].checks.aptitudeCap=false;},r=>{r.fingerprints['tf.json']='0';},r=>{r.initialVerification.matrixCases=32;},r=>{r.validation.evidenceHash='c'.repeat(64);}]){const r=structuredClone(record);change(r);assert.ok(P.problem(k,{randomCharacterTalents:r},core));}
 assert.throws(()=>P.record(k,core,{checks,coverage:'representative',validation}),/首次/);
 // The talent block and the v2.7 aptitude source are bound; unrelated core text is not.
 assert.notEqual(P.formulaHash(core.replace('三槽天賦等級調整','三槽天賦等級修改')),record.formulaHash);
 assert.notEqual(P.formulaHash(core.replace("throw Error('角色範本尚未辨識。')","throw Error('角色範本未辨識。')")),record.formulaHash);
 assert.equal(P.formulaHash(core.replace('經驗總量超出安全範圍。','經驗總量超出範圍。')),record.formulaHash);
 assert.equal(P.formulaHash(core.replace(/\n/g,'\r\n')),record.formulaHash);
});
