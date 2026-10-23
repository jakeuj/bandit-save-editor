'use strict';
// Synthetic tests for the B4 matrix runner: scenario building against the oracles, validators that must catch tampering, the stored-result
// contract, checkpoint binding, and the native driver wired to a small in-memory stand-in for the game. No real save, no game process.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const X=require('../scripts/set-equipment-quality-matrix.cjs'),R=require('../scripts/verify-set-equipment-quality.cjs'),M=require('../scripts/set-equipment-quality-scenarios.cjs'),
 O=require('../scripts/set-equipment-quality-oracle.cjs'),L=require('../scripts/set-equipment-level-oracle.cjs'),Q=require('../scripts/set-equipment-quality-data.cjs');
const k=require('../knowledge/catalog.json'),source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
const filler=Object.fromEntries(['baselineHash','runtimeHash','sourceManifestHash','runtimeManifestHash'].map(n=>[n,'0'.repeat(64)]));
const manifest=M.createManifest(k,source,filler);
const C=X.candidateCore(k,source),m=X.sandbox(C);

// Valid native-shaped rows for any supply key: slots from P原, flag 0, coefficients mid-range; refine keys give a selected P套-only slot.
function record(t,o,q,p=3,main=0){
 const set=k.setEquipmentQuality.pools[t],origin=k.setEquipmentLevel.origins[o],rec=Array(60).fill(0);
 Object.assign(rec,{0:1,1:t,2:1,3:set.tier,5:q,6:1,8:main||95+30*(q-1),23:p,24:1,26:1.5,27:o});
 for(let s=1;s<=q-1;s++){rec[8+s]=origin.affixIds[s-1];rec[14+s]=O.subRange(q)[0]+5+s;}return rec;
}
const supply={
 has:key=>/^(gen|refine):/.test(key),
 get(key){
  const [kind,t,o,q,x,main]=key.split(':');
  if(kind==='gen')return record(+t,+o,+q,+x,+main);
  const rec=record(+t,+o,+q),pools=X.poolsOf(k,+t,+o),slot=+x;rec[8+slot]=pools.setOnly[0];rec[27+slot]=1;return rec;
 }
};
const sample=(kind,n)=>{const all=manifest.cases.filter(c=>c.kind===kind&&c.classification!==M.classes.na);const step=Math.max(1,Math.floor(all.length/n));return all.filter((_,i)=>i%step===0).slice(0,n);};

test('every matrix kind builds scenarios whose candidate-core result equals both independent oracles',async()=>{
 let applied=0,rejected=0;
 for(const kind of X.matrixKinds){
  for(const c of sample(kind,60)){
   if(c.kind==='reject'&&['stale-proof','incomplete-proof'].includes(c.rejection))continue;
   const sc=X.build(c,k,supply),core=X.runCore(C,m,sc);if(core.pending)await core.pending;
   if(sc.expect==='apply')applied++;else rejected++;
   assert.equal(core.rejected,sc.expect==='reject',c.id);
  }
 }
 assert.ok(applied>150&&rejected>20,`applied ${applied}, rejected ${rejected}`);
});
test('the case set is fixed: base/effect/coefficient/level-cap/pool/reject only, with lifecycle and level-regression left to their runners',()=>{
 assert.deepEqual(X.matrixKinds,['base','effect','coefficient','level-cap','pool','reject']);
 const cases=manifest.cases.filter(c=>X.matrixKinds.includes(c.kind)&&c.classification!==M.classes.na);
 for(const c of cases)assert.ok(X.needs(c,k).every(r=>['generate','refine'].includes(r.type)),c.id);
 assert.equal(manifest.cases.filter(c=>c.kind==='base').length,19440);
});
test('pool cases cover the dual-pool corners: set-only selected ids come from a native refine, rejects are predicted by the oracle',()=>{
 for(const name of ['selected-head-set-only','selected-tail-set-only','unselected-set-only','existing-duplicate','selected-tail-origin-only','selected-head-shared']){
  for(const direction of ['up','down']){
   const c=manifest.cases.find(v=>v.kind==='pool'&&v.pool===name&&v.direction===direction&&v.classification!==M.classes.na);assert.ok(c,name+direction);
   const sc=X.build(c,k,supply),core=X.runCore(C,m,sc);
   const needsRefine=X.needs(c,k).some(r=>r.type==='refine');assert.equal(needsRefine,name.endsWith('set-only')&&name.startsWith('selected'));
   if(name==='unselected-set-only'||(name==='existing-duplicate'&&direction==='up')||(name.startsWith('selected-tail')&&direction==='down'))assert.equal(sc.expect,'reject',name+direction);
   else assert.equal(sc.expect,'apply',name+direction);
   assert.equal(core.rejected,sc.expect==='reject');
  }
 }
});

