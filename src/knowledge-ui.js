 // Knowledge is embedded by build-editor so the downloaded HTML is self-contained.
 const coord=(x,y,z)=>({x,y,z}),read=(x,y,z)=>C.exists(model.original,coord(x,y,z))?C.get(model,coord(x,y,z)):null;
 const stat=(name,value)=>`<div class="stat"><strong>${esc(fmt(value))}</strong><span>${esc(name)}</span></div>`;
 const short=v=>{const text=fmt(v);return text.length>150?text.slice(0,150)+'…':text;};
 const sourceHtml=rows=>rows.length?rows.map(e=>`<div class="source-detail">${esc(e.function)}<br>${esc(e.sheet)} · SID ${esc(e.sid)}</div>`).join(''):'<span class="source-detail">尚未定位欄位事件</span>';
 function paged(kind,list,render,container){
  const size=50,max=Math.max(0,Math.ceil(list.length/size)-1);knowledgePages[kind]=Math.min(knowledgePages[kind],max);
  const page=knowledgePages[kind],start=page*size;
  $(container).innerHTML=list.length?list.slice(start,start+size).map(render).join(''):(container==='catalogRows'?'<p class="muted">沒有符合的資料。</p>':'<tr><td colspan="5" class="empty">沒有符合的資料。</td></tr>');
  $(kind+'PageInfo').textContent=list.length?`${start+1}–${Math.min(start+size,list.length)} / ${htmlValue(list.length)} 筆`:'0 筆';
  $(kind+'Prev').disabled=page===0;$(kind+'Next').disabled=page===max;
 }
 function renderKnowledgeTab(name){if(name==='atlas')renderAtlas();if(!model)return;if(name==='characters')renderCharacters();if(name==='settlement')renderSettlement();if(name==='inventory')renderInventory();}
 function renderCharacters(){
  const q=$('characterSearch').value.trim().toLowerCase(),old=$('characterSelect').value;
  const rows=C.listEntities(model,'characters').filter(r=>`${r.id} ${r.name}`.toLowerCase().includes(q));
  $('characterSelect').innerHTML=rows.map(r=>`<option value="${r.id}">#${r.id} ${esc(r.name)} · ${esc(r.detail)}</option>`).join('');
  if(rows.some(r=>String(r.id)===old))$('characterSelect').value=old;
  $('characterEmpty').hidden=!!rows.length;$('characterBody').hidden=!rows.length;if(!rows.length)return;
  const x=Number($('characterSelect').value);
  $('characterName').value=read(x,1,2);$('renameCharacterBtn').disabled=!K.verification.names;
  $('characterSummary').innerHTML=stat('角色等級',read(x,3,2))+stat('自然經驗餘額',read(x,4,2))+stat('等級上限',(Math.floor(read(x,50,2))+1)*30)+stat('目前職業',C.catalogName('professions',read(x,6,2)))+stat('共用池已投入經驗',read(x,56,2))+stat('自動轉職預設',read(x,59,2));
  $('skillRows').innerHTML=C.SKILLS.map((name,i)=>`<tr><td>${esc(name)}</td><td>${htmlValue(read(x,31+i,2))} / ${htmlValue(read(x,22+i,2))}</td><td>${htmlValue(read(x,40+i,2))}</td><td>${htmlValue(C.experienceNeed.skill(read(x,31+i,2)))}</td></tr>`).join('');
  $('growthStatus').textContent=Object.values(K.verification).every(Boolean)?'新增寫入已通過隔離驗證':'部分功能待遊戲驗證';
  renderGrowth();
 }
 function renderGrowth(){
  const x=Number($('characterSelect').value),kind=$('growthKind').value,old=$('growthTarget').value;
  const targets=kind==='profession'?K.catalogs.professions.filter(r=>read(x,r.id,4)>0):kind==='skill'?C.SKILLS.map((name,i)=>({id:i+1,name})):[];
  $('growthTarget').hidden=kind==='character';$('growthTarget').innerHTML=targets.map(r=>`<option value="${r.id}">${esc(r.name)} #${r.id}</option>`).join('');
  if(targets.some(r=>String(r.id)===old))$('growthTarget').value=old;
  $('growthAmount').step=kind==='profession'?'0.1':'1';$('growthAmount').min=kind==='profession'?'0.1':'1';
  try{
   const i=C.growthInfo(model,kind,x,kind==='character'?undefined:Number($('growthTarget').value));
   $('growthInfo').textContent=`${i.name}：Lv ${i.currentLevel} / ${i.cap} · 經驗 ${htmlValue(i.currentExperience)} / ${htmlValue(i.need)}${i.verified?'':' · 尚待遊戲驗證'}${kind==='profession'&&read(x,59,2)>0?' · 請先在遊戲中關閉自動轉職':''}`;
   $('growthApplyBtn').disabled=!i.verified||i.currentLevel>=i.cap||(kind==='profession'&&read(x,59,2)>0);
  }catch(e){$('growthInfo').textContent=e.message;$('growthApplyBtn').disabled=true;}
 }
 function renderSettlement(){
  $('settlementName').value=read(1,1,0);$('renameSettlementBtn').disabled=!K.verification.names;
  $('settlementSummary').innerHTML=stat('山寨等級',read(2,1,0))+stat('目前地圖',read(4,1,0))+stat('累計遊玩秒數',read(15,1,0));
  const kind=$('settlementCategory').value,q=$('settlementSearch').value.trim().toLowerCase();
  $('settlementNote').textContent=['buildings','facilities','quests'].includes(kind)?'以下為遊戲資料表，不代表已建造、已擁有或已完成。配置與進程請從欄位圖鑑對照原始記錄。':'對照已核對的存檔欄位；此處不修改等級、研究狀態或解鎖。';
  const rows=K.catalogs[kind].filter(r=>`${r.id} ${r.name} ${r.category}`.toLowerCase().includes(q));
  paged('settlement',rows,r=>`<tr><td><span class="mono muted">#${r.id}</span> ${esc(r.name)}</td><td>${esc(r.category)}</td><td>${kind==='technologies'?`科技等級 ${htmlValue(read(r.id,4,0))} · 研究狀態 ${htmlValue(read(r.id,13,0))}`:kind==='professions'?`操練上限 ${htmlValue(read(r.id,5,0))}`:'資料表 · 唯讀'}</td></tr>`,'settlementRows');
 }
 function renderInventory(){
  const q=$('inventorySearch').value.trim().toLowerCase(),z=$('inventoryPlane').value;
  const rows=C.listEntities(model,'inventory').filter(r=>(!z||r.z===Number(z))&&`${r.id} ${r.name} ${r.detail}`.toLowerCase().includes(q));
  paged('inventory',rows,r=>`<tr><td class="mono">#${r.id} / ${esc(read(r.id,1,r.z))}</td><td>${esc(r.name)}</td><td>${r.z===7?'背包':'裝備庫／穿戴'}</td><td>${htmlValue(read(r.id,5,r.z))} / Lv ${htmlValue(read(r.id,6,r.z))}</td><td><button class="small" data-inspect-item="${r.id}" data-plane="${r.z}">查看欄位</button></td></tr>`,'inventoryRows');
 }
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
  paged('catalog',K.catalogs[kind].filter(r=>`${r.id} ${r.name} ${r.category}`.toLowerCase().includes(q)),r=>`<div class="catalog-item"><span class="muted mono">#${r.id}</span> ${esc(r.name)}<div class="muted small-text">${esc(r.category)}</div></div>`,'catalogRows');
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
 document.addEventListener('click',e=>{const b=e.target.closest('[data-inspect-item]');if(!b)return;atlasEntityId=Number(b.dataset.inspectItem);$('atlasPlane').value=b.dataset.plane;$('atlasSearch').value='';knowledgePages.atlas=0;showTab('atlas');});
