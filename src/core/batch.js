 const batchLabels={characterExperience:'角色經驗',professionExperience:'已習得職業經驗',skillExperience:'九項技藝經驗',equipmentMax:'普通裝備升滿',technologyLevel:'進階科技同值'};
 // Requests describe player actions, never arbitrary methods or coordinates.
 function batchTargets(m,request){
  if(!request||typeof request!=='object'||Array.isArray(request)||!Object.hasOwn(batchLabels,request.kind))throw Error('未知的批次操作。');
  const allowed={characterExperience:['kind','characterIds','amount'],professionExperience:['kind','characterId','amount'],skillExperience:['kind','characterId','amount'],equipmentMax:['kind','plane','includeEquipped'],technologyLevel:['kind','level']}[request.kind];
  if(Object.keys(request).some(k=>!allowed.includes(k)))throw Error('批次只接受指定動作的參數，不能傳入方法、座標或進階模式。');
  const r=JSON.parse(JSON.stringify(request)),targets=[],excluded=[];
  const character=(x,kind,id)=>({name:`${activeCharacter(m,x)?get(m,C(x,1,2)):'角色'} #${x}${kind==='profession'?'・'+catalogName('professions',id):kind==='skill'?'・'+SKILLS[id-1]:''}`,method:'experience',options:{kind,characterId:x,id,amount:r.amount},coordinates:kind==='character'?[C(x,3,2),C(x,4,2)]:kind==='profession'?[C(x,id,4),C(x,id,5)]:[C(x,30+id,2),C(x,39+id,2)]});
  if(r.kind==='characterExperience'){
   if(!Array.isArray(r.characterIds)||!r.characterIds.length||r.characterIds.length>m.original.size[0]-1||r.characterIds.some(x=>!Number.isSafeInteger(x)||x<1||x>=m.original.size[0])||new Set(r.characterIds).size!==r.characterIds.length)throw Error('請選擇不重複且在範圍內的角色。');
   for(const x of r.characterIds)targets.push(character(x,'character'));
  }else if(['professionExperience','skillExperience'].includes(r.kind)){
   if(!activeCharacter(m,r.characterId))throw Error('找不到有效角色。');
   const ids=r.kind==='skillExperience'?SKILLS.map((_,i)=>i+1):KNOWLEDGE.catalogs.professions.filter(p=>get(m,C(r.characterId,p.id,4))!==0).map(p=>p.id);
   for(const id of ids)targets.push(character(r.characterId,r.kind==='skillExperience'?'skill':'profession',id));
  }else if(r.kind==='equipmentMax'){
   if(!equipmentPlane(m,r.plane)||r.includeEquipped!==undefined&&typeof r.includeEquipped!=='boolean')throw Error('請選擇背包、裝備庫或這份存檔的武庫，穿戴選項須為布林值。');
   for(let x=1;x<m.original.size[0];x++){
    if(!get(m,C(x,0,r.plane)))continue;
    const item=catalogMaps.items.get(get(m,C(x,1,r.plane))),name=`${planeName(r.plane)} #${x}・${item?.name||'未知物品'}`;
    if(!item||item.category!=='裝備'||item.kind!=='普通'){excluded.push({name,reason:'非本次範圍：只處理已辨識的普通裝備。',status:'excluded'});continue;}
    if(r.plane===9&&!r.includeEquipped&&get(m,C(x,7,9))>0){excluded.push({name,reason:'未勾選包含穿戴裝備。',status:'excluded'});continue;}
    targets.push({name,method:'equipment',options:{itemId:x,plane:r.plane},coordinates:[C(x,6,r.plane)]});
   }
  }else for(let id=31;id<=44;id++)targets.push({name:`${catalogName('technologies',id)} #${id}`,method:'technology',options:{technologyId:id,level:r.level},coordinates:[C(id,4,0)]});
  return {request:r,targets,excluded,label:batchLabels[r.kind]};
 }
 function executeBatchTarget(m,target){
  if(target.method==='experience')return addExperience(m,target.options);
  if(target.method==='equipment'){
   const info=editingInfo(m,'equipment',target.options.itemId,target.options.plane);
   if(info.current>info.normalMax)throw Error('現有裝備超過原版上限，本批次不會自動降級。');
   return setEquipmentLevel(m,{...target.options,level:info.normalMax,advanced:false});
  }
  return setAdvancedTechnologyLevel(m,{...target.options,advanced:false});
 }
 const batchPreviews=new WeakMap();
 const batchClock=()=>globalThis.performance?.now()??Date.now();
 function batchSnapshot(m){return {original:m.original,text:m.text,changes:new Map(m.changes),history:[...m.history],counter:m.operationCounter,revision:m.revision,skillModes:JSON.stringify([...skillModes(m)]),gates:JSON.stringify(KNOWLEDGE.verification)};}
 function assertBatchCurrent(m,snapshot){
  if(m.revision!==snapshot.revision||JSON.stringify([...skillModes(m)])!==snapshot.skillModes||m.original!==snapshot.original||m.text!==snapshot.text||m.operationCounter!==snapshot.counter||m.changes.size!==snapshot.changes.size||[...snapshot.changes].some(([k,v])=>m.changes.get(k)!==v)||m.history.length!==snapshot.history.length||m.history.some((v,i)=>v!==snapshot.history[i])||JSON.stringify(KNOWLEDGE.verification)!==snapshot.gates)throw Error('存檔或驗證狀態已改變，請重新預覽批次。');
 }
 async function runBatch(m,request,{signal,onProgress,preview}={},commit=false){
  if(m.inTransaction)throw Error('批次不能在同步交易內執行。');
  const requestKey=JSON.stringify(request),prior=preview&&batchPreviews.get(preview);
  if(preview){if(!prior||prior.model!==m||prior.requestKey!==requestKey)throw Error('批次預覽不相符，請重新預覽。');assertBatchCurrent(m,prior.snapshot);}
  const snapshot=batchSnapshot(m),spec=batchTargets(m,request),operation=`${(m.operationCounter||0)+1}：批次・${spec.label}`;
  // Only this private model stays inside a transaction across yields. No callback in transaction() is async.
  const staged={...m,changes:new Map(m.changes),history:[],inTransaction:true,currentOperation:operation,currentGroup:null},rows=[];
  skillGrowthModes.set(staged,new Set(skillModes(m)));batchStages.add(staged);
  const check=()=>{if(signal?.aborted)throw Error('已取消批次，沒有套用任何修改。');if(JSON.stringify(request)!==requestKey)throw Error('批次參數已改變，請重新預覽。');assertBatchCurrent(m,snapshot);};
  const progress=done=>onProgress?.({done,total:spec.targets.length});
  check();progress(0);await new Promise(resolve=>setTimeout(resolve,0));check();
  let sliceStart=batchClock();
  for(let i=0;i<spec.targets.length;i++){
   const target=spec.targets[i],before=target.coordinates.map(c=>get(staged,c)),saved=target.coordinates.map(c=>staged.changes.get(key(c)));
   let reason='';try{executeBatchTarget(staged,target);}catch(error){reason=error.message;target.coordinates.forEach((c,j)=>{if(saved[j])staged.changes.set(key(c),saved[j]);else staged.changes.delete(key(c));});}
   const after=target.coordinates.map(c=>get(staged,c)),changed=after.filter((v,j)=>!Object.is(v,before[j])).length;
   rows.push({name:target.name,status:reason?'blocked':changed?'changed':'unchanged',reason,before,after,coordinates:target.coordinates,changedCells:changed});
   if(batchClock()-sliceStart>=12){progress(i+1);await new Promise(resolve=>setTimeout(resolve,0));check();sliceStart=batchClock();}
  }
  progress(spec.targets.length);check();
  const summary={targets:rows.length,changed:rows.filter(r=>r.status==='changed').length,unchanged:rows.filter(r=>r.status==='unchanged').length,excluded:spec.excluded.length,blocked:rows.filter(r=>r.status==='blocked').length,changedCells:rows.reduce((n,r)=>n+r.changedCells,0)};
  const result={label:spec.label,summary,rows:[...rows,...spec.excluded],canApply:summary.targets>0&&summary.blocked===0&&summary.changed>0};
  if(commit){
   if(summary.blocked)throw Error(`整批未套用：${summary.blocked} 個目標不合格。${rows.find(r=>r.status==='blocked').name}：${rows.find(r=>r.status==='blocked').reason}`);
   if(!summary.targets)throw Error('沒有可操作的目標，整批未套用。');
   if(result.canApply){transaction(m,()=>{m.changes=staged.changes;skillGrowthModes.set(m,new Set(skillModes(staged)));},`批次・${spec.label}`);}
  }else batchPreviews.set(result,{model:m,snapshot,requestKey});
  return result;
 }
 const previewBatch=(m,request,options)=>runBatch(m,request,options,false);
 const applyBatch=(m,request,options)=>runBatch(m,request,options,true);