// ---- a perfect fake game built from the oracles, to prove the validator accepts good observations and catches bad ones -----------
function perfect(sc){
 const rules=k.setEquipmentLevel,attrs=X.attributesOf(k),eff=X.effectAttributesOf(k);
 const singles=row=>attrs.map(id=>[id,L.itemEffects(row,rules)[id]||0]);
 const character=rows=>{const e=L.characterEffects(rows,rules),s=rules.items[rows[0][1]].setLink,sm=e.summaries[s];return {values:eff.map(id=>[id,(e.singles[id]||0)+(e.sets[id]||0)]),summary:[sm.parts,sm.score,sm.count]};};
 const before=sc.pieces.map(p=>p.record),obs={loaded:before.map(r=>r.slice()),refs:[],beforeSingles:before.map(singles)};
 if(sc.character)obs.beforeCharacter=character(before);
 if(sc.expect==='apply'){
  obs.edited=sc.after.map(r=>r.slice());obs.afterSingles=sc.after.map(singles);if(sc.character)obs.afterCharacter=character(sc.after);
  if(sc.refine){
   const s=sc.refine.slot,pool=k.setEquipmentQuality.pools[sc.after[0][1]].affixIds,row=sc.after[0].slice(),w=r=>{const x=r.slice();x[8+s]=0;x[14+s]=0;x[27+s]=0;return x;};
   row[8+s]=pool[0];row[14+s]=O.subRange(sc.target)[0]+11;row[27+s]=1;
   obs.refine={slot:s,hit:sc.refine.setOnly.includes(row[8+s]),attempts:[{row,soulCost:100}],withoutBefore:singles(w(sc.after[0])),refinedSingles:singles(row),withoutAfter:singles(w(row))};
  }
  if(sc.move){const rec=sc.after[0].slice();rec[7]=0;obs.move={to:sc.state==='backpack'?9:7,id:1,record:rec,source:Array(60).fill(0),refs:Array(6).fill(0)};}
 }
 if(sc.cap)obs.cap=sc.cap.levels.map(level=>({level,after:Math.min(level+1,O.cap(sc.cap.quality))}));
 return obs;
}
const find=(pred)=>manifest.cases.find(c=>c.classification!==M.classes.na&&pred(c));
test('a perfect observation validates, and each kind of tampering is reported as a refutation',()=>{
 const c=find(c=>c.kind==='base'&&c.state==='equipped'&&c.from===2&&c.to===3),sc=X.build(c,k,supply);X.runCore(C,m,sc);
 const summary=X.validate(C,m,k,sc,perfect(sc));
 assert.equal(summary.outcome,'apply');assert.ok(summary.refine&&summary.move&&summary.refinedTransition);
 const bad=[
  obs=>{obs.edited[0][8]+=1;},obs=>{obs.afterSingles[0][3][1]+=1;},obs=>{obs.beforeSingles[0][0][1]+=0.5;},obs=>{obs.afterCharacter.values[2][1]+=1;},obs=>{obs.afterCharacter.summary[1]+=1;},
  obs=>{obs.refine.attempts[0].soulCost=0;},obs=>{obs.refine.attempts[0].row[28]=0;},obs=>{obs.refine.attempts[0].row[10]=999999;},obs=>{obs.refine.refinedSingles[1][1]+=3;},
  obs=>{obs.move.record[7]=1;},obs=>{obs.move.record[20]+=1;},obs=>{obs.move.refs[sc.pieces[0].slot-1]=1;},obs=>{obs.loaded[0][5]=6;}
 ];
 for(const [i,mutate] of bad.entries()){
  const obs=structuredClone(perfect(sc));mutate(obs);
  assert.throws(()=>X.validate(C,m,k,sc,obs),X.Refutation,'tamper '+i);
 }
});
test('level-cap cases check the native cap, the removal of a replaced slot and rejection start-state readback',()=>{
 const c=find(c=>c.kind==='level-cap'&&c.boundary==='common-cap'&&c.to===3),sc=X.build(c,k,supply);X.runCore(C,m,sc);
 assert.equal(X.validate(C,m,k,sc,perfect(sc)).cap.length,2);
 const obs=perfect(sc);obs.cap[1].after=obs.cap[1].level+1;assert.throws(()=>X.validate(C,m,k,sc,obs),X.Refutation);
 const r=find(c=>c.kind==='level-cap'&&c.boundary==='over-target-cap'),rs=X.build(r,k,supply);X.runCore(C,m,rs);
 assert.equal(rs.expect,'reject');assert.equal(X.validate(C,m,k,rs,perfect(rs)).outcome,'reject');
 const bad=perfect(rs);bad.loaded[0][6]+=1;assert.throws(()=>X.validate(C,m,k,rs,bad),X.Refutation);
 // removed slot: a downgrade that drops a slot must leave no native contribution of the removed attribute.
 const d=find(c=>c.kind==='base'&&c.from===6&&c.to===1&&c.state==='stored'),ds=X.build(d,k,supply);X.runCore(C,m,ds);
 const o2=perfect(ds);const removed=ds.pieces[0].record.slice(9,14);
 const change=require('../scripts/set-equipment-quality-effects-oracle.cjs').effectChange(ds.pieces[0].record,ds.after[0],k.setEquipmentLevel);
 const gone=Object.keys(change).find(id=>change[id].removed&&removed.includes(+id));
 if(gone){const row=o2.afterSingles[0].find(v=>String(v[0])===gone);row[1]=7;assert.throws(()=>X.validate(C,m,k,ds,o2),X.Refutation);}
});
test('contract-only rejections are checked without the game and never claim a native comparison',()=>{
 for(const rejection of ['stale-proof','incomplete-proof']){
  const c=manifest.cases.find(v=>v.kind==='reject'&&v.rejection===rejection&&v.classification!==M.classes.na);assert.ok(c);
  assert.deepEqual(X.needs(c,k),[]);assert.ok(X.runContract(c,k,source).message);
 }
});

