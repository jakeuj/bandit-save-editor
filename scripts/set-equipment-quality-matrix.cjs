'use strict';
// B4: first-matrix scenarios, validators and native driver for set-equipment quality.
// Every executable A9 case (except lifecycle / level-regression, which have their own runners) becomes one scenario:
//   start rows (native-derived) -> candidate transaction in the isolated knowledge copy -> compared with the A7/A8 oracles offline ->
//   the same rows are loaded into the isolated game, native effects / refine / move / level cap are observed and compared again.
// Nothing here reads the candidate core's output as the answer: the expectation always comes from the oracles.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const O=require('./set-equipment-quality-oracle.cjs'),E=require('./set-equipment-quality-effects-oracle.cjs'),L=require('./set-equipment-level-oracle.cjs'),
 M=require('./set-equipment-quality-scenarios.cjs'),D=require('./set-equipment-quality-data.cjs'),P=require('./set-equipment-quality-proof.cjs');
const {hash}=D,classes=M.classes;
const matrixKinds=['base','effect','coefficient','level-cap','pool','reject'];
const effectLevel=5,refineMax=400;
const stateOf=state=>({plane:state==='backpack'?7:9,owner:state==='equipped'?1:0});
const sk=({t,o,q,p=3,main=0})=>[t,o,q,p,main].join(':');
const almost=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b));

// ---- static data helpers --------------------------------------------------------------------------------------------------
function levelOrigin(k,t){
 const it=k.setEquipmentLevel.items[t];
 return +Object.keys(k.setEquipmentLevel.origins).sort((a,b)=>a-b).find(id=>{const o=k.setEquipmentLevel.origins[id];return o.slot===it.slot&&o.tier===it.tier;});
}
function poolsOf(k,t,o){
 const origin=k.setEquipmentLevel.origins[o].affixIds,set=k.setEquipmentQuality.pools[t].affixIds;
 return {origin,set,originOnly:origin.filter(a=>!set.includes(a)),shared:origin.filter(a=>set.includes(a)),setOnly:set.filter(a=>!origin.includes(a))};
}
const attributesOf=k=>Object.keys(k.setEquipmentLevel.attributes).map(Number);
const effectAttributesOf=k=>[...new Set([...attributesOf(k),...Object.values(k.setEquipmentLevel.sets).flatMap(s=>s.effects.map(e=>e.attributeId))])];

// ---- isolated candidate core ----------------------------------------------------------------------------------------------
// Quality gates open only inside this VM copy of the knowledge; the shipped catalog stays untouched.
function candidateCore(k,source){
 const candidate=structuredClone(k);for(const g of D.groups)candidate.verification[g]=true;
 const ctx={};vm.runInNewContext(source.replace('/*__KNOWLEDGE__*/null',JSON.stringify(candidate)),ctx);return ctx.SaveCore;
}
function sandbox(C){
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='驗證角色';
 return C.parse(JSON.stringify({c2array:true,size:[221,60,22],data}));
}
// Replace rows 1..n of both planes and the role pointers; drop recorded changes so every scenario starts clean.
function place(m,pieces,plane){
 for(const z of [7,9])for(let x=1;x<=12;x++)for(let y=0;y<60;y++)m.original.data[x][y][z]=0;
 for(let s=1;s<=6;s++)m.original.data[1][15+s][2]=0;
 pieces.forEach((p,i)=>{p.record.forEach((v,y)=>{m.original.data[i+1][y][plane]=v;});if(p.record[7])m.original.data[1][15+p.slot][2]=i+1;});
 m.changes.clear();m.history=[];
}
const rowAt=(C,m,x,plane)=>Array.from({length:60},(_,y)=>C.get(m,{x,y,z:plane}));
const asTail=tail=>tail.map(t=>({slot:t.slot,attributeId:t.attributeId,coefficient:t.coefficient}));

// ---- supply of native-derived starting rows -------------------------------------------------------------------------------
// A need is {type:'generate',t,o,q,p,main?} (native acquisition + in-place synthesis) or {type:'refine',t,o,q,slot} (native same-slot refine until a P套-only id).
function tailFor(k,t,o,rec,from,to){
 const pool=poolsOf(k,t,o).origin,keep=O.slots(from),kept=new Set(rec.slice(9,9+keep)),need=O.slots(to)-keep,ids=pool.filter(id=>!kept.has(id)).slice(0,Math.max(0,need));
 assert.equal(ids.length,Math.max(0,need),'原池不足以補尾槽');const lo=O.subRange(to)[0];
 return ids.map((attributeId,i)=>({slot:keep+1+i,attributeId,coefficient:lo+7.25+i}));
}
const pick=(list,exclude,fallback)=>list.find(id=>!exclude.includes(id))??fallback.find(id=>!exclude.includes(id));

