'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const O=require('../scripts/treasure-level-oracle.cjs'),Syn=require('../scripts/treasure-level-synthetic.cjs'),S=require('../scripts/treasure-level-scenarios.cjs');
const k=require('../knowledge/catalog.json'),core=fs.readFileSync(require.resolve('../src/core.js'),'utf8');
test('soul cost is per-level, rounded inside the expression and finite for every tier/level',()=>{
 assert.equal(O.souls(1,1),11);assert.equal(O.souls(1,2),14);
 for(let t=1;t<=6;t++)for(let l=1;l<=35;l++)assert.ok(Number.isSafeInteger(O.souls(t,l)));
 const s={tier:1,quality:1,level:1,souls:11};
 assert.deepEqual(O.upgrade(s),{level:2,souls:0,costs:[11]});assert.deepEqual(O.upgrade({...s,souls:10}),{level:1,souls:10,costs:[]});
 assert.deepEqual(O.upgrade({...s,souls:25},true),{level:3,souls:0,costs:[11,14]});
 assert.deepEqual(O.upgrade({...s,level:10},true),{level:10,souls:11,costs:[]});
 assert.throws(()=>O.upgrade({...s,quality:7}));assert.throws(()=>O.souls(7,1));
});
test('decomposition pays the fixed tier price independent of level, quality and coefficient; batch honors locks',()=>{
 const row=(tier,q,l,lock=0)=>{const r=Array(60).fill(0);Object.assign(r,{3:tier,5:q,6:l,8:100+q,22:lock});return r;};
 for(let t=1;t<=6;t++)for(const [q,l] of [[1,1],[6,35],[3,7]])assert.equal(O.decompose(row(t,q,l)).gain,O.ransom[t]);
 assert.deepEqual(O.batchDecompose([row(1,1,1),row(2,1,1,1),row(3,6,1)],{quality:1}),{removed:1,gain:20,souls:20});
 assert.throws(()=>O.decompose(row(7,1,1)));
});
test('movement keeps y0-49 on the destination only; level-only assertion catches other writes',()=>{
 const src=Array.from({length:60},(_,y)=>y+1),m=O.movedRecord(src);
 assert.deepEqual(m.destination.slice(0,50),src.slice(0,50));assert.deepEqual(m.source.slice(0,50),Array(50).fill(0));assert.deepEqual(m.source.slice(50),src.slice(50));
 O.assertLevelOnly(src,src.map((v,y)=>y===6?9:v),9);assert.throws(()=>O.assertLevelOnly(src,src.map((v,y)=>y===7?9:v),9));
});
test('effect oracle covers reviewed percent attributes and reports the rest as uncovered',()=>{
 const items=k.treasureLevel.items,covered=a=>!a||k.affixReplacement.attributes[a];
 const id=Object.keys(items).find(i=>items[i].mainAttributes.every(covered)),odd=Object.keys(items).find(i=>!items[i].mainAttributes.every(covered));
 const e=O.itemEffects(Syn.treasureRecord(k,+id),k.treasureLevel,k.affixReplacement);assert.deepEqual(e.uncovered,[]);assert.ok(Object.keys(e.values).length);
 assert.ok(O.itemEffects(Syn.treasureRecord(k,+odd),k.treasureLevel,k.affixReplacement).uncovered.length);
});
test('synthetic runner passes sampled manifest cases of every kind and is never native',()=>{
 const wp=[[0]];for(const [id,t] of Object.entries(k.treasureLevel.items))wp[id]=[+id,t.name,'',t.tier,'宝物','装备',6];
 for(let i=0;i<wp.length;i++)wp[i]??=[i];
 const manifest=S.createManifest(k,wp,{baselineHash:'a'.repeat(64),runtimeHash:'b'.repeat(64),sourceManifestHash:'c'.repeat(64)});
 const run=Syn.createSyntheticRunner(k,core),pick=(kind,n)=>manifest.cases.filter(c=>c.kind===kind).filter((_,i)=>i%n===0);
 for(const c of [...pick('level',311),...pick('cost',1),...pick('decompose',1),...pick('reject',1)])assert.equal(run(c).nativeCompared,false);
});