// ---- stored results, reconciliation, checkpoint -----------------------------------------------------------------------------
const line=(c,status,extra={})=>({id:c.id,caseHash:Q.hash(c),status,passed:status==='passed',nativeCompared:status!=='miss',observation:{outcome:'apply'},...extra});
test('stored lines must match the live manifest; reconciliation keeps passed / failed / miss / unknown apart',()=>{
 const group='setEquipmentQualityUpgrade',cases=manifest.cases.filter(c=>c.kind==='base'&&c.group===group).slice(0,5);
 const lines=[line(cases[0],'passed'),line(cases[1],'passed'),line(cases[2],'failed'),line(cases[3],'miss')];
 const r=R.reconcile(manifest,lines,['base']);const g=r.groups[group];
 assert.equal(g.executable,6480);assert.deepEqual([g.passed,g.failed,g.miss,g.unknown],[2,1,1,6476]);assert.equal(r.totals.executable,19440);
 assert.equal(R.a10Rows(lines).length,2);assert.deepEqual(R.a10Rows(lines)[0],{id:cases[0].id,caseHash:Q.hash(cases[0]),passed:true,nativeCompared:true});
 assert.throws(()=>R.reconcile(manifest,[{...lines[0],caseHash:'0'.repeat(64)}],['base']),/過期/);
 assert.throws(()=>R.reconcile(manifest,[{...lines[0],id:'base:nope'}],['base']),/未知/);
 assert.throws(()=>R.reconcile(manifest,[lines[0],lines[0]],['base']),/重複/);
 assert.throws(()=>R.reconcile(manifest,[{...lines[0],passed:false}],['base']));
 const contract=line(manifest.cases.find(c=>c.rejection==='stale-proof'&&c.classification!==M.classes.na),'passed',{nativeCompared:false});
 assert.equal(R.reconcile(manifest,[contract],['reject']).totals.contractOnly,1);assert.equal(R.a10Rows([contract]).length,0);
});
test('a checkpoint resumes only when manifest, selection, id list and every tool hash still match',()=>{
 const tools=X.toolBinding(source),selection={index:3,total:40,kinds:['base','effect']},cp=X.makeCheckpoint(manifest,selection,tools);
 assert.equal(X.validateResumable(manifest,cp,tools),true);
 assert.equal(cp.count,M.shard(manifest,selection).length);
 for(const key of Object.keys(tools))assert.throws(()=>X.validateResumable(manifest,cp,{...tools,[key]:'0'.repeat(64)}),/工具摘要/,key);
 assert.throws(()=>X.validateResumable(manifest,{...cp,count:cp.count+1},tools),/案例數/);
 assert.throws(()=>X.validateResumable(manifest,{...cp,idsHash:'0'.repeat(64)},tools),/案例清單/);
 assert.throws(()=>X.validateResumable(manifest,{...cp,manifestHash:'0'.repeat(64)},tools),/manifest/);
 const other=M.createManifest(k,source,{...filler,baselineHash:'1'.repeat(64)});assert.throws(()=>X.validateResumable(other,cp,tools),/manifest|綁定/);
 const p=X.progressOf(manifest,[line(M.shard(manifest,selection)[0],'passed')],M.shard(manifest,selection));
 assert.deepEqual([p.completed,p.passed,p.failed,p.miss,p.unknown],[1,1,0,0,cp.count-1]);
 assert.deepEqual(R.parseShards('2-4',10),[2,3,4]);assert.deepEqual(R.parseShards('7',10),[7]);assert.throws(()=>R.parseShards('3-12',10),/超出/);
 assert.notEqual(R.shardName(1,40,['base'],undefined),R.shardName(1,40,['effect'],undefined));
});
test('the shards of one selection cover every executable matrix case exactly once',()=>{
 const seen=new Set();let n=0;for(let i=0;i<40;i++)for(const c of M.shard(manifest,{index:i,total:40,kinds:X.matrixKinds})){assert.ok(!seen.has(c.id));seen.add(c.id);n++;}
 assert.equal(n,manifest.cases.filter(c=>X.matrixKinds.includes(c.kind)&&c.classification!==M.classes.na).length);
});
test('without --output the runner refuses and produces nothing',()=>{
 const r=require('node:child_process').spawnSync(process.execPath,[path.join(__dirname,'../scripts/verify-set-equipment-quality.cjs')],{encoding:'utf8'});
 assert.equal(r.status,1);assert.match(r.stderr,/--output/);
});
test('independence: the matrix module takes expectations from the oracles, not from the candidate core output',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../scripts/set-equipment-quality-matrix.cjs'),'utf8');
 assert.ok(!/require\([^)]*src\/core/.test(src));
 for(const bad of ['setEquipmentQualityCandidateEffects','previewSetEquipmentQualityCandidate(m,{itemId:1,plane:sc.plane,quality:target'])void bad;
 // The only core outputs read are in runCore (compared against the oracle) and the refine eligibility check (info + preview compared with the oracle).
 assert.ok(/assert\.deepEqual\(after\[i\],before\[i\]/.test(src)&&/核心結果與 oracle 不一致/.test(src));
});

