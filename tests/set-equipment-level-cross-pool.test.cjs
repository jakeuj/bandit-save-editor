'use strict';
// Synthetic tests for the B6 cross-pool level runner: candidate isolation, planning, offline sequences, bytes, validators and A10 rows.
// No game and no real save; the refined start is a synthetic row with a P套-only id in the selected slot.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const B6=require('../scripts/verify-set-equipment-level-cross-pool.cjs'),O=require('../scripts/set-equipment-quality-oracle.cjs'),L=require('../scripts/set-equipment-level-oracle.cjs'),
 M=require('../scripts/set-equipment-quality-scenarios.cjs'),Q=require('../scripts/set-equipment-quality-data.cjs'),X=require('../scripts/set-equipment-quality-matrix.cjs');
const k=require('../knowledge/catalog.json'),source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
const filler=Object.fromEntries(['baselineHash','runtimeHash','sourceManifestHash','runtimeManifestHash'].map(n=>[n,'0'.repeat(64)]));
const census=O.reachabilityCensus(k.setEquipmentQuality,k.setEquipmentLevel);
function baseline(templateId,q){
 const row=census.find(r=>r.templateId===templateId),origin=k.setEquipmentLevel.origins[row.originId],set=k.setEquipmentQuality.pools[templateId],rec=Array(60).fill(0);
 Object.assign(rec,{0:1,1:templateId,2:1,3:set.tier,5:q,6:1,8:95+30*(q-1),23:3,24:1,26:1.5,27:row.originId});
 for(let s=1;s<=q-1;s++){rec[8+s]=origin.affixIds[s-1];rec[14+s]=O.subRange(q)[0]+5;}
 return {templateId,quality:q,origin:row.originId,before:rec.slice(),material:Array(60).fill(0),after:rec};
}
const results=Object.keys(k.setEquipmentQuality.pools).map(Number).flatMap(t=>[1,2,3,4,5,6].map(q=>baseline(t,q)));
const manifest=M.createManifest(k,source,filler),specs=B6.plan(k,results,manifest),{C,F}=B6.cores(k,source);
// What a native refine hit looks like: slot 1 holds a P套-only id with the selected flag; nothing else moves.
function refined(spec){const r=spec.baseline.slice(),p=X.poolsOf(k,spec.templateId,spec.originId);r[9]=p.setOnly[0];r[15]=O.subRange(r[5])[0]+12.34;r[28]=1;return r;}
const placed=(core,row,plane,slot)=>{const m=X.sandbox(core);X.place(m,[{record:row,slot}],plane);return m;};
const loadWith=knowledge=>{const ctx={};require('node:vm').runInNewContext(source.replace('/*__KNOWLEDGE__*/null',JSON.stringify(knowledge)),ctx);return ctx.SaveCore;};
const saveText=()=>{const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='驗證角色';return JSON.stringify({c2array:true,size:[221,60,22],data});};