// needs(c) -> list of supply requests; build(c,get) -> scenario. Both are pure functions of the case, the catalog and the supply.
function needs(c,k){
 const n=(t,q,p=3,o=levelOrigin(k,t),main)=>({type:'generate',t,o,q,p,main});
 switch(c.kind){
  case 'base':return [n(c.templateId,c.from,3,c.originId)];
  case 'effect':return k.setEquipmentLevel.sets[c.setId].members.slice(0,c.parts).map((t,i)=>n(t,c.from,c.score==='mixed'?i+1:3));
  case 'coefficient':return [n(c.templateId,c.from,3,undefined,mainEndpoint(c))];
  case 'level-cap':return [n(c.templateId,c.from),n(c.templateId,c.to)];
  case 'pool':{
   const out=[n(c.templateId,c.from,3,c.originId)];
   if(c.pool.endsWith('set-only')&&c.pool.startsWith('selected'))out.push({type:'refine',t:c.templateId,o:c.originId,q:c.from,slot:c.pool==='selected-tail-set-only'&&c.direction==='down'?c.from-1:1});
   return out;
  }
  case 'reject':return c.rejection==='stale-proof'||c.rejection==='incomplete-proof'?[]:[n(28,c.direction==='up'?3:4,3)];
 }
 throw Error('未知案例類型 '+c.kind);
}
// main-low / main-high ask the native acquisition for the endpoint itself; anything the game does not give is injected and labelled.
const mainEndpoint=c=>c.kind==='coefficient'&&c.endpoint.startsWith('main')?O.mainRange(c.from)[c.endpoint==='main-low'?0:1]:undefined;
const needKey=r=>r.type==='refine'?`refine:${r.t}:${r.o}:${r.q}:${r.slot}`:'gen:'+sk(r);

// ---- scenario building ----------------------------------------------------------------------------------------------------
const piece=(rec,state,level,templateSlot)=>{const r=rec.slice();r[6]=level;r[7]=stateOf(state).owner;return {record:r,slot:templateSlot};};
const slotOfTemplate=(k,t)=>k.setEquipmentLevel.items[t].slot;
function setSlot(rec,s,id,coef,flag){if(id!==undefined)rec[8+s]=id;if(coef!==undefined)rec[14+s]=coef;if(flag!==undefined)rec[27+s]=flag;}

function build(c,k,supply){
 const get=r=>{const v=supply.get(needKey(r));assert.ok(v,'缺少原生起點 '+needKey(r));return v;};
 const gen=r=>{const rec=get(r).slice();assert.ok(rec[1]===r.t&&rec[5]===r.q&&rec[27]===r.o&&rec[23]===(r.p??3),'原生起點與要求不符 '+needKey(r));return rec;},injected=[];
 const sc={id:c.id,kind:c.kind,group:c.group,state:c.state,...stateOf(c.state??'stored'),injected,pieces:[],target:c.to,tails:[],confirm:false,character:false,refine:null,cap:null,move:true,notes:[]};
 if(c.kind==='reject')return buildReject(c,k,sc,get,gen);
 const t=c.templateId;
 if(c.kind==='effect'){
  const members=k.setEquipmentLevel.sets[c.setId].members.slice(0,c.parts);
  sc.pieces=members.map((id,i)=>piece(gen({type:'generate',t:id,o:levelOrigin(k,id),q:c.from,p:c.score==='mixed'?i+1:3}),'equipped',effectLevel,slotOfTemplate(k,id)));
  sc.character=true;sc.move=false;sc.setId=c.setId;
  sc.pieces.forEach((p,i)=>{p.templateId=members[i];p.originId=levelOrigin(k,members[i]);p.tail=c.to>c.from?tailFor(k,p.templateId,p.originId,p.record,c.from,c.to):[];});
  sc.confirm=c.to<c.from;return finish(c,k,sc);
 }
 const o=c.kind==='base'||c.kind==='pool'?c.originId:levelOrigin(k,t),rec=gen({type:'generate',t,o,q:c.from,p:3,main:mainEndpoint(c)});
 let level=1,tail=null;
 if(c.kind==='coefficient')applyCoefficient(c,k,rec,injected);
 if(c.kind==='level-cap')level=c.level;
 if(c.kind==='pool')tail=applyPool(c,k,rec,injected,get).tail;
 const p=piece(rec,c.state,level,slotOfTemplate(k,t));p.templateId=t;p.originId=o;
 p.tail=tail??(c.to>c.from?tailFor(k,t,o,rec,c.from,c.to):[]);
 if(c.kind==='coefficient'&&c.endpoint.startsWith('tail')&&p.tail.length){const [lo,hi]=O.subRange(c.to);p.tail.forEach(x=>{x.coefficient=c.endpoint==='tail-low'?lo:hi;});}
 sc.pieces=[p];sc.confirm=c.to<c.from;
 sc.character=c.state==='equipped';
 // Native refine: first slot of the edited record; stop at the first P套-only id or after one attempt when the pool has none.
 const pools=poolsOf(k,t,o);
 if(c.kind==='base'&&c.to>=2)sc.refine={slot:1,setOnly:pools.setOnly,max:pools.setOnly.length?refineMax:1};
 if(c.kind==='level-cap'){
  const cp=O.cap(c.to);
  sc.cap={record:get({type:'generate',t,o:levelOrigin(k,t),q:c.to,p:3}).slice(),quality:c.to,levels:c.boundary==='level-1'?[1]:[cp-1,cp]};
 }
 return finish(c,k,sc);
}
function applyCoefficient(c,k,rec,injected){
 const [mlo,mhi]=O.mainRange(c.from),[slo,shi]=O.subRange(c.from),n=O.slots(c.from);
 const ep=c.endpoint;
 if(ep==='main-low'||ep==='main-high'){const want=ep==='main-low'?mlo:mhi;if(rec[8]!==want){rec[8]=want;injected.push('y8');}}
 if(ep==='sub-low'||ep==='sub-high'){for(let s=1;s<=n;s++)rec[14+s]=ep==='sub-low'?slo:shi;injected.push('subs');}
 if(ep==='sub-hundredth'){for(let s=1;s<=n;s++)rec[14+s]=s%2?slo+0.01:shi-0.01;injected.push('subs');}
}
function applyPool(c,k,rec,injected,get){
 const t=c.templateId,o=c.originId,pools=poolsOf(k,t,o),name=c.pool,up=c.direction==='up',from=c.from,n=O.slots(from);
 const cls=name.endsWith('origin-only')?'originOnly':name.endsWith('shared')?'shared':name.endsWith('set-only')?'setOnly':'originOnly';
 const tailAt=id=>[{slot:n+1,attributeId:id,coefficient:O.subRange(c.to)[0]+7.25}];
 const distinct=(preferred,count)=>{const out=[];for(const id of [...preferred,...pools.origin])if(out.length<count&&!out.includes(id))out.push(id);return out;};
 if(name==='existing-duplicate'){
  if(up){injected.push('tail-duplicate');return {tail:tailAt(rec[9])};}
  const id=pools.origin[0];for(let s=1;s<=n;s++)rec[8+s]=id;injected.push('duplicate-ids');return {tail:null};
 }
 if(name==='unselected-set-only'){
  if(up){injected.push('tail-set-only');return {tail:tailAt(pools.setOnly[0])};}
  rec[8+n]=pools.setOnly[0];injected.push('unselected-set-only-id');return {tail:null};
 }
 if(name.startsWith('unselected')){
  const chosen=distinct(pools[cls],n);for(let s=1;s<=n;s++)rec[8+s]=chosen[s-1];injected.push('ids');
  return {tail:up?tailAt(distinct(pools[cls],n+1).find(id=>!chosen.includes(id))):null};
 }
 const selected=name.startsWith('selected-tail')?(up?1:n):1;
 if(cls==='setOnly'){
  const r=get({type:'refine',t,o,q:from,slot:selected});
  for(let s=1;s<=n;s++){rec[8+s]=r[8+s];rec[14+s]=r[14+s];rec[27+s]=r[27+s];}injected.push('native-refine');
 }else{
  const id=pools[cls][0],others=distinct([...pools.originOnly,...pools.shared].filter(x=>x!==id),n);
  rec[8+selected]=id;rec[27+selected]=1;let j=0;
  for(let s=1;s<=n;s++)if(s!==selected)rec[8+s]=others.filter(x=>x!==id)[j++];
  injected.push('selected-id-and-flag');
 }
 return {tail:up?tailAt(distinct(pools.origin,n+1).find(id=>!rec.slice(9,9+n).includes(id))):null};
}

