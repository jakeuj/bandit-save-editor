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
  let info,error='';try{info=C.editingInfo(model,kind,itemId,plane);}catch(e){error=e.message;}
  const backpackNormalOnly=kind==='equipment'&&plane===7&&!info?.advancedVerified;
  if(backpackNormalOnly||info?.isSet||info?.isTreasure)state.advanced=false;
  const enabled=info?.verified&&(!state.advanced||info.advancedVerified),max=state.advanced?info?.advancedMax:Math.min(info?.normalMax??0,info?.advancedMax??0);
  $(kind+'Editor').innerHTML=`<h3>${title}</h3><div class="toolbar"><select data-edit-target="${kind}" aria-label="選擇${title}目標">${choices.map(v=>`<option value="${v.id}" ${v.id===state.id?'selected':''}>${esc(v.label||'#'+v.id+' '+v.name)}</option>`).join('')}</select><label class="check"><input type="checkbox" data-edit-mode="${kind}" ${backpackNormalOnly||info?.isSet||info?.isTreasure?'disabled':''} ${state.advanced?'checked':''}>進階模式</label></div><p class="muted small-text">${info?`目前 ${htmlValue(info.current)} · 一般上限 ${htmlValue(info.normalMax)}${info.isSet?' · 套裝僅一般模式 · 套裝積分 '+htmlValue(info.record[23]):info.isTreasure?' · 寶物僅一般模式 · 等階 T'+htmlValue(info.record[3])+' · 品質 Q'+htmlValue(info.record[5])+' · 歸屬 '+(info.record[7]?'#'+htmlValue(info.record[7]):'無'):backpackNormalOnly?' · 背包僅一般模式':' · 進階驗證上限 '+htmlValue(info.advancedMax)}`:esc(error)}</p><div class="toolbar"><label>目標數值<input type="number" min="${info?.min??1}" max="${max??0}" step="1" value="${info?.current||info?.min||1}" data-edit-value="${kind}" aria-label="${title}目標數值" ${info?'':'disabled'}></label><button class="small primary" data-edit-apply="${kind}" ${enabled?'':'disabled'}>套用${title}</button></div><p class="muted small-text" role="status">${info?.isSet?'<span data-set-level-preview>只調整套裝等級；積分、品質與合成來源保留。</span>':info?.isTreasure?'<span data-treasure-level-preview>只調整寶物等級；品質、詞條、歸屬與魂魄資源保留，不扣魂魄。</span> ':''}${esc(error||(!enabled?info?.isTreasure?'寶物等級尚待首次獨立證明，目前停用。':'此修改模式尚待隔離遊戲驗證，目前停用。':state.advanced?'已驗證範圍內可超過原版上限；不扣取得成本。':'一般模式遵守原版上限，不扣取得成本。'))}${kind==='training'?' 職業自然成長仍受原版 30 級限制。':kind==='technology'?' 目標為存檔值；遊戲科技提示的 Lv 為此值加一。':''}</p>`;
  if(info?.isSet){
   const input=document.querySelector('[data-edit-value="equipment"]'),button=document.querySelector('[data-edit-apply="equipment"]'),preview=document.querySelector('[data-set-level-preview]');
   if(input&&button&&preview)input.oninput=()=>{const target=Number(input.value),valid=input.value.trim()!==''&&Number.isSafeInteger(target)&&target>=1&&target<=info.normalMax;preview.textContent=valid?'套裝等級 '+info.current+' → '+target+'；積分 '+info.record[23]+'、品質與合成來源保持。':'目標須為 1–'+info.normalMax+' 的整數。';button.disabled=!enabled||!valid;};
  }
  if(info?.isTreasure){
   const input=document.querySelector('[data-edit-value="equipment"]'),button=document.querySelector('[data-edit-apply="equipment"]'),preview=document.querySelector('[data-treasure-level-preview]');
   if(input&&button&&preview)input.oninput=()=>{const target=Number(input.value),valid=input.value.trim()!==''&&Number.isSafeInteger(target)&&target>=1&&target<=info.normalMax;preview.textContent=valid?'寶物等級 '+info.current+' → '+target+'；品質、詞條、歸屬與魂魄保持，不扣魂魄。':'目標須為 1–'+info.normalMax+' 的整數。';button.disabled=!enabled||!valid;};
  }
  // Preserve an unsubmitted number while toggling modes, but reset after applying or changing target.
  if(state.preserveValue&&old!==undefined)document.querySelector(`[data-edit-value="${kind}"]`).value=old;
  state.preserveValue=false;
 }
 function renderAffixes(){
  const old=$('affixItem')?.value,slot=$('affixSlot')?.value||'1';
  const choices=equipmentChoices();
  $('affixEditor').innerHTML=`<h3>詞條係數與精準洗練</h3><div class="toolbar"><select id="affixItem" aria-label="詞條裝備">${choices.map(v=>`<option value="${v.z}:${v.id}">${esc(equipmentLabel(v))}</option>`).join('')}</select><select id="affixSlot" aria-label="詞條槽">${Array.from({length:5},(_,i)=>`<option value="${i+1}">詞條槽 ${i+1}</option>`).join('')}</select></div><p id="affixInfo" class="muted small-text" role="status"></p><div class="toolbar"><label>目標係數<input id="affixValue" type="number" step="0.01"></label><button id="affixApply" class="primary small">套用詞條係數</button></div><p class="muted small-text">上方係數操作只調既有係數；下方精準洗練可替換合法詞條，兩者皆不重置選槽。首次選槽請使用下方精準洗練並確認；品質請使用品質升降；特殊裝備與超限值保持唯讀。</p><h4>精準洗練</h4><div class="toolbar"><input id="affixSearch" type="search" aria-label="搜尋合法詞條" placeholder="搜尋此裝備的合法詞條"><select id="affixTarget" aria-label="目標詞條"></select></div><label class="check" id="affixFirstLabel" hidden><input id="affixFirst" type="checkbox">確認首次選定此槽</label><p id="affixFirstNote" class="muted small-text"></p><div id="affixPreview" class="small-text" role="status"></div><button id="affixReplace" class="primary small" disabled>套用詞條與係數</button><p class="muted small-text">預覽為這件裝備的屬性貢獻，包含同屬性的主屬性與其他詞條；不代表完整角色面板。保留洗練選槽，不扣魂魄。</p>`;
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
 function renderQuality(){
  const old=$('qualityItem')?.value,choices=equipmentChoices(),names=['','凡物','優秀','精緻','絕世','傳說','神話'];
  $('qualityEditor').innerHTML=`<h3>裝備品質升降</h3><div class="toolbar"><select id="qualityItem" aria-label="品質裝備">${choices.map(v=>`<option value="${v.z}:${v.id}">${esc(equipmentLabel(v))}</option>`).join('')}</select><select id="qualityTarget" aria-label="目標品質" aria-describedby="qualityInfo"></select></div><p id="qualityInfo" class="muted small-text" role="status"></p><div id="qualityAdditions"></div><p class="muted small-text">手機可左右捲動下方比較表。</p><div id="qualityPreview" class="small-text" role="status"></div><label id="qualityRemovalLabel" class="check" hidden><input id="qualityRemoval" type="checkbox">確認移除預覽中的尾端詞條槽</label><button id="qualityApply" class="primary small" disabled>套用品質調整</button><p class="muted small-text">保留原係數在品質區間內的相對位置，不重抽、不扣成本；保留等級與已選洗練槽。預覽只計算這件裝備，不代表完整角色面板。</p>`;
  if(choices.some(v=>`${v.z}:${v.id}`===old))$('qualityItem').value=old;
  let info=null;
  const target=()=>{const [plane,itemId]=$('qualityItem').value.split(':').map(Number);return {plane,itemId,quality:Number($('qualityTarget').value)};};
  const additions=()=>{const q=Number($('qualityTarget').value);return Array.from({length:Math.max(0,q-(info?.quality??q))},(_,n)=>{const slot=info.slots+n+1;if(!$('qualityCoefficient'+slot).value.trim())throw Error('新增詞條係數不能空白。');return {slot,attributeId:Number($('qualityAffix'+slot).value),coefficient:Number($('qualityCoefficient'+slot).value)};});};
  const preview=()=>{try{
   if(!info)throw Error('請選擇有效普通裝備。');
   const p=C.previewEquipmentQualityChange(model,{...target(),addedAffixes:additions()});
   const qName=q=>`${q}・${names[q]}`;
   $('qualityPreview').innerHTML=`<p>品質 ${esc(qName(p.previousQuality))} → ${esc(qName(p.quality))} · 等級上限 ${htmlValue(p.previousMax)} → ${htmlValue(p.normalMax)}<br>主係數 ${htmlValue(p.mainCoefficient.before)} → ${htmlValue(p.mainCoefficient.after)} · 已選槽 ${p.selectedSlot??'無'}</p><div class="table-wrap"><table><thead><tr><th>槽位／動作</th><th>目前詞條／係數／旗標</th><th>套用後</th></tr></thead><tbody>${p.slots.map(s=>`<tr><td>${s.slot}・${({added:'新增',removed:'移除',retained:'保留'})[s.kind]}</td><td>${s.before.attributeId?esc(C.catalogName('attributes',s.before.attributeId)):'無'} / ${htmlValue(s.before.coefficient)} / ${s.before.flag}</td><td>${s.after.attributeId?esc(C.catalogName('attributes',s.after.attributeId)):'無'} / ${htmlValue(s.after.coefficient)} / ${s.after.flag}</td></tr>`).join('')}</tbody></table></div><div class="table-wrap"><table><thead><tr><th>裝備屬性</th><th>目前</th><th>套用後</th><th>差異</th></tr></thead><tbody>${p.effects.filter(e=>e.before||e.after).map(e=>`<tr><td>${esc(e.name)}</td><td>${htmlValue(e.before)}${esc(e.unit)}</td><td>${htmlValue(e.after)}${esc(e.unit)}</td><td>${htmlValue(e.delta)}${e.unit==='%'?' 百分點':''}</td></tr>`).join('')}</tbody></table></div><p>${p.unchanged?'品質未改變。':p.effectUnchanged?'取整後效果不變。':''}${!p.verified?' 此庫別與升降方向尚待獨立遊戲驗證，目前停用。':''}</p>`;
   $('qualityRemovalLabel').hidden=!p.requiresRemovalConfirmation;
   $('qualityApply').disabled=!p.verified||p.unchanged||p.requiresRemovalConfirmation&&!$('qualityRemoval').checked;
  }catch(e){$('qualityPreview').textContent=e.message;$('qualityApply').disabled=true;}};
  const changed=()=>{$('qualityRemoval').checked=false;preview();};
  const rows=()=>{if(!info)return;const q=Number($('qualityTarget').value),min=10*(q-1),max=60+10*q;$('qualityRemoval').checked=false;$('qualityRemovalLabel').hidden=q>=info.quality;
   $('qualityAdditions').innerHTML=Array.from({length:Math.max(0,q-info.quality)},(_,n)=>{const s=info.slots+n+1;return `<div class="form-card"><h4>新增詞條槽 ${s}</h4><div class="toolbar"><input id="qualitySearch${s}" type="search" aria-label="搜尋新增槽 ${s} 詞條" placeholder="搜尋合法詞條"><select id="qualityAffix${s}" aria-label="新增槽 ${s} 詞條"><option value="">請明選詞條</option>${info.candidates.map(v=>`<option value="${v.attributeId}" ${info.record.slice(9,9+info.slots).includes(v.attributeId)?'disabled':''}>${esc(v.name)}</option>`).join('')}</select><label>係數<input id="qualityCoefficient${s}" aria-label="新增槽 ${s} 係數" type="number" min="${min}" max="${max}" step="0.01" value="${(min+max)/2}"></label></div></div>`;}).join('');
   for(let s=info.slots+1;s<q;s++){
    $('qualityAffix'+s).onchange=changed;$('qualityCoefficient'+s).oninput=changed;
    $('qualitySearch'+s).oninput=()=>{const select=$('qualityAffix'+s),value=select.value,search=$('qualitySearch'+s).value.trim().toLowerCase();select.innerHTML='<option value="">請明選詞條</option>'+info.candidates.filter(v=>!search||`${v.name} ${v.attributeId}`.toLowerCase().includes(search)||String(v.attributeId)===value).map(v=>`<option value="${v.attributeId}" ${String(v.attributeId)===value?'selected':''} ${info.record.slice(9,9+info.slots).includes(v.attributeId)?'disabled':''}>${esc(v.name)}</option>`).join('');changed();};
   }preview();
  };
  const update=()=>{info=null;$('qualityRemoval').checked=false;$('qualityRemovalLabel').hidden=true;$('qualityAdditions').innerHTML='';try{if(!choices.length)throw Error('目前沒有可選擇的裝備。');const {itemId,plane}=target();info=C.equipmentQualityInfo(model,{itemId,plane});$('qualityTarget').disabled=false;$('qualityTarget').innerHTML=info.targets.map(t=>`<option value="${t.quality}" ${t.quality===info.quality?'selected':''} ${t.allowed?'':'disabled'}>${t.quality}・${names[t.quality]}${t.reason?'・'+esc(t.reason):''}</option>`).join('');$('qualityInfo').textContent=`目前品質 ${info.quality} · 等級 ${info.current} · 主係數 ${info.mainCoefficient} · 升品須明選新增槽，降品須確認刪除尾槽。`;rows();}catch(e){info=null;$('qualityTarget').innerHTML='<option value="">無法調整品質</option>';$('qualityTarget').disabled=true;$('qualityInfo').textContent=e.message;$('qualityAdditions').innerHTML='';$('qualityRemovalLabel').hidden=true;$('qualityPreview').textContent='';$('qualityApply').disabled=true;}};
  $('qualityItem').onchange=update;$('qualityTarget').onchange=rows;$('qualityRemoval').onchange=preview;
  $('qualityApply').onclick=()=>{try{const o={...target(),addedAffixes:additions(),confirmRemovedAffixes:$('qualityRemoval').checked};perform(()=>C.setEquipmentQuality(model,o));}catch(e){toast(e.message,true);}};update();
 }
 function renderSetQuality(){
  const old=$('setQualityItem')?.value,names=['','凡物','優秀','精緻','絕世','傳說','神話'],sets=C.KNOWLEDGE.setEquipmentLevel?.items||{};
  const choices=equipmentChoices().filter(v=>sets[read(v.id,1,v.z)]);
  $('setQualityEditor').innerHTML=`<h3>套裝品質</h3><div class="toolbar"><select id="setQualityItem" aria-label="套裝品質裝備">${choices.map(v=>`<option value="${v.z}:${v.id}">${esc(equipmentLabel(v))}</option>`).join('')}</select><select id="setQualityTarget" aria-label="套裝目標品質"></select></div><p id="setQualityInfo" class="muted small-text" role="status"></p><p id="setQualityStatus" class="small-text" role="status"></p><details><summary>詞條池與每槽來源</summary><div id="setQualityPools" class="small-text"></div></details><div id="setQualityAdditions"></div><div id="setQualityPreview" class="small-text" role="status"></div><label id="setQualityRemovalLabel" class="check" hidden><input id="setQualityRemoval" type="checkbox">確認移除預覽中的尾端詞條槽</label><div class="toolbar"><button id="setQualityApply" class="primary small" disabled>套用套裝品質</button><button id="setQualityReset" class="small" type="button">重設選項與確認</button></div><p class="muted small-text">新增尾槽只能用原裝備詞條池（P原），旗標為 0；降品會刪除尾槽，須先確認。主係數每級 ±30、保留槽係數每級 ±10。品質不改等級，超過目標上限須先降低套裝等級。套裝積分與額外套裝效果不隨品質改變。</p>`;
  if(choices.some(v=>`${v.z}:${v.id}`===old))$('setQualityItem').value=old;
  let info=null;
  const target=()=>{const [plane,itemId]=$('setQualityItem').value.split(':').map(Number);return {plane,itemId,quality:Number($('setQualityTarget').value)};};
  const attrName=id=>id?C.catalogName('attributes',id):'無';
  const additions=()=>{const q=Number($('setQualityTarget').value);return Array.from({length:Math.max(0,q-(info?.quality??q))},(_,n)=>{const slot=info.quality+n;if(!$('setQualityAffix'+slot).value)throw Error('請明選新增槽 '+slot+' 的詞條。');if(!$('setQualityCoefficient'+slot).value.trim())throw Error('新增詞條係數不能空白。');return {slot,attributeId:Number($('setQualityAffix'+slot).value),coefficient:Number($('setQualityCoefficient'+slot).value)};});};
  const preview=()=>{
   $('setQualityApply').disabled=true;
   try{
    if(!info)throw Error('請選擇有效套裝裝備。');
    const o={...target(),addedAffixes:additions()},p=C.previewSetEquipmentQualityCandidate(model,o),f=C.setEquipmentQualityCandidateEffects(model,o);
    const dir=p.direction==='upgrade'?'升品':p.direction==='downgrade'?'降品':'未變';
    $('setQualityStatus').textContent=p.group?`${info.plane===7?'背包':'裝備庫'} · ${dir} · 群組 ${p.group} · ${p.verified?'已通過驗證':'尚待獨立遊戲驗證，套用停用'}`:'品質未改變。';
    $('setQualityPreview').innerHTML=`<p>品質 ${p.previousQuality}・${names[p.previousQuality]} → ${p.quality}・${names[p.quality]} · 等級 ${htmlValue(p.level)}（上限 ${htmlValue(p.previousMax)} → ${htmlValue(p.normalMax)}）<br>主係數 ${htmlValue(p.mainCoefficient.before)} → ${htmlValue(p.mainCoefficient.after)} · 已選槽 ${p.selectedSlot??'無'}</p><div class="table-wrap"><table><thead><tr><th>槽位／動作</th><th>來源</th><th>目前詞條／係數／旗標</th><th>套用後</th></tr></thead><tbody>${p.slots.map(s=>`<tr><td>${s.slot}・${({added:'新增',removed:'移除',retained:'保留'})[s.kind]}</td><td>${({origin:'P原',set:'P套',both:'P原＋P套'})[s.source]}</td><td>${esc(attrName(s.before.attributeId))} / ${htmlValue(s.before.coefficient)} / ${s.before.flag}</td><td>${esc(attrName(s.after.attributeId))} / ${htmlValue(s.after.coefficient)} / ${s.after.flag}</td></tr>`).join('')}</tbody></table></div><div class="table-wrap"><table><thead><tr><th>裝備屬性</th><th>目前</th><th>套用後</th><th>差異</th></tr></thead><tbody>${f.effects.filter(e=>e.before||e.after).map(e=>`<tr><td>${esc(e.name)}</td><td>${htmlValue(e.before)}${esc(e.unit)}</td><td>${htmlValue(e.after)}${esc(e.unit)}</td><td>${htmlValue(Math.round(e.delta*100)/100)}${e.unit==='%'?' 百分點':''}</td></tr>`).join('')}</tbody></table></div><p>${p.unchanged?'品質未改變。':f.effectUnchanged?'取整後效果不變。':''}${esc(f.setBonusNote)}</p>`;
    $('setQualityRemovalLabel').hidden=!p.requiresRemovalConfirmation;
    $('setQualityApply').disabled=!p.verified||p.unchanged||p.requiresRemovalConfirmation&&!$('setQualityRemoval').checked;
   }catch(e){$('setQualityStatus').textContent='';$('setQualityPreview').textContent=e.message;$('setQualityRemovalLabel').hidden=true;}
  };
  const changed=()=>{$('setQualityRemoval').checked=false;preview();};
  const rows=()=>{
   if(!info)return;const q=Number($('setQualityTarget').value),min=10*(q-1),max=60+10*q,kept=info.slots.slice(0,Math.min(q,info.quality)-1).map(v=>v.attributeId);
   $('setQualityRemoval').checked=false;$('setQualityRemovalLabel').hidden=q>=info.quality;
   $('setQualityAdditions').innerHTML=Array.from({length:Math.max(0,q-info.quality)},(_,n)=>{const s=info.quality+n;return `<div class="form-card"><h4>新增詞條槽 ${s}（P原）</h4><div class="toolbar"><select id="setQualityAffix${s}" aria-label="新增槽 ${s} 詞條"><option value="">請明選詞條</option>${info.pools.origin.map(id=>`<option value="${id}" ${kept.includes(id)?'disabled':''}>${esc(attrName(id))}</option>`).join('')}</select><label>係數<input id="setQualityCoefficient${s}" aria-label="新增槽 ${s} 係數" type="number" min="${min}" max="${max}" step="0.01" value="${(min+max)/2}"></label></div></div>`;}).join('');
   for(let s=info.quality;s<q;s++){$('setQualityAffix'+s).onchange=changed;$('setQualityCoefficient'+s).oninput=changed;}
   preview();
  };
  const update=()=>{
   info=null;$('setQualityRemoval').checked=false;$('setQualityRemovalLabel').hidden=true;$('setQualityAdditions').innerHTML='';$('setQualityStatus').textContent='';$('setQualityPools').textContent='';
   try{
    if(!choices.length)throw Error('目前沒有可選擇的套裝裝備。');
    const {itemId,plane}=target();info=C.setEquipmentQualityCandidateInfo(model,{itemId,plane});
    $('setQualityTarget').disabled=false;$('setQualityTarget').innerHTML=[1,2,3,4,5,6].map(q=>`<option value="${q}" ${q===info.quality?'selected':''}>${q}・${names[q]}</option>`).join('');
    $('setQualityInfo').textContent=`目前品質 ${info.quality} · 等級 ${info.level}（上限 ${info.normalMax}） · 主係數 ${info.mainCoefficient} · 已選槽 ${info.selectedSlot??'無'} · 升品 ${info.verified.upgrade?'已驗證':'待驗證'} · 降品 ${info.verified.downgrade?'已驗證':'待驗證'}`;
    $('setQualityPools').innerHTML=`<p>P原（${info.pools.origin.length}）：${esc(info.pools.origin.map(attrName).join('、'))}</p><p>P套（${info.pools.set.length}）：${esc(info.pools.set.map(attrName).join('、'))}</p><p>現有槽來源：${info.slots.map(s=>`槽 ${s.slot} ${({origin:'P原',set:'P套',both:'P原＋P套'})[s.source]}${s.selected?'（已選）':''}`).join('；')||'無'}</p>`;
    rows();
   }catch(e){info=null;$('setQualityTarget').innerHTML='<option value="">無法調整品質</option>';$('setQualityTarget').disabled=true;$('setQualityInfo').textContent=e.message;$('setQualityPreview').textContent='';$('setQualityApply').disabled=true;}
  };
  $('setQualityItem').onchange=update;$('setQualityTarget').onchange=rows;$('setQualityRemoval').onchange=preview;$('setQualityReset').onclick=update;
  $('setQualityApply').onclick=()=>{try{const o={...target(),addedAffixes:additions(),confirmRemovedAffixes:$('setQualityRemoval').checked};perform(()=>C.applySetEquipmentQualityCandidate(model,o));}catch(e){toast(e.message,true);}};update();
 }
 function renderPills(){
  const aptitude=$('pillAptitude')?.value||'1',old=$('pillType')?.value;
  $('pillEditor').innerHTML=`<h3>丹藥資質累積增量</h3><div class="toolbar"><select id="pillAptitude" aria-label="丹藥資質">${['力量','敏捷','智力'].map((name,i)=>`<option value="${i+1}">${name}</option>`).join('')}</select><select id="pillType" aria-label="上限依據丹藥"></select></div><p id="pillInfo" class="muted small-text" role="status"></p><div class="toolbar"><label>累積增量（1＝資質 0.1 點）<input id="pillValue" type="number" min="0" step="1"></label><button id="pillApply" class="primary small">套用丹藥增量</button></div><p class="muted small-text">直接設定累積增量，可下降或歸零，不扣丹藥；以已持有的同類丹藥及角色上限限制。只支援資質來源與結丹紀錄可核對的角色；結丹角色的上限倍率依入體內丹係數計算，重生會依原版清零。</p>`;
  $('pillAptitude').value=aptitude;
  const update=()=>{try{const i=C.pillInfo(model,Number($('characterSelect').value),Number($('pillAptitude').value),Number($('pillType').value));$('pillInfo').textContent=`目前累積 ${i.display}（總資質 ${i.total}） · 角色上限 ${i.cap}${i.ascensions?`（結丹 ${i.ascensions} 次，倍率 ${i.multiplier}）`:""} · 丹藥上限 ${i.pillCap} · 可填 0–${i.max}${i.decimal?'（最多一位小數）':''}${i.verified?'':' · 尚待隔離驗證'}`;$('pillValue').value=i.display;$('pillValue').max=i.max;$('pillValue').step=i.step;$('pillApply').disabled=!i.verified;}catch(e){$('pillInfo').textContent=e.message;$('pillValue').value='';$('pillApply').disabled=true;}};
  const choices=()=>{const rows=Object.entries(K.batch2Data.pills).filter(([id,p])=>p.aptitude===Number($('pillAptitude').value)&&read(Number(id),6,0)>0);$('pillType').innerHTML=rows.map(([id])=>`<option value="${id}">${esc(C.catalogName('materials',Number(id)))}</option>`).join('');if(rows.some(([id])=>id===old))$('pillType').value=old;update();};
  $('pillAptitude').onchange=choices;$('pillType').onchange=update;
  $('pillApply').onclick=()=>{if(!$('pillValue').value.trim())return toast('累積增量不能空白。',true);perform(()=>C.setPillAptitudeBonus(model,{characterId:Number($('characterSelect').value),aptitude:Number($('pillAptitude').value),pillId:Number($('pillType').value),bonus:Number($('pillValue').value)}));};choices();
 }
 function renderBaseAptitudes(){
  const characterId=Number($('characterSelect').value),info=C.randomCharacterGrowthInfo(model,{characterId});
  $('baseAptitudeEditor').innerHTML=`<h3>一般隨機角色基礎資質</h3><p class="muted small-text" id="baseAptitudeStatus" role="status"></p><div class="aptitude-inputs">${['力量','敏捷','智力'].map((name,i)=>`<label>${name}原始值<input id="baseAptitude${i}" type="number" min="1" max="300" step="1" value="${esc(read(characterId,10+i,2))}" ${info.eligible?'':'disabled'}></label>`).join('')}</div><p class="muted small-text">每 1 代表顯示資質 0.1 點。三項須能由同品質的原版招募共同生成；不修改品質、天賦或丹藥。還原會一起還原此角色三項基礎及三項丹藥增量。</p><div class="toolbar"><button id="baseAptitudePreviewBtn" class="small">預覽三項資質</button><button id="baseAptitudeApplyBtn" class="primary small" disabled>套用三項資質</button></div><div id="baseAptitudePreview" aria-live="polite"></div>`;
  $('baseAptitudeStatus').textContent=info.eligible?`品質 ${info.quality} · 同品質任一原生傾向${info.ascensions?` · 結丹 ${info.ascensions} 次，倍率 ${info.multiplier}`:''}${info.verified?'':' · 尚待獨立隔離驗證，套用停用'}`:info.reasons.join('；');
  $('baseAptitudePreviewBtn').disabled=!info.eligible;
  let snapshot=null;
  const request=()=>({characterId,baseRaw:[0,1,2].map(i=>{const s=$('baseAptitude'+i).value;if(!s.trim())throw Error('三項基礎資質不能空白。');return Number(s);})});
  const invalidate=()=>{snapshot=null;$('baseAptitudeApplyBtn').disabled=true;$('baseAptitudePreview').textContent='輸入已變更，請重新預覽。';};
  for(let i=0;i<3;i++)$('baseAptitude'+i).oninput=invalidate;
  $('baseAptitudePreviewBtn').onclick=()=>{try{
   const o=request(),p=C.previewCharacterBaseAptitudes(model,o);snapshot={model,revision,request:JSON.stringify(o)};
   $('baseAptitudePreview').innerHTML=(p.reasons.length?`<p class="negative">${esc(p.reasons.join('；'))}</p>`:'')+(p.aptitudes?.[0]?.after?`<div class="tablewrap"><table><thead><tr><th>資質</th><th>原始值</th><th>來源 A</th><th>丹藥 B</th><th>總資質</th><th>上限 C</th></tr></thead><tbody>${p.aptitudes.map(a=>`<tr><td>${esc(a.name)}</td>${['raw','base','bonus','total','cap'].map(k=>`<td>${esc(a.before[k])} → ${esc(a.after[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'')+(p.unchanged?'<p class="muted">三項均無變更。</p>':'');
   $('baseAptitudeApplyBtn').disabled=!p.canApply;
  }catch(e){snapshot=null;$('baseAptitudeApplyBtn').disabled=true;$('baseAptitudePreview').textContent=e.message;}};
  $('baseAptitudeApplyBtn').onclick=()=>{try{const o=request();if(!snapshot||snapshot.model!==model||snapshot.revision!==revision||snapshot.request!==JSON.stringify(o))throw Error('存檔或輸入已變更，請重新預覽。');perform(()=>C.setCharacterBaseAptitudes(model,o));}catch(e){invalidate();toast(e.message,true);}};
 }
 function renderSkillCaps(){
  const characterId=Number($('characterSelect').value),info=C.randomCharacterSkillCapsInfo(model,{characterId});
  $('skillCapsEditor').innerHTML=`<h3>一般隨機角色九項技藝上限</h3><p class="muted small-text" id="skillCapsStatus" role="status"></p><div class="aptitude-inputs">${C.SKILLS.map((name,i)=>`<label for="skillCap${i+1}">${esc(name)}上限<input id="skillCap${i+1}" type="number" min="1" step="1" value="${esc(read(characterId,22+i,2))}" ${info.eligible?'':'disabled'}></label>`).join('')}</div><p class="muted small-text">九項須與目前品質、原始資質及三項天賦符合相同的原版招募傾向與主副技藝條件；只調上限，不改天賦。提高上限保留等級與經驗餘額，不會立即升級；低於目前等級，或降低至目前等級且仍有餘額時，整筆阻擋。</p><p class="muted small-text" id="skillCapsRestoreNote">首次有效上限調整後，此角色九項上限、等級與經驗餘額共 27 欄會累計一起還原，包含先前及後續的單項／全部技藝經驗修改。還原回載入時；復原一步只撤回上一筆操作。其他角色不受影響。</p><div class="toolbar"><button id="skillCapsPreviewBtn" class="small">預覽九項上限</button><button id="skillCapsApplyBtn" class="primary small" disabled>套用九項上限</button></div><div id="skillCapsPreview" aria-live="polite"></div>`;
  $('skillCapsStatus').textContent=info.eligible?`品質 ${info.quality} · 目前九項有共同生成條件${info.ascensions?` · 結丹 ${info.ascensions} 次`:''}${info.verified?' · 已通過獨立隔離驗證':' · 尚待獨立隔離驗證，可預覽，套用停用'}`:info.reasons.join('；');
  $('skillCapsPreviewBtn').disabled=!info.eligible;
  let snapshot=null;
  const request=()=>({characterId,caps:C.SKILLS.map((_,i)=>{const value=$('skillCap'+(i+1)).value;if(!value.trim())throw Error('九項上限不能空白。');return Number(value);})});
  const invalidate=()=>{snapshot=null;$('skillCapsApplyBtn').disabled=true;$('skillCapsPreview').textContent='輸入已變更，請重新預覽。';};
  for(let i=1;i<=9;i++)$('skillCap'+i).oninput=invalidate;
  $('skillCapsPreviewBtn').onclick=()=>{try{
   const options=request(),preview=C.previewCharacterSkillCaps(model,options);snapshot={model,revision,request:JSON.stringify(options),preview};
   const witness=preview.witnesses[0],orientation=witness?.orientation==='生产'?'生產':witness?.orientation;
   $('skillCapsPreview').innerHTML=(preview.reasons.length?`<p class="negative">${esc(preview.reasons.join('；'))}</p>`:'')+(preview.rows.length?`<div class="tablewrap"><table><thead><tr><th>技藝</th><th>上限（目前 → 套用後）</th><th>等級（目前 → 套用後）</th><th>經驗餘額（目前 → 套用後）</th></tr></thead><tbody>${preview.rows.map(row=>`<tr${row.before.cap!==row.after.cap?' class="changed"':''}><td>${esc(row.name)}</td>${['cap','level','experience'].map(key=>`<td>${htmlValue(row.before[key])} → ${htmlValue(row.after[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="small-text">${preview.unchanged?'九項均無變更，不會新增歷史。':`上限變更 ${preview.changes.length} 項；全部九項等級與經驗餘額保持原值。`}</p>`:'')+(witness?`<p class="muted small-text">可行招募組合之一：${esc(orientation)}傾向、主要${esc(C.SKILLS[witness.primary-1])}、次要${esc(C.SKILLS[witness.secondary-1])}。這是固定資質與天賦下的可生成條件，不代表角色的招募歷史。</p>`:'')+(!preview.verified?'<p class="negative">尚待相符來源的獨立隔離驗證，目前不能套用。</p>':'');
   $('skillCapsApplyBtn').disabled=!preview.canApply;
  }catch(error){snapshot=null;$('skillCapsApplyBtn').disabled=true;$('skillCapsPreview').textContent=error.message;}};
  $('skillCapsApplyBtn').onclick=()=>{try{
   const options=request();if(!snapshot||snapshot.model!==model||snapshot.revision!==revision||snapshot.request!==JSON.stringify(options))throw Error('存檔或輸入已變更，請重新預覽。');
   if(perform(()=>C.setCharacterSkillCaps(model,options,{preview:snapshot.preview})))toast('九項上限已套用；此角色全部技藝會累計一起還原。');
  }catch(error){invalidate();toast(error.message,true);}};
 }
 function renderTalentLevels(){
  // The container is added with the task-9 rebuild; an older page simply skips this editor.
  if(!$('talentLevelsEditor'))return;
  const characterId=Number($('characterSelect').value),info=C.randomCharacterTalentsInfo(model,{characterId});
  const effect=e=>`${esc(e.name)} ${htmlValue(e.value)}${e.unit==='百分比'?'%':''}`,effects=list=>list.map(effect).join('、');
  $('talentLevelsEditor').innerHTML=`<h3>一般隨機角色天賦等級</h3><p class="muted small-text" id="talentLevelsStatus" role="status"></p>${info.eligible?`<div class="tablewrap"><table><thead><tr><th>槽</th><th>天賦</th><th>等級</th><th>目前效果</th></tr></thead><tbody>${info.slots.map(s=>`<tr><td>${s.slot}</td><td>#${s.id} ${esc(s.name)}</td><td><select id="talentLevel${s.slot}" aria-label="第 ${s.slot} 槽天賦等級" ${info.levelPool.length>1?'':'disabled'}>${info.levelPool.map(l=>`<option value="${l}" ${l===s.level?'selected':''}>Lv ${l}</option>`).join('')}</select></td><td>${effects(s.effects)}</td></tr>`).join('')}</tbody></table></div>`:''}<p class="muted small-text">只調整三槽天賦等級，等級須在角色品質的原版等級池內；天賦 ID 依原版招募固定，不能更換或清空。力量／敏捷／智力強化會改變資質來源與丹藥上限，既有丹藥增量超過新上限時整筆阻擋，不會截斷。</p><p class="muted small-text" id="talentLevelsRestoreNote">此角色三槽天賦等級、三項基礎資質與丹藥增量共 12 欄會累計一起還原；復原一步只撤回上一筆操作。其他角色與技藝上限不受影響。</p><div class="toolbar"><button id="talentLevelsPreviewBtn" class="small">預覽天賦等級</button><button id="talentLevelsApplyBtn" class="primary small" disabled>套用天賦等級</button></div><div id="talentLevelsPreview" aria-live="polite"></div>`;
  $('talentLevelsStatus').textContent=info.eligible?`品質 ${info.quality} · 等級池 ${info.levelPool.join('、')}${info.levelPool.length>1?'':' · 此品質只有一個等級，無可調整值'}${info.ascensions?` · 結丹 ${info.ascensions} 次，倍率 ${info.multiplier}`:''}${info.verified?' · 已通過獨立隔離驗證':' · 尚待獨立隔離驗證，可預覽，套用停用'}`:info.reasons.join('；');
  $('talentLevelsPreviewBtn').disabled=!info.eligible||info.levelPool.length<2;
  if(!info.eligible)return;
  let snapshot=null;
  const request=()=>({characterId,levels:info.slots.map(s=>Number($('talentLevel'+s.slot).value))});
  const invalidate=()=>{snapshot=null;$('talentLevelsApplyBtn').disabled=true;$('talentLevelsPreview').textContent='輸入已變更，請重新預覽。';};
  for(const s of info.slots)$('talentLevel'+s.slot).onchange=invalidate;
  $('talentLevelsPreviewBtn').onclick=()=>{try{
   const options=request(),preview=C.previewCharacterTalents(model,options);snapshot={model,revision,request:JSON.stringify(options),preview};
   const after=new Map(preview.changes.map(c=>[c.slot,c]));
   $('talentLevelsPreview').innerHTML=(preview.reasons.length?`<p class="negative">${esc(preview.reasons.join('；'))}</p>`:'')+(!preview.reasons.length?`<div class="tablewrap"><table><thead><tr><th>天賦</th><th>等級（目前 → 套用後）</th><th>效果（目前 → 套用後）</th></tr></thead><tbody>${info.slots.map(s=>{const c=after.get(s.slot);return `<tr${c?' class="changed"':''}><td>#${s.id} ${esc(s.name)}</td><td>${s.level} → ${c?c.after:s.level}</td><td>${effects(s.effects)} → ${effects(c?c.effects:s.effects)}</td></tr>`;}).join('')}</tbody></table></div>`:'')+(preview.aptitudes.length?`<div class="tablewrap"><table><thead><tr><th>資質</th><th>來源 A（目前 → 套用後）</th><th>丹藥 B</th><th>總資質</th><th>上限 C（目前 → 套用後）</th></tr></thead><tbody>${preview.aptitudes.map(a=>`<tr><td>${esc(a.name)}</td><td>${htmlValue(a.before.base)} → ${htmlValue(a.after.base)}</td><td>${htmlValue(a.after.bonus)}</td><td>${htmlValue(a.after.total)}</td><td>${htmlValue(a.before.cap)} → ${htmlValue(a.after.cap)}</td></tr>`).join('')}</tbody></table></div>`:'')+(preview.unchanged?'<p class="muted small-text">三槽等級均無變更，不會新增歷史。</p>':'')+(!preview.verified?'<p class="negative">尚待相符來源的獨立隔離驗證，目前不能套用。</p>':'');
   $('talentLevelsApplyBtn').disabled=!preview.canApply;
  }catch(error){snapshot=null;$('talentLevelsApplyBtn').disabled=true;$('talentLevelsPreview').textContent=error.message;}};
  $('talentLevelsApplyBtn').onclick=()=>{try{
   const options=request();if(!snapshot||snapshot.model!==model||snapshot.revision!==revision||snapshot.request!==JSON.stringify(options))throw Error('存檔或輸入已變更，請重新預覽。');
   if(perform(()=>C.setCharacterTalents(model,options,{preview:snapshot.preview})))toast('天賦等級已套用；此角色天賦、基礎資質與丹藥增量會一起還原。');
  }catch(error){invalidate();toast(error.message,true);}};
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
  const rows=C.listEntities(model,'characters').filter(r=>q.startsWith('#')?String(r.id)===q.slice(1):`${r.id} ${r.name}`.toLowerCase().includes(q));
  $('characterMatchInfo').textContent=rows.length>50?`符合 ${rows.length} 名，先顯示 50 名；請搜尋名稱或 #ID。`:'';
  const visible=rows.slice(0,50);
  $('characterSelect').innerHTML=visible.map(r=>`<option value="${r.id}">#${r.id} ${esc(r.name)} · ${esc(r.detail)}</option>`).join('');
  if(visible.some(r=>String(r.id)===old))$('characterSelect').value=old;
  $('characterEmpty').hidden=!!rows.length;$('characterBody').hidden=!rows.length;if(!rows.length)return;
  const x=Number($('characterSelect').value);
  $('characterName').value=read(x,1,2);$('renameCharacterBtn').disabled=!K.verification.names;
  $('characterSummary').innerHTML=stat('角色等級',read(x,3,2))+stat('自然經驗餘額',read(x,4,2))+stat('等級上限',(Math.floor(read(x,50,2))+1)*30)+stat('目前職業',C.catalogName('professions',read(x,6,2)))+stat('共用池已投入經驗',read(x,56,2))+stat('自動轉職預設',read(x,59,2));
  $('skillRows').innerHTML=C.SKILLS.map((name,i)=>`<tr><td>${esc(name)}</td><td>${htmlValue(read(x,31+i,2))} / ${htmlValue(read(x,22+i,2))}</td><td>${htmlValue(read(x,40+i,2))}</td><td>${htmlValue(C.experienceNeed.skill(read(x,31+i,2)))}</td></tr>`).join('');
  $('growthStatus').textContent=['names','characterExperience','professionExperience','skillExperience'].every(k=>K.verification[k])?'名稱與經驗已通過隔離驗證':'部分養成功能待遊戲驗證';
  renderGrowth();renderBaseAptitudes();renderSkillCaps();renderTalentLevels();renderPills();
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
  $('settlementSummary').innerHTML=stat('山寨等級',read(2,1,0))+stat('目前地圖',read(4,1,0))+stat('累計遊玩秒數',read(15,1,0));if(typeof renderWall==='function')renderWall();
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
  renderEditing('equipment');renderAffixes();renderQuality();renderSetQuality();if(typeof renderRelics==='function')renderRelics();
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
