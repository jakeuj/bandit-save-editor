'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../scripts/random-character-skill-caps-data.cjs'),k=require('../knowledge/catalog.json');
const rows=()=>[[0],...[1,2,3].map(id=>[id,'',0,0,'通用',0,'力量',0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])];
test('reviewed cap rules retain all six rounded endpoints and readonly talent selectors',()=>{
 const r=rows();r[1][13]=1;r[2][21]=1;
 const d=D.reviewedRules(D.reviewedDigest,k.randomCharacterGrowth,r);
 assert.deepEqual(d.ranges,[{base:[4,14],primary:[18,38],secondary:[9,27]},{base:[7,17],primary:[28,48],secondary:[17,35]},{base:[10,20],primary:[38,58],secondary:[25,43]},{base:[13,23],primary:[48,68],secondary:[33,51]},{base:[16,26],primary:[58,78],secondary:[41,59]},{base:[19,29],primary:[68,88],secondary:[49,67]}]);
 assert.deepEqual(d.talents[1].excludedPrimary,[1]);assert.deepEqual(d.talents[2].excludedPrimary,[9]);
 assert.equal(k.randomCharacterSkillCaps.sourceDigest,D.reviewedDigest);
 assert.equal(typeof k.verification.randomCharacterSkillCaps,'boolean');
 if(k.verification.randomCharacterSkillCaps)assert.equal(require('../knowledge/verification.json').groups.randomCharacterSkillCaps,true,'開放狀態必須有群組紀錄');
});
test('unreviewed events, malformed tf and any bound data drift fail closed',()=>{
 assert.throws(()=>D.reviewedRules('changed',k.randomCharacterGrowth,rows()),/SID/);
 for(const [col,value]of [[0,99],[4,1],[6,null],[13,'1'],[21,2]]){const r=rows();r[1][col]=value;assert.throws(()=>D.reviewedRules(D.reviewedDigest,k.randomCharacterGrowth,r));}
 assert.equal(D.canPreserve(k,structuredClone(k)),true);
 for(const field of ['fingerprints','batch2Fingerprints','randomCharacterSkillCaps']){const n=structuredClone(k);n[field].changed=true;assert.equal(D.canPreserve(k,n),false);}
 assert.equal(D.canPreserve({},k),false);
});

test('initial rules bind all native generation and recruitment entrypoints and reject source drift',()=>{
 const initial=D.reviewedInitialRules(D.reviewedInitialDigest);
 assert.deepEqual(initial,{quality:1,ranges:{base:[1,30],primary:[36,44],secondary:[26,34]},sourceSids:[822838674776648,820431404775607,213875126173692,480540019440160],sourceDigest:D.reviewedInitialDigest});
 assert.deepEqual(k.randomCharacterSkillCaps.initial,initial);
 assert.throws(()=>D.reviewedInitialRules('changed'),/初始角色.*SID/);
 for(const field of ['ranges','sourceDigest']){const next=structuredClone(k);next.randomCharacterSkillCaps.initial[field]='changed';assert.equal(D.canPreserve(k,next),false);}
 for(const flag of ['randomCharacterSkillCapsInitial','randomCharacterSkillCapsAdvanced']){
  assert.equal(typeof k.verification[flag],'boolean');
  assert.ok(fs.readFileSync('scripts/extract-game.cjs','utf8').includes(flag+':false'));
  assert.equal(require('../scripts/verification-suite.cjs').familyOf(flag),'randomCharacterSkillCaps');
  if(k.verification[flag]){
   const proof=require('../knowledge/verification.json'),record=proof.lightweight[flag];
   assert.equal(proof.groups[flag],true);assert.equal(record.passed,true);assert.equal(record.gameVersion,k.gameVersion);assert.match(record.resultSha256,/^[0-9a-f]{64}$/);
  }
 }
});