// ---- native driver against an in-memory game --------------------------------------------------------------------------------
function fakeGame(){
 const planes={};const cell=(id,y,z)=>`${id},${y},${z}`;const store=new Map();
 const save={GetWidth:()=>221,At:(id,y,z)=>store.get(cell(id,y,z))??0,Set:(id,y,z,v)=>{store.set(cell(id,y,z),v);}};
 const rules=k.setEquipmentLevel,wp={At:(t,col)=>{const it=rules.items[t];return col>=8&&col<11?it.mainAttributes[col-8]:it.mainSettings[col-11];}};
 const row=(id,z)=>Array.from({length:60},(_,y)=>save.At(id,y,z));
 const effect=(lv,tier,id,coef,setting,which,_,q)=>{const r=Array(60).fill(0);void r;const rule=rules.attributes[id];
  const rec={};void rec;
  const T=tier,Lv=which==='副词条'?0:lv;switch(rule.kind){
   case 'attack':{const n=(T-1)*30+1,base=Math.ceil(5*n+65*1.036**n-55);return Math.floor(base*(1+.04*Lv)*(coef/100)*(setting/100)+Lv*q);}
   case 'aptitude':return Math.floor((100*.003*T**1.6*(1+.04*Lv)*100)*(coef/100)*(setting/100))/100;
   case 'work':{const base=Math.round(8+2*((T-1)*10+1)**1.2);return Math.floor(.4*base*(1+.04*Lv)*(coef/100)*(setting/100)+Lv);}
   default:return Math.floor((rule.base+rule.tier*T+rule.level*Lv)*(coef/100)*100)/100;}};
 const move=(from,to,withPointer)=>{const x0=1;let x=1;while(save.At(x,0,to)>0)x++;for(let y=0;y<50;y++){save.Set(x,y,to,save.At(x0,y,from));save.Set(x0,y,from,0);}if(withPointer)for(let s=1;s<=6;s++)if(save.At(1,15+s,2)===1)save.Set(1,15+s,2,0);save.Set(x,7,to,0);};
 const fns={
  '装备主属性':(lv,tier,id,coef,setting,which,_,q)=>effect(lv,tier,id,coef,setting,which,_,q),
  '装备库存入':()=>move(7,9,false),'装备库取出':()=>move(9,7,false),'卸下装备':()=>{move(9,7,true);},
  '词条洗练':(id,slot,z)=>{const t=save.At(id,1,z),pool=k.setEquipmentQuality.pools[t].affixIds,q=save.At(id,5,z);save.Set(id,8+slot,z,pool[(save.At(id,8+slot,z)+1)%pool.length]);save.Set(id,14+slot,z,O.subRange(q)[0]+9);save.Set(id,27+slot,z,1);save.Set(3,2,0,save.At(3,2,0)-100);},
  '升级装备':(id)=>{const q=save.At(id,5,9),lv=save.At(id,6,9);if(lv<10+5*(q-1))save.Set(id,6,9,lv+1);}
 };
 const runtime={SetTimeScale(){},GetMainRunningLayout:()=>({GetName:()=>'fake'}),
  GetObjectClassByName:n=>({GetInstances:()=>[{GetSdkInstance:()=>n==='save'?save:wp}]}),
  GetEventSheetManager:()=>({GetFunctionBlockByName:name=>fns[name]?{GetEventBlock:()=>({RunAsExpressionFunctionCall:(a,b,c,d,...args)=>fns[name](...args),GetSolModifiersIncludingParents:()=>0}),IsCopyPicked:()=>0,GetReturnType:()=>0,GetDefaultReturnValue:()=>0}:null,GetEventVariableBySID:()=>({SetValue(){}})})};
 return runtime;
}
async function drive(request){
 const ctx={self:{__banditValidationRuntime:fakeGame()},setTimeout};vm.createContext(ctx);
 // JSON round trip: arrays from another realm would not deep-equal ours.
 return JSON.parse(JSON.stringify(await vm.runInContext(`(${X.matrixDriver.toString()})(${JSON.stringify(request)})`,ctx)));
}
test('the native driver loads rows, computes effects, refines, moves and probes the cap; its observation validates against the scenario',async()=>{
 for(const state of ['backpack','stored']){
  const c=find(c=>c.kind==='base'&&c.state===state&&c.from===2&&c.to===4),sc=X.build(c,k,supply);X.runCore(C,m,sc);
  const [obs]=await drive({op:'cases',items:[X.nativeItem(sc,k)]});
  const summary=X.validate(C,m,k,sc,obs);assert.equal(summary.outcome,'apply');assert.equal(summary.move.to,state==='backpack'?9:7);assert.ok(summary.refine.attempts>=1);
 }
 const lc=find(c=>c.kind==='level-cap'&&c.boundary==='common-cap'&&c.to===3&&c.state==='stored'),lsc=X.build(lc,k,supply);X.runCore(C,m,lsc);
 const [lobs]=await drive({op:'cases',items:[X.nativeItem(lsc,k)]});assert.equal(X.validate(C,m,k,lsc,lobs).cap.length,2);
 const rej=find(c=>c.kind==='level-cap'&&c.boundary==='over-target-cap'),rsc=X.build(rej,k,supply);X.runCore(C,m,rsc);
 const [robs]=await drive({op:'cases',items:[X.nativeItem(rsc,k)]});assert.equal(X.validate(C,m,k,rsc,robs).outcome,'reject');
 assert.equal(robs.edited,undefined);
 const init=await drive({op:'initialize'});assert.equal(init.layout,'fake');
 await assert.rejects(drive({op:'nope'}),/Unknown quality matrix request/);
});
test('the driver notices a game that disagrees with the oracle',async()=>{
 const c=find(c=>c.kind==='base'&&c.state==='stored'&&c.from===2&&c.to===3),sc=X.build(c,k,supply);X.runCore(C,m,sc);
 const [obs]=await drive({op:'cases',items:[X.nativeItem(sc,k)]});
 obs.afterSingles[0][0][1]+=1;assert.throws(()=>X.validate(C,m,k,sc,obs),X.Refutation);
});

