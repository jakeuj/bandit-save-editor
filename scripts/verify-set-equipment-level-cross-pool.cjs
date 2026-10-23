#!/usr/bin/env node
'use strict';
// B6: cross-pool supplement for the two existing set-level groups (z7 backpackSetEquipmentLevel, z9 setEquipmentLevel).
// The A9 manifest lists 8 `level-regression` cases per plane. Every case starts from a native-derived row (level-B native acquisition +
// native same-slot refine until a P套-only id sits in the selected slot) and is checked offline against the oracles, then in the isolated game:
//   refined-set-only-id   native refine witness on that plane; candidate level eligibility accepts, the formal entry refuses
//   level-up / level-down candidate y6 edit; native readback, single-item effects, native 升级装备 between the endpoints (cost, no souls)
//   at-cap                cap(Q) accepted, cap+1 / 0 / fraction refused; native 升级装备 stops at the cap
//   wear-effect           character effects and set summary (worn z9 row, or a z7 row equipped natively)
//   io-two-rounds         edited bytes → read back → save → new PID; refine → move cycle → sort → save → new PID (B2 playCopy)
//   quality-level-quality-undo  Q up → level → (Q down refused over cap) → level → Q down, undo step by step; bytes + new PID, native refine
//   accumulated-restore   level/quality mix, restore one token → whole item back, restoreAll; bytes + new PID
// The level candidate is an isolated VM copy of core whose set-level eligibility also accepts the selected slot in P套 (the shared candidate
// policy); the shipped src/core.js is never modified and its formal entry must keep refusing. Results use the A10 per-case shape.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict');
const O=require('./set-equipment-quality-oracle.cjs'),E=require('./set-equipment-quality-effects-oracle.cjs'),L=require('./set-equipment-level-oracle.cjs'),
 M=require('./set-equipment-quality-scenarios.cjs'),Q=require('./set-equipment-quality-data.cjs'),X=require('./set-equipment-quality-matrix.cjs');
const {hash}=Q,sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const names=['refined-set-only-id','level-up','level-down','at-cap','wear-effect','io-two-rounds','quality-level-quality-undo','accumulated-restore'];
const planes={z7:{plane:7,group:'backpackSetEquipmentLevel',state:'backpack',tier:1},z9:{plane:9,group:'setEquipmentLevel',state:'stored',tier:9}};
const startQuality=3,refineMax=400;
const filler=Object.fromEntries(['baselineHash','runtimeHash','sourceManifestHash','runtimeManifestHash'].map(n=>[n,'0'.repeat(64)]));

// ---- isolated cores ---------------------------------------------------------------------------------------------------------
// Formal = shipped source and knowledge. Candidate = quality gates open in a knowledge copy, plus the set-level slot check widened to the
// shared candidate policy (selected slot may hold a P套 id). The patch must hit exactly one place or nothing runs.
const formalSlotCheck="if(slot<quality){if(!origin.affixIds.includes(id)||";
const candidateSlotCheck="if(slot<quality){if(!(origin.affixIds.includes(id)||flag===1&&KNOWLEDGE.setEquipmentQuality.pools[record[1]].affixIds.includes(id))||";
function candidateLevelSource(source){
 const parts=source.split(formalSlotCheck);assert.equal(parts.length,2,'套裝等級槽檢查不是唯一一處，候選政策無法隔離套用');return parts.join(candidateSlotCheck);
}
function loadCore(source,knowledge){const ctx={};vm.runInNewContext(source.replace('/*__KNOWLEDGE__*/null',JSON.stringify(knowledge)),ctx);return ctx.SaveCore;}
function cores(k,source){
 const candidate=structuredClone(k);for(const g of Q.groups)candidate.verification[g]=true;
 return {C:loadCore(candidateLevelSource(source),candidate),F:loadCore(source,k)};
}

// ---- planning ---------------------------------------------------------------------------------------------------------------
const poolsOf=(k,t,o)=>X.poolsOf(k,t,o);
// One native level-B baseline per plane: Q3, points 3, tier 1 (z7) / 9 (z9), the largest P套-only share, and enough P原 ids for a Q5 tail.
function pickBaseline(k,levelResults,tier){
 const items=k.setEquipmentLevel.items,ok=levelResults.filter(v=>v.quality===startQuality&&v.after[23]===3&&items[v.templateId].tier===tier).map(v=>({v,p:poolsOf(k,v.templateId,v.origin)}))
  .filter(({p})=>p.setOnly.length&&p.origin.length>=O.slots(5)+1);
 assert.ok(ok.length,'缺 T'+tier+' Q3 跨池基準');
 ok.sort((a,b)=>b.p.setOnly.length/b.p.set.length-a.p.setOnly.length/a.p.set.length||a.v.templateId-b.v.templateId);return ok[0].v;
}
function plan(k,levelResults,manifest){
 const cases=manifest.cases.filter(c=>c.kind==='level-regression');assert.equal(cases.length,16,'等級回歸應為 16 案');
 const out={};
 for(const [key,p] of Object.entries(planes)){
  const base=pickBaseline(k,levelResults,p.tier),record=base.after.slice();assert.equal(record[6],1);assert.equal(record[7],0);
  out[key]={...p,key,templateId:base.templateId,originId:base.origin,slot:k.setEquipmentLevel.items[base.templateId].slot,baseline:record,baselineHash:hash(base),
   cases:names.map(name=>{const c=cases.find(v=>v.plane===key&&v.regression===name);assert.ok(c&&c.group===p.group,'缺案例 '+key+' '+name);return c;})};
 }
 return out;
}

