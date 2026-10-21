 // Knowledge is embedded by build-editor so the downloaded HTML is self-contained.
 const coord=(x,y,z)=>({x,y,z}),read=(x,y,z)=>C.exists(model.original,coord(x,y,z))?C.get(model,coord(x,y,z)):null;
 const stat=(name,value)=>`<div class="stat"><strong>${esc(fmt(value))}</strong><span>${esc(name)}</span></div>`;
 const short=v=>{const text=fmt(v);return text.length>150?text.slice(0,150)+'…':text;};
 const sourceHtml=rows=>rows.length?rows.map(e=>`<div class="source-detail">${esc(e.function)}<br>${esc(e.sheet)} · SID ${esc(e.sid)}</div>`).join(''):'<span class="source-detail">尚未定位欄位事件</span>';
 const editingState=Object.fromEntries(['equipment','training','technology'].map(kind=>[kind,{id:null,advanced:false}]));
 const equipmentChoices=()=>C.listEntities(model,'inventory').filter(v=>!$('inventoryPlane').value||String(v.z)===$('inventoryPlane').value);
 const equipmentLabel=v=>`${v.z===7?'背包':read(v.id,7,9)>0?'穿戴・'+read(read(v.id,7,9),1,2):'裝備庫'} #${v.id} ${v.name}`;
 function renderEditing(kind){
  const state=editingState[kind],title={equipment:'裝備等級',training:'職業操練上限',technology:'進階科技等級'}[kind];
  const choices=kind==='equipment'?equipmentChoices().map(v=>({...v,itemId:v.id,id:`${v.z}:${v.id}`,label:equipmentLabel(v)})):K.catalogs[kind==='training'?'professions':'technologies'].filter(v=>kind!=='technology'||v.advanced);
  const old=document.querySelector(`[data-edit-value="${kind}"]`)?.value;
  if(!choices.some(v=>v.id===state.id))state.id=choices[0]?.id??null;
  const [plane,itemId]=kind==='equipment'&&state.id?state.id.split(':').map(Number):[9,state.id];
  if(kind==='equipment'&&plane===7)state.advanced=false;
  let info,error='';try{info=C.editingInfo(model,kind,itemId,plane);}catch(e){error=e.message;}
  const enabled=info?.verified&&(!state.advanced||info.advancedVerified),max=state.advanced?info?.advancedMax:Math.min(info?.normalMax??0,info?.advancedMax??0);
  $(kind+'Editor').innerHTML=`<h3>${title}</h3><div class="toolbar"><select data-edit-target="${kind}" aria-label="選擇${title}目標">${choices.map(v=>`<option value="${v.id}" ${v.id===state.id?'selected':''}>${esc(v.label||'#'+v.id+' '+v.name)}</option>`).join('')}</select><label class="check"><input type="checkbox" data-edit-mode="${kind}" ${kind==='equipment'&&plane===7?'disabled':''} ${state.advanced?'checked':''}>進階模式</label></div><p class="muted small-text">${info?`目前 ${htmlValue(info.current)} · 一般上限 ${htmlValue(info.normalMax)}${kind==='equipment'&&plane===7?' · 背包僅一般模式':' · 進階驗證上限 '+htmlValue(info.advancedMax)}`:esc(error)}</p><div class="toolbar"><label>目標數值<input type="number" min="${info?.min??1}" max="${max??0}" step="1" value="${info?.current||info?.min||1}" data-edit-value="${kind}" aria-label="${title}目標數值" ${info?'':'disabled'}></label><button class="small primary" data-edit-apply="${kind}" ${enabled?'':'disabled'}>套用${title}</button></div><p class="muted small-text" role="status">${esc(error||(!enabled?'此修改模式尚待隔離遊戲驗證，目前停用。':state.advanced?'已驗證範圍內可超過原版上限；不扣取得成本。':'一般模式遵守原版上限，不扣取得成本。'))}${kind==='training'?' 職業自然成長仍受原版 30 級限制。':kind==='technology'?' 目標為存檔值；遊戲科技提示的 Lv 為此值加一。':''}</p>`;
  // Preserve an unsubmitted number while toggling modes, but reset after applying or changing target.
  if(state.preserveValue&&old!==undefined)document.querySelector(`[data-edit-value="${kind}"]`).value=old;
  state.preserveValue=false;
 }
 function renderAffixes(){
  const old=$('affixItem')?.value,slot=$('affixSlot')?.value||'1';
  const choices=equipmentChoices();
  $('affixEditor').innerHTML=`<h3>詞條係數與精準洗練</h3><div class="toolbar"><select id="affixItem" aria-label="詞條裝備">${choices.map(v=>`<option value="${v.z}:${v.id}">${esc(equipmentLabel(v))}</option>`).join('')}</select><select id="affixSlot" aria-label="詞條槽">${Array.from({length:5},(_,i)=>`<option value="${i+1}">詞條槽 ${i+1}</option>`).join('')}</select></div><p id="affixInfo" class="muted small-text" role="status"></p><div class="toolbar"><label>目標係數<input id="affixValue" type="number" step="0.01"></label><button id="affixApply" class="primary small">套用詞條係數</button></div><p class="muted small-text">上方係數操作只調既有係數；下方精準洗練可替換合法詞條，兩者皆不重置選槽。首次選槽請使用下方精準洗練並確認；品質、特殊裝備與超限值保持唯讀。</p><h4>精準洗練</h4><div class="toolbar"><input id="affixSearch" type="search" aria-label="搜尋合法詞條" placeholder="搜尋此裝備的合法詞條"><select id="affixTarget" aria-label="目標詞條"></select></div><label class="check" id="affixFirstLabel" hidden><input id="affixFirst" type="checkbox">確認首次選定此槽</label><p id="affixFirstNote" class="muted small-text"></p><div id="affixPreview" class="small-text" role="status"></div><button id="affixReplace" class="primary small" disabled>套用詞條與係數</button><p class="muted small-text">預覽為這件裝備的屬性貢獻，包含同屬性的主屬性與其他詞條；不代表完整角色面板。保留洗練選槽，不扣魂魄。</p>`;
  if(choices.some(v=>`${v.z}:${v.id}`===old))$('affixItem').value=old;$('affixSlot').value=slot;
  let info=null;
  const target=()=>{const [plane,itemId]=$('affixItem').value.split(':').map(Number);return {plane,itemId,slot:Number($('affixSlot').value)};};
  const replacementPreview=()=>{
   $('affixReplace').disabled=true;
   try{if(!$('affixValue').value.trim()||!$('affixTarget').value)throw Error('請選擇合法詞條並輸入係數。');
    const p=C.previewEquipmentAffixReplacement(model,{...target(),attributeId:Number($('affixTarget').value),coefficient:Number($('affixValue').value),selectUnwashedSlot:!!info?.requiresInitialSelection});
    $('affixPreview').innerHTML=`<p>${esc(C.catalogName('attributes',p.before.attributeId))}（係數 ${esc(p.before.coefficient)}） → ${esc(C.catalogName('attributes',p.after.attributeId))}（係數 ${esc(p.after.coefficient)}）</p><table><thead><tr><th>裝備屬性</th><th>目前</th><th>套用後</th><th>差異</th></tr></thead><tbody>${p.effects.map(v=>`<tr><td>${esc(v.name)}</td><td>${esc(fmt(v.before))}${esc(v.unit)}</td><td>${esc(fmt(v.after))}${esc(v.unit)}</td><td>${esc(fmt(Math.round(v.delta*100)/100))} 百分點</td></tr>`).join('')}</tbody></table><p>${p.selectionChange?'首次選槽：未選定 → 槽 '+p.slot+'；其他槽將維持鎖定。':''}${p.unchanged?'詞條與係數未改變。':p.effectUnchanged?'取整後效果不變。':''}${p.verified?'':' 精準洗練尚待隔離驗證。'}</p>`;
    $('affixReplace').disabled=!p.verified||p.unchanged||info?.requiresInitialSelection&&!$('affixFirst').checked;
   }catch(e){$('affixPreview').textContent=e.message;}
  };
  const candidates=()=>{const selected=$('affixTarget').value||String(info?.attributeId||''),query=$('affixSearch').value.trim().toLowerCase();
   const rows=(info?.candidates||[]).filter(v=>v.name.toLowerCase().includes(query)||String(v.attributeId)===query);
   $('affixTarget').innerHTML='<option value="">選擇目標詞條</option>'+rows.map(v=>`<option value="${v.attributeId}" ${v.reason?'disabled':''}>${esc(v.name)}${v.reason?' · '+esc(v.reason):''}</option>`).join('');
   if(rows.some(v=>String(v.attributeId)===selected&&!v.reason))$('affixTarget').value=selected;replacementPreview();
  };
  const update=()=>{info=null;$('affixFirst').checked=false;$('affixFirstLabel').hidden=true;$('affixFirstNote').textContent='';
   try{let error;const t=target();for(const slot of [...new Set([t.slot,1,2,3,4,5])]){try{info=C.equipmentAffixReplacementInfo(model,{...t,slot});break;}catch(e){error=e;}}if(!info)throw error;
    const i=info;$('affixSlot').innerHTML=i.selectableSlots.map(s=>`<option value="${s}">詞條槽 ${s}</option>`).join('');$('affixSlot').value=String(i.slot);
    $('affixInfo').textContent=`${C.catalogName('attributes',i.attributeId)} · 目前 ${i.current} · 範圍 ${i.min}–${i.max}${i.requiresInitialSelection?' · 尚未選槽':''}`;
    $('affixValue').value=i.current;$('affixValue').min=i.min;$('affixValue').max=i.max;
    $('affixApply').disabled=i.requiresInitialSelection||!C.affixInfo(model,t.itemId,i.slot,t.plane).verified;
    $('affixFirstLabel').hidden=!i.requiresInitialSelection;$('affixFirst').disabled=!C.KNOWLEDGE.verification.equipmentAffixInitialSelection;$('affixFirstNote').textContent=i.requiresInitialSelection?(!C.KNOWLEDGE.verification.equipmentAffixInitialSelection?'首次選槽尚待原生遊戲 UI 驗證，目前停用。 ':'')+'首次套用後，遊戲只允許洗練此槽；編輯器內可整組還原。本次不扣魂魄。':'';
   }catch(e){$('affixInfo').textContent=e.message;$('affixApply').disabled=true;if(!info)$('affixValue').value='';}
   $('affixTarget').innerHTML='';$('affixSearch').value='';candidates();
  };
  $('affixItem').onchange=update;$('affixSlot').onchange=update;$('affixSearch').oninput=candidates;$('affixTarget').onchange=replacementPreview;$('affixValue').oninput=replacementPreview;$('affixFirst').onchange=replacementPreview;
  $('affixApply').onclick=()=>{if(!$('affixValue').value.trim())return toast('係數不能空白。',true);perform(()=>C.setEquipmentAffixCoefficient(model,{...target(),coefficient:Number($('affixValue').value)}));};
  $('affixReplace').onclick=()=>{if(!$('affixValue').value.trim())return toast('係數不能空白。',true);perform(()=>C.setEquipmentAffix(model,{...target(),attributeId:Number($('affixTarget').value),coefficient:Number($('affixValue').value),selectUnwashedSlot:!!info?.requiresInitialSelection&&$('affixFirst').checked}));};update();
 }
 function renderPills(){
  const aptitude=$('pillAptitude')?.value||'1',old=$('pillType')?.value;
  $('pillEditor').innerHTML=`<h3>丹藥資質累積增量</h3><div class="toolbar"><select id="pillAptitude" aria-label="丹藥資質">${['力量','敏捷','智力'].map((name,i)=>`<option value="${i+1}">${name}</option>`).join('')}</select><select id="pillType" aria-label="上限依據丹藥"></select></div><p id="pillInfo" class="muted small-text" role="status"></p><div class="toolbar"><label>累積增量（1＝資質 0.1 點）<input id="pillValue" type="number" min="0" step="1"></label><button id="pillApply" class="primary small">套用丹藥增量</button></div><p class="muted small-text">直接設定累積增量，可下降或歸零，不扣丹藥；以已持有的同類丹藥及角色上限限制。只支援無結丹紀錄且資質來源可核對的角色，重生會依原版清零。</p>`;
  $('pillAptitude').value=aptitude;
  const update=()=>{try{const i=C.pillInfo(model,Number($('characterSelect').value),Number($('pillAptitude').value),Number($('pillType').value));$('pillInfo').textContent=`目前累積 ${i.current}（總資質 ${i.total}） · 角色上限 ${i.cap} · 丹藥上限 ${i.pillCap} · 可填 0–${i.max}${i.verified?'':' · 尚待隔離驗證'}`;$('pillValue').value=i.current;$('pillValue').max=i.max;$('pillApply').disabled=!i.verified;}catch(e){$('pillInfo').textContent=e.message;$('pillValue').value='';$('pillApply').disabled=true;}};
  const choices=()=>{const rows=Object.entries(K.batch2Data.pills).filter(([id,p])=>p.aptitude===Number($('pillAptitude').value)&&read(Number(id),6,0)>0);$('pillType').innerHTML=rows.map(([id])=>`<option value="${id}">${esc(C.catalogName('materials',Number(id)))}</option>`).join('');if(rows.some(([id])=>id===old))$('pillType').value=old;update();};
  $('pillAptitude').onchange=choices;$('pillType').onchange=update;
  $('pillApply').onclick=()=>{if(!$('pillValue').value.trim())return toast('累積增量不能空白。',true);perform(()=>C.setPillAptitudeBonus(model,{characterId:Number($('characterSelect').value),aptitude:Number($('pillAptitude').value),pillId:Number($('pillType').value),bonus:Number($('pillValue').value)}));};choices();
 }
 function paged(kind,list,render,container){
  const size=50,max=Math.max(0,Math.ceil(list.length/size)-1);knowledgePages[kind]=Math.min(knowledgePages[kind],max);
  const page=knowledgePages[kind],start=page*size;
  $(container).innerHTML=list.length?list.slice(start,start+size).map(render).join(''):(container==='catalogRows'?'<p class="muted">沒有符合的資料。</p>':'<tr><td colspan="5" class="empty">沒有符合的資料。</td></tr>');
  $(kind+'PageInfo').textContent=list.length?`${start+1}–${Math.min(start+size,list.length)} / ${htmlValue(list.length)} 筆`:'0 筆';
  $(kind+'Prev').disabled=page===0;$(kind+'Next').disabled=page===max;
 }
 function renderKnowledgeTab(name){if(name==='professions')renderProfessions();if(name==='atlas')renderAtlas();if(!model)return;if(name==='characters')renderCharacters();if(name==='settlement')renderSettlement();if(name==='inventory')renderInventory();}
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
  $('growthStatus').textContent=['names','characterExperience','professionExperience','skillExperience'].every(k=>K.verification[k])?'名稱與經驗已通過隔離驗證':'部分養成功能待遊戲驗證';
  renderGrowth();renderPills();
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
  $('settlementNote').textContent=['buildings','facilities','quests'].includes(kind)?'以下為遊戲資料表，不代表已建造、已擁有或已完成。配置與進程請從欄位圖鑑對照原始記錄。':'可從下方調整操練上限或進階科技；研究與操練進行中不修改。';
  const rows=K.catalogs[kind].filter(r=>`${r.id} ${r.name} ${r.category}`.toLowerCase().includes(q));
  paged('settlement',rows,r=>`<tr><td><span class="mono muted">#${r.id}</span> ${esc(r.name)}</td><td>${esc(r.category)}</td><td>${kind==='technologies'?`科技等級 ${htmlValue(read(r.id,4,0))} · 研究狀態 ${htmlValue(read(r.id,13,0))}`:kind==='professions'?`操練上限 ${htmlValue(read(r.id,5,0))}`:'資料表 · 唯讀'}</td></tr>`,'settlementRows');
  renderEditing('training');renderEditing('technology');
 }
 function renderInventory(){
  const q=$('inventorySearch').value.trim().toLowerCase(),z=$('inventoryPlane').value;
  const rows=C.listEntities(model,'inventory').filter(r=>(!z||r.z===Number(z))&&`${r.id} ${r.name} ${r.detail}`.toLowerCase().includes(q));
  paged('inventory',rows,r=>`<tr><td class="mono">#${r.id} / ${esc(read(r.id,1,r.z))}</td><td>${esc(r.name)}</td><td>${r.z===7?'背包':'裝備庫／穿戴'}</td><td>${htmlValue(read(r.id,5,r.z))} / Lv ${htmlValue(read(r.id,6,r.z))}</td><td><button class="small" data-inspect-item="${r.id}" data-plane="${r.z}">查看欄位</button></td></tr>`,'inventoryRows');
  renderEditing('equipment');renderAffixes();
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
  try{const value=num(input),options={advanced:state.advanced};perform(()=>kind==='equipment'?C.setEquipmentLevel(model,{...options,plane:Number(state.id.split(':')[0]),itemId:Number(state.id.split(':')[1]),level:value}):kind==='training'?C.setProfessionTrainingCap(model,{...options,professionId:state.id,cap:value}):C.setAdvancedTechnologyLevel(model,{...options,technologyId:state.id,level:value}));}catch(error){toast(error.message,true);}
 });
 document.addEventListener('click',e=>{const b=e.target.closest('[data-inspect-item]');if(!b)return;atlasEntityId=Number(b.dataset.inspectItem);$('atlasPlane').value=b.dataset.plane;$('atlasSearch').value='';knowledgePages.atlas=0;showTab('atlas');});
