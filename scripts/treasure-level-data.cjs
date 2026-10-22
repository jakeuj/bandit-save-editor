'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// Reviewed static rules, not a native proof. Covers acquisition, upgrade, cap, equip/unequip, storage moves and decomposition.
const sourceSids=[601593514747018,605413626718369,290240793057956,713681756866045,940995553206160,924571110308816,501272375624196,791657421740250,959041203712077,654692930556623,418018161514165,754298301929487,311899301569964,714979671293604,163385542232476,981828147671074,761577193118513,565108901731936,131416746119248,773239288013696];
const reviewedDigest='d538a7f4e8ca258d1b5583797806d9f9f125b9898f5e5be78fff3b5fbf6fdcd2';
const groups=['backpackTreasureLevel','treasureLevel'];
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const tierCounts={1:21,2:25,3:29,4:31,5:31,6:33};
const decompose={1:20,2:200,3:1000,4:10000,5:50000,6:500000};
function reviewedRules(digest,{wp}){
 if(digest!==reviewedDigest)throw Error('寶物來源事件已改變，需重新核對');
 const items={},counts={};
 for(const t of wp.filter(r=>r[4]==='宝物'&&r[5]==='装备'&&r[6]===6)){
  const id=t[0];
  if(!Number.isSafeInteger(id)||wp[id]!==t||items[id]||![1,2,3,4,5,6].includes(t[3])||t[16]!==0&&t[16]!==undefined&&t[16]!=='')throw Error('寶物範本資料不符');
  if(!t.slice(8,14).every(v=>Number.isFinite(v)))throw Error('寶物主屬性資料不符');
  items[id]={name:t[1],tier:t[3],slot:6,mainAttributes:t.slice(8,11),mainSettings:t.slice(11,14)};
  counts[t[3]]=(counts[t[3]]||0)+1;
 }
 if(JSON.stringify(counts)!==JSON.stringify(tierCounts))throw Error('寶物範本規模尚未核對');
 return {version:1,policy:'level-only',phase:'A-static-no-native-proof',sourceSids,sourceDigest:digest,items,
  qualities:{min:1,max:6,capBase:10,capStep:5},
  // C(L,T)=round(10*1.05^((T-1)*30+4*L)-1): the -1 is applied inside round, outside the exponent.
  cost:{currency:'souls',base:10,growth:1.05,tierStep:30,levelStep:4,offset:-1,rounding:'round'},
  decompose:{currency:'souls',byTier:{...decompose},ignores:['level','quality','coefficient','investment']},
  limits:{planes:[7,9],slot:6,minTier:1,maxTier:6,quantity:1,backpackOwner:0,equipPointer:{y:21,z:2},moveColumns:50,columns:{level:6,owner:7,locked:22},experience:false,advanced:false,metadata:'native-conversion-witness-required'}};
}
function extract(game,digestEvents){
 // Historical builds are not supported; the editor keeps working without claiming treasure support.
 if(['6661d77209c0e98069219965908fd4d6b9ee3dca84763c158dcd5f0a863df665','32a36accc1b97e9bb3498eb3be76950e1e72b2e8f7a0cf9ce293b57aa5e0d820'].includes(game.fingerprints?.['data.json']))return null;
 const wp=JSON.parse(fs.readFileSync(path.join(game.root,'wp.json'),'utf8')).data.map(r=>r.map(c=>c[0]));
 return reviewedRules(digestEvents(game,sourceSids),{wp});
}
const canPreserve=(old,next)=>['fingerprints','batch2Fingerprints','treasureLevel'].every(k=>hash(old[k]??null)===hash(next[k]??null));
function requireClosed(k){for(const group of groups)if(k.verification[group]!==undefined&&k.verification[group]!==false)throw Error('寶物等級沒有首次證明，群組必須關閉：'+group);}
module.exports={extract,reviewedRules,reviewedDigest,sourceSids,groups,hash,canPreserve,requireClosed,decompose};