// Rejection cases: start from a legal Q3 (up) / Q4 (down) row, make exactly one illegal thing, expect the candidate to refuse and change nothing.
function buildReject(c,k,sc,get,gen){
 const up=c.direction==='up',from=up?3:4,to=up?4:3,t=28,o=levelOrigin(k,t),rec=gen({type:'generate',t,o,q:from,p:3}),pools=poolsOf(k,t,o),n=O.slots(from);
 const plane=c.group.startsWith('backpack')?7:9,state=plane===7?'backpack':c.rejection==='bad-pointer'?'equipped':'stored';
 const p=piece(rec,state,1,slotOfTemplate(k,t));p.templateId=t;p.originId=o;
 Object.assign(sc,{state,...stateOf(state),pieces:[p],target:to,tails:[],move:false,rejection:c.rejection,confirm:!up});
 const tail=up?tailFor(k,t,o,rec,from,to):[];p.tail=tail;sc.options={};
 const r=p.record;
 switch(c.rejection){
  case 'q0':sc.options.quality=0;break;case 'q7':sc.options.quality=7;break;case 'fraction':sc.options.quality=to+0.5;break;
  case 'wrong-plane':sc.options.plane=8;break;
  case 'wrong-kind':r[1]=Number(Object.values(k.catalogs.items).find(v=>v.kind==='普通'&&v.category==='裝備').id);break;
  case 'missing-metadata':r[27]=0;break;
  case 'bad-pointer':if(plane===7)r[7]=1;else sc.options.clearPointer=true;break;
  case 'duplicate-reference':if(plane===7)r[7]=1;else{sc.options.duplicatePointer=true;r[7]=1;}break;
  case 'multi-flag':r[28]=1;r[29]=1;break;
  case 'tail-data-outside-slots':setSlot(r,n+1,pools.origin[0],40,0);break;
  case 'pool-outside-id':setSlot(r,1,999999);break;
  case 'unselected-set-pool-id':setSlot(r,1,pools.setOnly[0],undefined,0);break;
  case 'special-main-coefficient':r[8]=9999;break;
  case 'new-duplicate':p.tail=[{slot:n+1,attributeId:r[9],coefficient:O.subRange(to)[0]+7.25}];break;
  case 'remove-selected':r[8+n]=pools.setOnly[0]??r[8+n];r[27+n]=1;break;
  case 'downgrade-over-cap':r[6]=O.cap(to)+1;break;
  case 'permission-bypass-coordinate':case 'permission-bypass-legacy-set':case 'permission-bypass-batch':case 'atomic-rollback':break;
  case 'stale-proof':case 'incomplete-proof':sc.pieces=[];sc.contractOnly=true;break;
  default:throw Error('未知拒絕案例 '+c.rejection);
 }
 sc.expect='reject';return sc;
}

