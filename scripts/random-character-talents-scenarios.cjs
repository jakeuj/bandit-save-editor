'use strict';
const {loadCore,editSave,defaultCells}=require('./verify-game.cjs');
// Representative migration inputs only; not the initial native matrix. Q2 changes an aptitude talent, Q5 two others.
function buildTalentScenarios({catalog,saveText}){
 const baseline=[],observe=defaultCells.map(c=>[...c]),operations=[],talentCharacters=[];
 const put=(x,y,z,v)=>{baseline.push([x,y,z,v]);observe.push([x,y,z]);};
 for(const [index,[q,raw,talents,from,to]]of [[2,[50,40,40],[1,4,52],[1,1,1],[3,2,1]],[5,[80,75,70],[5,44,66],[4,4,4],[4,5,5]]].entries()){
  const id=index+1;
  for(const z of [2,4,5,12,16,20])for(let y=0;y<60;y++)put(id,y,z,0);
  for(const [y,v]of [[0,id],[1,'天賦驗證'+id],[3,1],[6,1],[49,q],[10,raw[0]],[11,raw[1]],[12,raw[2]]])put(id,y,2,v);
  put(id,1,4,1);
  for(let i=0;i<9;i++){put(id,22+i,2,50);put(id,31+i,2,1);}
  talents.forEach((t,i)=>{put(id,1+i,12,t);put(id,21+i,12,from[i]);});
  operations.push({method:'setCharacterTalents',options:{characterId:id,levels:to}});
  talentCharacters.push(id);
 }
 const scenario={baseline,operations,observe,talentCharacters};editSave(loadCore(catalog),saveText,scenario);
 return [{name:'random-talents-representative',family:'randomCharacterTalents',oracleArgs:[],lifecycle:true,cases:operations.length,scenario}];
}
module.exports={buildTalentScenarios};
