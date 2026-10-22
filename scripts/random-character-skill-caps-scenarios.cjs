'use strict';
const {loadCore,editSave,defaultCells}=require('./verify-game.cjs');
const matrixVersion=1;
// The first opening uses all qualities, primary positions and directions. A later migration may use a subset.
function matrixManifest(representative=false){
 const result=[];
 for(const quality of representative?[1,6]:[1,2,3,4,5,6])for(const primary of representative?[1]:[1,2,3,4,5,6,7,8,9])for(const direction of representative?['up']:['up','down'])result.push({id:result.length+1,quality,primary,secondary:((primary-1+(direction==='up'?1:4))%9)+1,direction});
 return result;
}
function buildSkillCapScenarios({catalog,saveText,representative=true}){
 const C=loadCore(catalog),rules=catalog.randomCharacterSkillCaps;
 const make=(name,manifest,lifecycle)=>{
  const baseline=[],observe=defaultCells.map(c=>[...c]),operations=[],skillCapCases=[];
  const put=(x,y,z,v)=>{baseline.push([x,y,z,v]);observe.push([x,y,z]);};
  const data=JSON.parse(saveText.replace(/^\uFEFF/,'')).data;
  if(data.length<=Math.max(12,...manifest.map(m=>m.id)))throw Error('技藝上限矩陣需要足夠的隔離角色列');
  for(let x=1;x<data.length;x++)if(data[x][7][9]>0)put(x,7,9,0);
  for(const entry of manifest){
   const {id,quality,primary,secondary,direction}=entry,r=ranges(quality),low=values(r,primary,secondary,0),high=values(r,primary,secondary,1),beforeCaps=direction==='up'?low:high,afterCaps=direction==='up'?high:low;
   for(const z of [2,4,5,12,16,20])for(let y=0;y<60;y++)put(id,y,z,0);
   const raw=Array(3).fill(rules.totals[quality-1][0]/3);
   for(const [y,v]of [[0,id],[1,'技藝驗證'+id],[3,1],[6,1],[49,quality],...raw.map((v,i)=>[10+i,v])])put(id,y,2,v);
   put(id,1,4,lifecycle&&id===11?4:1);put(id,1,5,lifecycle&&id===11?C.experienceNeed.profession(4,1)-1:0);
   for(let i=0;i<3;i++){put(id,1+i,12,i+1);put(id,21+i,12,rules.talentLevels[quality-1][0]);}
   const atLevelBoundary=!lifecycle&&!representative&&id===2,levels=afterCaps.map(v=>atLevelBoundary?v:1),remainders=afterCaps.map((_,i)=>atLevelBoundary?0:i===8?0.5:0);
   beforeCaps.forEach((v,i)=>{put(id,22+i,2,v);put(id,31+i,2,levels[i]);put(id,40+i,2,remainders[i]);});
   operations.push({method:'setCharacterSkillCaps',options:{characterId:id,caps:afterCaps}});
   skillCapCases.push({...entry,beforeCaps,afterCaps,levels,remainders,atLevelBoundary,raw,talents:[1,2,3],talentLevels:Array(3).fill(rules.talentLevels[quality-1][0])});
  }
  // Reserve a synthetic row for the named-template control; it is made named only immediately before numeric update.
  if(lifecycle)for(const id of [3,4,5,6,7,8,9,12])for(const z of [2,4,5,12,16,20])for(let y=0;y<60;y++)put(id,y,z,0);
  const scenario={baseline,operations,observe,skillCapCharacters:manifest.map(m=>m.id),skillCapCases,skillCapManifest:manifest,skillCapCoverage:representative?'representative':'initial-matrix',skillCapMatrixVersion:matrixVersion,...(!lifecycle?{skillCapBatchRequests:[{kind:'skillExperience',characterId:manifest[0].id,amount:20000}]}:{})};
  editSave(C,saveText,scenario);
  return {name,family:'randomCharacterSkillCaps',oracleArgs:[],lifecycle,cases:manifest.length,scenario,...(!lifecycle?{batchRequests:scenario.skillCapBatchRequests}:{})};
 };
 const ranges=q=>rules.ranges[q-1],values=(r,p,s,e)=>Array.from({length:9},(_,i)=>(i+1===p?r.primary:i+1===s?r.secondary:r.base)[e]);
 const matrix=make(representative?'random-skill-caps-representative':'random-skill-caps-matrix',matrixManifest(representative),false);
 const lifecycle=make('random-skill-caps-lifecycle',[{id:10,quality:1,primary:1,secondary:2,direction:'down'},{id:11,quality:1,primary:1,secondary:2,direction:'down'}],true);
 return [matrix,lifecycle];
}
module.exports={buildSkillCapScenarios,matrixManifest,matrixVersion};