// Fill in offline expectations from the oracles. Applied (non-reject) scenarios get `after` rows, character effects and shape checks.
function finish(c,k,sc){
 const rules=k.setEquipmentQuality,level=k.setEquipmentLevel;
 sc.after=[];sc.oracleReject=[];
 sc.pieces.forEach((p,i)=>{
  const tail=(p.tail||[]).map(x=>({id:x.attributeId,coefficient:x.coefficient}));
  const a7=O.transition(p.record,c.to,{tail},rules,level);
  if(!a7.ok){sc.oracleReject.push(a7.reason);return;}
  let a8;try{a8=E.transition(p.record,c.to,{added:p.tail||[],confirmRemoved:c.to<c.from});}catch(e){sc.oracleReject.push('A8: '+e.message);return;}
  assert.deepEqual(a7.record,a8,'A7 與 A8 oracle 不一致 '+c.id);E.assertQualityOnly(p.record,a8,c.to);O.assertPreserved(p.record,a7.record);sc.after[i]=a7.record;
 });
 sc.expect=sc.oracleReject.length?'reject':'apply';
 if(sc.expect==='apply')assert.equal(sc.after.filter(Boolean).length,sc.pieces.length,'部分部位被拒絕 '+c.id);
 return sc;
}

// ---- offline candidate-core run, compared with the oracle -----------------------------------------------------------------
function runCore(C,m,sc){
 place(m,sc.pieces,sc.plane);const before=sc.pieces.map((_,i)=>rowAt(C,m,i+1,sc.plane)),errors=[];
 if(sc.kind==='reject'&&sc.rejection&&!['stale-proof','incomplete-proof'].includes(sc.rejection))return runReject(C,m,sc,before);
 sc.pieces.forEach((p,i)=>{
  try{C.applySetEquipmentQualityCandidate(m,{itemId:i+1,plane:sc.plane,quality:sc.target,addedAffixes:asTail(p.tail||[]),confirmRemovedAffixes:sc.confirm});}
  catch(e){errors.push(e.message);}
 });
 const after=sc.pieces.map((_,i)=>rowAt(C,m,i+1,sc.plane));
 if(sc.expect==='apply'){
  assert.equal(errors.length,0,'核心拒絕了 oracle 允許的案例：'+errors[0]);
  sc.after.forEach((r,i)=>assert.deepEqual(after[i],r,'核心結果與 oracle 不一致 piece '+i));
 }else{
  assert.ok(errors.length>0,'核心接受了 oracle 拒絕的案例：'+sc.oracleReject[0]);
  sc.pieces.forEach((_,i)=>assert.deepEqual(after[i],before[i],'拒絕後存檔被改動'));assert.equal(m.changes.size,0);
 }
 return {errors,rejected:errors.length>0};
}
function runReject(C,m,sc,before){
 const name=sc.rejection,p=sc.pieces[0],id=1,plane=sc.options.plane??sc.plane,q=sc.options.quality??sc.target;
 if(sc.options.clearPointer)m.original.data[1][15+p.slot][2]=0;
 if(sc.options.duplicatePointer){const other=p.slot%6+1;m.original.data[1][15+other][2]=1;}
 const apply=()=>C.applySetEquipmentQualityCandidate(m,{itemId:id,plane,quality:q,addedAffixes:asTail(p.tail||[]),confirmRemovedAffixes:sc.confirm});
 const unchanged=()=>{assert.deepEqual(rowAt(C,m,id,sc.plane),before[0],'拒絕後列被改動');assert.equal(m.changes.size,0,'拒絕後留有變更');assert.equal(m.history.length,0);};
 const expectThrow=(fn,re)=>{let error=null;try{fn();}catch(e){error=e;}assert.ok(error,'應拒絕但成功：'+name);if(re)assert.match(error.message,re);return error.message;};
 let message;
 switch(name){
  case 'permission-bypass-coordinate':{
   const msgs=[];for(const api of ['set','setField'])for(const y of [5,8,9,15,28])msgs.push(expectThrow(()=>C[api](m,{x:id,y,z:sc.plane},1),/唯讀/));message=msgs[0];unchanged();break;
  }
  case 'permission-bypass-legacy-set':
   message=expectThrow(()=>C.setEquipmentQuality(m,{itemId:id,plane:sc.plane,quality:q}),/./);unchanged();break;
  case 'permission-bypass-batch':{
   // previewBatch is async: the refusal arrives as a rejected promise, so the caller awaits `pending` before counting the case.
   const pending=C.previewBatch(m,{kind:'equipmentMax',plane:sc.plane,quality:q}).then(()=>{throw Error('批次應拒絕品質參數');},e=>{assert.match(e.message,/批次只接受/,'批次應拒絕品質參數');unchanged();return e.message;});
   return {errors:[],rejected:true,pending};
  }
  case 'atomic-rollback':{
   const text=C.serialize(m);message=expectThrow(()=>C.transaction(m,()=>{
    C.applySetEquipmentQualityCandidate(m,{itemId:id,plane:sc.plane,quality:q,addedAffixes:asTail(p.tail||[]),confirmRemovedAffixes:sc.confirm});throw Error('外層失敗');
   },'外層'),/外層失敗/);assert.equal(C.serialize(m),text,'外層失敗未整筆回滾');unchanged();break;
  }
  default:message=expectThrow(apply);unchanged();
 }
 return {errors:[message],rejected:true};
}
// Contract-only rejections (no game involved): a stale or incomplete first-proof record is refused by the A10 contract.
function runContract(c,k,source){
 const group=c.group;
 if(c.rejection==='incomplete-proof'){const bad=P.initialProblem({group},group);assert.ok(bad,'不完整紀錄應被拒絕');return {message:bad};}
 const hex=ch=>ch.repeat(64),record={group,coverage:'initial-matrix',fingerprints:Object.fromEntries(Array.from({length:15},(_,i)=>['f'+i,hex('a')])),coreHashAlgorithm:require('./core-source-proof.cjs').algorithm,
  denominator:{executable:1},executed:1,passed:1,nativeCompared:1,failed:0,unknown:0,io:{rounds:2,newPidReadback:true,shiftedColumns:50,tailColumns:10},ui:Object.fromEntries(P.uiKeys.map(x=>[x,true]))};
 for(const key of ['coreHash','dataHash','levelDataHash','manifestHash','bindingHash','evidenceHash','caseIdsHash','baselineHash','runtimeHash','sourceManifestHash','runtimeManifestHash','dataScriptHash','transactionOracleHash','effectOracleHash','scenarioHash'])record[key]=hex('b');
 const bad=P.recordProblem(record,group,k,source);assert.ok(bad&&/過期|不符/.test(bad),'過期紀錄應被拒絕：'+bad);return {message:bad};
}