// ---- offline helpers (candidate core vs oracles) ----------------------------------------------------------------------------
const levelTo=(row,level)=>row.map((v,y)=>y===6?level:v);
const owned=(row,owner)=>row.map((v,y)=>y===7?owner:v);
function placed(C,record,plane,slot){const m=X.sandbox(C);X.place(m,[{record,slot}],plane);return m;}
const rowOf=(C,m,plane)=>X.rowAt(C,m,1,plane);
const throws=(fn,re)=>{let e=null;try{fn();}catch(x){e=x;}assert.ok(e,'應拒絕但成功');if(re)assert.match(e.message,re);return e.message;};
// Formal entries (shipped core, level flags as shipped) refuse the cross-pool row and leave nothing behind.
function formalRefuses(F,record,plane,slot){
 const m=placed(F,record,plane,slot),before=rowOf(F,m,plane),msgs=[];
 msgs.push(throws(()=>F.setEquipmentLevelInfo(m,{itemId:1,plane}),/套裝等級/));
 msgs.push(throws(()=>F.editingInfo(m,'equipment',1,plane)));
 msgs.push(throws(()=>F.setEquipmentLevel(m,{itemId:1,plane,level:Math.min(record[6]+1,O.cap(record[5]))})));
 for(const api of ['set','setField'])msgs.push(throws(()=>F[api](m,{x:1,y:6,z:plane},2)));
 assert.deepEqual(rowOf(F,m,plane),before,'正式入口拒絕後列被改動');assert.equal(m.changes.size,0,'正式入口拒絕後留有變更');return msgs;
}
// Candidate level edit: only y6 changes, one token, and the quality candidate eligibility still accepts the row.
function levelEdit(C,m,plane,level){
 const before=rowOf(C,m,plane),size=m.changes.size;C.setEquipmentLevel(m,{itemId:1,plane,level});const after=rowOf(C,m,plane);
 L.assertLevelOnly(before,after,level);assert.ok(m.changes.size<=size+1);
 const info=C.setEquipmentQualityCandidateInfo(m,{itemId:1,plane});assert.equal(info.level,level);return after;
}
function qualityEdit(k,C,m,plane,to,tail){
 const before=rowOf(C,m,plane),a7=O.transition(owned(before,0),to,{tail:tail.map(t=>({id:t.attributeId,coefficient:t.coefficient}))},k.setEquipmentQuality,k.setEquipmentLevel);
 assert.ok(a7.ok,'A7 oracle 拒絕：'+a7.reason);const a8=E.transition(before,to,{added:tail,confirmRemoved:to<before[5]});
 assert.deepEqual(owned(a7.record,before[7]),a8,'A7 與 A8 oracle 不一致');
 C.applySetEquipmentQualityCandidate(m,{itemId:1,plane,quality:to,addedAffixes:tail,confirmRemovedAffixes:to<before[5]});
 const after=rowOf(C,m,plane);assert.deepEqual(after,a8,'核心品質交易與 oracle 不一致');return after;
}
function tailOf(k,row,to){const t=row[1],o=row[27];return X.tailFor(k,t,o,row,row[5],to).map(x=>({slot:x.slot,attributeId:x.attributeId,coefficient:x.coefficient}));}
// Sequence offline on a sandbox: each step is checked against the oracles; the returned states are what the game must read back.
function undoSequence(k,C,F,start,plane,slot){
 const m=placed(C,start,plane,slot),states=[rowOf(C,m,plane)],steps=[];
 states.push(qualityEdit(k,C,m,plane,4,tailOf(k,states[0],4)));steps.push('Q3→Q4');
 states.push(levelEdit(C,m,plane,O.cap(3)+2));steps.push('L→'+(O.cap(3)+2));
 // Quality down while the level is above the lower cap: both oracles and the candidate refuse; nothing changes.
 const atRefuse=rowOf(C,m,plane),history=m.history.length;
 assert.throws(()=>E.transition(atRefuse,3,{confirmRemoved:true}),/上限/);
 const refused=throws(()=>C.applySetEquipmentQualityCandidate(m,{itemId:1,plane,quality:3,confirmRemovedAffixes:true}));
 assert.deepEqual(rowOf(C,m,plane),atRefuse);assert.equal(m.history.length,history);
 states.push(levelEdit(C,m,plane,O.cap(3)-2));steps.push('L→'+(O.cap(3)-2));
 states.push(qualityEdit(k,C,m,plane,3,[]));steps.push('Q4→Q3');
 assert.equal(states.at(-1)[27+1],1,'已選 P套 槽旗標應保留');
 formalRefuses(F,states.at(-1),plane,slot);
 const undone=[];for(let i=states.length-2;i>=0;i--){C.undo(m);const now=rowOf(C,m,plane);assert.deepEqual(now,states[i],'undo 未回到前一筆 '+i);undone.push(now);}
 assert.equal(m.changes.size,0,'全部 undo 後仍有變更');
 return {states,steps,refused,undone};
}
function restoreSequence(k,C,start,plane,slot){
 const run=()=>{const m=placed(C,start,plane,slot),states=[rowOf(C,m,plane)];
  states.push(levelEdit(C,m,plane,5));states.push(qualityEdit(k,C,m,plane,4,tailOf(k,states[1],4)));
  states.push(levelEdit(C,m,plane,12));states.push(qualityEdit(k,C,m,plane,5,tailOf(k,states[3],5)));return {m,states};};
 const a=run();C.restore(a.m,{x:1,y:6,z:plane});assert.deepEqual(rowOf(C,a.m,plane),start,'restore 未整件還原');assert.equal(a.m.changes.size,0);
 const b=run();C.restore(b.m,{x:1,y:5,z:plane});assert.deepEqual(rowOf(C,b.m,plane),start,'品質 token restore 未整件還原');
 const c=run();C.restoreAll(c.m);assert.deepEqual(rowOf(C,c.m,plane),start,'restoreAll 未還原');assert.equal(c.m.changes.size,0);
 return {states:a.states};
}

