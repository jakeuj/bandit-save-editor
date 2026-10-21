'use strict';
// Derived rules only. Source event bodies and runtime remain outside the repository.
module.exports=function qualityData(catalogs,wp,sx,affixReplacement){
 const items=Object.fromEntries(catalogs.items.filter(i=>i.category==='装备'&&i.kind==='普通'&&i.slot<=4&&wp[i.id][16]===0).map(i=>[i.id,{tier:wp[i.id][3],poolType:wp[i.id][23],mainAttributes:wp[i.id].slice(8,11),mainSettings:wp[i.id].slice(11,14)}]));
 const ids=[...new Set([...Object.values(items).flatMap(i=>i.mainAttributes).filter(Boolean),...Object.keys(affixReplacement.attributes).map(Number)])].sort((a,b)=>a-b);
 const attributes=Object.fromEntries(ids.map(id=>{const kind=id>=4&&id<=6?'attack':id>=1&&id<=3?'aptitude':id>=40&&id<=48?'work':'percent';const r=affixReplacement.attributes[id]||{base:4,tier:1.5,level:.2,expression:5304};return [id,{kind,unit:sx[id][4]==='百分比'?'%':'',format:sx[id][4],expression:kind==='attack'?5295:kind==='aptitude'?5296:kind==='work'?5301:r.expression,...(kind==='percent'?{base:r.base,tier:r.tier,level:r.level}:{})}];}));
 return {version:1,items,attributes,sourceSids:[601593514747018,166680919655131,817916654281532,360141429177377,631300007252337,910195347276964,773239288013696,287806596379587,365081551176251,471274501781742,909366777963554,364262392529690,358108413690538,131416746119248],limits:{planes:[7,9],minQuality:1,maxQuality:6,maxTier:9,mainCoefficientShift:30,affixCoefficientShift:10,selectedSlotRemoval:'reject',extraSlots:'explicit-tail-only',allowNewDuplicates:false,advanced:false}};
};