test('the cross-pool level policy is gated by its own closed groups: shipped knowledge refuses, an opened copy is the candidate',()=>{
 for(const g of Q.crossPoolGroups)assert.equal(k.verification[g],false);
 const opened=structuredClone(k);opened.verification[Q.crossPoolGroups[0]]=true;assert.throws(()=>B6.cores(opened,source),/必須關閉/);
 for(const spec of Object.values(specs)){
  const start=refined(spec);B6.formalRefuses(F,start,spec.plane,spec.slot);
  // Shipped knowledge keeps the four quality groups closed.
  for(const g of Q.groups)assert.notEqual(k.verification[g],true);
 }
});
// B7: the shipped core with both cross-pool groups closed must behave exactly like the pre-B7 core (the original-pool check only).
const crossPoolLine="  // Cross-pool scope reuses the set-quality pool (P套) for the one selected slot, behind its own per-plane first proof; closed, it is the original-pool check.\n  const crossPool=KNOWLEDGE.verification[plane===7?'backpackSetEquipmentLevelCrossPool':'setEquipmentLevelCrossPool']===true?KNOWLEDGE.setEquipmentQuality?.pools?.[record[1]]:undefined;\n";
const crossPoolCheck="if(slot<quality){if(!(origin.affixIds.includes(id)||flag===1&&!!crossPool?.affixIds.includes(id))||";
function preB7Source(){
 const lf=source.replace(/\r\n/g,'\n');assert.equal(lf.split(crossPoolLine).length,2);assert.equal(lf.split(crossPoolCheck).length,2);
 return lf.replace(crossPoolLine,'').replace(crossPoolCheck,"if(slot<quality){if(!origin.affixIds.includes(id)||");
}
const outcome=fn=>{try{const v=fn();return {ok:true,v:JSON.stringify(v)};}catch(e){return {ok:false,e:e.message};}};
test('closed cross-pool groups: every formal entry matches the pre-B7 core on cross-pool, misplaced, multi-flag and original-pool rows',()=>{
 const old=B6.cores(k,preB7Source()).F;
 for(const spec of Object.values(specs)){
  const start=refined(spec),misplaced=start.slice(),multi=start.slice(),origin=spec.baseline.slice();
  misplaced[28]=0;misplaced[29]=1;multi[29]=1;
  for(const row of [start,misplaced,multi,origin,origin.map((v,y)=>y===28?1:v)]){
   const run=core=>{const m=placed(core,row,spec.plane,spec.slot),plane=spec.plane;
    const r=[outcome(()=>core.setEquipmentLevelInfo(m,{itemId:1,plane})),outcome(()=>core.editingInfo(m,'equipment',1,plane)),outcome(()=>core.resolveField(m,{x:1,y:6,z:plane})),
     outcome(()=>core.set(m,{x:1,y:6,z:plane},2)),outcome(()=>core.setField(m,{x:1,y:6,z:plane},2)),outcome(()=>core.setEquipmentLevel(m,{itemId:1,plane,level:Math.min(row[6]+1,O.cap(row[5]))}))];
    return {r,bytes:core.serialize(m),changes:m.changes.size};};
   const a=run(F),b=run(old);assert.deepEqual(a,b,'關閉時與 B7 前核心不同');
  }
 }
});
test('cross-pool groups are per plane and only widen the selected slot; requireClosed covers them',()=>{
 for(const spec of Object.values(specs)){
  const start=refined(spec),other=spec.plane===7?'setEquipmentLevelCrossPool':'backpackSetEquipmentLevelCrossPool',own=spec.plane===7?'backpackSetEquipmentLevelCrossPool':'setEquipmentLevelCrossPool';
  const onlyOther=structuredClone(k);onlyOther.verification[other]=true;const W=loadWith(onlyOther);
  assert.throws(()=>W.setEquipmentLevelInfo(placed(W,start,spec.plane,spec.slot),{itemId:1,plane:spec.plane}),/原裝備詞條/);
  const onlyOwn=structuredClone(k);onlyOwn.verification[own]=true;const V=loadWith(onlyOwn),m=placed(V,start,spec.plane,spec.slot);
  assert.equal(V.setEquipmentLevelInfo(m,{itemId:1,plane:spec.plane}).verified,true);V.setEquipmentLevel(m,{itemId:1,plane:spec.plane,level:7});assert.equal(m.changes.size,1);
  const misplaced=start.slice();misplaced[28]=0;misplaced[29]=1;assert.throws(()=>V.setEquipmentLevelInfo(placed(V,misplaced,spec.plane,spec.slot),{itemId:1,plane:spec.plane}),/原裝備詞條/);
  const multi=start.slice();multi[29]=1;assert.throws(()=>V.setEquipmentLevelInfo(placed(V,multi,spec.plane,spec.slot),{itemId:1,plane:spec.plane}),/多個已選洗練槽/);
  const outside=start.slice();outside[9]=999999;assert.throws(()=>V.setEquipmentLevelInfo(placed(V,outside,spec.plane,spec.slot),{itemId:1,plane:spec.plane}),/原裝備詞條/);
  // An opened cross-pool group never bypasses the closed set-level flag of its plane.
  const noLevel=structuredClone(onlyOwn);noLevel.verification[spec.group]=false;const N=loadWith(noLevel);
  assert.throws(()=>N.setEquipmentLevel(placed(N,start,spec.plane,spec.slot),{itemId:1,plane:spec.plane,level:7}));
  const closedCheck=structuredClone(k);Q.requireClosed(closedCheck);closedCheck.verification[own]=true;assert.throws(()=>Q.requireClosed(closedCheck),/首次證明/);
 }
});
test('planning maps the 16 level-regression cases onto both existing set-level groups with native-shaped starts',()=>{
 assert.deepEqual(Object.keys(specs),['z7','z9']);
 for(const [key,spec] of Object.entries(specs)){
  assert.equal(spec.cases.length,8);assert.deepEqual(spec.cases.map(c=>c.regression),B6.names);assert.ok(spec.cases.every(c=>c.group===spec.group&&c.plane===key));
  assert.equal(spec.baseline[5],3);assert.equal(spec.baseline[6],1);assert.equal(k.setEquipmentLevel.items[spec.templateId].tier,key==='z7'?1:9);
  assert.ok(X.poolsOf(k,spec.templateId,spec.originId).setOnly.length>0);
 }
 assert.deepEqual(specs.z7.group,'backpackSetEquipmentLevel');assert.deepEqual(specs.z9.group,'setEquipmentLevel');
 assert.throws(()=>B6.plan(k,results.filter(v=>v.quality!==3),manifest),/缺 T/);
});
test('candidate eligibility: selected P套 slot accepted for level, misplaced or unflagged P套 id refused',()=>{
 for(const spec of Object.values(specs)){
  const start=refined(spec),m=X.sandbox(C);X.place(m,[{record:start,slot:spec.slot}],spec.plane);
  const info=C.setEquipmentLevelInfo(m,{itemId:1,plane:spec.plane});assert.equal(info.normalMax,O.cap(3));assert.equal(info.group,spec.group);
  const after=B6.levelEdit(C,m,spec.plane,12);L.assertLevelOnly(start,after,12);assert.equal(m.changes.size,1);
  const wrong=start.slice();wrong[28]=0;wrong[29]=1;const mw=X.sandbox(C);X.place(mw,[{record:wrong,slot:spec.slot}],spec.plane);assert.throws(()=>C.setEquipmentLevelInfo(mw,{itemId:1,plane:spec.plane}));
  const flagless=start.slice();flagless[28]=0;const mu=X.sandbox(C);X.place(mu,[{record:flagless,slot:spec.slot}],spec.plane);assert.throws(()=>C.setEquipmentLevelInfo(mu,{itemId:1,plane:spec.plane}));
  assert.throws(()=>C.setEquipmentLevel(m,{itemId:1,plane:spec.plane,level:O.cap(3)+1}),/上限/);
 }
});
test('quality→level→quality interleaving follows the oracles, refuses Q-down over cap, and undoes step by step',()=>{
 for(const spec of Object.values(specs)){
  const r=B6.undoSequence(k,C,F,refined(spec),spec.plane,spec.slot);
  assert.equal(r.states.length,5);assert.deepEqual(r.states.map(s=>[s[5],s[6]]),[[3,1],[4,1],[4,22],[4,18],[3,18]]);
  assert.equal(r.undone.at(-1).join(),refined(spec).join());assert.match(r.refused,/上限|等級/);
  assert.equal(r.states.at(-1)[9],refined(spec)[9],'已選 P套 ID 保留');
 }
});
test('accumulated restore: a level or quality token reverts the whole item; restoreAll as well',()=>{
 for(const spec of Object.values(specs)){const r=B6.restoreSequence(k,C,refined(spec),spec.plane,spec.slot);assert.deepEqual(r.states.map(s=>[s[5],s[6]]),[[3,1],[3,5],[4,5],[4,12],[5,12]]);}
});
test('bytes: only the transaction tokens change, restore returns the exact start bytes, formal core refuses each saved row',()=>{
 for(const spec of Object.values(specs)){
  const start=refined(spec);
  const io=B6.byteCases(k,C,F,saveText(),start,spec,'io-two-rounds');assert.equal(io.saves.length,1);assert.equal(io.saves[0].expected[6],9);
  const diff=C.diff(C.parse(io.text0).original,C.parse(io.saves[0].text).original);assert.equal(JSON.stringify(diff.map(d=>[d.x,d.y,d.z])),JSON.stringify([[1,6,spec.plane]]));
  const u=B6.byteCases(k,C,F,saveText(),start,spec,'quality-level-quality-undo');assert.deepEqual(u.saves.map(s=>[s.label,s.expected[5],s.expected[6]]),[['interleaved',3,18],['after-two-undo',4,22]]);assert.ok(u.saves[0].refine);
  const r=B6.byteCases(k,C,F,saveText(),start,spec,'accumulated-restore');assert.equal(r.saves[1].text,r.text0);assert.deepEqual(r.saves[1].expected,start);
  const worn=B6.byteCases(k,C,F,saveText(),start.map((v,y)=>y===7?1:v),{...spec,plane:9},'io-two-rounds');
  if(spec.plane===9)assert.equal(worn.saves[0].pointers[spec.slot-1],1);
 }
});
test('native validators: effects, character, refine and upgrade mismatches are refutations',()=>{
 const spec=specs.z9,start=refined(spec),rules=k.setEquipmentLevel,attrs=X.attributesOf(k),e=L.itemEffects(start,rules);
 const singles=attrs.map(id=>[id,e[id]||0]);B6.checkSingles(singles,start,rules,'t');
 assert.throws(()=>B6.checkSingles(singles.map(([id,v],i)=>[id,i?v:v+1]),start,rules,'t'),B6.Refutation);
 const worn=start.map((v,y)=>y===7?1:v),ce=L.characterEffects([worn],rules),s=ce.summaries[rules.items[worn[1]].setLink];
 const ch={summary:[s.parts,s.score,s.count],values:X.effectAttributesOf(k).map(id=>[id,(ce.singles[id]||0)+(ce.sets[id]||0)])};B6.checkCharacter(ch,[worn],rules,'t');
 assert.throws(()=>B6.checkCharacter({...ch,summary:[9,9,9]},[worn],rules,'t'),B6.Refutation);
 const base=spec.baseline,hit=start;const ok={attempts:[{row:hit,soulCost:100}],hit:true};assert.equal(B6.checkRefine(k,base,ok,spec).hit,true);
 const moved=hit.slice();moved[3]=99;assert.throws(()=>B6.checkRefine(k,base,{attempts:[{row:moved,soulCost:100}]},spec),B6.Refutation);
 assert.throws(()=>B6.checkRefine(k,base,{attempts:[{row:hit,soulCost:0}]},spec),B6.Refutation);
 const high=start.map((v,y)=>y===6?12:v);let cost=0;for(let l=1;l<12;l++)cost+=L.money(start[3],l);
 B6.checkUpgrade({upgraded:high,cost,soulCost:0},high,start,9);
 assert.throws(()=>B6.checkUpgrade({upgraded:high,cost:cost+1,soulCost:0},high,start,9),B6.Refutation);
 assert.throws(()=>B6.checkUpgrade({upgraded:high,cost,soulCost:5},high,start,9),B6.Refutation);
 const z7=specs.z7,s7=refined(z7),h7=s7.map((v,y)=>y===6?12:v),c7=Array.from({length:11},(_,i)=>L.money(s7[3],i+1)).reduce((a,b)=>a+b,0);
 B6.checkUpgrade({moved:s7.map((v,y)=>y<50?v:0),upgraded:h7.map((v,y)=>y<50?v:0),cost:c7,soulCost:0},h7,s7,7);
});
test('A10 rows: only complete when all 16 cases passed with the live case hash; nothing else is emitted',()=>{
 const cases=manifest.cases.filter(c=>c.kind==='level-regression');
 const all=cases.map(c=>({id:c.id,caseHash:Q.hash(c),passed:true,nativeCompared:true}));
 const r=B6.a10Rows(manifest,all);assert.equal(r.complete,true);assert.equal(r.rows.length,16);assert.ok(r.rows.every(v=>Object.keys(v).join()==='id,caseHash,passed,nativeCompared'&&v.nativeCompared===true));
 assert.equal(B6.a10Rows(manifest,all.slice(1)).complete,false);
 const stale=all.map((v,i)=>i?v:{...v,caseHash:'0'.repeat(64)});assert.equal(B6.a10Rows(manifest,stale).complete,false);
 const failed=all.map((v,i)=>i?v:{...v,passed:false});const f=B6.a10Rows(manifest,failed);assert.equal(f.complete,false);assert.equal(f.rows.length,15);assert.deepEqual(f.missing,[cases[0].id]);
});
test('the runner refuses to run without an artifacts folder outside the repo',()=>{
 const p=require('node:child_process').spawnSync(process.execPath,[path.join(__dirname,'../scripts/verify-set-equipment-level-cross-pool.cjs')],{encoding:'utf8'});
 assert.equal(p.status,1);assert.match(p.stderr,/--output/);
});