// ---- bytes on the fixed baseline save -----------------------------------------------------------------------------------------
const emptyRows=obj=>{for(let x=1;x<obj.size[0];x++){for(const z of [7,9,18])for(let y=0;y<60;y++)obj.data[x][y][z]=0;for(let s=1;s<=6;s++)obj.data[x][15+s][2]=0;}};
function startText(fixedText,record,plane,slot){
 const obj=JSON.parse(fixedText.replace(/^﻿/,''));emptyRows(obj);record.forEach((v,y)=>{obj.data[1][y][plane]=v;});if(record[7])obj.data[1][15+slot][2]=1;return JSON.stringify(obj);
}
const textRow=(text,plane)=>{const o=JSON.parse(text.replace(/^﻿/,''));return Array.from({length:60},(_,y)=>o.data[1][y][plane]);};
const textRefs=text=>{const o=JSON.parse(text.replace(/^﻿/,''));return Array.from({length:6},(_,s)=>o.data[1][16+s][2]);};
// The byte-level transactions of one case; each `save` is a text the isolated game must load and read back unchanged.
function byteCases(k,C,F,fixedText,start,spec,name){
 const plane=spec.plane,slot=spec.slot,text0=startText(fixedText,start,plane,slot),m=C.parse(text0),saves=[];
 const row=()=>Array.from({length:60},(_,y)=>C.get(m,{x:1,y,z:plane}));
 if(name==='io-two-rounds'){levelEdit(C,m,plane,9);saves.push({label:'edited',text:C.serialize(m)});}
 if(name==='quality-level-quality-undo'){
  qualityEdit(k,C,m,plane,4,tailOf(k,row(),4));levelEdit(C,m,plane,O.cap(3)+2);levelEdit(C,m,plane,O.cap(3)-2);qualityEdit(k,C,m,plane,3,[]);
  saves.push({label:'interleaved',text:C.serialize(m),refine:true});C.undo(m);C.undo(m);
  assert.equal(row()[5],4);assert.equal(row()[6],O.cap(3)+2);saves.push({label:'after-two-undo',text:C.serialize(m)});
 }
 if(name==='accumulated-restore'){
  levelEdit(C,m,plane,5);qualityEdit(k,C,m,plane,4,tailOf(k,row(),4));levelEdit(C,m,plane,12);qualityEdit(k,C,m,plane,5,tailOf(k,row(),5));
  saves.push({label:'accumulated',text:C.serialize(m)});C.restore(m,{x:1,y:6,z:plane});
  const restored=C.serialize(m);assert.equal(restored,text0,'restore 後 bytes 不等於起點');saves.push({label:'restored',text:restored});
 }
 for(const s of saves){s.expected=textRow(s.text,plane);s.pointers=textRefs(s.text);s.hash=hash(s.text);if(s.label!=='restored')formalRefuses(F,owned(s.expected,s.expected[7]),plane,slot);}
 return {text0,saves};
}

// ---- native driver (runs inside the disposable game; original functions only) ---------------------------------------------------
async function crossPoolDriver(request){
 const runtime=self.__banditValidationRuntime,manager=runtime.GetEventSheetManager();
 const table=n=>runtime.GetObjectClassByName(n).GetInstances()[0].GetSdkInstance(),a=table('save'),wp=table('wp');
 const call=(name,...args)=>{const f=manager.GetFunctionBlockByName(name);if(!f)throw Error('Missing native function '+name);const b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};
 const read=(id,z)=>Array.from({length:60},(_,y)=>a.At(id,y,z)),put=(id,z,row)=>row.forEach((v,y)=>a.Set(id,y,z,v)),clear=(id,z)=>put(id,z,Array(60).fill(0));
 const refs=()=>Array.from({length:6},(_,i)=>a.At(1,16+i,2)),pause=()=>new Promise(r=>setTimeout(r,500));
 const reset=()=>{for(let id=1;id<=12;id++)for(const z of [7,9,18])clear(id,z);for(let slot=1;slot<=6;slot++)a.Set(1,15+slot,2,0);a.Set(1,2,0,1e12);a.Set(3,2,0,1e9);};
 const find=(z,tid)=>{for(let x=1;x<a.GetWidth();x++)if(a.At(x,1,z)===tid&&a.At(x,0,z)>0)return x;throw Error('Native destination absent '+z+' refs '+JSON.stringify(refs()));};
 const single=(v,id)=>{let sum=0;for(let s=0;s<3;s++)if(wp.At(v[1],8+s,0)===id)sum+=call('装备主属性',v[6],v[3],id,v[8],wp.At(v[1],11+s,0),'主属性',0,v[5]);for(let s=1;s<=6;s++)if(v[8+s]===id)sum+=call('装备主属性',v[6],v[3],id,v[14+s],100,'副词条',0,v[5]);return sum;};
 const singles=row=>request.attributes.map(id=>[id,single(row,id)]);
 const character=tid=>({values:request.effectAttributes.map(id=>[id,call('装备属性计算',1,id,0,0,0,0,0,0,0)]),summary:[call('套装数量检测',tid,1,0,0,0,0,0,0,0,0,0),call('套装数量检测',tid,1,0,0,0,0,0,0,0,0,9),call('相同套装数',tid,1,0,0)]});
 const load=(row,z,slot)=>{reset();put(1,z,row);if(row[7])a.Set(1,15+slot,2,1);return read(1,z);};
 if(request.op==='initialize'){
  for(let x=1;x<a.GetWidth();x++)for(const z of [7,9,18])clear(x,z);for(let x=1;x<50;x++)for(let slot=1;slot<=6;slot++)a.Set(x,15+slot,2,0);
  reset();runtime.SetTimeScale(0);return {layout:runtime.GetMainRunningLayout().GetName(),width:a.GetWidth()};
 }
 if(request.op==='refine'){
  load(request.record,request.plane,request.slot);const attempts=[];let hit=false;
  while(attempts.length<request.max){const souls=a.At(3,2,0);call('词条洗练',1,request.refineSlot,request.plane);const row=read(1,request.plane);attempts.push({row,soulCost:souls-a.At(3,2,0)});if(request.setOnly.includes(row[8+request.refineSlot])){hit=true;break;}}
  return {hit,attempts,refs:refs()};
 }
 if(request.op==='rows')return request.items.map(item=>{
  const loaded=load(item.record,item.plane,item.slot),r={label:item.label,loaded,refs:refs(),singles:singles(loaded)};
  if(item.character)r.character=character(item.record[1]);return r;
 });
 if(request.op==='upgrade')return request.items.map(item=>{
  // 升级装备(物品序号,角色序号) acts on z9; a z7 row is first stored natively, the destination row is found by identity.
  const start=item.record.map((v,y)=>y===6?item.low:v);load(start,item.plane,item.slot);let target=1,moved=null;
  if(item.plane===7){call('装备库存入',1,true,0);target=find(9,start[1]);moved=read(target,9);}
  const copper=a.At(1,2,0),souls=a.At(3,2,0);for(let l=item.low;l<item.high;l++)call('升级装备',target,0);
  return {label:item.label,moved,upgraded:read(target,9),cost:copper-a.At(1,2,0),soulCost:souls-a.At(3,2,0),target};
 });
 if(request.op==='cap')return request.items.map(item=>{
  const row=item.record.map((v,y)=>y===6?item.level:y===7?0:v);load(row,9,item.slot);const copper=a.At(1,2,0);call('升级装备',1,0,0,true);
  return {level:item.level,after:read(1,9),cost:copper-a.At(1,2,0)};
 });
 if(request.op==='wear'){
  // z7 row equipped natively from the bag; character values while worn, then unequipped back to the bag.
  load(request.record,7,request.slot);call('穿戴装备',request.slot,1,1,false,false);await pause();const z9=a.At(1,15+request.slot,2);
  if(!z9)throw Error('Native equip did not set role pointer '+JSON.stringify(refs()));
  call('刷新单角色全属性',1,true,0);const worn=read(z9,9),source=read(1,7),values=character(request.record[1]),wornRefs=refs();
  call('卸下装备',request.slot,z9,1,false,false);await pause();const bag=find(7,request.record[1]);
  return {z9,worn,source,values,wornRefs,back:read(bag,7),backRefs:refs()};
 }
 throw Error('Unknown cross-pool request '+request.op);
}

