'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const B=require('../scripts/set-equipment-quality-baseline.cjs'),O=require('../scripts/set-equipment-quality-oracle.cjs');
const k=require('../knowledge/catalog.json'),R=k.setEquipmentQuality,L=k.setEquipmentLevel;
const templateId=28,originId=1,P原=L.origins[originId].affixIds,P套=R.pools[templateId].affixIds;
const setOnly=P套.filter(a=>!P原.includes(a));
// Synthetic native observations: an origin-template drop and its in-place synthesis (set-level B shape).
function generation(q=6){
 const before=Array(60).fill(0);Object.assign(before,{0:1,1:originId,2:1,3:1,5:q,6:1,8:95+30*(q-1)});
 for(let s=1;s<q;s++){before[O.col.id(s)]=P原[s-1];before[O.col.coef(s)]=O.subRange(q)[0]+5;}
 const material=Array(60).fill(0);material[4]=3;material[10]=1.5;
 const after=before.slice();Object.assign(after,{1:templateId,23:3,24:1,26:1.5,27:originId});
 return {templateId,quality:q,origin:originId,before,material,after};
}
function refineSeq(record,ids,slot=1){
 let prev=record.slice();return {key:`${templateId}:${originId}`,plane:7,slot,hit:setOnly.includes(ids.at(-1)),attempts:ids.map(id=>{const row=prev.slice();row[O.col.id(slot)]=id;row[O.col.coef(slot)]=O.subRange(record[5])[0]+20;row[O.col.flag(slot)]=1;prev=row;return {row,soulCost:30};})};
}