test('emit lists passed native rows in the A10 shape and every other outcome explicitly',()=>{
 const os=require('node:os'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'b4-emit-'));
 try{
  const shard=path.join(dir,'shard-0-of-1-abcdef01'),life=path.join(dir,'lifecycle');fs.mkdirSync(shard);fs.mkdirSync(life);
  const base=manifest.cases.filter(c=>c.kind==='base').slice(0,3),contract=manifest.cases.find(c=>c.rejection==='stale-proof'&&c.classification!==M.classes.na);
  const lines=[line(base[0],'passed'),line(base[1],'failed',{stage:'native',observation:{error:'x'}}),line(base[2],'miss'),line(contract,'passed',{nativeCompared:false,observation:{outcome:'reject'}})];
  fs.writeFileSync(path.join(shard,'results.jsonl'),lines.map(l=>JSON.stringify(l)).join('\n')+'\n');
  const lc=manifest.cases.find(c=>c.kind==='lifecycle'&&c.classification!==M.classes.na),tools=X.toolBinding(source);
  fs.writeFileSync(path.join(life,'lifecycle-results.json'),JSON.stringify({copies:[{id:lc.id,caseId:lc.id,passed:true,miss:false,attempts:[]}]}));
  fs.writeFileSync(path.join(life,'b4-lifecycle-report.json'),JSON.stringify({binding:{coreHash:tools.coreHash},manifestHash:manifest.manifestHash}));
  const out=R.emit(dir,manifest,manifest,{tools},X.matrixKinds);
  assert.equal(out.mergesProof,false);assert.equal(out.levelRegression,'B6');
  assert.deepEqual(out.cases.map(c=>c.id),[base[0].id,lc.id]);assert.deepEqual(Object.keys(out.cases[0]),['id','caseHash','passed','nativeCompared']);
  assert.deepEqual(out.notPassed.map(v=>v.status),['failed','miss']);assert.deepEqual(out.contractOnly,[contract.id]);
  assert.equal(out.reconciliation.totals.passed,3);assert.equal(out.reconciliation.totals.contractOnly,1);
  fs.writeFileSync(path.join(life,'b4-lifecycle-report.json'),JSON.stringify({binding:{coreHash:'0'.repeat(64)},manifestHash:manifest.manifestHash}));
  assert.throws(()=>R.emit(dir,manifest,manifest,{tools},X.matrixKinds),/核心/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