// ---- validation of native observations ---------------------------------------------------------------------------------------
class Refutation extends Error{}
const must=(cond,msg)=>{if(!cond)throw new Refutation(msg);};
const near=(a,b)=>X.almost(a,b);
function checkSingles(native,record,rules,label){const e=L.itemEffects(record,rules);for(const [id,v] of native)must(near(v,e[id]||0),`${label} 屬性 ${id}：原生 ${v} ≠ oracle ${e[id]||0}`);}
function checkCharacter(native,rows,rules,label){
 const e=L.characterEffects(rows,rules),s=e.summaries[rules.items[rows[0][1]].setLink];
 must(JSON.stringify(native.summary)===JSON.stringify([s.parts,s.score,s.count]),label+' 套裝摘要 '+JSON.stringify(native.summary));
 for(const [id,v] of native.values)must(near(v,(e.singles[id]||0)+(e.sets[id]||0)),`${label} 角色屬性 ${id}：原生 ${v} ≠ oracle ${(e.singles[id]||0)+(e.sets[id]||0)}`);
}
function checkRefine(k,start,obs,spec){
 const pools=poolsOf(k,spec.templateId,spec.originId),[lo,hi]=O.subRange(start[5]),s=1;let prev=start;
 must(obs.attempts.length>0,'沒有洗練結果');
 obs.attempts.forEach((a,i)=>{
  for(let y=0;y<60;y++)if(![O.col.id(s),O.col.coef(s),O.col.flag(s)].includes(y))must(a.row[y]===prev[y],`第 ${i+1} 次洗練改變欄 ${y}`);
  must(pools.set.includes(a.row[O.col.id(s)]),`第 ${i+1} 次洗練結果不在 P套`);must(a.row[O.col.coef(s)]>=lo&&a.row[O.col.coef(s)]<=hi,`第 ${i+1} 次係數超出區間`);
  must(a.row[O.col.flag(s)]===1,`第 ${i+1} 次旗標`);must(a.soulCost>0,`第 ${i+1} 次無魂魄成本`);prev=a.row;
 });
 return {attempts:obs.attempts.length,hit:!!obs.hit,final:obs.attempts.at(-1).row,soulCost:obs.attempts[0].soulCost};
}
function checkUpgrade(obs,expectedHigh,startLow,plane){
 if(plane===7){for(let y=0;y<60;y++)must(obs.moved[y]===(y<50?startLow[y]:0),`存入裝備庫欄 y${y}`);}
 for(let y=0;y<60;y++)if(y!==7)must(obs.upgraded[y]===(plane===7&&y>=50?0:expectedHigh[y]),`原生升級結果欄 y${y}：${obs.upgraded[y]} ≠ ${expectedHigh[y]}`);
 let cost=0;for(let l=startLow[6];l<expectedHigh[6];l++)cost+=L.money(startLow[3],l);
 must(obs.cost===cost,`原生升級費用 ${obs.cost} ≠ ${cost}`);must(obs.soulCost===0,'升級不應花費魂魄');return {cost};
}

