'use strict';
// The first-proof validators must re-derive expectations and reject tampered raw observations.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../scripts/verify-treasure-level-matrix.cjs'),O=require('../scripts/treasure-level-oracle.cjs'),Syn=require('../scripts/treasure-level-synthetic.cjs'),L=require('../scripts/verify-treasure-level-lifecycle.cjs');
const k=require('../knowledge/catalog.json'),core=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
const tier3=+Object.keys(k.treasureLevel.items).find(i=>k.treasureLevel.items[i].tier===3);
const baseline=new Map([[`${tier3}:4`,Syn.treasureRecord(k,tier3,{quality:4,level:1})]]);
baseline.get(`${tier3}:4`)[9]=17;baseline.get(`${tier3}:4`)[15]=80;
const C=M.candidateCore(k,core);
const c={id:'x',kind:'level',group:'backpackTreasureLevel',templateId:tier3,tier:3,quality:4,state:'backpack',from:5,to:6};
// Honest observation built from the oracle, i.e. what a native run that agrees with it would report.
function honest(c){
 const before=M.beforeRecord(baseline,c),after=M.coreEdit(C,before,c),parts=O.components(after,k.treasureLevel,k.affixReplacement);
 const moved=before.map((v,y)=>y>=50?0:v),observed={totals:[[17,1]],components:parts.map(p=>({kind:p.kind,id:p.id,coefficient:p.coefficient,setting:p.setting,value:p.value??1.5}))};
 if(c.to===c.from+1)observed.upgrade={moved,upgraded:after.map((v,y)=>y>=50?0:v),soulCost:O.souls(c.tier,c.from)};
 return {before,after,observed};
}
test('an honest oracle-agreeing observation passes and the core edit is level-only',()=>{
 const {before,after,observed}=honest(c);assert.equal(M.validateLevel(observed,c,before,after,k),true);
 assert.deepEqual(after,before.map((v,y)=>y===6?6:v));
});
test('tampered level observations are rejected',()=>{
 const run=mutate=>{const h=honest(c);mutate(h);return ()=>M.validateLevel(h.observed,c,h.before,h.after,k);};
 assert.throws(run(h=>h.observed.upgrade.soulCost+=1),/魂魄成本/);
 assert.throws(run(h=>h.observed.upgrade.upgraded[6]=9),/不同/);
 assert.throws(run(h=>h.observed.upgrade.upgraded[5]=h.observed.upgrade.moved[5]+1),/不同|等級外/);
 assert.throws(run(h=>delete h.observed.upgrade),/缺原生升級/);
 assert.throws(run(h=>h.observed.components[0].value+=0.01),/oracle 不符/);
 assert.throws(run(h=>h.observed.components[0].value=NaN),/有限值/);
 assert.throws(run(h=>h.observed.components.pop()),/成分數量/);
 assert.throws(run(h=>h.observed.components[0].coefficient+=1),/成分輸入/);
 assert.throws(run(h=>h.observed.totals[0][1]=Infinity),/總值/);
 assert.throws(run(h=>h.after[5]+=1),/等級外欄位/);
 const down={...c,from:6,to:5},d=honest(down);assert.equal(M.validateLevel(d.observed,down,d.before,d.after,k),true);
 d.observed.upgrade={moved:d.before,upgraded:d.after,soulCost:0};assert.throws(()=>M.validateLevel(d.observed,down,d.before,d.after,k),/降級/);
});
test('cost observations must equal the oracle for every mode',()=>{
 for(const mode of ['insufficient','exact','ample','partial-max','at-cap','maximum']){
  const cc={id:'c',kind:'cost',tier:3,quality:4,mode},input=M.costInput(new Map([[`${tier3}:4`,baseline.get(`${tier3}:4`)]]),k,cc),e=O.upgrade({tier:3,quality:4,level:input.record[6],souls:input.souls},input.maximum),observed={record:input.record.map((v,y)=>y===6?e.level:v),souls:e.souls};
  assert.equal(M.validateCost(observed,cc,input),true);
  assert.throws(()=>M.validateCost({...observed,souls:observed.souls+1},cc,input));
  if(e.level<O.cap(4)||mode==='at-cap')assert.throws(()=>M.validateCost({...observed,record:observed.record.map((v,y)=>y===6?v+1:v)},cc,input));
  assert.throws(()=>M.validateCost({...observed,record:observed.record.map((v,y)=>y===5?v+1:v)},cc,input));
 }
});
test('decompose pays the fixed tier price, clears the row, and keeps locked rows in batches',()=>{
 const map=new Map([[`${tier3}:4`,baseline.get(`${tier3}:4`)]]);
 for(const mode of ['single','batch-unlocked','batch-locked']){
  const cc={id:'d',kind:'decompose',tier:3,quality:4,level:5,mode,souls:O.ransom[3]},input=M.decomposeInput(map,k,cc);
  const locked=mode==='batch-locked',observed={rows:[locked?input.row:Array(60).fill(0)],souls:input.souls+(locked?0:O.ransom[3])};
  assert.equal(M.validateDecompose(observed,cc,input),true);
  assert.throws(()=>M.validateDecompose({...observed,souls:observed.souls+1},cc,input));
  assert.throws(()=>M.validateDecompose({...observed,rows:[locked?Array(60).fill(0):input.row]},cc,input));
 }
});
test('lifecycle takeout owner: stored takeout keeps the owner, worn takeout and unequip clear it',()=>{
 const expected=Array(60).fill(0);expected[7]=1;
 const step=(phase,owner)=>({phase,id:2,record:expected.map((v,y)=>y===7?owner:v),refs:[0,0,0,0,0,phase==='equip'?2:0],source:Array(60).fill(0)});
 const report=worn=>({initial:expected,worn,steps:[step('takeout',worn?0:1),step('equip',1),step('unequip',0)]});
 assert.equal(L.validateCycle(report(false),expected),true);assert.equal(L.validateCycle(report(true),expected),true);
 const wrong=report(true);wrong.steps[0].record[7]=1;assert.throws(()=>L.validateCycle(wrong,expected),/owner/);
 const stale=report(false);stale.steps[0].record[7]=0;assert.throws(()=>L.validateCycle(stale,expected),/owner/);
});