// ---- native driver (runs inside the disposable game; calls original functions only) -----------------------------------------
async function matrixDriver(request){
 const runtime=self.__banditValidationRuntime,manager=runtime.GetEventSheetManager();
 const table=n=>runtime.GetObjectClassByName(n).GetInstances()[0].GetSdkInstance(),a=table('save'),wp=table('wp');
 const call=(name,...args)=>{const f=manager.GetFunctionBlockByName(name);if(!f)throw Error('Missing native function '+name);const b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};
 const setGlobal=(sid,value)=>manager.GetEventVariableBySID(sid).SetValue(value);
 const read=(id,z)=>Array.from({length:60},(_,y)=>a.At(id,y,z)),put=(id,z,row)=>row.forEach((v,y)=>a.Set(id,y,z,v)),clear=(id,z)=>put(id,z,Array(60).fill(0));
 const refs=()=>Array.from({length:6},(_,i)=>a.At(1,16+i,2));
 const reset=()=>{for(let id=1;id<=12;id++)for(const z of [7,9,18])clear(id,z);for(let slot=1;slot<=6;slot++)a.Set(1,15+slot,2,0);a.Set(1,2,0,1e12);a.Set(3,2,0,1e9);};
 const find=(z,tid)=>{for(let x=1;x<a.GetWidth();x++)if(a.At(x,1,z)===tid&&a.At(x,0,z)>0)return x;return 0;};
 const settle=async(z,tid,ready=()=>true)=>{for(let i=0;i<300;i++){const x=find(z,tid);if(x&&ready(x))return x;await new Promise(r=>setTimeout(r,10));}throw Error('Native destination absent '+z+' refs '+JSON.stringify(refs()));};
 const single=(v,id)=>{let sum=0;for(let s=0;s<3;s++)if(wp.At(v[1],8+s,0)===id)sum+=call('装备主属性',v[6],v[3],id,v[8],wp.At(v[1],11+s,0),'主属性',0,v[5]);for(let s=1;s<=6;s++)if(v[8+s]===id)sum+=call('装备主属性',v[6],v[3],id,v[14+s],100,'副词条',0,v[5]);return sum;};
 const singles=(row,attrs)=>attrs.map(id=>[id,single(row,id)]);
 const characterValues=(attrs,tid)=>({values:attrs.map(id=>[id,call('装备属性计算',1,id,0,0,0,0,0,0,0)]),summary:[call('套装数量检测',tid,1,0,0,0,0,0,0,0,0,0),call('套装数量检测',tid,1,0,0,0,0,0,0,0,0,9),call('相同套装数',tid,1,0,0)]});
 if(request.op==='initialize'){
  for(let x=1;x<a.GetWidth();x++)for(const z of [7,9,18])clear(x,z);
  for(let x=1;x<50;x++)for(let slot=1;slot<=6;slot++)a.Set(x,15+slot,2,0);
  reset();runtime.SetTimeScale(0);return {layout:runtime.GetMainRunningLayout().GetName(),width:a.GetWidth()};
 }
 if(request.op==='generate')return request.items.map(item=>{
  reset();const origin=item.o;let bag,before,attempts=0;
  do{for(let id=1;id<=12;id++)clear(id,7);call('获得物品',true,origin,item.q,1,item.tier,item.main||95+30*(item.q-1),1,false,0,'特定装备',false,false);bag=find(7,origin);before=read(bag,7);if(++attempts>512)throw Error('Native quality rejection sampling exhausted');}while(before[5]!==item.q);
  const spirit=call('合成灵物编号',item.t);if(!spirit)throw Error('Native recipe spirit missing '+item.t);
  call('获得灵物',true,spirit,item.p||3,1,false,0,0,0,0,0,0,false);
  const spiritRow=find(18,spirit),material=read(spiritRow,18);
  setGlobal(551767285314451,bag);setGlobal(990563423582099,spiritRow);setGlobal(158219813858328,7);
  call('套装合成',item.t);const after=read(bag,7);if(after[1]!==item.t)throw Error('Native conversion did not occur '+item.t);
  return {key:item.key,before,material,after,attempts};
 });
 if(request.op==='refine')return request.items.map(item=>{
  reset();put(1,7,item.record);const attempts=[];let hit=false;
  while(attempts.length<item.max){const souls=a.At(3,2,0);call('词条洗练',1,item.slot,7);const row=read(1,7);attempts.push({row,soulCost:souls-a.At(3,2,0)});if(item.setOnly.includes(row[8+item.slot])){hit=true;break;}}
  return {key:item.key,hit,attempts};
 });
 if(request.op==='cases'){
  const out=[];
  for(const item of request.items){
   reset();const z=item.plane,r={id:item.id};
   const load=rows=>{reset();rows.forEach((row,i)=>{put(i+1,z,row);if(row[7])a.Set(1,15+item.slots[i],2,i+1);});};
   load(item.before);r.loaded=item.before.map((_,i)=>read(i+1,z));r.refs=refs();
   r.beforeSingles=item.before.map(row=>singles(row,item.attributes));
   if(item.character)r.beforeCharacter=characterValues(item.effectAttributes,item.before[0][1]);
   if(item.after){
    item.after.forEach((row,i)=>put(i+1,z,row));
    r.edited=item.after.map((_,i)=>read(i+1,z));r.afterSingles=item.after.map(row=>singles(row,item.attributes));
    if(item.character)r.afterCharacter=characterValues(item.effectAttributes,item.after[0][1]);
    if(item.refine){
     const s=item.refine.slot,row0=item.after[0],withoutSlot=row=>{const w=row.slice();w[8+s]=0;w[14+s]=0;w[27+s]=0;return w;};
     put(1,z,row0);const attempts=[];let hit=false;
     while(attempts.length<item.refine.max){const souls=a.At(3,2,0);call('词条洗练',1,s,z);const row=read(1,z);attempts.push({row,soulCost:souls-a.At(3,2,0)});if(item.refine.setOnly.includes(row[8+s])){hit=true;break;}}
     const fin=attempts.at(-1).row;r.refine={slot:s,hit,attempts,withoutBefore:singles(withoutSlot(row0),item.attributes),refinedSingles:singles(fin,item.attributes),withoutAfter:singles(withoutSlot(fin),item.attributes)};
     put(1,z,row0);
    }
    if(item.move){
     const row=item.after[0],tid=row[1];
     if(item.state==='backpack'){call('装备库存入',1,true,0);const x=await settle(9,tid);r.move={to:9,id:x,record:read(x,9),source:read(1,7),refs:refs()};}
     else if(item.state==='stored'){call('装备库取出',1,true,0);const x=await settle(7,tid);r.move={to:7,id:x,record:read(x,7),source:read(1,9),refs:refs()};}
     else{call('卸下装备',item.slots[0],1,1,false,false);const x=await settle(7,tid,id=>a.At(1,15+item.slots[0],2)===0&&a.At(id,7,7)===0);r.move={to:7,id:x,record:read(x,7),source:read(1,9),refs:refs()};}
    }
   }
   if(item.cap){
    r.cap=item.cap.levels.map(level=>{reset();const row=item.cap.record.slice();row[6]=level;row[7]=0;put(1,9,row);a.Set(1,2,0,1e12);a.Set(3,2,0,999);call('升级装备',1,0,0,true);return {level,after:read(1,9)[6]};});
   }
   out.push(r);
  }
  return out;
 }
 throw Error('Unknown quality matrix request '+request.op);
}

