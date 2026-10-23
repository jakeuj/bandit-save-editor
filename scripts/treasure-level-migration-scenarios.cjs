'use strict';
// Representative migration copies for the two treasure-level groups. They exercise the final core and the native
// lifecycle, but never first-open a group: first proofs come from the independent matrix and lifecycle (task 9).
const {treasureRecord}=require('./treasure-level-synthetic.cjs'),{loadCore,editSave}=require('./verify-game.cjs');
const planes={7:'backpackTreasureLevel',9:'treasureLevel'};
// Low/high ends: Q1 level 1→2 and Q6 level 35→34, one tier apart, so both directions and both cap rules are replayed.
const picks=[{quality:1,tier:1,from:1,to:2},{quality:6,tier:6,from:35,to:34}];
function build({catalog,saveText}){
 const C=loadCore(catalog);
 return [7,9].map(plane=>{
  const model=C.parse(saveText),baseline=[],observe=[],items=[],operations=[];
  for(let x=1;x<model.original.size[0];x++){for(const z of [7,9])for(let y=0;y<60;y++)baseline.push([x,y,z,0]);if(x<50)for(let s=1;s<=6;s++)baseline.push([x,15+s,2,0]);}
  picks.forEach((pick,i)=>{
   const id=i+1,templateId=+Object.keys(catalog.treasureLevel.items).find(t=>catalog.treasureLevel.items[t].tier===pick.tier),before=treasureRecord(catalog,templateId,{quality:pick.quality,level:pick.from});
   before.forEach((v,y)=>{baseline.push([id,y,plane,v]);observe.push([id,y,plane]);});
   items.push({id,plane,slot:catalog.treasureLevel.limits.slot,before,after:before.map((v,y)=>y===6?pick.to:v)});
   operations.push({method:'setEquipmentLevel',options:{itemId:id,plane,level:pick.to}});
  });
  const scenario={baseline,observe,items,operations,treasureLevelCoverage:'representative'};
  editSave(C,saveText,scenario);
  return {name:'treasure-level-'+plane+'-representative',family:'treasureLevel',oracleArgs:[],lifecycle:true,cases:items.length,groups:[planes[plane]],scenario};
 });
}
module.exports={build,planes,picks};
