'use strict';
// Phase A manifest for treasure level editing. Static candidate cases only: no native result, no core dependency.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const states=['backpack','stored','equipped'];
const group=state=>state==='backpack'?'backpackTreasureLevel':'treasureLevel';
const cap=quality=>10+(quality-1)*5;
const ransom={1:20,2:200,3:1000,4:10000,5:50000,6:500000};
const costModes=['insufficient','exact','ample','partial-max','at-cap','maximum'];
const decomposeModes=['single','batch-unlocked','batch-locked'];
const rejects=['q0','q7','level0','overcap','fraction','string','unknown-template','bad-quantity','bad-tier','bad-owner','duplicate-owner','bad-plane'];
const expectedTierCounts={1:21,2:25,3:29,4:31,5:31,6:33};
// Rows follow wp.json: [id,name,label,tier,kind,category,part,...]. Treasures are category=装备, kind=宝物, part 6.
function treasureTemplates(wp){
 const items=wp.filter(r=>r[4]==='宝物'&&r[5]==='装备'&&r[6]===6);
 const counts={};
 for(const r of items){
  assert.ok(Number.isSafeInteger(r[0])&&wp[r[0]]===r,'寶物範本列與編號不符');
  assert.ok(Number.isSafeInteger(r[3])&&r[3]>=1&&r[3]<=6,'寶物等階超出 T1–T6');
  counts[r[3]]=(counts[r[3]]||0)+1;
 }
 assert.deepEqual(counts,expectedTierCounts,'寶物範本規模尚未核對');assert.equal(items.length,170);
 return items.map(r=>({id:r[0],name:r[1],tier:r[3]}));
}
function binding(k,wp,{baselineHash,runtimeHash,sourceManifestHash}={}){
 const valid=/^[0-9a-f]{64}$/;for(const [n,v] of Object.entries({baselineHash,runtimeHash,sourceManifestHash}))assert.match(v||'',valid,'缺'+n);
 const fingerprints={...k.fingerprints,...k.batch2Fingerprints};assert.equal(Object.keys(fingerprints).length,15);
 for(const h of Object.values(fingerprints))assert.match(h,valid);
 const scenarioHash=hash(fs.readFileSync(__filename,'utf8').replace(/\r\n/g,'\n'));
 return {gameVersion:k.gameVersion,fingerprints,baselineHash,runtimeHash,sourceManifestHash,templateHash:hash(treasureTemplates(wp)),scenarioHash};
}
function createManifest(k,wp,inputs){
 const cases=[],templates=treasureTemplates(wp);
 const add=c=>cases.push({...c,classification:c.kind==='reject'?'policy-rejection':c.kind==='cost'||c.kind==='decompose'?'oracle-only':'unknown-native-generation',candidateOnly:true});
 for(const t of templates)for(let quality=1;quality<=6;quality++){
  const top=cap(quality),pairs=[[1,2],[2,1],[top-1,top],[top,top-1]];
  for(const state of states)for(const [from,to] of pairs)add({id:`level:${t.id}:${quality}:${state}:${from}>${to}`,kind:'level',group:group(state),templateId:t.id,tier:t.tier,quality,state,from,to});
 }
 for(let tier=1;tier<=6;tier++)for(const quality of [1,6])for(const mode of costModes)add({id:`cost:${tier}:${quality}:${mode}`,kind:'cost',group:'treasureLevel',tier,quality,mode});
 for(let tier=1;tier<=6;tier++)for(const quality of [1,6])for(const level of [1,cap(quality)])for(const mode of decomposeModes)add({id:`decompose:${tier}:${quality}:${level}:${mode}`,kind:'decompose',group:'backpackTreasureLevel',tier,quality,level,mode,souls:ransom[tier]});
 const sample=templates[0];
 for(const state of states)for(const rejection of rejects)add({id:`reject:${state}:${rejection}`,kind:'reject',group:group(state),state,rejection,templateId:sample.id,tier:sample.tier,quality:3,from:3,to:4});
 const counts={level:12240,cost:72,decompose:72,reject:36};
 assert.equal(new Set(cases.map(c=>c.id)).size,cases.length,'案例編號重複');
 for(const [kind,n] of Object.entries(counts))assert.equal(cases.filter(c=>c.kind===kind).length,n,'矩陣規模不符');
 const payload={schemaVersion:1,phase:'A',nativeProof:false,binding:binding(k,wp,inputs),counts,cases};
 return {...payload,manifestHash:hash(payload)};
}
function validateManifest(m,k,wp,inputs){assert.deepEqual(m,createManifest(k,wp,inputs),'來源、範本、輸入或案例 manifest 不符');return true;}
function shard(m,{index=0,total=1,kinds=Object.keys(m.counts)}={}){
 assert.ok(Number.isSafeInteger(total)&&total>=1&&Number.isSafeInteger(index)&&index>=0&&index<total,'非法分片');
 assert.ok(Array.isArray(kinds)&&kinds.length&&new Set(kinds).size===kinds.length&&kinds.every(v=>Object.hasOwn(m.counts,v)),'非法案例類型');
 return m.cases.filter((c,i)=>i%total===index&&kinds.includes(c.kind));
}
function emptyProgress(m){return {schemaVersion:1,manifestHash:m.manifestHash,mode:'synthetic',results:[]};}
function validateProgress(m,p){
 assert.equal(p.schemaVersion,1);assert.equal(p.mode,'synthetic','A階段不能接收原生證明');assert.equal(p.manifestHash,m.manifestHash,'續跑輸入不符');assert.ok(Array.isArray(p.results));
 const seen=new Set(),byId=new Map(m.cases.map(c=>[c.id,c]));
 for(const r of p.results){
  assert.ok(byId.has(r.id)&&!seen.has(r.id),'未知或重複案例');seen.add(r.id);
  assert.equal(r.caseHash,hash(byId.get(r.id)),'案例摘要不符');assert.equal(typeof r.passed,'boolean');
  assert.equal(r.nativeCompared,false,'合成結果不可冒充原生');assert.ok(r.observation&&typeof r.observation==='object','缺少合成觀察');
  assert.equal(r.observationHash,hash(r.observation),'合成觀察摘要不符');
  assert.equal(!!r.observation.error,!r.passed,'失敗不能改標通過');
 }
 return true;
}
function recordResult(m,p,c,{passed,observation}){
 validateProgress(m,p);assert.ok(m.cases.some(v=>v.id===c.id&&hash(v)===hash(c)),'未知案例');assert.ok(!p.results.some(r=>r.id===c.id),'重複案例');assert.equal(typeof passed,'boolean');
 p.results.push({id:c.id,caseHash:hash(c),passed,observation,observationHash:hash(observation),nativeCompared:false});validateProgress(m,p);
}
function summary(m,p){
 validateProgress(m,p);const passed=p.results.filter(r=>r.passed).length;
 return {cases:m.cases.length,attempted:p.results.length,passed,failed:p.results.length-passed,pending:m.cases.length-p.results.length,unknownNativeGeneration:m.cases.filter(c=>c.classification==='unknown-native-generation').length,syntheticComplete:passed===m.cases.length,nativeComplete:false,groups:{backpackTreasureLevel:false,treasureLevel:false}};
}
module.exports={hash,cap,ransom,states,rejects,treasureTemplates,binding,createManifest,validateManifest,shard,emptyProgress,validateProgress,recordResult,summary};
