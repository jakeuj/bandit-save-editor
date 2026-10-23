'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const k=require('../knowledge/catalog.json'),S=require('../scripts/set-equipment-quality-scenarios.cjs'),{hash,groups}=require('../scripts/set-equipment-quality-data.cjs');
const core=fs.readFileSync(require.resolve('../src/core.js'),'utf8'),inputs={baselineHash:'a'.repeat(64),runtimeHash:'b'.repeat(64),sourceManifestHash:'c'.repeat(64),runtimeManifestHash:'d'.repeat(64)};
const manifest=S.createManifest(k,core,inputs),by=f=>manifest.cases.filter(f),executable=c=>c.classification!=='not-applicable';
const [BU,BD,SU,SD]=groups;

test('base matrix is 216 templates × 30 directed transitions × 3 states with the mother-spec group split',()=>{
 const base=by(c=>c.kind==='base');assert.equal(base.length,19440);assert.equal(manifest.counts.base,19440);
 assert.equal(new Set(base.map(c=>`${c.templateId}:${c.from}>${c.to}:${c.state}`)).size,19440);
 assert.equal(new Set(base.map(c=>c.templateId)).size,216);
 const n=g=>base.filter(c=>c.group===g).length;
 assert.deepEqual([n(BU),n(BD),n(SU),n(SD)],[3240,3240,6480,6480]);
 for(const g of [SU,SD])for(const state of ['stored','equipped'])assert.equal(base.filter(c=>c.group===g&&c.state===state).length,3240);
 assert.ok(base.every(c=>c.from!==c.to&&(c.to>c.from?'up':'down')===c.direction&&c.group.endsWith(c.direction==='up'?'Upgrade':'Downgrade')&&c.level===1));
 assert.ok(base.filter(c=>c.state==='backpack').every(c=>c.group.startsWith('backpack')));
 assert.ok(base.every(c=>c.classification==='unknown-native'&&c.candidateOnly===true));
 assert.equal(manifest.nativeProof,false);
});
test('effect matrix has 864 executable combinations; natural five/six piece sets are listed as not applicable',()=>{
 const all=by(c=>c.kind==='effect'),ok=all.filter(executable);
 assert.equal(ok.length,864);assert.equal(Object.keys(k.setEquipmentLevel.sets).length,54);
 assert.equal(new Set(ok.map(c=>c.id)).size,864);
 for(const parts of [1,2,3,4])for(const score of ['same','mixed'])for(const direction of ['up','down'])assert.equal(ok.filter(c=>c.parts===parts&&c.score===score&&c.direction===direction).length,54);
 const naRows=all.filter(c=>!executable(c));assert.equal(naRows.length,432);assert.ok(naRows.every(c=>c.parts>=5&&/沒有自然/.test(c.reason)));
 assert.ok(!ok.some(c=>c.parts>4));assert.deepEqual([...new Set(ok.flatMap(c=>c.effectFormats))].sort(),['倍率','整数','百分比']);
 assert.ok(ok.every(c=>c.state==='equipped'&&(c.direction==='up'?c.group===SU:c.group===SD)));
});
test('coefficient and cap dimensions cover range ends, two-decimal boundary and over-cap starts',()=>{
 const co=by(c=>c.kind==='coefficient'),lc=by(c=>c.kind==='level-cap');
 assert.equal(co.length,30*3*7);assert.equal(lc.length,30*3*3);
 assert.ok(co.filter(c=>c.endpoint.startsWith('sub')&&Math.min(c.from,c.to)<2).every(c=>!executable(c)));
 assert.ok(co.filter(c=>c.endpoint.startsWith('tail')&&c.direction==='down').every(c=>!executable(c)));
 assert.ok(co.filter(c=>c.endpoint==='main-low'||c.endpoint==='main-high').every(executable));
 assert.equal(co.filter(c=>c.endpoint==='tail-high'&&executable(c)).every(c=>c.direction==='up'),true);
 const over=lc.filter(c=>c.boundary==='over-target-cap');
 assert.ok(over.filter(c=>c.direction==='down').every(c=>c.classification==='policy-rejection'&&c.level===10+5*(c.to-1)+1&&c.level<=10+5*(c.from-1)));
 assert.ok(over.filter(c=>c.direction==='up').every(c=>!executable(c)&&/升品/.test(c.reason)));
 assert.ok(lc.filter(c=>c.boundary==='common-cap').every(c=>c.level===10+5*(Math.min(c.from,c.to)-1)));
 assert.ok(lc.filter(c=>c.boundary==='level-1').every(c=>c.level===1&&c.classification==='unknown-native'));
});
test('pool dimension follows the real same-tier same-slot origin rows and separates missing combinations',()=>{
 const L=k.setEquipmentLevel,Q=k.setEquipmentQuality,pool=by(c=>c.kind==='pool');
 let rows=0,reject=0;
 for(const [tid,set] of Object.entries(Q.pools))for(const [oid,o] of Object.entries(L.origins)){
  if(o.tier!==set.tier||o.slot!==set.slot)continue;rows++;
  const shared=o.affixIds.filter(a=>set.affixIds.includes(a)).length,setOnly=set.affixIds.length-shared,originOnly=o.affixIds.length-shared;
  const find=name=>pool.filter(c=>c.templateId===+tid&&c.originId===+oid&&c.pool===name);
  assert.equal(find('unselected-origin-only').length,4);
  assert.equal(find('unselected-origin-only').every(c=>executable(c)===(originOnly>0)),true);
  assert.equal(find('unselected-shared').every(c=>executable(c)===(shared>0)),true);
  assert.equal(find('selected-tail-set-only').every(c=>executable(c)===(setOnly>0)),true);
  const wrong=find('unselected-set-only');assert.equal(wrong.every(c=>executable(c)===(setOnly>0)),true);
  assert.ok(wrong.filter(executable).every(c=>c.classification==='policy-rejection'));reject+=wrong.filter(executable).length;
  assert.ok(find('selected-head-set-only').filter(executable).every(c=>c.classification==='unknown-native'));
 }
 assert.equal(rows,1458);assert.equal(pool.length,rows*10*4);assert.ok(reject>0);
 assert.ok(pool.filter(c=>!executable(c)).every(c=>typeof c.reason==='string'&&c.reason.length>0));
 assert.ok(pool.some(c=>!executable(c))&&pool.some(executable));
 // each of the four groups owns its own pool cases; a z9 proof cannot stand in for z7
 for(const g of groups)assert.equal(pool.filter(c=>c.group===g).length,rows*10);
});
test('lifecycle, level regression and rejection dimensions are all present per group',()=>{
 const life=by(c=>c.kind==='lifecycle'),startIds=life.filter(c=>!c.extra).map(c=>c.id);
 assert.deepEqual(startIds,['lifecycle:backpack-up','lifecycle:backpack-down','lifecycle:stored-up','lifecycle:stored-down','lifecycle:equipped-up','lifecycle:equipped-down']);
 assert.ok(life.every(c=>c.ioRounds===2&&c.moveColumns===50&&c.tailColumns===10));
 for(const extra of ['tier-1','tier-9','q1-q6','q6-q1','q5-q6','q6-q5','selected-slot','synthesis-in-place-z9','synthesis-from-bag-z7','origin-pool-slot','set-pool-slot'])assert.equal(life.filter(c=>c.extra===extra).length,4,extra);
 assert.ok(life.filter(c=>c.extra==='q1-q6').filter(c=>executable(c)).every(c=>c.direction==='up'));
 assert.ok(life.filter(c=>c.extra==='synthesis-in-place-z9'&&executable(c)).every(c=>!c.group.startsWith('backpack')));
 assert.ok(life.filter(c=>c.extra==='synthesis-from-bag-z7'&&executable(c)).every(c=>c.group.startsWith('backpack')));
 const reg=by(c=>c.kind==='level-regression');assert.equal(reg.length,16);
 assert.ok(reg.every(c=>c.supplementsExistingGroup&&S.levelGroups.includes(c.group)&&groups.every(g=>g!==c.group)));
 assert.deepEqual(new Set(reg.map(c=>c.regression)).size,8);assert.ok(reg.some(c=>c.regression==='quality-level-quality-undo')&&reg.some(c=>c.regression==='accumulated-restore'));
 const rej=by(c=>c.kind==='reject');assert.equal(rej.length,groups.length*22);
 assert.ok(rej.filter(executable).every(c=>c.classification==='policy-rejection'));
 for(const g of groups){const set=rej.filter(c=>c.group===g&&executable(c)).map(c=>c.rejection);
  for(const name of ['q0','q7','fraction','multi-flag','tail-data-outside-slots','pool-outside-id','special-main-coefficient','permission-bypass-coordinate','permission-bypass-legacy-set','permission-bypass-batch','stale-proof','incomplete-proof','atomic-rollback'])assert.ok(set.includes(name),g+' '+name);
  assert.equal(set.includes('new-duplicate'),g.endsWith('Upgrade'));assert.equal(set.includes('remove-selected'),g.endsWith('Downgrade'));assert.equal(set.includes('downgrade-over-cap'),g.endsWith('Downgrade'));}
});
test('every case has exactly one classification and denominators reconcile per group and per kind',()=>{
 const allowed=new Set(Object.values(S.classes));
 assert.ok(manifest.cases.every(c=>allowed.has(c.classification)));
 assert.ok(manifest.cases.filter(c=>!executable(c)).every(c=>typeof c.reason==='string'&&c.reason));
 assert.ok(manifest.cases.filter(executable).every(c=>c.reason===undefined));
 assert.equal(new Set(manifest.cases.map(c=>c.id)).size,manifest.cases.length);
 let total=0;
 for(const [g,d] of Object.entries(manifest.denominators)){
  const mine=by(c=>c.group===g);assert.equal(d.total,mine.length);assert.equal(d.executable,mine.filter(executable).length);
  assert.equal(Object.values(d.classes).reduce((a,b)=>a+b,0),d.total);
  for(const [kind,cls] of Object.entries(d.kinds))for(const [name,n] of Object.entries(cls))assert.equal(mine.filter(c=>c.kind===kind&&c.classification===name).length,n);
  total+=d.total;
 }
 assert.equal(total,manifest.cases.length);assert.deepEqual(Object.keys(manifest.denominators).sort(),[...groups,...S.levelGroups].sort());
 assert.deepEqual(S.denominatorsOf(manifest.cases),manifest.denominators);
 for(const [name,kinds] of Object.entries(manifest.dimensions))assert.ok(kinds.some(kind=>by(c=>c.kind===kind&&executable(c)).length>0),'維度沒有可執行案例 '+name);
 assert.deepEqual(Object.values(manifest.dimensions).flat().sort(),[...S.kinds].sort());
 assert.equal(manifest.cases.filter(c=>c.classification==='unknown-native').length>0,true);
});
test('manifest rejects source, data, baseline, core, oracle and membership drift',()=>{
 S.validateManifest(manifest,k,core,inputs);
 for(const mutate of [m=>m.cases.pop(),m=>m.cases.push(m.cases[0]),m=>m.binding.fingerprints['tz.json']='changed',m=>m.binding.baselineHash='c'.repeat(64),m=>m.binding.effectOracleHash='x',m=>m.cases[0].classification='policy-rejection',m=>m.denominators[BU].total++]){
  const m=structuredClone(manifest);mutate(m);assert.throws(()=>S.validateManifest(m,k,core,inputs),/manifest/);
 }
 assert.throws(()=>S.validateManifest(manifest,k,core+'\n// changed',inputs));
 for(const key of Object.keys(inputs))assert.throws(()=>S.createManifest(k,core,{...inputs,[key]:'short'}));
 const changedRules=structuredClone(k);changedRules.setEquipmentQuality.sourceDigest='x';assert.throws(()=>S.validateManifest(manifest,changedRules,core,inputs),/manifest/);
 const noQuality=structuredClone(k);delete noQuality.setEquipmentQuality;assert.throws(()=>S.createManifest(noQuality,core,inputs));
 assert.notEqual(S.createManifest(k,core+'\n// changed',inputs).manifestHash,manifest.manifestHash);
});
test('shards cover every executable case exactly once; filters and bad selections fail closed',()=>{
 for(const total of [1,7,17]){
  const ids=Array.from({length:total},(_,index)=>S.shard(manifest,{index,total})).flat().map(c=>c.id);
  assert.equal(ids.length,manifest.cases.filter(executable).length);assert.equal(new Set(ids).size,ids.length);
 }
 const all=S.shard(manifest,{includeNotApplicable:true});assert.equal(all.length,manifest.cases.length);
 assert.ok(S.shard(manifest).every(executable));
 const only=S.shard(manifest,{kinds:['base'],groups:[SU]});assert.equal(only.length,6480);assert.ok(only.every(c=>c.kind==='base'&&c.group===SU));
 assert.equal(S.shard(manifest,{kinds:['effect']}).length,864);
 for(const bad of [{index:2,total:2},{index:-1,total:2},{total:0},{index:0.5,total:2},{kinds:['unknown']},{kinds:[]},{kinds:['base','base']},{groups:['nope']},{groups:[]}])assert.throws(()=>S.shard(manifest,bad));
 const sizes=Array.from({length:5},(_,index)=>S.shard(manifest,{index,total:5}).length);assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1);
});
test('checkpoints bind the exact manifest, inputs and shard selection',()=>{
 const sel={index:3,total:11,kinds:['base','pool'],groups:[BD]},cp=S.checkpoint(manifest,sel);
 assert.equal(S.validateCheckpoint(manifest,cp),true);assert.ok(cp.count>0);
 const copy=f=>{const c=structuredClone(cp);f(c);return c;};
 for(const bad of [c=>c.manifestHash='x',c=>c.binding='x',c=>c.count++,c=>c.idsHash='x',c=>c.selection.index=4,c=>c.selection.kinds=['base'],c=>c.selection.total=12,c=>c.selection.groups=[BU],c=>c.schemaVersion=2])assert.throws(()=>S.validateCheckpoint(manifest,copy(bad)));
 const drift=S.createManifest(k,core+'\n// changed',inputs);assert.throws(()=>S.validateCheckpoint(drift,cp),/checkpoint/);
 const other=S.createManifest(k,core,{...inputs,baselineHash:'e'.repeat(64)});assert.throws(()=>S.validateCheckpoint(other,cp));
 assert.equal(S.validateCheckpoint(manifest,S.checkpoint(manifest)),true);
});
test('progress refuses duplicates, not-applicable results, relabeled native evidence and per-group completion claims',()=>{
 const p=S.emptyProgress(manifest),c=manifest.cases.find(executable),skipped=manifest.cases.find(v=>!executable(v));
 S.recordResult(manifest,p,c,{passed:true,observation:{expected:1,nativeCompared:false}});
 assert.throws(()=>S.recordResult(manifest,p,c,{passed:true,observation:{expected:1,nativeCompared:false}}),/重複/);
 assert.throws(()=>S.recordResult(manifest,p,skipped,{passed:true,observation:{nativeCompared:false}}),/不適用/);
 assert.throws(()=>S.recordResult(manifest,p,{...c,id:'unknown'},{passed:true,observation:{nativeCompared:false}}),/未知/);
 const wrong=structuredClone(p);wrong.manifestHash='x';assert.throws(()=>S.validateProgress(manifest,wrong),/輸入/);
 const native=structuredClone(p);native.mode='native';assert.throws(()=>S.validateProgress(manifest,native),/原生/);
 const fake=structuredClone(p);fake.results[0].nativeCompared=true;assert.throws(()=>S.validateProgress(manifest,fake),/冒充/);
 const altered=structuredClone(p);altered.results[0].caseHash=hash('changed');assert.throws(()=>S.validateProgress(manifest,altered),/摘要/);
 const second=manifest.cases.filter(executable)[1];S.recordResult(manifest,p,second,{passed:false,observation:{error:'failure'}});
 const flipped=structuredClone(p);flipped.results[1].passed=true;assert.throws(()=>S.validateProgress(manifest,flipped));
 const stale=structuredClone(p);stale.results.push({...stale.results[0],id:skipped.id,caseHash:hash(skipped)});assert.throws(()=>S.validateProgress(manifest,stale));
 const result=S.summary(manifest,p),g=result.groups[c.group];
 assert.equal(result.attempted,2);assert.equal(result.nativeComplete,false);assert.equal(g.syntheticComplete,false);assert.ok(g.pending>0);
 assert.equal(g.total,g.executable+g.notApplicable);assert.equal(g.executable,g.attempted+g.pending);
 assert.deepEqual(Object.values(result.opened),[false,false,false,false]);assert.deepEqual(Object.keys(result.opened),groups);
 // finishing one group's shard does not complete another group
 const done=S.emptyProgress(manifest);for(const x of S.shard(manifest,{groups:[BU],kinds:['reject']}))S.recordResult(manifest,done,x,{passed:true,observation:{nativeCompared:false}});
 const part=S.summary(manifest,done).groups;assert.equal(part[BU].syntheticComplete,false);assert.equal(part[BD].passed,0);
});
test('groups stay closed, unregistered and the scenario module reads no core or native source',()=>{
 for(const g of groups)assert.equal(k.verification[g],false);
 const src=fs.readFileSync(path.join(__dirname,'../scripts/set-equipment-quality-scenarios.cjs'),'utf8');
 assert.deepEqual([...src.matchAll(/require\(([^)]*)\)/g)].map(m=>m[1]).sort(),["'./set-equipment-quality-data.cjs'","'./set-equipment-quality-effects-oracle.cjs'","'./set-equipment-quality-oracle.cjs'","'node:assert/strict'","'node:fs'","'node:path'"].sort());
 assert.ok(!/SaveCore|runInNewContext|vm\./.test(src));
});