// ---- validation of one native observation ---------------------------------------------------------------------------------
const rowsEqual=(x,y,label)=>assert.deepEqual(x,y,label);
function checkSingles(native,record,rules,label){
 const expect=L.itemEffects(record,rules);
 for(const [id,v] of native)assert.ok(almost(v,expect[id]||0),`${label} 屬性 ${id}：原生 ${v} 與 oracle ${expect[id]||0} 不符`);
}
function checkCharacter(native,rows,rules,label){
 const e=L.characterEffects(rows,rules),setId=rules.items[rows[0][1]].setLink,summary=e.summaries[setId];
 assert.deepEqual(native.summary,[summary.parts,summary.score,summary.count],label+' 套裝摘要');
 for(const [id,v] of native.values)assert.ok(almost(v,(e.singles[id]||0)+(e.sets[id]||0)),`${label} 角色屬性 ${id}：原生 ${v} 與 oracle ${(e.singles[id]||0)+(e.sets[id]||0)} 不符`);
}
// Throws on the first native/oracle mismatch. `refutation` marks mismatches that would overturn the spec or an oracle.
class Refutation extends Error{}
function validate(C,m,k,sc,obs){
 const rules=k.setEquipmentLevel,ex=(cond,msg)=>{if(!cond)throw new Refutation(msg);};
 const ok=(fn)=>{try{fn();}catch(e){throw e instanceof Refutation?e:new Refutation(e.message);}};
 const before=sc.pieces.map(p=>p.record);
 ok(()=>rowsEqual(obs.loaded,before,'載入後與起點不符'));
 ok(()=>obs.beforeSingles.forEach((s,i)=>checkSingles(s,before[i],rules,'編輯前')));
 if(obs.beforeCharacter)ok(()=>checkCharacter(obs.beforeCharacter,before,rules,'編輯前'));
 const summary={outcome:sc.expect,startNative:true};
 if(sc.expect==='apply'){
  ok(()=>rowsEqual(obs.edited,sc.after,'原生讀回與 oracle 結果不符'));
  ok(()=>obs.afterSingles.forEach((s,i)=>checkSingles(s,sc.after[i],rules,'編輯後')));
  if(obs.afterCharacter){
   ok(()=>checkCharacter(obs.afterCharacter,sc.after,rules,'編輯後'));
   ok(()=>E.assertSetInvariant(before,sc.after,rules,sc.setId??rules.items[before[0][1]].setLink));
  }
  // Removed slots: an attribute the oracle says disappeared must be exactly 0 in the native total.
  const change=E.effectChange(before[0],sc.after[0],rules);
  for(const [id,v] of obs.afterSingles[0])if(change[id]?.removed)ex(v===0,`移除槽的舊效果 ${id} 仍在原生總和：${v}`);
  if(sc.refine&&obs.refine){
   const r=obs.refine,s=sc.refine.slot,pools=poolsOfRecord(k,sc.after[0]);let prev=sc.after[0];
   ex(r.attempts.length>0,'沒有洗練結果');
   r.attempts.forEach((a,i)=>{
    for(let y=0;y<60;y++)if(![O.col.id(s),O.col.coef(s),O.col.flag(s)].includes(y))ex(a.row[y]===prev[y],`第 ${i+1} 次洗練改變欄 ${y}`);
    ex(pools.set.includes(a.row[O.col.id(s)]),`第 ${i+1} 次洗練結果不在 P套`);
    const [lo,hi]=O.subRange(sc.target);ex(a.row[O.col.coef(s)]>=lo&&a.row[O.col.coef(s)]<=hi,`第 ${i+1} 次洗練係數超出區間`);
    ex(a.row[O.col.flag(s)]===1,`第 ${i+1} 次洗練旗標`);ex(a.soulCost>0,`第 ${i+1} 次無魂魄成本`);prev=a.row;
   });
   const fin=r.attempts.at(-1).row;ok(()=>checkSingles(r.refinedSingles,fin,rules,'洗練後'));
   const w=(row)=>{const x=row.slice();x[8+s]=0;x[14+s]=0;x[27+s]=0;return x;};
   ok(()=>checkSingles(r.withoutBefore,w(sc.after[0]),rules,'洗練前去槽'));ok(()=>checkSingles(r.withoutAfter,w(fin),rules,'洗練後去槽'));
   // Old slot gone: everything outside the replaced slot is unchanged, natively.
   ex(JSON.stringify(r.withoutBefore)===JSON.stringify(r.withoutAfter),'洗練後其他槽的原生效果改變');
   // The refined record is a legal start again: A7 source check, candidate info and one transition through the preview must agree.
   const problem=O.sourceProblem(fin,k.setEquipmentQuality,rules);ex(problem===null,'洗練後 oracle 判定不合格：'+problem);
   place(m,[{record:fin.map((v,y)=>y===7?0:v),slot:0}],sc.plane);
   const info=C.setEquipmentQualityCandidateInfo(m,{itemId:1,plane:sc.plane});ex(info.selectedSlot===s&&['set','both'].includes(info.slots[s-1].source),'洗練後資格 API 不接受');
   const target=[sc.pieces[0].record[5],Math.min(6,sc.target+1),sc.target-1].find(q=>q>=1&&q!==sc.target&&O.slots(q)>=s);
   if(target){
    const tail=target>sc.target?tailFor(k,sc.pieces[0].templateId,sc.pieces[0].originId,fin,sc.target,target):[];
    const preview=C.previewSetEquipmentQualityCandidate(m,{itemId:1,plane:sc.plane,quality:target,addedAffixes:asTail(tail)});
    const a7=O.transition(fin.map((v,y)=>y===7?0:v),target,{tail:tail.map(x=>({id:x.attributeId,coefficient:x.coefficient}))},k.setEquipmentQuality,rules);
    ex(a7.ok,'洗練後 oracle 拒絕轉換 '+a7.reason);
    const next=fin.map((v,y)=>y===7?0:v);for(const c of preview.changes)next[c.coordinate.y]=c.after;
    ex(JSON.stringify(next)===JSON.stringify(a7.record),'洗練後預覽與 oracle 不一致');
    summary.refinedTransition=target;
   }
   summary.refine={attempts:r.attempts.length,hit:r.hit,soulCostPerAttempt:r.attempts[0].soulCost};
  }
  if(obs.move){
   const mv=obs.move,src=sc.after[0];
   ex(mv.to===(sc.state==='backpack'?9:7),'搬移目的庫別');
   for(let y=0;y<50;y++)if(y!==7)ex(mv.record[y]===src[y],`搬移欄位 y${y}：${mv.record[y]} ≠ ${src[y]}`);
   ex(mv.record[7]===0,'搬移後 owner');
   if(sc.state==='equipped')ex(mv.refs[sc.pieces[0].slot-1]===0,'卸下後角色指標未清除');
   const cleared=mv.source.slice(0,50).every(v=>v===0);if(sc.state!=='backpack')ex(cleared,'搬移後來源 y0–49 未清除');
   summary.move={to:mv.to,sourceCleared:cleared};
  }
 }else{
  ok(()=>rowsEqual(obs.loaded,before,'拒絕案例的起點讀回'));
 }
 if(obs.cap&&sc.cap){
  const cp=O.cap(sc.cap.quality);
  for(const c of obs.cap)ex(c.after===Math.min(c.level+1,cp),`原生等級上限：Q${sc.cap.quality} L${c.level} → ${c.after}，預期 ${Math.min(c.level+1,cp)}`);
  summary.cap=obs.cap.map(c=>[c.level,c.after]);
 }
 return summary;
}
function poolsOfRecord(k,rec){return {origin:k.setEquipmentLevel.origins[rec[27]].affixIds,set:k.setEquipmentQuality.pools[rec[1]].affixIds};}