// ---- game sessions ---------------------------------------------------------------------------------------------------------------
function gameEnv(root){
 const index=JSON.parse(fs.readFileSync(path.join(root,'.local/game-sources.json'),'utf8')),entry=index.entries.find(e=>e.id===index.preferredDevelopmentSourceId);
 return {index,entry,fixedSave:path.join(entry.artifactsRoot,'native-cache-smoke-4IKtSE','baseline','savedir','ea3save.dat'),playerSave:path.join(index.installedGameDirectory,'savedir','ea3save.dat'),
  levelFile:path.join(entry.artifactsRoot,'set-equipment-level-B','native-baselines.json')};
}
async function openGame({env,saveFile,catalogPath,out,port,observe}){
 const {waitMain}=require('./verify-game.cjs'),LL=require('./verify-set-equipment-level-lifecycle.cjs');
 const args=['--setup','--source',env.entry.source,'--runtime',env.entry.runtime,'--save-file',saveFile,'--catalog',catalogPath,'--artifacts',out,'--port',String(port)];
 if(observe){const f=path.join(path.dirname(saveFile),'..','scenario.json');fs.writeFileSync(f,JSON.stringify({observe}));args.push('--scenario',f);}
 const setup=LL.command(args),stateFile=setup.match(/STATE (.+)/)[1].trim();LL.command(['--state',stateFile,'--load',...(observe?[]:['--mode','云存档'])]);
 const s=JSON.parse(fs.readFileSync(stateFile,'utf8'));await waitMain(s);return {stateFile,state:s};
}
function stopGame(stateFile){if(stateFile)try{require('./verify-set-equipment-level-lifecycle.cjs').command(['--state',stateFile,'--stop']);}catch{}}
function writeStart(out,label,text,saveInfo){
 const dir=path.join(out,'starts',label.replace(/[^\w-]/g,'_')),file=path.join(dir,'savedir','ea3save.dat');fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,text);if(saveInfo)fs.copyFileSync(saveInfo,path.join(path.dirname(file),'saveinfo.dat'));return file;
}
const observeCells=plane=>[...Array.from({length:60},(_,y)=>[1,y,plane]),...Array.from({length:6},(_,s)=>[1,16+s,2])];
// One byte state: load → read back equals expected → native save → stop → new PID → read back again (optionally a native refine after).
async function byteRound({env,save,spec,out,catalogPath,saveInfo,port,k,C}){
 const {evaluate}=require('./verify-game.cjs'),LL=require('./verify-set-equipment-level-lifecycle.cjs'),B2=require('./verify-set-equipment-quality-migration-lifecycle.cjs');
 const rpc=(s,r)=>evaluate(s,`(${B2.lifecycleDriver.toString()})(${JSON.stringify(r)})`);
 const file=writeStart(out,spec.key+'-'+save.case+'-'+save.label,save.text,saveInfo);let g;
 try{
  g=await openGame({env,saveFile:file,catalogPath,out,port,observe:observeCells(spec.plane)});let s=g.state;const pid0=s.pid,loc=[{id:1,plane:spec.plane}];
  const first=await rpc(s,{op:'observe',locations:loc});must(JSON.stringify(first.records[0].record)===JSON.stringify(save.expected),save.label+' 載入讀回與預期不符');
  must(JSON.stringify(first.refs)===JSON.stringify(save.pointers),save.label+' 角色指標與存檔不符');
  s=await LL.checkpoint(g.stateFile);must(s.pid!==pid0,'PID 未更新');const again=await rpc(s,{op:'observe',locations:loc});
  must(JSON.stringify(again)===JSON.stringify(first),save.label+' 新 PID 讀回不一致');
  const r={label:save.label,hash:save.hash,pids:[pid0,s.pid],readback:first.records[0].record};
  if(save.refine){
   // After the round trip: native same-slot refine, then the quality and level candidate APIs must still accept the re-read row.
   const pools=poolsOf(k,spec.templateId,spec.originId);await rpc(s,{op:'prepare',plane:spec.plane,decoys:[]});
   const ref=await rpc(s,{op:'refine',plane:spec.plane,slot:1,setOnly:pools.setOnly,max:refineMax});const chk=checkRefine(k,save.expected,ref,spec);
   const m=placed(C,chk.final,spec.plane,spec.slot),info=C.setEquipmentQualityCandidateInfo(m,{itemId:1,plane:spec.plane});
   must(info.selectedSlot===1,'洗練後候選資格不接受');const lv=C.setEquipmentLevelInfo(m,{itemId:1,plane:spec.plane});must(lv.current===chk.final[6],'洗練後候選等級資格不接受');
   levelEdit(C,m,spec.plane,Math.min(chk.final[6]+1,O.cap(chk.final[5])));
   r.refine={attempts:chk.attempts,hit:chk.hit,source:info.slots[0].source};
  }
  r.steam=JSON.parse(fs.readFileSync(path.join(s.dir,'steam-init.json'),'utf8')).initialized===true;return r;
 }finally{stopGame(g?.stateFile);}
}
// io-two-rounds: the B2 lifecycle (round 1 IO, refine, move cycle with tail markers, sort, round 2 IO) on the level-edited bytes.
async function twoRounds({env,save,spec,start,out,catalogPath,saveInfo,port,k}){
 const {evaluate}=require('./verify-game.cjs'),LL=require('./verify-set-equipment-level-lifecycle.cjs'),B2=require('./verify-set-equipment-quality-migration-lifecycle.cjs');
 const file=writeStart(out,spec.key+'-io-two-rounds',save.text,saveInfo);let g;
 const copy={id:'level-regression:'+spec.key+':io-two-rounds',plane:spec.plane,state:start[7]?'equipped':spec.state,slot:spec.slot,templateId:spec.templateId,originId:spec.originId,from:start[5],to:start[5],record:start};
 try{
  g=await openGame({env,saveFile:file,catalogPath,out,port,observe:observeCells(spec.plane)});let s=g.state;
  const report=await B2.playCopy({copy,k,start:{expected:save.expected,pointers:save.pointers},pid0:s.pid,rpc:r=>evaluate(s,`(${B2.lifecycleDriver.toString()})(${JSON.stringify(r)})`),restart:async()=>{s=await LL.checkpoint(g.stateFile);return s.pid;}});
  let summary;try{summary=B2.validateCopy(k,copy,report);}catch(e){throw new Refutation(e.message);}
  // Round 2 watches the bag row and the vacated z9 row (cleared by the unequip); only the row that holds the item carries the level.
  const held=report.rounds[1].reloaded.filter(row=>row[0]>0&&row[1]===spec.templateId);
  must(held.length===1&&held[0][6]===save.expected[6],'第二輪讀回等級改變 '+JSON.stringify(report.rounds[1].reloaded.map(row=>[row[0],row[1],row[6]])));
  return {pids:report.rounds.map(r=>r.pids),summary,refineAttempts:report.refine.attempts.length,steam:JSON.parse(fs.readFileSync(path.join(s.dir,'steam-init.json'),'utf8')).initialized===true};
 }finally{stopGame(g?.stateFile);}
}

