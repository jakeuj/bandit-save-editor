'use strict';
const {createHash}=require('node:crypto');
const sha=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const group='randomCharacterSkillCaps';
// Bind the entire unembedded core: feasibility, readonly policy, transactions, batches and serializer.
// This intentionally requires re-verification if any shared write implementation changes.
const formulaHash=source=>sha(source.replace(/\r\n/g,'\n'));
const dataHash=k=>sha(k.randomCharacterSkillCaps);
function record(k,source,{date,platform,checks,coverage='representative',copies}){
 return {date,gameVersion:k.gameVersion,platform,fingerprints:{...k.fingerprints,...k.batch2Fingerprints},dataHash:dataHash(k),formulaHash:formulaHash(source),coverage,copies,groups:{[group]:{checks}}};
}
function problem(k,proof,source){
 const p=proof[group],all={...k.fingerprints,...k.batch2Fingerprints},required=require('./verification-requirements.cjs').requiredChecks(group);
 if(!p||!k.randomCharacterSkillCaps||p.gameVersion!==k.gameVersion||Object.keys(all).length!==15||Object.keys(p.fingerprints||{}).length!==15||Object.entries(all).some(([f,h])=>p.fingerprints[f]!==h)||p.dataHash!==dataHash(k)||p.formulaHash!==formulaHash(source)||!required.every(c=>p.groups?.[group]?.checks?.[c]===true))return '一般隨機角色技藝上限缺少相符的獨立驗證';
 return null;
}
function requireNativeRunner(){
 const family=require('./verification-suite.cjs').families[group];
 if(family.pendingReason)throw Error(family.pendingReason+'；不可產生或合併成功證明');
}
module.exports={group,formulaHash,dataHash,record,problem,requireNativeRunner};
