'use strict';
// Proof contract for the two treasure-level groups. A group opens only with its own initial-matrix record; the
// representative migration copies below validate a later build but can never create or substitute that record.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const D=require('./treasure-level-data.cjs'),Core=require('./core-source-proof.cjs'),R=require('./verification-requirements.cjs');
const valid=v=>/^[a-f0-9]{64}$/.test(v||''),same=(a,b)=>D.hash(a)===D.hash(b);
// Per-group denominators fixed by the manifest: 170 templates × Q1–Q6 × 4 boundary pairs per state, and the lifecycle shard cases.
const expected={
 backpackTreasureLevel:{matrixCases:4080,lifecycleCases:6,effectTemplates:170,costs:0,decomposes:72,rejects:12},
 treasureLevel:{matrixCases:8160,lifecycleCases:10,effectTemplates:170,costs:72,decomposes:0,rejects:24}
};
const binding=(k,source)=>({gameVersion:k.gameVersion,fingerprints:{...k.fingerprints,...k.batch2Fingerprints},dataHash:D.hash(k.treasureLevel),coreHash:Core.hash(source),coreHashAlgorithm:Core.algorithm,oracleHash:D.hash(fs.readFileSync(path.join(__dirname,'treasure-level-oracle.cjs'),'utf8'))});
function initialProblem(v,group){
 const e=expected[group];
 if(!e)return '未知寶物群組';
 if(!v||v.group!==group||v.coverage!=='initial-matrix'||Object.keys(v.fingerprints||{}).length!==15||!valid(v.coreHash)||!Core.supported(v.coreHashAlgorithm)||!valid(v.dataHash)||!valid(v.manifestHash)||!valid(v.evidenceHash))return '寶物首次證明紀錄不完整';
 for(const [key,count] of Object.entries(e))if(v[key]!==count)return '寶物首次證明案例數不符：'+key;
 return null;
}
function validateMigrationCopy(copy,k){
 const e=copy.evidence;
 assert.ok(copy.ok&&e&&e.scenario.treasureLevelCoverage==='representative');
 assert.equal(copy.family,'treasureLevel');
 assert.ok(copy.steps.length&&copy.steps.every(s=>s.ok));
 for(const name of ['load','oracle','save','assert','reload','oracleCompare','lifecycle'])assert.ok(copy.steps.some(s=>s.step===name&&s.ok),'代表驗證缺步驟 '+name);
 assert.ok(copy.steps.filter(s=>s.step==='lifecycle').length>=5);
 const sources={...k.fingerprints,...k.batch2Fingerprints};
 for(const [file,h] of Object.entries(sources))assert.equal(e.source.sourceHashes[file],h);
 assert.equal(e.scenario.items.length,2);
 const plane=e.scenario.items[0].plane;
 assert.ok(e.scenario.items.every(v=>v.plane===plane&&v.slot===k.treasureLevel.limits.slot));
 assert.equal(copy.name,'treasure-level-'+plane+'-representative');
 require('./verify-treasure-level.cjs').validateEffects(e.effects,e.scenario.items,k);
 require('./verify-treasure-level-lifecycle.cjs').validateCycle(e.lifecycle.cycle,e.scenario.items[0].after);
 assert.deepEqual(e.source.fingerprints,sources);
 assert.ok(e.source.assertions.length>=4&&e.source.assertions.every(a=>a.passed)&&new Set(e.source.assertions.map(a=>a.pid)).size>=3);
 assert.ok(e.source.originalHashes.length>0);assert.ok(e.steam.initialized);
 return Object.fromEntries(R.requiredChecks(D.groups[plane===7?0:1]).map(c=>[c,true]));
}
// Build gate: a flag may be true only when the composite proof carries this group's matching initial record.
function problem(k,proof,source,only){
 const open=only?[only]:D.groups.filter(g=>k.verification[g]);
 if(!open.length)return null;
 if(proof.schemaVersion===2)return require('./migration-proof.cjs').problem(k,proof,source,only);
 const p=proof.treasureLevel,b=binding(k,source);
 for(const group of open)if(!p||!same(Object.fromEntries(Object.keys(b).map(key=>[key,p[key]])),b)||initialProblem(p.initialVerification?.[group],group)||!R.requiredChecks(group).every(c=>p.groups?.[group]?.checks?.[c]===true))return '寶物等級缺少相符的獨立首次證明：'+group;
 return null;
}
// Pure merge of a validated initial record into the proof. The matrix/lifecycle validator that builds the record and its
// results lives with the full first run (task 9); this only refuses anything that is not group-complete, and never
// touches the other group, the other sections or the input object.
function mergeProof({catalog,proof,group,record,results,source}){
 assert.ok(D.groups.includes(group),'未知寶物群組');
 const initial=record.initialVerification?.[group];
 assert.ok(!initialProblem(initial,group),'寶物首次證明紀錄不完整');
 assert.equal(initial.dataHash,D.hash(catalog.treasureLevel),'寶物規則摘要不符');
 assert.ok(results.completed&&R.requiredChecks(group).every(c=>results.checks?.[group]?.[c]===true),'首次原生 checks 不完整');
 const next=structuredClone(proof),checks=Object.fromEntries(R.requiredChecks(group).map(c=>[c,true]));
 next.groups={...next.groups,[group]:true};
 if(proof.schemaVersion===2){
  next.treasureLevel={...(next.treasureLevel||{}),initialVerification:{...(next.treasureLevel?.initialVerification||{}),[group]:initial}};
  require('./migration-proof.cjs').mergeInitial(catalog,next,group,{initialVerification:{[group]:initial},coverage:'initial-matrix'},results,source);
  return next;
 }
 assert.equal(typeof source,'string','缺少核心來源');
 const b=binding(catalog,source),old=next.treasureLevel;
 if(old)assert.ok(same(Object.fromEntries(Object.keys(b).map(key=>[key,old[key]])),b),'另一寶物群組的證明綁定不同，需整體重證');
 next.treasureLevel={...(old||{}),...b,date:record.date||old?.date,coverage:'initial-matrix',initialVerification:{...(old?.initialVerification||{}),[group]:initial},groups:{...(old?.groups||{}),[group]:{checks}}};
 return next;
}
module.exports={expected,binding,initialProblem,validateMigrationCopy,problem,mergeProof};
