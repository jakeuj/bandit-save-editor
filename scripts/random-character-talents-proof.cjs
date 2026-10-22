'use strict';
const {createHash}=require('node:crypto');
const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const group='randomCharacterTalents';
// Binds the talent block and the v2.7 aptitude source it calls, not the whole core.
function formulaHash(source){
 const start=source.indexOf(' // Talent level rules.'),end=source.indexOf(' // Talent level rules end.',start);
 if(start<0||end<0)throw Error('Missing talent level source');
 return sha(source.slice(start,end).replace(/\r\n/g,'\n')+require('./random-character-growth-proof.cjs').formulaHash(source));
}
const dataHash=k=>sha({rules:k.randomCharacterTalents,talents:k.batch2Data.talents});
function problem(k,proof,coreSource){
 const p=proof?.randomCharacterTalents,all={...k.fingerprints,...k.batch2Fingerprints},required=require('./verification-requirements.cjs').requiredChecks(group);
 if(!p||p.gameVersion!==k.gameVersion||p.coverage!=='initial-matrix'||Object.keys(all).length!==15||Object.entries(all).some(([f,h])=>p.fingerprints?.[f]!==h)||p.dataHash!==dataHash(k)||p.formulaHash!==formulaHash(coreSource)||!required.every(c=>p.groups?.[group]?.checks?.[c]===true))return '一般隨機角色天賦等級缺少相符的獨立首次驗證';
 return null;
}
function requireNativeRunner(){
 const family=require('./verification-suite.cjs').families.randomCharacterTalents;
 if(family.pendingReason)throw Error(family.pendingReason+'；不可產生或合併成功證明');
}
module.exports={group,formulaHash,dataHash,problem,requireNativeRunner};
