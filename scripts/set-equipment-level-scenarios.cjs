'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {hash}=require('./set-equipment-level-data.cjs'),O=require('./set-equipment-level-oracle.cjs');
const states=['backpack','stored','equipped'];
const group=state=>state==='backpack'?'backpackSetEquipmentLevel':'setEquipmentLevel';
function record(k,templateId,{quality=1,level=1,points=3,owner=0}={}){
 const t=k.setEquipmentLevel.items[templateId];assert.ok(t,'未知套裝範本');
 const origin=Object.keys(k.setEquipmentLevel.origins).map(Number).sort((a,b)=>a-b).find(id=>{const o=k.setEquipmentLevel.origins[id];return o.slot===t.slot&&o.tier===t.tier;});
 assert.ok(origin,'缺少候選原裝備');const pool=k.setEquipmentLevel.origins[origin].affixIds;
 const r=Array(60).fill(0);Object.assign(r,{0:5,1:templateId,2:1,3:t.tier,5:quality,6:level,7:owner,8:95+30*(quality-1),23:points,24:1,26:1.7,27:origin});
 for(let s=1;s<quality;s++){r[8+s]=pool[s-1];r[14+s]=30+10*(quality-1);}
 return r;
}
function binding(k,core,{baselineHash,runtimeHash,sourceManifestHash,runtimeManifestHash}={}){
 const valid=/^[0-9a-f]{64}$/;assert.match(baselineHash||'',valid,'缺基準雜湊');assert.match(runtimeHash||'',valid,'缺runtime雜湊');
 assert.match(sourceManifestHash||'',valid,'缺來源manifest雜湊');assert.match(runtimeManifestHash||'',valid,'缺runtime manifest雜湊');
 const fingerprints={...k.fingerprints,...k.batch2Fingerprints};assert.equal(Object.keys(fingerprints).length,15);
 for(const h of Object.values(fingerprints))assert.match(h,valid);
 const codeHash=file=>hash(fs.readFileSync(path.join(__dirname,file),'utf8').replace(/\r\n/g,'\n'));
 return {gameVersion:k.gameVersion,fingerprints,baselineHash,runtimeHash,sourceManifestHash,runtimeManifestHash,sourceDigest:k.setEquipmentLevel.sourceDigest,dataHash:hash(k.setEquipmentLevel),coreHash:hash(core.replace(/\r\n/g,'\n')),oracleHash:codeHash('set-equipment-level-oracle.cjs'),scenarioHash:codeHash('set-equipment-level-scenarios.cjs'),runnerHash:codeHash('verify-set-equipment-level-matrix.cjs')};
}
function createManifest(k,core,inputs){
 const cases=[],rules=k.setEquipmentLevel;const add=c=>cases.push({...c,classification:c.kind==='reject'?'policy-rejection':c.kind==='cost'?'oracle-only':'unknown-native-generation',candidateOnly:true});
 for(const templateId of Object.keys(rules.items).map(Number).sort((a,b)=>a-b))for(let quality=1;quality<=6;quality++){
  const cap=O.cap(quality),pairs=[[1,2],[2,1],[cap-1,cap],[cap,cap-1]];
  for(const state of states)for(const [from,to]of pairs)add({id:`level:${templateId}:${quality}:${state}:${from}>${to}`,kind:'level',group:group(state),templateId,quality,state,from,to});
 }
 for(const [setId,t]of Object.entries(rules.sets))for(let parts=1;parts<=4;parts++)for(const score of ['same','mixed'])for(const [from,to]of [[1,2],[2,1]])add({id:`effect:${setId}:${parts}:${score}:${from}>${to}`,kind:'effect',group:'setEquipmentLevel',setId:+setId,templateId:t.members[0],quality:1,state:'equipped',parts,score,from,to});
 for(const tier of [1,9])for(const quality of [1,6])for(const mode of ['insufficient','exact','ample','partial-max','at-cap','maximum'])add({id:`cost:${tier}:${quality}:${mode}`,kind:'cost',group:'setEquipmentLevel',tier,quality,mode});
 const rejects=['q0','q7','level0','overcap','fraction','string','missing-origin','zero-score','bad-owner','duplicate-owner','non-set','bad-plane'];
 for(const state of states)for(const rejection of rejects)add({id:`reject:${state}:${rejection}`,kind:'reject',group:group(state),state,rejection,templateId:28,quality:3,from:3,to:4});
 const payload={schemaVersion:1,phase:'A',nativeProof:false,binding:binding(k,core,inputs),counts:{level:15552,effect:864,cost:24,reject:36},cases};
 assert.equal(new Set(cases.map(c=>c.id)).size,cases.length);for(const [kind,n]of Object.entries(payload.counts))assert.equal(cases.filter(c=>c.kind===kind).length,n,'矩陣規模不符');
 return {...payload,manifestHash:hash(payload)};
}
function validateManifest(m,k,core,inputs){assert.deepEqual(m,createManifest(k,core,inputs),'來源、oracle、核心、輸入或案例 manifest 不符');return true;}
function shard(m,{index=0,total=1,kinds=['level','effect','cost','reject']}={}){
 assert.ok(Number.isSafeInteger(total)&&total>=1&&Number.isSafeInteger(index)&&index>=0&&index<total,'非法分片');
 assert.ok(Array.isArray(kinds)&&kinds.length&&new Set(kinds).size===kinds.length&&kinds.every(k=>Object.hasOwn(m.counts,k)),'非法案例類型');
 return m.cases.filter((c,i)=>i%total===index&&kinds.includes(c.kind));
}
// Native B driver must perform these calls and observe destination rows; this is a plan, not execution evidence.
function nativePlan(c){return {plane:c.state==='backpack'?7:9,upgradePlane:9,direction:c.to<c.from?'downgrade-io-and-reupgrade':'native-upgrade-comparison',steps:c.state==='backpack'?['load-backpack','装备库存入','locate-unique-destination','升级装备','升级最大装备','装备库取出','native-save-new-pid']:['load-z9','升级装备','升级最大装备','native-save-new-pid']};}
function locateMoved(rows,original){const matches=rows.flatMap((row,i)=>row.slice(0,50).every((v,y)=>v===original[y])?[i]:[]);assert.equal(matches.length,1,'搬移目的列缺失或不唯一');return matches[0];}
function createSyntheticRunner(k,core){
 const candidate=structuredClone(k);candidate.verification.backpackSetEquipmentLevel=candidate.verification.setEquipmentLevel=true;
 const ctx={};vm.runInNewContext(core.replace('/*__KNOWLEDGE__*/null',JSON.stringify(candidate)),ctx);const C=ctx.SaveCore;
 return c=>{
  if(c.kind==='cost'){
   const level=c.mode==='at-cap'?O.cap(c.quality):1,cost=O.money(c.tier,level),copper=c.mode==='insufficient'?cost-1:c.mode==='exact'||c.mode==='partial-max'?cost:1e12;
   const result=O.upgrade({tier:c.tier,quality:c.quality,level,copper,souls:999},['partial-max','maximum','at-cap'].includes(c.mode));
   assert.equal(result.souls,999);return {expected:result,nativeCompared:false};
  }
  const plane=c.state==='backpack'?7:9,owner=c.state==='equipped'?1:0;
  const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='合成角色';
  const ids=c.kind==='effect'?k.setEquipmentLevel.sets[c.setId].members.slice(0,c.parts):[c.templateId],records=[];
  ids.forEach((id,i)=>{const r=record(k,id,{quality:c.quality,level:c.from,points:c.score==='mixed'?i+1:3,owner});records.push(r);r.forEach((v,y)=>data[20+i][y][plane]=v);if(owner)data[1][15+k.setEquipmentLevel.items[id].slot][2]=20+i;});
  const model=C.parse(JSON.stringify({c2array:true,size:[221,60,22],data})),options={itemId:20,plane,level:c.to};
  if(c.kind==='reject'){
   const row=model.original.data[20];
   switch(c.rejection){case 'q0':row[5][plane]=0;break;case 'q7':row[5][plane]=7;break;case 'level0':options.level=0;break;case 'overcap':options.level=1000;break;case 'fraction':options.level=1.5;break;case 'string':options.level='2';break;case 'missing-origin':row[27][plane]=0;break;case 'zero-score':row[23][plane]=0;break;case 'bad-owner':row[7][plane]=999;break;case 'duplicate-owner':if(plane===7)row[7][plane]=1;else model.original.data[1][17][2]=20;break;case 'non-set':row[1][plane]=738;break;case 'bad-plane':options.plane=8;break;default:throw Error('未知拒絕案例');}
   const before=C.serialize(model);assert.throws(()=>C.setEquipmentLevel(model,options));assert.equal(C.serialize(model),before);assert.equal(model.history.length,0);return {rejected:true,nativeCompared:false};
  }
  C.setEquipmentLevel(model,options);const after=Array.from({length:60},(_,y)=>C.get(model,{x:20,y,z:plane}));O.assertLevelOnly(records[0],after,c.to);assert.equal(model.changes.size,1);
  const beforeEffects=O.characterEffects(records,k.setEquipmentLevel),afterRecords=[after,...records.slice(1)],afterEffects=O.characterEffects(afterRecords,k.setEquipmentLevel);
  assert.deepEqual(beforeEffects.sets,afterEffects.sets);assert.deepEqual(beforeEffects.summaries,afterEffects.summaries);
  return {expected:{record:after,effects:afterEffects},nativeCompared:false};
 };
}
function emptyProgress(m){return {schemaVersion:1,manifestHash:m.manifestHash,mode:'synthetic',results:[]};}
function validateProgress(m,p){
 assert.equal(p.schemaVersion,1);assert.equal(p.mode,'synthetic','A階段不能接收原生證明');assert.equal(p.manifestHash,m.manifestHash,'續跑輸入不符');assert.ok(Array.isArray(p.results));
 const seen=new Set(),byId=new Map(m.cases.map(c=>[c.id,c]));
 for(const r of p.results){assert.ok(byId.has(r.id)&&!seen.has(r.id),'未知或重複案例');seen.add(r.id);assert.equal(r.caseHash,hash(byId.get(r.id)),'案例摘要不符');assert.equal(typeof r.passed,'boolean');assert.match(r.observationHash||'',/^[a-f0-9]{64}$/);assert.equal(r.nativeCompared,false,'合成結果不可冒充原生');assert.ok(r.observation&&typeof r.observation==='object','缺少合成觀察');assert.equal(r.observationHash,hash(r.observation),'合成觀察摘要不符');if(r.passed)assert.equal(r.observation.nativeCompared,false,'成功觀察必須標記合成');else assert.equal(typeof r.observation.error,'string','失敗觀察缺少原因');assert.equal(!!r.observation.error,!r.passed,'失敗不能改標通過');}
 return true;
}
function recordResult(m,p,c,{passed,observation}){
 validateProgress(m,p);assert.ok(m.cases.some(v=>v.id===c.id&&hash(v)===hash(c)),'未知案例');assert.ok(!p.results.some(r=>r.id===c.id),'重複案例');assert.equal(typeof passed,'boolean');
 p.results.push({id:c.id,caseHash:hash(c),passed,observation,observationHash:hash(observation),nativeCompared:false});validateProgress(m,p);
}
function summary(m,p){validateProgress(m,p);const passed=p.results.filter(r=>r.passed).length;return {cases:m.cases.length,attempted:p.results.length,passed,failed:p.results.length-passed,pending:m.cases.length-p.results.length,unknownNativeGeneration:m.cases.filter(c=>c.classification==='unknown-native-generation').length,syntheticComplete:passed===m.cases.length,nativeComplete:false,groups:{backpackSetEquipmentLevel:false,setEquipmentLevel:false}};}
module.exports={states,record,binding,createManifest,validateManifest,shard,nativePlan,locateMoved,createSyntheticRunner,emptyProgress,validateProgress,recordResult,summary};