// ---- request building -------------------------------------------------------------------------------------------------------
function nativeItem(sc,k){
 return {id:sc.id,plane:sc.plane,state:sc.state,slots:sc.pieces.map(p=>p.slot),before:sc.pieces.map(p=>p.record),after:sc.expect==='apply'?sc.after:null,
  attributes:attributesOf(k),effectAttributes:effectAttributesOf(k),character:sc.character,refine:sc.refine,move:sc.move&&sc.expect==='apply',cap:sc.cap};
}
// Case fields the observation keeps so a reviewer can retrace the case without the raw rows.
function observation(sc,summary){return {...summary,state:sc.state,plane:sc.plane,injected:sc.injected,kind:sc.kind,target:sc.target,hashes:{start:hash(sc.pieces.map(p=>p.record)),after:sc.after?hash(sc.after):null}};}

// ---- checkpoint / results store -------------------------------------------------------------------------------------------
// A checkpoint binds the exact manifest/selection (A9) plus the tools that produce results; any difference refuses to resume.
const codeHash=file=>hash(fs.readFileSync(path.join(__dirname,file),'utf8').replace(/\r\n/g,'\n'));
function toolBinding(core){return {matrixHash:codeHash('set-equipment-quality-matrix.cjs'),runnerHash:codeHash('verify-set-equipment-quality.cjs'),driverHash:hash(matrixDriver.toString()),coreHash:hash(core.replace(/\r\n/g,'\n')),
 transactionOracleHash:codeHash('set-equipment-quality-oracle.cjs'),effectOracleHash:codeHash('set-equipment-quality-effects-oracle.cjs'),levelOracleHash:codeHash('set-equipment-level-oracle.cjs'),scenarioHash:codeHash('set-equipment-quality-scenarios.cjs')};}