test('existing level baselines cover one origin per template; missing origin rows are listed at Q6',()=>{
 const covered=Object.keys(R.pools).map(Number).map(t=>{const row=O.reachabilityCensus(R,L).filter(r=>r.templateId===t).sort((a,b)=>a.originId-b.originId)[0];return {templateId:t,origin:row.originId};});
 const missing=B.missingOriginRows(k,covered),census=O.reachabilityCensus(R,L);
 assert.equal(missing.length,census.length-covered.length);
 assert.ok(missing.every(m=>m.quality===6&&m.points===3&&!covered.some(c=>c.templateId===m.templateId&&c.origin===m.origin)));
 assert.equal(new Set(missing.map(m=>m.id)).size,missing.length);
});
test('generation check accepts a native drop + synthesis and flags metadata, pool and slot drift',()=>{
 const v=generation(),c={templateId,origin:originId,quality:6};
 assert.deepEqual(B.checkGeneration(v,c,k),{problems:[],conflicts:[]});
 const foreign=structuredClone(v);foreign.after[O.col.id(2)]=setOnly[0];
 assert.match(B.checkGeneration(foreign,c,k).conflicts.join(),/不在 P原/);
 const extra=structuredClone(v);extra.after[40]=7;assert.match(B.checkGeneration(extra,c,k).conflicts.join(),/合成改變欄 40/);
 const meta=structuredClone(v);meta.after[23]=4;assert.match(B.checkGeneration(meta,c,k).problems.join(),/metadata/);
 const flagged=structuredClone(v);flagged.after[O.col.flag(1)]=1;flagged.before[O.col.flag(1)]=1;assert.match(B.checkGeneration(flagged,c,k).problems.join(),/旗標/);
 const tail=generation(3);tail.after[O.col.id(4)]=P原[4];tail.before[O.col.id(4)]=P原[4];assert.match(B.checkGeneration(tail,{...c,quality:3},k).conflicts.join(),/品質外尾槽/);
});
test('refine targets only keep records whose set pool has ids the origin pool lacks',()=>{
 const t=B.refineTargets(k,[generation()]);assert.equal(t.length,setOnly.length?1:0);
 if(t.length)assert.deepEqual(t[0].setOnly,setOnly);
 assert.equal(B.refineTargets(k,[generation(1)]).length,0);
});
test('refine check accepts native same-slot results from P套 and rejects slot leakage or a foreign pool',()=>{
 assert.ok(setOnly.length,'fixture needs a set-only id');
 const [target]=B.refineTargets(k,[generation()]),shared=P套.find(a=>P原.includes(a));
 const ok=refineSeq(target.record,[shared,setOnly[0]]),r=B.checkRefine(ok,target,k,7);
 assert.deepEqual([r.problems,r.conflicts,r.hit],[[],[],true]);
 const miss=refineSeq(target.record,[shared]),m=B.checkRefine(miss,target,k,7);assert.equal(m.hit,false);assert.deepEqual(m.problems,[]);
 const foreign=refineSeq(target.record,[P原.find(a=>!P套.includes(a))]);assert.match(B.checkRefine(foreign,target,k,7).conflicts.join(),/不在 P套/);
 const leak=refineSeq(target.record,[setOnly[0]]);leak.attempts[0].row[O.col.id(2)]=setOnly[0];assert.match(B.checkRefine(leak,target,k,7).conflicts.join(),/改變欄 10/);
 const free=refineSeq(target.record,[setOnly[0]]);free.attempts[0].soulCost=0;assert.match(B.checkRefine(free,target,k,7).problems.join(),/魂魄成本/);
 const lie=refineSeq(target.record,[shared]);lie.hit=true;assert.match(B.checkRefine(lie,target,k,7).problems.join(),/命中標示/);
 const range=refineSeq(target.record,[setOnly[0]]);range.attempts[0].row[O.col.coef(1)]=999;assert.match(B.checkRefine(range,target,k,7).problems.join(),/區間/);
});
test('witness table: W3 stays missing without a set-only hit; lifecycle witnesses belong to later tasks',()=>{
 const base={levelQualities:[1,2,3,4,5,6],levelCount:1944,generated:10,generationOk:true,originPoolOk:true,refineTargets:5,hitsByPlane:{}};
 const none=B.witnessStatus({...base,setOnlyHits:0});assert.equal(none.find(w=>w.id==='W3').status,'missing');
 const got=B.witnessStatus({...base,setOnlyHits:2,hitsByPlane:{7:1,9:1}});assert.deepEqual(got.map(w=>w.status),['acquired','acquired','acquired','not-applicable','not-applicable','not-applicable','not-applicable']);
 assert.equal(B.witnessStatus({...base,levelQualities:[1,2],setOnlyHits:1}).find(w=>w.id==='W1').status,'missing');
 assert.deepEqual(got.map(w=>w.id),O.witnessTodo.map(w=>w.id));
});
test('source verification reads every manifest file and the 15 catalog fingerprints',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'b1-sources-')),src=path.join(dir,'src'),rt=path.join(dir,'rt');fs.mkdirSync(path.join(src,'scripts'),{recursive:true});fs.mkdirSync(rt);
 const sha=t=>crypto.createHash('sha256').update(t).digest('hex'),fingerprints={};
 for(let i=0;i<14;i++)fingerprints[`f${i}.json`]=sha('x'+i);fingerprints['scripts/c3runtime.js']=sha('rt');
 for(let i=0;i<14;i++)fs.writeFileSync(path.join(src,`f${i}.json`),'x'+i);fs.writeFileSync(path.join(src,'scripts/c3runtime.js'),'rt');fs.writeFileSync(path.join(rt,'game.exe'),'exe');
 fs.writeFileSync(path.join(src,'source-cache.json'),JSON.stringify({files:fingerprints}));fs.writeFileSync(path.join(rt,'runtime-cache.json'),JSON.stringify({files:{'game.exe':sha('exe')}}));
 const catalog={fingerprints:Object.fromEntries(Object.entries(fingerprints).slice(0,2)),batch2Fingerprints:Object.fromEntries(Object.entries(fingerprints).slice(2))};
 const entry={source:src,sourceManifest:path.join(src,'source-cache.json'),runtimeDirectory:rt,runtimeManifest:path.join(rt,'runtime-cache.json'),fingerprints,runtimeHash:'r',packageHash:'p'};
 const v=B.verifySources(entry,catalog);assert.equal(v.sourceFiles,15);assert.equal(v.runtimeFiles,1);assert.match(v.sourceManifestHash,/^[0-9a-f]{64}$/);
 fs.writeFileSync(path.join(rt,'game.exe'),'changed');assert.throws(()=>B.verifySources(entry,catalog),/runtime manifest/);
 fs.writeFileSync(path.join(rt,'game.exe'),'exe');assert.throws(()=>B.verifySources({...entry,fingerprints:{...fingerprints,'f0.json':sha('other')}},catalog),/索引指紋/);
 fs.rmSync(dir,{recursive:true,force:true});
});
test('native refine driver only uses the reviewed native function and reads rows',()=>{
 const text=B.refineDriver.toString();assert.match(text,/'词条洗练'/);assert.doesNotMatch(text,/GetEventVariableBySID|SetValue\(/);
 assert.deepEqual(B.refineColumns(2),[10,16,29]);assert.deepEqual(B.synthesisColumns,[1,23,24,26,27]);
});
