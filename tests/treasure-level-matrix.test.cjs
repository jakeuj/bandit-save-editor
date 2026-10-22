'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const k=require('../knowledge/catalog.json'),S=require('../scripts/treasure-level-scenarios.cjs');
const inputs={baselineHash:'a'.repeat(64),runtimeHash:'b'.repeat(64),sourceManifestHash:'c'.repeat(64)};
// Synthetic wp table: sparse array indexed by template id, matching real wp.json row shape.
const counts={1:21,2:25,3:29,4:31,5:31,6:33};
const wp=[];wp[0]=[0,'','','','','',''];
let id=1;for(const [tier,n] of Object.entries(counts))for(let i=0;i<n;i++,id++)wp[id]=[id,'宝物'+id,'宝物'+id,+tier,'宝物','装备',6];
wp[id]=[id,'普通',' ',1,'普通','装备',1];
const manifest=S.createManifest(k,wp,inputs);
test('manifest holds every candidate once with groups and unknown native generation separate',()=>{
 assert.equal(S.treasureTemplates(wp).length,170);
 assert.equal(manifest.cases.length,12240+72+72+36);assert.equal(manifest.nativeProof,false);
 assert.equal(manifest.cases.filter(c=>c.kind==='level'&&c.group==='backpackTreasureLevel').length,4080);
 assert.equal(manifest.cases.filter(c=>c.kind==='level'&&c.group==='treasureLevel').length,8160);
 assert.ok(manifest.cases.filter(c=>c.kind==='reject').every(c=>c.classification==='policy-rejection'));
 assert.equal(manifest.cases.filter(c=>c.classification==='unknown-native-generation').length,12240);
 for(const q of [1,2,3,4,5,6])assert.equal(S.cap(q),[10,15,20,25,30,35][q-1]);
 assert.deepEqual(Object.values(S.ransom),[20,200,1000,10000,50000,500000]);
 const picked=Array.from({length:7},(_,index)=>S.shard(manifest,{index,total:7})).flat();
 assert.equal(new Set(picked.map(c=>c.id)).size,manifest.cases.length);assert.equal(picked.length,manifest.cases.length);
 assert.throws(()=>S.shard(manifest,{index:2,total:2}));assert.throws(()=>S.shard(manifest,{kinds:['bogus']}));
});
test('manifest rejects template, source and baseline drift',()=>{
 S.validateManifest(manifest,k,wp,inputs);
 for(const mutate of [m=>m.cases.pop(),m=>m.cases.push(m.cases[0]),m=>m.binding.fingerprints['wp.json']='changed',m=>m.binding.baselineHash='d'.repeat(64)]){
  const m=structuredClone(manifest);mutate(m);assert.throws(()=>S.validateManifest(m,k,wp,inputs),/manifest/);
 }
 const short=wp.slice();short[2]=[2,'x','x',1,'普通','装备',1];assert.throws(()=>S.createManifest(k,short,inputs),/規模/);
 assert.throws(()=>S.createManifest(k,wp,{...inputs,runtimeHash:'x'}));
});
test('progress refuses duplicates, wrong manifest, relabelled evidence and flipped failures',()=>{
 const p=S.emptyProgress(manifest),c=manifest.cases[0];S.recordResult(manifest,p,c,{passed:true,observation:{ok:1}});
 assert.throws(()=>S.recordResult(manifest,p,c,{passed:true,observation:{ok:1}}),/重複/);
 const wrong=structuredClone(p);wrong.manifestHash='x';assert.throws(()=>S.validateProgress(manifest,wrong),/輸入/);
 const fake=structuredClone(p);fake.results[0].nativeCompared=true;assert.throws(()=>S.validateProgress(manifest,fake),/冒充/);
 S.recordResult(manifest,p,manifest.cases[1],{passed:false,observation:{error:'boom'}});
 const flipped=structuredClone(p);flipped.results[1].passed=true;assert.throws(()=>S.validateProgress(manifest,flipped));
 const result=S.summary(manifest,p);assert.equal(result.failed,1);assert.equal(result.pending,manifest.cases.length-2);
 assert.equal(result.nativeComplete,false);assert.deepEqual(result.groups,{backpackTreasureLevel:false,treasureLevel:false});
});
