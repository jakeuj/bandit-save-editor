'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const P=require('../scripts/set-equipment-level-proof.cjs'),D=require('../scripts/set-equipment-level-data.cjs'),k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),source=fs.readFileSync('src/core.js','utf8');
test('set first proofs bind each plane independently to native coverage, sources, rules and final core',()=>{
 assert.equal(P.problem(k,proof,source),null);const p=structuredClone(proof);delete p.setEquipmentLevel.initialVerification.backpackSetEquipmentLevel;
 assert.ok(P.problem(k,p,source,D.groups[0]));assert.equal(P.problem(k,p,source,D.groups[1]),null);
 for(const change of [p=>p.setEquipmentLevel.initialVerification.setEquipmentLevel.matrixCases--,p=>p.setEquipmentLevel.initialVerification.setEquipmentLevel.group=D.groups[0],p=>p.setEquipmentLevel.initialVerification.setEquipmentLevel.lifecycleCases=4,p=>delete p.setEquipmentLevel.initialVerification.setEquipmentLevel.fingerprints,p=>p.setEquipmentLevel.groups.setEquipmentLevel.checks.restart=false,p=>p.setEquipmentLevel.dataHash='0'.repeat(64)]){const p=structuredClone(proof);change(p);assert.ok(P.problem(k,p,source,D.groups[1]));}
 assert.equal(P.problem(k,proof,source+'\n// cosmetic'),null);assert.ok(P.problem(k,proof,source+'\nglobalThis.changed=true;'));
});
test('first-opening insert retains every unrelated proof byte and cannot invent coverage from representatives',()=>{
 const old=structuredClone(proof);delete old.setEquipmentLevel;for(const g of D.groups)delete old.groups[g];const text=JSON.stringify(old,null,2)+'\n',record=proof.setEquipmentLevel;
 const merged=P.mergeText(text,record,[D.groups[0]]),p=JSON.parse(merged);assert.equal(p.groups[D.groups[0]],true);assert.equal(p.groups[D.groups[1]],undefined);delete p.setEquipmentLevel;delete p.groups[D.groups[0]];assert.deepEqual(p,old);
 const representative=structuredClone(record);representative.initialVerification[D.groups[0]].matrixCases=2;assert.throws(()=>P.mergeText(text,representative,[D.groups[0]]));assert.throws(()=>P.mergeText(text,record,['equipmentLevel']));
});
test('set migration owns both groups with independently selected copies and never creates a first proof',()=>{
 const R=require('../scripts/verification-requirements.cjs'),S=require('../scripts/verification-suite.cjs'),M=require('../scripts/verify-migration.cjs');assert.equal(S.families.setEquipmentLevel.initialProofRequired,true);for(const g of D.groups)assert.equal(R.sectionOf(g),'setEquipmentLevel');assert.deepEqual(S.uncovered(D.groups),[]);
 const fake={name:'set-level-7-representative',family:'setEquipmentLevel',ok:true,steps:[{step:'load',ok:true}],evidence:{checks:{load:true}}};assert.throws(()=>P.validateMigrationCopy(fake,k));const checks=M.provenChecks([fake],{},undefined,k);for(const g of D.groups)assert.ok(Object.values(checks[g]).every(v=>v===false));
});
