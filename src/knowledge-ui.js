/*__KNOWLEDGE_SHARED__*/
/*__KNOWLEDGE_EDITING__*/
/*__KNOWLEDGE_AFFIXES__*/
/*__KNOWLEDGE_QUALITY__*/
/*__KNOWLEDGE_APTITUDES__*/
/*__KNOWLEDGE_SKILL_CAPS__*/
/*__KNOWLEDGE_TALENTS__*/
/*__KNOWLEDGE_LISTS__*/
 function renderAtlas(){
  const z=Number($('atlasPlane').value),plane=K.planes[z],q=$('atlasSearch').value.trim().toLowerCase();
  $('knowledgeSummary').textContent=`對應 ${K.gameVersion} · ${K.counts.functions} 個事件函式 · ${K.counts.setXYZ} 處存檔寫入 · ${K.planes.length} 層 · 名稱索引 ${Object.values(K.catalogs).reduce((n,r)=>n+r.length,0)} 筆。知識隨 HTML 下載，無需連線。`;
  $('atlasInfo').textContent=`第 ${z} 層：${plane.name} · ${plane.writes} 處寫入 · ${plane.status}。${model?'列出目前存檔的非零／非空記錄，最多每頁 50 筆。':'載入存檔可對照實際欄位與值；以下先顯示程式寫入索引。'}${atlasEntityId!==null?` 目前限定實體 #${atlasEntityId}；切換資料層或搜尋可解除。`:''}`;
  const rows=[];
  if(model){
   const xs=atlasEntityId===null?Array.from({length:model.original.size[0]},(_,i)=>i):[atlasEntityId];
   for(const x of xs)for(let y=0;y<model.original.size[1];y++){
    const c=coord(x,y,z),v=C.get(model,c);if(v===0||v===''||v===null)continue;
    const f=C.resolveField(model,c);if(q&&!`${x},${y},${z} ${f.label} ${f.entity} ${f.source.map(s=>s.function+' '+s.sid).join(' ')}`.toLowerCase().includes(q))continue;
    rows.push({c,v,f});
   }
   paged('atlas',rows,({c,v,f})=>`<tr><td class="mono">[${c.x}, ${c.y}, ${c.z}]</td><td>${esc(f.label)}<span class="sub">${esc(f.entity)}</span><span class="source-detail">${esc(f.description)}</span>${f.related.length?`<span class="sub mono">關聯：${f.related.map(c=>`[${c.x},${c.y},${c.z}]`).join(' ')}</span>`:''}</td><td class="rowvalue">${esc(short(v))}</td><td><span class="${f.editable?'status-editable':'status-readonly'}">${esc(f.type)} · ${esc(f.status)}<br>${f.editable?'可編輯':esc(f.reason)}</span></td><td>${sourceHtml(f.source)}</td></tr>`,'atlasRows');
  }else{
   const seen=new Set();for(const e of K.evidence.filter(e=>e.z===z)){const k=`${e.x},${e.y},${e.z}:${e.function}`;if(seen.has(k)||q&&!`${k} ${e.sid}`.toLowerCase().includes(q))continue;seen.add(k);rows.push(e);}
   paged('atlas',rows,e=>`<tr><td class="mono">[${e.x}, ${e.y}, ${e.z}]</td><td>${esc(e.function)}</td><td>尚未載入存檔</td><td>程式寫入位置<br>* 為動態索引</td><td>${sourceHtml([e])}</td></tr>`,'atlasRows');
  }
  renderCatalog();
 }
 function renderCatalog(){
  const kind=$('catalogKind').value,q=$('catalogSearch').value.trim().toLowerCase();
  paged('catalog',K.catalogs[kind].filter(r=>`${r.id} ${r.name} ${r.category}`.toLowerCase().includes(q)),r=>`<div class="catalog-item"><span class="muted mono">#${r.id}</span> ${kind==='professions'?`<button class="small ghost" data-profession-link="${r.id}">${esc(r.name)} · 查看轉職</button>`:esc(r.name)}<div class="muted small-text">${esc(r.category)}</div></div>`,'catalogRows');
 }
 const categories={materials:'材料',characters:'角色範本',professions:'職業',attributes:'屬性',items:'物品',technologies:'科技',buildings:'建築',quests:'任務',talents:'天賦',facilities:'設施',relics:'靈物'};
 $('atlasPlane').innerHTML=K.planes.map(p=>`<option value="${p.z}">${p.z} · ${esc(p.name)}</option>`).join('');$('atlasPlane').value='2';
 $('catalogKind').innerHTML=Object.keys(K.catalogs).map(k=>`<option value="${k}">${categories[k]}</option>`).join('');
 for(const [id,fn]of [['characterSearch',renderCharacters],['characterSelect',renderCharacters],['growthKind',renderGrowth],['growthTarget',renderGrowth]])$(id)[id.endsWith('Search')?'oninput':'onchange']=()=>{if(model)fn();};
 for(const [kind,ids,fn]of [['settlement',['settlementCategory','settlementSearch'],renderSettlement],['inventory',['inventorySearch','inventoryPlane'],renderInventory],['atlas',['atlasPlane','atlasSearch'],renderAtlas],['catalog',['catalogKind','catalogSearch'],renderCatalog]]){
  for(const id of ids)$(id)[id.endsWith('Search')?'oninput':'onchange']=()=>{knowledgePages[kind]=0;if(kind==='atlas')atlasEntityId=null;if(model||kind==='atlas'||kind==='catalog')fn();};
  $(kind+'Prev').onclick=()=>{knowledgePages[kind]--;fn();};$(kind+'Next').onclick=()=>{knowledgePages[kind]++;fn();};
 }
 $('renameCharacterBtn').onclick=()=>{const x=Number($('characterSelect').value);perform(()=>C.setField(model,coord(x,1,2),$('characterName').value));};
 $('renameSettlementBtn').onclick=()=>perform(()=>C.setField(model,coord(1,1,0),$('settlementName').value));
 $('growthApplyBtn').onclick=()=>{
  const options={kind:$('growthKind').value,characterId:Number($('characterSelect').value),id:Number($('growthTarget').value),amount:Number($('growthAmount').value)};
  perform(()=>C.addExperience(model,options));
 };
 document.addEventListener('change',e=>{
  const kind=e.target.dataset.editTarget||e.target.dataset.editMode;if(!kind||!model)return;
  if(e.target.dataset.editTarget)editingState[kind].id=kind==='equipment'?e.target.value:Number(e.target.value);
  else{editingState[kind].advanced=e.target.checked;editingState[kind].preserveValue=true;}
  renderEditing(kind);
 });
 document.addEventListener('click',e=>{
  const kind=e.target.closest('[data-edit-apply]')?.dataset.editApply;if(!kind||!model)return;
  const state=editingState[kind],input=document.querySelector(`[data-edit-value="${kind}"]`);
  try{const value=num(input),options={advanced:state.advanced};const [plane,itemId]=kind==='equipment'?state.id.split(':').map(Number):[];perform(()=>kind==='equipment'&&innerPillRow(plane,itemId)?C.setInnerPillLevel(model,{plane,itemId,level:value}):kind==='equipment'?C.setEquipmentLevel(model,{...options,plane,itemId,level:value}):kind==='training'?C.setProfessionTrainingCap(model,{...options,professionId:state.id,cap:value}):state.id===33&&state.advanced&&value>299&&typeof C.setRecruitTechnologyLevel==='function'?C.setRecruitTechnologyLevel(model,{level:value}):C.setAdvancedTechnologyLevel(model,{...options,technologyId:state.id,level:value}));}catch(error){toast(error.message,true);}
 });
 document.addEventListener('click',e=>{const b=e.target.closest('[data-inspect-item]');if(!b)return;atlasEntityId=Number(b.dataset.inspectItem);$('atlasPlane').value=b.dataset.plane;$('atlasSearch').value='';knowledgePages.atlas=0;showTab('atlas');});
