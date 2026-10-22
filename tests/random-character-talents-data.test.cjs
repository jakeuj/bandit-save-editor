'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../scripts/random-character-talents-data.cjs'),k=require('../knowledge/catalog.json');
const sx=()=>{const r=[];for(const [id,unit]of [[10,'小数'],[12,'百分比'],[77,'倍率'],[104,'小数'],[50,'百分比']])r[id]=[id,'',0,0,unit];return r;};
const tf=()=>[[0],[1,'',1,1,'通用','普通','力量',104,0,0,5,0,0],[2,'',1,2,'战斗','稀有','通用',12,77,0,3,3,0]];
test('reviewed talent rules keep level pools and source-ordered effect branches',()=>{
 const d=D.reviewedRules(D.reviewedDigest,tf(),sx());
 assert.deepEqual(d.talentLevels,[[1,2],[1,2,3],[2,3,4],[3,4,5],[4,5],[5]]);
 assert.deepEqual(d.attributes,{104:{unit:'小数',formula:'levelTenth'},12:{unit:'百分比',formula:'coefficientPlusTwoLevels'},77:{unit:'倍率',formula:'multiplier'}});
 assert.equal(D.formulaOf(2,'倍率'),'levelTenth');assert.equal(D.formulaOf(52,'百分比'),'coefficientTimesLevel');assert.equal(D.formulaOf(10,'小数'),'regeneration');assert.equal(D.formulaOf(36,'百分比'),'growth');
 assert.equal(k.randomCharacterTalents.sourceDigest,D.reviewedDigest);
 assert.deepEqual(k.randomCharacterTalents.sourceSids,D.sourceSids);
 assert.equal(typeof k.verification.randomCharacterTalents,'boolean');
});
test('catalog covers 75 talents, 107 attribute slots and the six native branches',()=>{
 const uses={};let slots=0;
 for(const t of Object.values(k.batch2Data.talents))t.attributes.forEach(a=>{if(!a)return;slots++;const f=k.randomCharacterTalents.attributes[a].formula;uses[f]=(uses[f]||0)+1;});
 assert.equal(Object.keys(k.batch2Data.talents).length,75);assert.equal(slots,107);
 assert.deepEqual(uses,{levelTenth:3,coefficientPlusTwoLevels:8,coefficientTimesLevel:5,regeneration:3,multiplier:17,growth:71});
});
test('unreviewed events, malformed talent rows or unknown units fail closed',()=>{
 assert.throws(()=>D.reviewedRules('changed',tf(),sx()),/SID/);
 for(const [col,value]of [[0,9],[7,'104'],[7,0],[8,5],[10,-1],[11,0],[10,'5']]){const r=tf();r[2][col]=value;assert.throws(()=>D.reviewedRules(D.reviewedDigest,r,sx()),undefined,JSON.stringify([col,value]));}
 const s=sx();delete s[77];assert.throws(()=>D.reviewedRules(D.reviewedDigest,tf(),s),/屬性型別/);
 assert.equal(D.canPreserve(k,structuredClone(k)),true);
 for(const field of ['fingerprints','batch2Fingerprints','randomCharacterTalents']){const n=structuredClone(k);n[field].changed=true;assert.equal(D.canPreserve(k,n),false);}
 const n=structuredClone(k);n.batch2Data.talents[1].coefficients[0]=6;assert.equal(D.canPreserve(k,n),false);
 assert.equal(D.canPreserve({},k),false);
});
