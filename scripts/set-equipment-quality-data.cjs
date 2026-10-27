'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// Reviewed static rules, not a native proof. Q1-Q10 index docs/research/set-equipment-quality.md (V1.0.11.2 SIDs / expressions).
const dependencies={
 Q1:{sids:[360141429177377,910195347276964,631300007252337],expressions:[5289,5290,5291,5293,5298,5299,5300],topic:'main/sub coefficient ranges, slot count'},
 Q2:{sids:[713681756866045,605413626718369,384081373648316],expressions:[5326,3010,3011,3012],topic:'level cap by quality'},
 Q3:{sids:[601593514747018,166680919655131,817916654281532,503731874338191,835824606167319],expressions:[12,15,44,2846,2753,4,3569,3570],topic:'acquisition and synthesis keep y5 and affixes'},
 Q4:{sids:[557896778643212,619743323262026,564254928232839],expressions:[2390,2834,4866,4867,4868,2902],topic:'affix pool follows current y1 template'},
 Q5:{sids:[773239288013696,287806596379587,365081551176251,471274501781742,131416746119248],expressions:[5306,5307,5312,5308,5309,5310,5311,5313,5314,5315,5367,5369],topic:'per-piece main attribute and attack LxQ'},
 Q6:{sids:[797846367485481,944863480488013,240477057233049,934893556333374],expressions:[813,800,3036,3037,3038,15,3,4],topic:'set piece parts, score S and count N'},
 Q7:{sids:[661914404104909],expressions:[243,5329,5330,5332,5370,5371,5372,5373,5374,5375,5376,5377,5378],topic:'extra set bonus independent of y5'},
 Q8:{sids:[791657421740250,204416519787196,654692930556623,574511591831477],expressions:[2874,2875,59,12,15,3],topic:'storage move copies y0-49'},
 Q9:{sids:[924571110308816,685377673296405,257975754908346,501272375624196,314497106398393,731456201592556],expressions:[801,15,3,3610],topic:'equip/unequip owner pointers, synthesis refresh'},
 Q10:{sids:[491911663973794,118557701104625,780562691790658,876108178253015,196601779910507,775039415186059,819450314280438,338766607025535],expressions:[2833,356,2834,2835,2836,4852,1576,2902,4869,4870,4865],topic:'slot generation, refine page limits and refresh'}
};
const reviewedDigests={
 Q1:'3ca6d9b9dfc3b01c3b1da9f7dd8c79c3cf06e6f7064296f2290126301aeac30c',
 Q2:'03140745c58a0f1cd9837eff8861967cc90e12bbe01a90dafb2042acad5703d5',
 Q3:'be467a282c1228cfce75fbe7efb44068d3564ab9e3e8df6032ba4c61dd681fa8',
 Q4:'3919b33bea681bf41e59edf8a92e0da5e1524004a4f9f8430955fd3b34aabde9',
 Q5:'8bf7f8eb69b73d72a38ab555b4f6201adf4bca2e1ff9b2c615f7c4f624300cd9',
 Q6:'2b5c23a09bed9815cc76f542347911263bcaadf1eb3a3a6aa4be7d8c86bb44c9',
 Q7:'5f1719fe9bacb71e4949bf4e15ce8629c0336cade95625917579f4676a007ac4',
 Q8:'02a08ac78766217c08f69f6712299c2de9ea1b1a5c79eaa08c486fd94bfa7c6b',
 Q9:'cff27728febe1c540fe9d16c1e619279dc70ec7e632ddec1e4963892b23fc9e2',
 Q10:'0b4ec7c994ff1624b9a700bb5e3e3282c25a392c9224e43bd6890a4d16e8d4bb'
};
// V1.0.12.2 digests of the same reviewed events (Q8/Q9 SIDs were rebuilt in V1.0.13.0, so they have none). V1.0.13.0 differs
// only by object/bound-reference renumbering and the 库序号 argument (7 or the new armory 22) of the equip/unequip/storage moves.
const previousDigests={
 Q2:'8e5e3e17aa815b0967bf9045f7a3f88d7e24ed4c270aa1cb6c282e0220607c57',
 Q3:'746f9a73dfd09c9891c433506951e153be8469bd59a2da75e6efa76277eceb12',
 Q4:'2d4529ff52d269bfaf8ab1f2795b7e0993399059fce5832e670fc4b2d381fa0e',
 Q10:'0dff003d8f73542180ec3777c4d1cf09ee09b83a5182a7f8d44032cd745ae1f6'
};
const groups=['backpackSetEquipmentQualityUpgrade','backpackSetEquipmentQualityDowngrade','setEquipmentQualityUpgrade','setEquipmentQualityDowngrade'];
// Flag registration is deferred to A10; until then these keys must be absent or false. Ordinary-equipment quality flags are separate.
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sourceSids=[...new Set(Object.values(dependencies).flatMap(d=>d.sids))];
const quality={min:1,max:6,mainBase:80,mainStep:30,subStep:10,subSpan:60,slotsMin:0,levelCapBase:10,levelCapStep:5,shift:{main:30,sub:10},precision:'hundredths-integer'};
const poolKinds=['通用','战斗','生产'];
function reviewedRules(digests,{wp},batch2,setLevel){
 for(const q of Object.keys(dependencies))if(!reviewedDigests[q]||digests[q]!==reviewedDigests[q]&&digests[q]!==previousDigests[q])throw Error('套裝品質來源事件已改變，需重新核對：'+q);
 if(!setLevel?.items||!setLevel.origins||!batch2?.items)throw Error('缺少套裝等級或原裝備詞條來源');
 const pools={},counts={};
 for(const [key,item] of Object.entries(setLevel.items)){
  const id=+key,t=wp[id],pool=batch2.items[id]?.affixIds;
  if(t?.[0]!==id||t[4]!=='套装'||t[5]!=='装备'||t[3]!==item.tier||t[6]!==item.slot||t[16]!==item.setLink)throw Error('套裝範本與等級資料不符');
  if(!poolKinds.slice(1).includes(t[23]))throw Error('套裝詞條池類型未核對');
  if(!Array.isArray(pool)||!pool.length||new Set(pool).size!==pool.length||pool.some(a=>!Number.isSafeInteger(a)))throw Error('套裝詞條池資料不符');
  if(!Object.values(setLevel.origins).some(o=>o.tier===item.tier&&o.slot===item.slot))throw Error('套裝缺少同階／同部位原裝備來源');
  pools[id]={tier:item.tier,slot:item.slot,poolType:t[23],affixIds:[...pool]};
  counts[t[23]]=(counts[t[23]]||0)+1;
 }
 if(Object.keys(pools).length!==216||counts['战斗']!==108||counts['生产']!==108)throw Error('套裝詞條池規模尚未核對');
 return {version:1,policy:'candidate-cross-pool',phase:'A-static-no-native-proof',sourceSids,sourceDigest:hash(digests),
  dependencies:Object.fromEntries(Object.entries(dependencies).map(([q,d])=>[q,{...d,digest:digests[q]}])),
  quality,pools,
  // P原 = setEquipmentLevel.origins[y27].affixIds; P套 = pools[y1].affixIds. Unselected slot: P原 only; sole selected slot: P原 or P套.
  policies:{unselected:'origin',selectedSingle:'origin-or-set',upgradeTail:'origin-unique-flag-0',afterRefine:'native-set-pool'},
  limits:{planes:[7,9],minTier:1,maxTier:9,quantity:1,backpackOwner:0,moveColumns:50,preserved:[0,1,2,3,7,23,24,25,26,27],reachability:'native-witness-required'}};
}
function extract(game,digestEvents,batch2,setLevel){
 if(!setLevel)return null;
 if(['6661d77209c0e98069219965908fd4d6b9ee3dca84763c158dcd5f0a863df665','32a36accc1b97e9bb3498eb3be76950e1e72b2e8f7a0cf9ce293b57aa5e0d820'].includes(game.fingerprints?.['data.json']))return null;
 const wp=JSON.parse(fs.readFileSync(path.join(game.root,'wp.json'),'utf8')).data.map(r=>r.map(c=>c[0]));
 const digests=Object.fromEntries(Object.entries(dependencies).map(([q,d])=>[q,digestEvents(game,d.sids)]));
 return reviewedRules(digests,{wp},batch2,setLevel);
}
// Dual-pool classification for candidate tests; throws on any unreviewed source, tier or slot.
function classify(rules,setLevel,setId,originId,affixId){
 const set=rules.pools[setId],origin=setLevel.origins[originId];
 if(!set)throw Error('未知套裝範本');if(!origin)throw Error('未知原裝備範本');
 if(origin.tier!==set.tier||origin.slot!==set.slot)throw Error('原裝備與套裝同階／部位不符');
 const o=origin.affixIds.includes(affixId),s=set.affixIds.includes(affixId);
 return o&&s?'both':o?'origin':s?'set':'none';
}
const canPreserve=(old,next)=>['fingerprints','batch2Fingerprints','setEquipmentLevel','setEquipmentQuality'].every(k=>hash(old[k]??null)===hash(next[k]??null));
// Cross-pool scope of the two existing set-level groups (selected slot in P套); opened only by its own first proof, never by quality proofs.
const crossPoolGroups=['backpackSetEquipmentLevelCrossPool','setEquipmentLevelCrossPool'];
function requireClosed(k){for(const group of [...groups,...crossPoolGroups])if(k.verification[group]!==undefined&&k.verification[group]!==false)throw Error('套裝品質 A 階段沒有首次證明，群組必須關閉：'+group);}
module.exports={extract,reviewedRules,reviewedDigests,dependencies,sourceSids,groups,crossPoolGroups,hash,classify,canPreserve,requireClosed};
