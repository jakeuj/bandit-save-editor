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
 Q8:{sids:[791657421740250,959041203712077,654692930556623,418018161514165],expressions:[2874,2875,59,12,15,3],topic:'storage move copies y0-49'},
 Q9:{sids:[924571110308816,894058542259455,412476211843946,501272375624196,158038025432481,731456201592556],expressions:[801,15,3,3610],topic:'equip/unequip owner pointers, synthesis refresh'},
 Q10:{sids:[491911663973794,118557701104625,780562691790658,876108178253015,196601779910507,775039415186059,819450314280438,338766607025535],expressions:[2833,356,2834,2835,2836,4852,1576,2902,4869,4870,4865],topic:'slot generation, refine page limits and refresh'}
};
const reviewedDigests={
 Q1:'916742c43e8c93e948e571612d48bbd77139684953690315a3d5039bf16b5e71',
 Q2:'e4c0e5c90757e2ae4adc9aed52d50581808a72ffabdca12ab6171c4f267117d8',
 Q3:'b9a83c8c1bd4aaa0cec531d18fb0844dda5ec2f254e5e98af0bb4570df9ddfd6',
 Q4:'dc78d0aca36cc00b9fa75ce6ddfd58822562ead80c1a4edd1a972e9712029df3',
 Q5:'8bf7f8eb69b73d72a38ab555b4f6201adf4bca2e1ff9b2c615f7c4f624300cd9',
 Q6:'2b5c23a09bed9815cc76f542347911263bcaadf1eb3a3a6aa4be7d8c86bb44c9',
 Q7:'5f1719fe9bacb71e4949bf4e15ce8629c0336cade95625917579f4676a007ac4',
 Q8:'bf7e5df0b0e9e8d1462067909d181b96699577784811ac6126a6c9dd2148a80e',
 Q9:'bab445ef741acf27adc14d72b64d8166cf3552aa1c861da33657236b5d6fe3e1',
 Q10:'8af8f9bb5b6148718fe817f30f7e1b1c97486966380d44912917dc3de90e4cd7'
};
const groups=['backpackSetEquipmentQualityUpgrade','backpackSetEquipmentQualityDowngrade','setEquipmentQualityUpgrade','setEquipmentQualityDowngrade'];
// Flag registration is deferred to A10; until then these keys must be absent or false. Ordinary-equipment quality flags are separate.
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sourceSids=[...new Set(Object.values(dependencies).flatMap(d=>d.sids))];
const quality={min:1,max:6,mainBase:80,mainStep:30,subStep:10,subSpan:60,slotsMin:0,levelCapBase:10,levelCapStep:5,shift:{main:30,sub:10},precision:'hundredths-integer'};
const poolKinds=['通用','战斗','生产'];
function reviewedRules(digests,{wp},batch2,setLevel){
 for(const q of Object.keys(dependencies))if(!reviewedDigests[q]||digests[q]!==reviewedDigests[q])throw Error('套裝品質來源事件已改變，需重新核對：'+q);
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
