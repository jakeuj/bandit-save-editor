'use strict';
const {createHash}=require('node:crypto');
const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
function formulaHash(source){
 const start=source.indexOf(' // Exact recruitment feasibility.'),end=source.indexOf(' /** @returns {FieldDescriptor} */',start);
 const equipment=source.match(/ function ordinaryEquipment\([\s\S]*?(?= function equipmentSlotInfo)/)?.[0];
 if(start<0||end<0||!equipment)throw Error('Missing random growth formula source');
 return sha((source.slice(start,end)+equipment).replace(/\r\n/g,'\n'));
}
const dataHash=k=>sha({rules:k.randomCharacterGrowth,talents:k.batch2Data.talents,items:k.batch2Data.items});
function record(k,coreSource,{date,platform,checks,coverage='representative',copies}){
 return {date,gameVersion:k.gameVersion,platform,fingerprints:{...k.fingerprints,...k.batch2Fingerprints},dataHash:dataHash(k),formulaHash:formulaHash(coreSource),coverage,copies,groups:{randomCharacterBaseAptitudes:{checks}}};
}
function problem(k,proof,coreSource){
 const p=proof.randomCharacterGrowth,all={...k.fingerprints,...k.batch2Fingerprints},required=require('./verification-requirements.cjs').requiredChecks('randomCharacterBaseAptitudes');
 if(!p||p.gameVersion!==k.gameVersion||Object.keys(p.fingerprints||{}).length!==15||Object.keys(all).length!==15||Object.entries(all).some(([f,h])=>p.fingerprints[f]!==h)||p.dataHash!==dataHash(k)||p.formulaHash!==formulaHash(coreSource)||!required.every(c=>p.groups?.randomCharacterBaseAptitudes?.checks?.[c]===true))return '一般隨機角色基礎資質缺少相符的獨立驗證';
 return null;
}
module.exports={dataHash,formulaHash,record,problem};
