'use strict';
const S=require('./set-equipment-level-scenarios.cjs'),{loadCore,editSave}=require('./verify-game.cjs');
function build({catalog,saveText}){const C=loadCore(catalog);return [7,9].map(plane=>{
 const model=C.parse(saveText),baseline=[],observe=[],items=[],operations=[];
 for(let x=1;x<model.original.size[0];x++){for(const z of [7,9])for(let y=0;y<60;y++)baseline.push([x,y,z,0]);if(x<50)for(let s=1;s<=6;s++)baseline.push([x,15+s,2,0]);}
 for(const [i,quality]of [1,6].entries()){const id=i+1,tier=i?9:1,templateId=+Object.keys(catalog.setEquipmentLevel.items).find(id=>catalog.setEquipmentLevel.items[id].tier===tier),before=S.record(catalog,templateId,{quality,level:i?35:1}),to=i?34:2;before.forEach((v,y)=>{baseline.push([id,y,plane,v]);observe.push([id,y,plane]);});items.push({id,plane,slot:catalog.setEquipmentLevel.items[templateId].slot,before,after:before.map((v,y)=>y===6?to:v)});operations.push({method:'setEquipmentLevel',options:{itemId:id,plane,level:to}});}
 const scenario={baseline,observe,items,operations,setLevelCoverage:'representative'};editSave(C,saveText,scenario);return {name:'set-level-'+plane+'-representative',family:'setEquipmentLevel',oracleArgs:[],lifecycle:true,cases:2,groups:[plane===7?'backpackSetEquipmentLevel':'setEquipmentLevel'],scenario};
 });}module.exports={build};
