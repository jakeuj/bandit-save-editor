'use strict';
const {loadCore,editSave,defaultCells}=require('./verify-game.cjs');
// Ten distinct non-aptitude triples. Over Q1–Q5 × slot × up/down each position is the changed slot exactly once,
// covering every effect branch and both single- and two-attribute talents. Aptitude talents 1–3 get their own rows.
const triples=[[4,5,6],[7,8,44],[52,57,74],[75,12,36],[22,49,70],[13,58,66],[40,41,42],[55,69,72],[9,45,63],[10,46,73]];
function matrixSpecs(pools,representative){
 const specs=[];
 for(let q=1;q<=5;q++)for(let slot=0;slot<3;slot++)for(const up of [true,false]){
  const pool=pools[q-1],ids=triples[(q-1)*2+(up?0:1)],from=ids.map(()=>pool[0]),to=[...from];
  from[slot]=up?pool[0]:pool.at(-1);to[slot]=up?pool.at(-1):pool[0];
  specs.push({q,ids,from,to});
 }
 for(const aptitude of [1,2,3])specs.push({q:3,ids:[aptitude,4,5],from:[2,2,2],to:[4,2,2],aptitude});
 // Representative migrations keep one rising and one falling row plus one aptitude row.
 return representative?[specs[0],specs[29],specs[30]]:specs;
}
function buildTalentScenarios({catalog,saveText,representative=false}){
 const C=loadCore(catalog),pools=catalog.randomCharacterTalents.talentLevels,totals=catalog.randomCharacterGrowth.totals;
 const make=(name,lifecycle,specs)=>{
  const baseline=[],observe=defaultCells.map(c=>[...c]),operations=[],talentCharacters=[],expectedLevels={},talentAptitudeCharacters=[];
  const put=(x,y,z,v)=>{baseline.push([x,y,z,v]);observe.push([x,y,z]);};
  // No equipped items, so aptitude sources stay within the reviewed v2.7 scope.
  const data=JSON.parse(saveText.replace(/^﻿/,'')).data;
  for(let x=1;x<data.length;x++)if(data[x][7][9]>0)put(x,7,9,0);
  specs.forEach(({q,ids,from,to,aptitude},i)=>{
   const id=i+1,raw=Math.round(totals[q-1][0]/3);
   for(const z of [2,4,5,12,16,20])for(let y=0;y<60;y++)put(id,y,z,0);
   for(const [y,v]of [[0,id],[1,'天賦'+id],[2,0],[3,1],[6,1],[49,q],[10,raw],[11,raw],[12,raw]])put(id,y,2,v);
   for(let skill=1;skill<=9;skill++){put(id,21+skill,2,50);put(id,30+skill,2,1);}
   put(id,1,4,lifecycle&&id===2?4:1);put(id,1,5,lifecycle&&id===2?C.experienceNeed.profession(4,1)-1:0);
   ids.forEach((t,s)=>{put(id,1+s,12,t);put(id,21+s,12,from[s]);});
   operations.push({method:'setCharacterTalents',options:{characterId:id,levels:to}});
   talentCharacters.push(id);expectedLevels[id]={ids,levels:to};if(aptitude)talentAptitudeCharacters.push(id);
  });
  const scenario={baseline,operations,observe,talentCharacters,expectedLevels,talentAptitudeCharacters,talentFormulas:!lifecycle,talentCoverage:lifecycle?'lifecycle':representative?'representative':'initial-matrix'};
  editSave(C,saveText,scenario);
  return {name,family:'randomCharacterTalents',oracleArgs:[],lifecycle,cases:operations.length,scenario};
 };
 const lifecycle=make('random-talents-lifecycle',true,[{q:3,ids:[1,4,52],from:[2,2,2],to:[4,3,2]},{q:3,ids:[5,44,66],from:[2,2,2],to:[3,4,2]}]);
 return [make(representative?'random-talents-representative':'random-talents-matrix',false,matrixSpecs(pools,representative)),lifecycle];
}
module.exports={buildTalentScenarios,triples,matrixSpecs};