function makeCheckpoint(manifest,selection,tools){return {...M.checkpoint(manifest,selection),tools,toolsHash:hash(tools)};}
function validateResumable(manifest,cp,tools){
 M.validateCheckpoint(manifest,cp);assert.equal(cp.toolsHash,hash(tools),'checkpoint 的工具摘要與目前不符（程式、核心或 oracle 已改）');assert.deepEqual(cp.tools,tools);return true;
}
// A stored result line must still match the live manifest case; anything else is refused instead of skipped.
function validateResultLine(manifest,line){
 const c=manifest.cases.find(v=>v.id===line.id);assert.ok(c,'結果含未知案例 '+line.id);assert.equal(line.caseHash,hash(c),'結果的案例摘要過期 '+line.id);
 assert.ok(['passed','failed','miss'].includes(line.status),'非法狀態');assert.equal(line.passed,line.status==='passed');return c;
}
function progressOf(manifest,lines,selected){
 const done=new Map(lines.map(l=>[l.id,l]));let passed=0,failed=0,miss=0;
 for(const l of done.values()){if(l.status==='passed')passed++;else if(l.status==='failed')failed++;else miss++;}
 return {total:selected.length,completed:selected.filter(c=>done.has(c.id)).length,passed,failed,miss,unknown:selected.filter(c=>!done.has(c.id)).length};
}
module.exports={matrixKinds,effectLevel,refineMax,stateOf,sk,almost,levelOrigin,poolsOf,attributesOf,effectAttributesOf,candidateCore,sandbox,place,rowAt,tailFor,needs,needKey,build,finish,runCore,runContract,matrixDriver,validate,Refutation,nativeItem,observation,toolBinding,makeCheckpoint,validateResumable,validateResultLine,progressOf};
