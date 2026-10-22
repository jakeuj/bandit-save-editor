'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// Reviewed static rules, not a native proof. Whole event subtrees include metadata producers and movement.
const sourceSids=[713681756866045,605413626718369,290240793057956,648325761183486,179109980508468,797846367485481,240477057233049,661914404104909,131416746119248,773239288013696,360141429177377,503731874338191,791657421740250,654692930556623,924571110308816,501272375624196,601593514747018,699971245656002];
const reviewedDigest='74f9e5772b73edbdcac8bf4c9111b23bb5b9a42ec86198500ae24a27917be598';
const groups=['backpackSetEquipmentLevel','setEquipmentLevel'];
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function reviewedRules(digest,{wp,tz,sx},batch2,affix){
 if(digest!==reviewedDigest)throw Error('套裝來源事件已改變，需重新核對');
 if(tz.length!==55||wp.filter(r=>r[4]==='套装').length!==216)throw Error('套裝資料規模尚未核對');
 const sets={},items={},origins={};
 for(const r of tz.slice(1)){
  const id=r[0],members=r.slice(9,15).filter(Boolean),effects=[];
  if(!Number.isSafeInteger(id)||id<1||id>=tz.length||tz[id]!==r||r[2]!==4||members.length!==4||new Set(members).size!==4)throw Error('套裝成員資料不符');
  for(let i=0;i<3;i++){
   const attributeId=r[3+2*i],coefficient=r[4+2*i];
   if(!Number.isSafeInteger(attributeId)||attributeId<0||!Number.isFinite(coefficient)||coefficient<0||(attributeId===0)!==(coefficient===0))throw Error('套裝效果資料不符');
   if(attributeId){const format=sx[attributeId]?.[4];if(!['百分比','倍率','整数'].includes(format))throw Error('套裝效果單位尚未核對');effects.push({pieces:2+2*i,attributeId,coefficient,format});}
  }
  if(r[7]!==0||r[8]!==0)throw Error('尚未涵蓋自然六件套裝');
  sets[id]={name:r[1],pieces:r[2],members,effects};
  for(const templateId of members){const t=wp[templateId];
   if(t?.[0]!==templateId||t[4]!=='套装'||t[5]!=='装备'||t[16]!==id||![1,2,3,4].includes(t[6])||t[17]!==t[6]||!Number.isSafeInteger(t[3])||t[3]<1||t[3]>9||items[templateId])throw Error('套裝範本／部位不符');
   items[templateId]={name:t[1],tier:t[3],slot:t[6],setLink:id,part:t[17],mainAttributes:t.slice(8,11),mainSettings:t.slice(11,14)};
  }
 }
 for(const t of wp.filter(r=>r[4]==='普通'&&r[5]==='装备'&&r[16]===0&&[1,2,3,4].includes(r[6]))){
  const pool=batch2.items[t[0]]?.affixIds;
  if(!pool?.length||pool.some(id=>!Number.isSafeInteger(id)||!affix.attributes[id]))throw Error('原裝備詞條資料不符');
  origins[t[0]]={tier:t[3],slot:t[6],affixIds:[...pool]};
 }
 const needed=new Set([...Object.values(items).flatMap(t=>t.mainAttributes).filter(Boolean),...Object.keys(affix.attributes).map(Number)]),attributes={};
 for(const id of needed){
  if(sx[id]?.[0]!==id)throw Error('主屬性資料缺列');
  const kind=id>=4&&id<=6?'attack':id>=1&&id<=3?'aptitude':id>=40&&id<=48?'work':'percent';
  // 套裝主屬性 #28 uses the reviewed final/default branch (V1.0.11.2 expression 5315).
  const rule=affix.attributes[id]||(id===28?{base:4,tier:1.5,level:.2}:null);if(kind==='percent'&&!rule)throw Error('主屬性公式未涵蓋');
  attributes[id]={kind,format:sx[id][4],...(kind==='percent'?{base:rule.base,tier:rule.tier,level:rule.level}:{})};
 }
 for(const t of Object.values(items))if(t.mainSettings.some(v=>!Number.isFinite(v))||!Object.values(origins).some(o=>o.slot===t.slot&&o.tier===t.tier))throw Error('套裝原裝備來源未涵蓋');
 return {version:1,policy:'level-only',phase:'A-static-no-native-proof',sourceSids,sourceDigest:digest,sets,items,origins,attributes,limits:{planes:[7,9],minQuality:1,maxQuality:6,minTier:1,maxTier:9,advanced:false,metadata:'native-conversion-witness-required',moveColumns:50}};
}
function extract(game,digestEvents,batch2,affix){
 // Keep the editor's already-supported historical generators usable without claiming set-level support.
 if(['6661d77209c0e98069219965908fd4d6b9ee3dca84763c158dcd5f0a863df665','32a36accc1b97e9bb3498eb3be76950e1e72b2e8f7a0cf9ce293b57aa5e0d820'].includes(game.fingerprints?.['data.json']))return null;
 const table=n=>JSON.parse(fs.readFileSync(path.join(game.root,n+'.json'),'utf8')).data.map(r=>r.map(c=>c[0]));
 return reviewedRules(digestEvents(game,sourceSids),{wp:table('wp'),tz:table('tz'),sx:table('sx')},batch2,affix);
}
const canPreserve=(old,next)=>['fingerprints','batch2Fingerprints','setEquipmentLevel'].every(k=>hash(old[k]??null)===hash(next[k]??null));
function requireClosed(k){for(const group of groups)if(k.verification[group]!==undefined&&k.verification[group]!==false)throw Error('套裝等級 A 階段沒有首次證明，群組必須關閉：'+group);}
module.exports={extract,reviewedRules,reviewedDigest,sourceSids,groups,hash,canPreserve,requireClosed};