// ---- main -------------------------------------------------------------------------------------------------------------------------
async function run({out,only,log=console.log}){
 const root=path.resolve(__dirname,'..'),env=gameEnv(root),catalogPath=path.join(root,'knowledge/catalog.json'),k=JSON.parse(fs.readFileSync(catalogPath,'utf8')),source=fs.readFileSync(path.join(root,'src/core.js'),'utf8');
 if(!path.relative(root,out).startsWith('..'))throw Error('Artifacts must stay outside the repo');fs.mkdirSync(out,{recursive:true});
 const lock=path.join(out,'.game.lock');if(fs.existsSync(lock)){const pid=Number(fs.readFileSync(lock,'utf8'));let alive=false;try{process.kill(pid,0);alive=true;}catch{}if(alive)throw Error('另一個 B6 原生執行仍在進行（PID '+pid+'）');}
 fs.writeFileSync(lock,String(process.pid));
 const B1=require('./set-equipment-quality-baseline.cjs'),sources=B1.verifySources(env.entry,k),level=JSON.parse(fs.readFileSync(env.levelFile,'utf8'));
 assert.deepEqual(level.binding.fingerprints,sources.fingerprints,'等級基準指紋不符');
 const guarded={fixedSave:sha(env.fixedSave),playerSave:sha(env.playerSave),levelBaselines:sha(env.levelFile)};
 const saveInfo=fs.existsSync(path.join(path.dirname(env.fixedSave),'saveinfo.dat'))?path.join(path.dirname(env.fixedSave),'saveinfo.dat'):null,fixedText=fs.readFileSync(env.fixedSave,'utf8');
 const manifest=M.createManifest(k,source,filler),specs=plan(k,level.results,manifest),{C,F}=cores(k,source),rules=k.setEquipmentLevel;
 const attributes=X.attributesOf(k),effectAttributes=X.effectAttributesOf(k);
 const binding={coreHash:hash(source.replace(/\r\n/g,'\n')),candidatePatch:hash(candidateSlotCheck),runnerHash:hash(fs.readFileSync(__filename,'utf8').replace(/\r\n/g,'\n')),driverHash:hash(crossPoolDriver.toString()),
  matrixHash:hash(fs.readFileSync(path.join(__dirname,'set-equipment-quality-matrix.cjs'),'utf8').replace(/\r\n/g,'\n')),lifecycleHash:hash(fs.readFileSync(path.join(__dirname,'verify-set-equipment-quality-migration-lifecycle.cjs'),'utf8').replace(/\r\n/g,'\n')),
  levelOracleHash:hash(fs.readFileSync(path.join(__dirname,'set-equipment-level-oracle.cjs'),'utf8').replace(/\r\n/g,'\n')),manifestHash:manifest.manifestHash,fingerprints:sources.fingerprints};
 const resultFile=path.join(out,'b6-results.json'),result=fs.existsSync(resultFile)?JSON.parse(fs.readFileSync(resultFile,'utf8')):{binding,starts:{},cases:[]};
 assert.deepEqual(result.binding,binding,'續跑綁定不符（程式、核心或輸入已改）');
 const save=()=>{fs.writeFileSync(resultFile+'.tmp',JSON.stringify(result));fs.renameSync(resultFile+'.tmp',resultFile);};
 const record=(c,passed,observation)=>{result.cases=result.cases.filter(v=>v.id!==c.id);result.cases.push({id:c.id,caseHash:hash(c),passed,nativeCompared:true,observation});save();log(`${c.id} ${passed?'passed':'FAILED '+observation.error}`);};
 const port=()=>19300+Math.floor(Math.random()*90);let stop=false;
 try{
  // Stage 1: one isolated game on the fixed save; native refine starts plus the row-level cases.
  const keys=Object.keys(specs).filter(key=>!only||specs[key].cases.some(c=>only.includes(c.id)));
  const pendingRows=key=>specs[key].cases.slice(0,5).some(c=>(!only||only.includes(c.id))&&!result.cases.some(v=>v.id===c.id&&v.passed));
  if(keys.some(key=>!result.starts[key]||pendingRows(key))){
   const {evaluate}=require('./verify-game.cjs');let g;
   try{
    g=await openGame({env,saveFile:env.fixedSave,catalogPath,out,port:port()});const s=g.state,rpc=r=>evaluate(s,`(${crossPoolDriver.toString()})(${JSON.stringify({attributes,effectAttributes,...r})})`);
    await rpc({op:'initialize'});log('stage 1 game pid '+s.pid);
    for(const key of keys){
     const spec=specs[key],pools=poolsOf(k,spec.templateId,spec.originId);
     // Native refine on this plane until a P套-only id: this row (not injected) is the start of every case of the plane.
     // A resumed run keeps the stored start so already-passed cases and new ones share the same native row.
     let chk=result.starts[key]?.refine;
     if(!chk){
      const ref=await rpc({op:'refine',plane:spec.plane,slot:spec.slot,record:spec.baseline,refineSlot:1,setOnly:pools.setOnly,max:refineMax});
      chk=checkRefine(k,spec.baseline,ref,spec);assert.ok(chk.hit,'原生洗練未取得 P套 專有 ID：'+key);chk.raw=ref.attempts;
      result.starts[key]={templateId:spec.templateId,originId:spec.originId,tier:spec.tier,slot:spec.slot,baselineHash:spec.baselineHash,record:chk.final,attempts:chk.attempts,soulCost:chk.soulCost,setOnlyId:chk.final[9],injected:[],refine:chk};save();
     }
     if(!pendingRows(key))continue;
     const start=chk.final,c=spec.cases,want=i=>!only||only.includes(c[i].id),done=i=>result.cases.some(v=>v.id===c[i].id&&v.passed);
     const attempt=async(i,fn)=>{if(stop||!want(i)||done(i))return;try{record(c[i],true,await fn());}catch(e){record(c[i],false,{error:e.message,refutation:e instanceof Refutation});if(e instanceof Refutation)stop=true;}};
     await attempt(0,async()=>{
      const problem=O.sourceProblem(start,k.setEquipmentQuality,rules);must(problem===null,'洗練後 oracle 判定不合格：'+problem);
      const m=placed(C,start,spec.plane,spec.slot),info=C.setEquipmentQualityCandidateInfo(m,{itemId:1,plane:spec.plane}),lv=C.setEquipmentLevelInfo(m,{itemId:1,plane:spec.plane});
      must(info.selectedSlot===1&&info.slots[0].source==='set','候選資格未辨識 P套 專有已選槽');must(lv.current===1&&lv.normalMax===O.cap(start[5]),'候選等級資格');
      const formal=formalRefuses(F,start,spec.plane,spec.slot);
      // The same P套-only id in an unselected slot is refused by the candidate level policy as well.
      const wrong=start.slice();wrong[27+1]=0;wrong[27+2]=1;const mw=placed(C,wrong,spec.plane,spec.slot);const misplaced=throws(()=>C.setEquipmentLevelInfo(mw,{itemId:1,plane:spec.plane}));
      const unflagged=start.slice();unflagged[28]=0;const mu=placed(C,unflagged,spec.plane,spec.slot);throws(()=>C.setEquipmentLevelInfo(mu,{itemId:1,plane:spec.plane}));
      const [obs]=await rpc({op:'rows',items:[{label:'start',record:start,plane:spec.plane,slot:spec.slot}]});
      must(JSON.stringify(obs.loaded)===JSON.stringify(start),'原生讀回與洗練結果不符');checkSingles(obs.singles,start,rules,'洗練後');
      return {refineAttempts:chk.attempts,soulCost:chk.soulCost,setOnlyId:start[9],formal:formal[0],misplaced,injected:[]};
     });
     const edit=(row,lv)=>{const m=placed(C,row,spec.plane,spec.slot);return levelEdit(C,m,spec.plane,lv);};
     await attempt(1,async()=>{
      const after=edit(start,12),[obs]=await rpc({op:'rows',items:[{label:'after',record:after,plane:spec.plane,slot:spec.slot}]});
      must(JSON.stringify(obs.loaded)===JSON.stringify(after),'原生讀回與編輯不符');checkSingles(obs.singles,after,rules,'升級後');
      const [up]=await rpc({op:'upgrade',items:[{label:'1→12',record:start,plane:spec.plane,slot:spec.slot,low:1,high:12}]});const u=checkUpgrade(up,after,start,spec.plane);
      return {from:1,to:12,cost:u.cost,injected:[]};
     });
     await attempt(2,async()=>{
      // The high start comes from a native upgrade of the refined row, then the candidate lowers it.
      const [nat]=await rpc({op:'upgrade',items:[{label:'1→18',record:start,plane:spec.plane,slot:spec.slot,low:1,high:18}]});const high=levelTo(start,18);checkUpgrade(nat,high,start,spec.plane);
      const nativeHigh=spec.plane===7?high:nat.upgraded.map((v,y)=>y===7?start[7]:v);must(nativeHigh[6]===18,'原生升級起點');
      const after=edit(nativeHigh,6),obs=await rpc({op:'rows',items:[{label:'high',record:nativeHigh,plane:spec.plane,slot:spec.slot},{label:'after',record:after,plane:spec.plane,slot:spec.slot}]});
      must(JSON.stringify(obs[0].loaded)===JSON.stringify(nativeHigh),'高等級起點讀回');must(JSON.stringify(obs[1].loaded)===JSON.stringify(after),'降級後讀回');
      checkSingles(obs[0].singles,nativeHigh,rules,'降級前');checkSingles(obs[1].singles,after,rules,'降級後');
      // Native upgrade from the lowered row back to the native high row closes the loop (cost from the level oracle).
      const [back]=await rpc({op:'upgrade',items:[{label:'6→18',record:after,plane:spec.plane,slot:spec.slot,low:6,high:18}]});const u=checkUpgrade(back,nativeHigh,after,spec.plane);
      return {from:18,to:6,nativeHigh:true,cost:u.cost,injected:[]};
     });
     await attempt(3,async()=>{
      const cp=O.cap(start[5]);must(cp===L.cap(start[5]),'品質與等級 oracle cap 不一致');
      const m=placed(C,start,spec.plane,spec.slot);const at=levelEdit(C,m,spec.plane,cp),before=rowOf(C,m,spec.plane),n=m.changes.size;
      const refusals=[cp+1,0,cp-0.5].map(v=>throws(()=>C.setEquipmentLevel(m,{itemId:1,plane:spec.plane,level:v})));
      must(JSON.stringify(rowOf(C,m,spec.plane))===JSON.stringify(before)&&m.changes.size===n,'拒絕後留有變更');
      const [obs]=await rpc({op:'rows',items:[{label:'cap',record:at,plane:spec.plane,slot:spec.slot}]});must(JSON.stringify(obs.loaded)===JSON.stringify(at),'cap 讀回');checkSingles(obs.singles,at,rules,'cap');
      const probe=await rpc({op:'cap',items:[cp-1,cp].map(level=>({record:start,slot:spec.slot,level}))});
      for(const p of probe)must(p.after[6]===Math.min(p.level+1,cp),`原生升級上限 L${p.level}→${p.after[6]}`);must(probe[1].cost===0,'cap 時不應扣費');
      return {cap:cp,refusals,probe:probe.map(p=>[p.level,p.after[6],p.cost]),injected:[]};
     });
     await attempt(4,async()=>{
      if(spec.plane===9){
       const worn=owned(start,1),after=edit(worn,15),obs=await rpc({op:'rows',items:[{label:'before',record:worn,plane:9,slot:spec.slot,character:true},{label:'after',record:after,plane:9,slot:spec.slot,character:true}]});
       must(JSON.stringify(obs[1].loaded)===JSON.stringify(after),'穿戴讀回');must(obs[1].refs[spec.slot-1]===1,'穿戴指標');
       checkCharacter(obs[0].character,[worn],rules,'編輯前');checkCharacter(obs[1].character,[after],rules,'編輯後');checkSingles(obs[1].singles,after,rules,'穿戴編輯後');
       return {state:'equipped',to:15,injected:[]};
      }
      const after=edit(start,15),w=await rpc({op:'wear',record:after,slot:spec.slot});
      for(let y=0;y<50;y++)if(y!==7)must(w.worn[y]===after[y],'穿戴搬移欄 y'+y);must(w.worn[7]===1&&w.wornRefs[spec.slot-1]===w.z9,'穿戴 owner／指標');
      must(w.source.slice(0,50).every(v=>v===0),'穿戴後背包來源未清除');checkCharacter(w.values,[w.worn.map((v,y)=>y<50?v:0)],rules,'背包編輯後穿戴');
      for(let y=0;y<50;y++)if(y!==7)must(w.back[y]===after[y],'卸下欄 y'+y);must(w.back[7]===0&&w.backRefs[spec.slot-1]===0,'卸下 owner／指標');
      return {state:'backpack→equipped',to:15,injected:[]};
     });
    }
   }finally{stopGame(g?.stateFile);}
  }
  // Stage 2: byte-level cases, each byte state in its own isolated game with a new-PID read back.
  for(const key of keys){
   const spec=specs[key],st=result.starts[key];if(!st||stop)continue;
   const start=st.record;
   for(const [i,name] of [[5,'io-two-rounds'],[6,'quality-level-quality-undo'],[7,'accumulated-restore']]){
    const c=spec.cases[i];if(stop||only&&!only.includes(c.id)||result.cases.some(v=>v.id===c.id&&v.passed))continue;
    try{
     const caseStart=name==='io-two-rounds'&&spec.plane===9?owned(start,1):start;
     const offline=name==='quality-level-quality-undo'?undoSequence(k,C,F,caseStart,spec.plane,spec.slot):name==='accumulated-restore'?restoreSequence(k,C,caseStart,spec.plane,spec.slot):null;
     const bytes=byteCases(k,C,F,fixedText,caseStart,spec,name),rounds=[];
     if(name==='io-two-rounds')rounds.push(await twoRounds({env,save:bytes.saves[0],spec,start:caseStart,out,catalogPath,saveInfo,port:port(),k}));
     else for(const sv of bytes.saves)rounds.push(await byteRound({env,save:{...sv,case:name},spec,out,catalogPath,saveInfo,port:port(),k,C}));
     if(name!=='io-two-rounds'){
      // Every intermediate offline state is also read back and its effects compared natively (row level).
      const states=name==='quality-level-quality-undo'?[...offline.states,...offline.undone]:offline.states;
      const {evaluate}=require('./verify-game.cjs');let g;
      try{g=await openGame({env,saveFile:env.fixedSave,catalogPath,out,port:port()});const s=g.state;
       const obs=await evaluate(s,`(${crossPoolDriver.toString()})(${JSON.stringify({attributes,effectAttributes,op:'rows',items:states.map((r,j)=>({label:'s'+j,record:r,plane:spec.plane,slot:spec.slot}))})})`);
       obs.forEach((o,j)=>{must(JSON.stringify(o.loaded)===JSON.stringify(states[j]),'中間狀態讀回 '+j);checkSingles(o.singles,states[j],rules,'中間狀態 '+j);});
      }finally{stopGame(g?.stateFile);}
     }
     record(c,true,{rounds,steps:offline?.steps,refused:offline?.refused,states:offline?(name==='quality-level-quality-undo'?offline.states.length+offline.undone.length:offline.states.length):undefined,injected:[]});
    }catch(e){record(c,false,{error:e.message,refutation:e instanceof Refutation});if(e instanceof Refutation)stop=true;}
   }
  }
 }finally{try{fs.unlinkSync(lock);}catch{}}
 const after={fixedSave:sha(env.fixedSave),playerSave:sha(env.playerSave),levelBaselines:sha(env.levelFile)};assert.deepEqual(after,guarded,'原檔或既有基準雜湊改變');
 assert.deepEqual(B1.verifySources(env.entry,k),sources,'快取雜湊改變');
 return {result,guarded,after,manifestHash:manifest.manifestHash,resultsHash:sha(resultFile)};
}
// A10 rows: every one of the 16 cases must be present, passed and natively compared; nothing is dropped or merged here.
function a10Rows(manifest,cases){
 const want=manifest.cases.filter(c=>c.kind==='level-regression'),byId=new Map(cases.map(v=>[v.id,v]));
 return {complete:want.every(c=>byId.get(c.id)?.passed===true&&byId.get(c.id).caseHash===hash(c)),
  rows:want.filter(c=>byId.get(c.id)?.passed).map(c=>({id:c.id,caseHash:hash(c),passed:true,nativeCompared:true})),missing:want.filter(c=>!byId.get(c.id)?.passed).map(c=>c.id)};
}
module.exports={names,planes,formalSlotCheck,candidateSlotCheck,candidateLevelSource,cores,pickBaseline,plan,levelEdit,qualityEdit,formalRefuses,undoSequence,restoreSequence,startText,byteCases,
 crossPoolDriver,Refutation,checkSingles,checkCharacter,checkRefine,checkUpgrade,a10Rows,run};
