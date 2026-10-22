'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const k=require('../knowledge/catalog.json'),S=require('../scripts/set-equipment-level-scenarios.cjs'),{hash}=require('../scripts/set-equipment-level-data.cjs');
const core=fs.readFileSync(require.resolve('../src/core.js'),'utf8'),inputs={baselineHash:'a'.repeat(64),runtimeHash:'b'.repeat(64),sourceManifestHash:'c'.repeat(64),runtimeManifestHash:'d'.repeat(64)};
const manifest=S.createManifest(k,core,inputs);
test('first matrix contains all candidate cases once; groups and native unknowns stay separate',()=>{
 assert.equal(manifest.cases.length,16476);assert.equal(manifest.nativeProof,false);
 assert.equal(manifest.cases.filter(c=>c.kind==='level'&&c.group==='backpackSetEquipmentLevel').length,5184);
 assert.equal(manifest.cases.filter(c=>c.kind==='level'&&c.group==='setEquipmentLevel').length,10368);
 assert.equal(manifest.cases.filter(c=>c.kind==='effect').length,864);
 assert.equal(manifest.cases.filter(c=>c.kind==='reject').length,36);
 assert.equal(manifest.cases.filter(c=>c.classification==='unknown-native-generation').length,16416);
 assert.ok(manifest.cases.filter(c=>c.kind==='reject').every(c=>c.classification==='policy-rejection'));
 const selected=Array.from({length:17},(_,index)=>S.shard(manifest,{index,total:17})).flat();
 assert.equal(new Set(selected.map(c=>c.id)).size,manifest.cases.length);assert.equal(selected.length,manifest.cases.length);
 assert.throws(()=>S.shard(manifest,{index:2,total:2}));assert.throws(()=>S.shard(manifest,{kinds:['unknown']}));
});
test('manifest rejects source, data, baseline, core and membership drift',()=>{
 S.validateManifest(manifest,k,core,inputs);
 for(const mutate of [m=>m.cases.pop(),m=>m.cases.push(m.cases[0]),m=>m.binding.fingerprints['tz.json']='changed',m=>m.binding.baselineHash='c'.repeat(64)]){
  const m=structuredClone(manifest);mutate(m);assert.throws(()=>S.validateManifest(m,k,core,inputs),/manifest/);
 }
 assert.throws(()=>S.validateManifest(manifest,k,core+'\n// changed',inputs));
});
test('resume refuses duplicate, failed/missing outcomes, wrong binding and synthetic evidence relabeling',()=>{
 const p=S.emptyProgress(manifest),c=manifest.cases[0];S.recordResult(manifest,p,c,{passed:true,observation:{expected:1,nativeCompared:false}});
 assert.throws(()=>S.recordResult(manifest,p,c,{passed:true,observation:{expected:1,nativeCompared:false}}),/重複/);
 const wrong=structuredClone(p);wrong.manifestHash='x';assert.throws(()=>S.validateProgress(manifest,wrong),/輸入/);
 const fake=structuredClone(p);fake.results[0].nativeCompared=true;assert.throws(()=>S.validateProgress(manifest,fake),/冒充/);
 const altered=structuredClone(p);altered.results[0].caseHash=hash('changed');assert.throws(()=>S.validateProgress(manifest,altered),/摘要/);
 const failure=manifest.cases[1];S.recordResult(manifest,p,failure,{passed:false,observation:{error:'failure'}});
 const result=S.summary(manifest,p);assert.equal(result.failed,1);assert.equal(result.pending,manifest.cases.length-2);assert.equal(result.nativeComplete,false);assert.equal(result.syntheticComplete,false);
 const flipped=structuredClone(p);flipped.results[1].passed=true;assert.throws(()=>S.validateProgress(manifest,flipped));
});
test('synthetic core runner tests all three states, effect boundaries and every rejection policy',()=>{
 const run=S.createSyntheticRunner(k,core),cases=[...['backpack','stored','equipped'].map(state=>manifest.cases.find(c=>c.kind==='level'&&c.state===state)),manifest.cases.find(c=>c.kind==='effect'&&c.parts===4),...manifest.cases.filter(c=>c.kind==='reject')];
 for(const c of cases){const result=run(c);assert.equal(result.nativeCompared,false);}
 for(const c of manifest.cases.filter(c=>c.kind==='cost'))assert.equal(run(c).nativeCompared,false);
});
test('backpack native plan uses z9 only after relocation; ambiguous move identity fails closed',()=>{
 const plan=S.nativePlan(manifest.cases[0]);assert.equal(plan.plane,7);assert.equal(plan.upgradePlane,9);assert.ok(plan.steps.includes('locate-unique-destination'));
 const row=S.record(k,28);const empty=Array(60).fill(0);assert.equal(S.locateMoved([empty,row],row),1);
 assert.throws(()=>S.locateMoved([row,row],row),/不唯一/);assert.throws(()=>S.locateMoved([empty],row),/缺失/);
});
