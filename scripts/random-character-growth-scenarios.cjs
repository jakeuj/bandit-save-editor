'use strict';
const {loadCore,editSave,defaultCells}=require('./verify-game.cjs');
function buildGrowthScenarios({catalog,saveText,representative=false}){
 const C=loadCore(catalog),totalRanges=catalog.randomCharacterGrowth.totals;
 const make=(name,lifecycle)=>{
  const baseline=[],observe=defaultCells.map(c=>[...c]),operations=[],growthCharacters=[],growthPills=[];
  const put=(x,y,z,v)=>{baseline.push([x,y,z,v]);observe.push([x,y,z]);};
  // These copies intentionally have no equipped items. Preserve other save planes and existing world state.
  const data=JSON.parse(saveText.replace(/^\uFEFF/,'')).data;
  for(let x=1;x<data.length;x++)if(data[x][7][9]>0)put(x,7,9,0);
  const specs=lifecycle?[{q:1,direction:1,talent:true},{q:1,direction:0,talent:false}]:[1,2,3,4,5,6].filter(q=>!representative||q===1||q===6).flatMap(q=>[0,1].flatMap(direction=>[false,true].map(talent=>({q,direction,talent}))));
  specs.forEach(({q,direction,talent},i)=>{
   const id=i+1,n=totalRanges[q-1][direction?0:1],target=totalRanges[q-1][direction?1:0];
   for(const z of [2,4,5,12,16,20])for(let y=0;y<60;y++)put(id,y,z,0);
   const raw=Array(3).fill(Math.round(n/3)),after=Array(3).fill(Math.round(target/3));
   for(const [y,v]of [[0,id],[1,'驗證'+id],[2,0],[3,1],[6,1],[49,q]])put(id,y,2,v);
   raw.forEach((v,i)=>put(id,10+i,2,v));
   for(let skill=1;skill<=9;skill++){put(id,21+skill,2,50);put(id,30+skill,2,1);}
   put(id,1,4,lifecycle&&id===2?4:1);put(id,1,5,lifecycle&&id===2?C.experienceNeed.profession(4,1)-1:0);
   if(talent)for(let t=0;t<3;t++){put(id,1+t,12,t+1);put(id,21+t,12,1);}
   operations.push({method:'setCharacterBaseAptitudes',options:{characterId:id,baseRaw:after}});growthCharacters.push(id);
  });
  if(lifecycle)for(let aptitude=1;aptitude<=3;aptitude++){
   const [id,p]=Object.entries(catalog.batch2Data.pills).find(([,p])=>p.aptitude===aptitude&&p.cap>=40&&p.effect<3);
   put(Number(id),6,0,10);growthPills.push({id:Number(id),aptitude,...p});
  }
  const scenario={baseline,operations,observe,growthCharacters,growthPills};
  editSave(C,saveText,scenario);return {name,family:'randomCharacterGrowth',oracleArgs:[],lifecycle,cases:operations.length,scenario};
 };
 return [make('random-growth-matrix',false),make('random-growth-lifecycle',true)];
}
module.exports={buildGrowthScenarios};
