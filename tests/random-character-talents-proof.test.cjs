'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const P=require('../scripts/random-character-talents-proof.cjs'),S=require('../scripts/verification-suite.cjs'),R=require('../scripts/verification-requirements.cjs');
const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),core=fs.readFileSync('src/core.js','utf8');
test('A phase keeps the talent group closed with fail-closed native entries',()=>{
 assert.equal(k.verification.randomCharacterTalents,false);
 assert.ok(S.families.randomCharacterTalents.pendingReason);assert.equal(S.families.randomCharacterTalents.initialProofRequired,true);
 assert.throws(()=>P.requireNativeRunner(),/不可產生或合併成功證明/);
 assert.match(P.problem(k,proof,core),/獨立首次驗證/);
 for(const script of [S.families.randomCharacterTalents.oracle,...S.families.randomCharacterTalents.lifecycle]){
  const run=spawnSync(process.execPath,[path.join('scripts',script)],{encoding:'utf8'});assert.equal(run.status,1,script);assert.match(run.stderr,/尚未實作/);
 }
 assert.ok(R.requiredChecks('randomCharacterTalents').includes('aptitudeCap'));
});
test('a forged all-true record is rejected unless it binds sources, rules and the talent formula slice',()=>{
 const checks=Object.fromEntries(R.requiredChecks(P.group).map(c=>[c,true]));
 const record={gameVersion:k.gameVersion,coverage:'initial-matrix',fingerprints:{...k.fingerprints,...k.batch2Fingerprints},dataHash:P.dataHash(k),formulaHash:P.formulaHash(core),groups:{[P.group]:{checks}}};
 assert.equal(P.problem(k,{randomCharacterTalents:record},core),null);
 for(const change of [r=>{r.coverage='representative';},r=>{r.dataHash='0';},r=>{r.groups[P.group].checks.aptitudeCap=false;},r=>{r.fingerprints['tf.json']='0';}]){const r=structuredClone(record);change(r);assert.ok(P.problem(k,{randomCharacterTalents:r},core));}
 // The talent block and the v2.7 aptitude source are bound; unrelated core text is not.
 assert.notEqual(P.formulaHash(core.replace('三槽天賦等級調整','三槽天賦等級修改')),record.formulaHash);
 assert.notEqual(P.formulaHash(core.replace("throw Error('角色範本尚未辨識。')","throw Error('角色範本未辨識。')")),record.formulaHash);
 assert.equal(P.formulaHash(core.replace('經驗總量超出安全範圍。','經驗總量超出範圍。')),record.formulaHash);
 assert.equal(P.formulaHash(core.replace(/\n/g,'\r\n')),record.formulaHash);
});
