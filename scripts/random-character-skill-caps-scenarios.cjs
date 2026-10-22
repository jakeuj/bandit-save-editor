'use strict';
const {loadCore,editSave,defaultCells}=require('./verify-game.cjs');
// Representative migration inputs only; not the full initial native matrix.
function buildSkillCapScenarios({catalog,saveText}){
 const baseline=[],observe=defaultCells.map(c=>[...c]),operations=[],skillCapCharacters=[];
 const put=(x,y,z,v)=>{baseline.push([x,y,z,v]);observe.push([x,y,z]);};
 for(const [index,q]of [1,6].entries()){
  const id=index+1,r=catalog.randomCharacterSkillCaps.ranges[q-1],raw=catalog.randomCharacterSkillCaps.totals[q-1][0]/3;
  for(const z of [2,4,5,12,16,20])for(let y=0;y<60;y++)put(id,y,z,0);
  for(const [y,v]of [[0,id],[1,'技藝驗證'+id],[3,1],[6,1],[49,q],[10,raw],[11,raw],[12,raw]])put(id,y,2,v);
  put(id,1,4,1);
  for(let i=0;i<3;i++){put(id,1+i,12,i+1);put(id,21+i,12,catalog.randomCharacterSkillCaps.talentLevels[q-1][0]);}
  const caps=[r.primary[0],r.secondary[0],...Array(7).fill(r.base[0])];
  caps.forEach((v,i)=>{put(id,22+i,2,v);put(id,31+i,2,1);put(id,40+i,2,i===8?0.5:0);});
  operations.push({method:'setCharacterSkillCaps',options:{characterId:id,caps:[r.primary[1],r.secondary[1],...Array(7).fill(r.base[1])]}});
  skillCapCharacters.push(id);
 }
 const scenario={baseline,operations,observe,skillCapCharacters};editSave(loadCore(catalog),saveText,scenario);
 return [{name:'random-skill-caps-representative',family:'randomCharacterSkillCaps',oracleArgs:[],lifecycle:true,cases:operations.length,scenario}];
}
module.exports={buildSkillCapScenarios};
