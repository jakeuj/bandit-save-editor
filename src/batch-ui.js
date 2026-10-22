 // Batch editing shares the existing local model and named core operations.
 const batchState={selected:new Set(),characterPage:0,page:0,preview:null,request:null,revision:-1,controller:null};
 const batchPageSize=50;
 function invalidateBatch(){
  batchState.preview=null;batchState.request=null;batchState.page=0;
  $('batchSummary').textContent='選擇目標與數值後，先預覽再套用。';$('batchRows').innerHTML='';$('batchApply').disabled=true;$('batchResultPager').hidden=true;
 }
 function resetBatch(){batchState.selected.clear();batchState.characterPage=0;batchState.revision=revision;invalidateBatch();}
 function renderBatch(){
  if(!model)return;
  if(batchState.revision!==revision){invalidateBatch();batchState.revision=revision;}
  const kind=$('batchKind').value,characters=C.listEntities(model,'characters');
  $('batchCharacterScope').hidden=kind!=='characterExperience';
  $('batchSingleCharacter').hidden=!['professionExperience','skillExperience'].includes(kind);
  $('batchSkillRestoreNote').hidden=kind!=='skillExperience';
  $('batchEquipmentOptions').hidden=kind!=='equipmentMax';$('batchValueLabel').hidden=kind==='equipmentMax';
  $('batchIncludeEquipped').disabled=$('batchPlane').value!=='9';
  $('batchNumberLabel').textContent=kind==='technologyLevel'?'目標存檔值（遊戲 Lv = 此值 + 1）':'每個目標增加的經驗';
  $('batchAmount').step=kind==='professionExperience'?'0.1':'1';$('batchAmount').min=kind==='technologyLevel'?'0':kind==='professionExperience'?'0.1':'1';
  const old=$('batchCharacter').value;
  const search=$('batchCharacterSearch').value.trim().toLowerCase(),matches=characters.filter(c=>!search||`${c.name} #${c.id}`.toLowerCase().includes(search)),choices=matches.slice(0,50);
  $('batchCharacterHint').textContent=`顯示 ${choices.length} / ${matches.length} 名；超過50名請搜尋名稱或 #編號。`;
  $('batchCharacter').innerHTML=choices.map(c=>`<option value="${c.id}">${esc(c.name)} #${c.id}</option>`).join('');
  if(choices.some(c=>String(c.id)===old))$('batchCharacter').value=old;
  $('batchCharacterPicker').hidden=$('batchCharacterMode').value==='all';
  batchState.characterPage=Math.max(0,Math.min(batchState.characterPage,Math.ceil(characters.length/batchPageSize)-1));
  const start=batchState.characterPage*batchPageSize,visible=characters.slice(start,start+batchPageSize);
  $('batchCharacters').innerHTML=visible.map(c=>`<label class="batch-character"><input type="checkbox" data-batch-character="${c.id}" ${batchState.selected.has(c.id)?'checked':''}><span>${esc(c.name)} #${c.id}<small class="sub">${esc(c.detail)}</small></span></label>`).join('')||'<p class="muted">沒有已招募角色。</p>';
  $('batchCharacterCount').textContent=`已勾選 ${batchState.selected.size} / ${characters.length} 名；本頁 ${visible.length} 名`;
  $('batchCharacterPageInfo').textContent=`第 ${batchState.characterPage+1} / ${Math.max(1,Math.ceil(characters.length/batchPageSize))} 頁`;
  $('batchCharacterPrev').disabled=start===0;$('batchCharacterNext').disabled=start+batchPageSize>=characters.length;
  renderBatchResults();
 }
 function batchRequest(){
  const kind=$('batchKind').value;
  if(kind==='equipmentMax')return {kind,plane:Number($('batchPlane').value),includeEquipped:$('batchPlane').value==='9'&&$('batchIncludeEquipped').checked};
  if($('batchAmount').value.trim()==='')throw Error('請輸入批次數值。');
  const amount=Number($('batchAmount').value);
  if(kind==='technologyLevel')return {kind,level:amount};
  if(kind==='characterExperience')return {kind,characterIds:$('batchCharacterMode').value==='all'?C.listEntities(model,'characters').map(c=>c.id):[...batchState.selected].sort((a,b)=>a-b),amount};
  return {kind,characterId:Number($('batchCharacter').value),amount};
 }
 function renderBatchResults(){
  const p=batchState.preview;
  $('batchApply').disabled=loading||!p?.canApply;
  if(!p)return;
  const s=p.summary;
  $('batchSummary').textContent=`目標 ${s.targets} · 有變更 ${s.changed} · 無變更 ${s.unchanged} · 範圍外 ${s.excluded} · 阻擋 ${s.blocked} · 變更欄位 ${s.changedCells}。${s.blocked?'有目標不合格，整批不能套用。':!s.targets?'沒有可操作的目標。':!s.changed?'全部無變更，不會新增歷史。':'確認後可整批套用。'}`;
  const rows=p.rows.filter(r=>!$('batchBlockedOnly').checked||r.status==='blocked');
  batchState.page=Math.max(0,Math.min(batchState.page,Math.ceil(rows.length/batchPageSize)-1));
  const start=batchState.page*batchPageSize,status={changed:'有變更',unchanged:'無變更',blocked:'阻擋',excluded:'範圍外'};
  $('batchRows').innerHTML=rows.slice(start,start+batchPageSize).map(r=>`<tr><td>${esc(r.name)}<span class="sub">${status[r.status]}</span></td><td>${r.before?esc(r.before.join(' ／ ')):'—'}</td><td>${r.after?esc(r.after.join(' ／ ')):'—'}</td><td>${esc(r.reason||'')}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">沒有符合的明細。</td></tr>';
  $('batchResultPager').hidden=false;$('batchPageInfo').textContent=`第 ${batchState.page+1} / ${Math.max(1,Math.ceil(rows.length/batchPageSize))} 頁 · ${rows.length} 筆`;
  $('batchPrev').disabled=start===0;$('batchNext').disabled=start+batchPageSize>=rows.length;
 }
 async function runBatchUI(apply){
  if(!model||loading)return;
  let request;try{request=apply?batchState.request:batchRequest();if(!request||apply&&!batchState.preview?.canApply)return;}catch(error){toast(error.message,true);return;}
  const baseRevision=revision,baseModel=model,preview=batchState.preview,controller=new AbortController();batchState.controller=controller;
  // Save disabled states, including controls outside the panel. Cancellation remains accessible.
  const controls=[...document.querySelectorAll('button,input,select,textarea')].filter(e=>e.id!=='batchCancel'),disabled=controls.map(e=>e.disabled);
  loading=true;controls.forEach(e=>e.disabled=true);$('workspace').setAttribute('aria-busy','true');$('batchCancel').hidden=false;$('batchProgress').hidden=false;
  let result;
  try{
   result=await C[apply?'applyBatch':'previewBatch'](model,request,{preview:apply?preview:undefined,signal:controller.signal,onProgress:({done,total})=>{$('batchProgress').textContent=`${apply?'檢查並套用':'預覽'} ${done} / ${total} 個目標…`;}});
   if(model!==baseModel||revision!==baseRevision)throw Error('存檔已改變，請重新預覽。');
   if(apply){if(result.canApply)revision++;invalidateBatch();toast(result.canApply?'批次已套用；復原一步可撤回整批。':'全部無變更。');}
   else{batchState.preview=result;batchState.request=request;batchState.page=0;batchState.revision=revision;}
  }catch(error){invalidateBatch();toast(error.message,true);}
  finally{loading=false;batchState.controller=null;controls.forEach((e,i)=>e.disabled=disabled[i]);$('workspace').setAttribute('aria-busy','false');$('batchCancel').hidden=true;$('batchProgress').hidden=true;render();renderBatch();}
 }
 $('batchPreview').onclick=()=>runBatchUI(false);$('batchApply').onclick=()=>runBatchUI(true);$('batchCancel').onclick=()=>batchState.controller?.abort();
 for(const id of ['batchKind','batchCharacterMode','batchCharacter','batchPlane','batchIncludeEquipped'])$(id).onchange=()=>{invalidateBatch();renderBatch();};
 $('batchAmount').oninput=invalidateBatch;
 $('batchCharacterSearch').oninput=()=>{invalidateBatch();renderBatch();};
 $('batchBlockedOnly').onchange=()=>{batchState.page=0;renderBatchResults();};
 $('batchPrev').onclick=()=>{batchState.page--;renderBatchResults();};$('batchNext').onclick=()=>{batchState.page++;renderBatchResults();};
 $('batchCharacterPrev').onclick=()=>{batchState.characterPage--;renderBatch();};$('batchCharacterNext').onclick=()=>{batchState.characterPage++;renderBatch();};
 $('batchSelectPage').onclick=()=>{for(const input of $('batchCharacters').querySelectorAll('[data-batch-character]'))batchState.selected.add(Number(input.dataset.batchCharacter));invalidateBatch();renderBatch();};
 $('batchClearSelection').onclick=()=>{batchState.selected.clear();invalidateBatch();renderBatch();};
 document.addEventListener('change',e=>{if(e.target.dataset.batchCharacter){const id=Number(e.target.dataset.batchCharacter);if(e.target.checked)batchState.selected.add(id);else batchState.selected.delete(id);invalidateBatch();renderBatch();}});