if(require.main===module){
 const argv=process.argv.slice(2),opt=n=>argv.includes(n)?argv[argv.indexOf(n)+1]:undefined;
 if(!opt('--output')){console.error('套裝等級跨池補證需要 --output（repo 外的 artifacts 目錄）；未提供，不產生任何驗證結果');process.exitCode=1;return;}
 const out=path.resolve(opt('--output'));
 run({out,only:opt('--only')?.split(','),log:m=>{console.log(m);fs.appendFileSync(path.join(out,'b6.log'),m+'\n');}}).then(r=>{
  const root=path.resolve(__dirname,'..'),k=JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'),'utf8')),source=fs.readFileSync(path.join(root,'src/core.js'),'utf8');
  const a10=a10Rows(M.createManifest(k,source,filler),r.result.cases),file=path.join(out,'a10-results.json');
  fs.writeFileSync(file,JSON.stringify({schemaVersion:1,task:'set-equipment-quality-B6',mergesProof:false,manifestHash:r.manifestHash,binding:r.result.binding,guarded:r.guarded,guardedAfter:r.after,resultsHash:r.resultsHash,starts:Object.fromEntries(Object.entries(r.result.starts).map(([key,v])=>[key,{...v,record:hash(v.record)}])),complete:a10.complete,missing:a10.missing,cases:a10.rows},null,1)+'\n');
  console.log(JSON.stringify({file,sha256:sha(file),complete:a10.complete,rows:a10.rows.length,missing:a10.missing}));process.stdout.write('',()=>process.exit(a10.complete?0:1));
 }).catch(e=>{console.error(e.stack);process.stderr.write('',()=>process.exit(1));});
}
