 function renderEditing(kind){
  const state=editingState[kind],title={equipment:'裝備等級',training:'職業操練上限',technology:'進階科技等級'}[kind];
  const choices=kind==='equipment'?equipmentChoices().map(v=>({...v,itemId:v.id,id:`${v.z}:${v.id}`,label:equipmentLabel(v)})):K.catalogs[kind==='training'?'professions':'technologies'].filter(v=>kind!=='technology'||v.advanced);
  if(kind==='equipment'&&!choices.length){state.id=null;emptyEquipment('equipmentEditor',title);return;}
  const old=document.querySelector(`[data-edit-value="${kind}"]`)?.value;
  if(!choices.some(v=>v.id===state.id))state.id=choices[0]?.id??null;
  const [plane,itemId]=kind==='equipment'&&state.id?state.id.split(':').map(Number):[9,state.id];
  let info,error='';try{info=kind==='equipment'&&innerPillRow(plane,itemId)?C.innerPillLevelInfo(model,{itemId,plane}):C.editingInfo(model,kind,itemId,plane);}catch(e){error=e.message;}
  const backpackNormalOnly=kind==='equipment'&&plane!==9&&!info?.advancedVerified;
  if(backpackNormalOnly||info?.isSet||info?.isTreasure||info?.isInnerPill)state.advanced=false;
  const enabled=info?.verified&&(!state.advanced||info.advancedVerified),max=state.advanced?info?.advancedMax:Math.min(info?.normalMax??0,info?.advancedMax??0);
  let recruit=null;if(info&&kind==='technology'&&itemId===33&&state.advanced&&typeof C.recruitTechnologyInfo==='function')try{recruit=C.recruitTechnologyInfo(model);}catch(e){}
  const inputMax=recruit?.verified?recruit.max:max;
  $(kind+'Editor').innerHTML=`<h3>${title}</h3><div class="toolbar"><select data-edit-target="${kind}" aria-label="選擇${title}目標">${choices.map(v=>`<option value="${v.id}" ${v.id===state.id?'selected':''}>${esc(v.label||'#'+v.id+' '+v.name)}</option>`).join('')}</select><label class="check"><input type="checkbox" data-edit-mode="${kind}" ${backpackNormalOnly||info?.isSet||info?.isTreasure||info?.isInnerPill?'disabled':''} ${state.advanced?'checked':''}>進階模式</label></div><p class="muted small-text">${info?`目前 ${htmlValue(info.current)} · 一般上限 ${htmlValue(info.normalMax)}${info.isSet?' · 套裝僅一般模式 · 套裝積分 '+htmlValue(info.record[23]):info.isTreasure?' · 寶物僅一般模式 · 等階 T'+htmlValue(info.record[3])+' · 品質 Q'+htmlValue(info.record[5])+' · 歸屬 '+(info.record[7]?'#'+htmlValue(info.record[7]):'無'):info.isInnerPill?' · 內丹僅一般模式 · 等階 T'+htmlValue(info.tier)+' · 品質 Q'+htmlValue(info.quality)+(info.worn?' · 穿戴中':info.stored?' · 備用套裝':''):backpackNormalOnly?' · 背包僅一般模式':' · 進階驗證上限 '+htmlValue(info.advancedMax)}`:esc(error)}</p><div class="toolbar"><label>目標數值<input type="number" min="${info?.min??1}" max="${inputMax??0}" step="1" value="${info?.current||info?.min||1}" data-edit-value="${kind}" aria-label="${title}目標數值" ${info?'':'disabled'}></label><button class="small primary" data-edit-apply="${kind}" ${enabled?'':'disabled'}>套用${title}</button></div><p class="muted small-text" role="status">${info?.isSet?'<span data-set-level-preview>只調整套裝等級；積分、品質與合成來源保留。</span>':info?.isTreasure?'<span data-treasure-level-preview>只調整寶物等級；品質、詞條、歸屬與魂魄資源保留，不扣魂魄。</span> ':info?.isInnerPill?'<span data-inner-pill-level-preview>只調整內丹等級；品質、歸屬與魂魄資源保留，不扣魂魄。穿戴中的內丹會改變角色屬性與渡劫速度，渡劫入體時帶入此等級。</span> ':''}${esc(error||(!enabled?info?.isTreasure?'寶物等級尚待首次獨立證明，目前停用。':info?.isInnerPill?'內丹等級尚待隔離遊戲冒煙，目前停用。':'此修改模式尚待隔離遊戲驗證，目前停用。':state.advanced?'已驗證範圍內可超過原版上限；不扣取得成本。':'一般模式遵守原版上限，不扣取得成本。'))}${kind==='training'?' 職業自然成長仍受原版 30 級限制。':kind==='technology'?' 目標為存檔值；遊戲科技提示的 Lv 為此值加一。':''}${recruit?`<span data-recruit-overlimit> 招募技術超限：${recruit.verified?`可填到 ${recruit.max}`:`${recruit.min}–${recruit.max} 尚待隔離遊戲冒煙，目前停用`}。招募間隔＝600−存檔值 秒（目前 ${recruit.interval} 秒），新間隔在下一次刷新後生效；598 起主動尋訪只在部分秒數可用，599 時每秒換一批候選，主動尋訪一律顯示「招募數據刷新中」。超過 299 後書院不能再研究此科技。</span>`:''}</p>`;
  if(info?.isSet){
   const input=document.querySelector('[data-edit-value="equipment"]'),button=document.querySelector('[data-edit-apply="equipment"]'),preview=document.querySelector('[data-set-level-preview]');
   if(input&&button&&preview)input.oninput=()=>{const target=Number(input.value),valid=input.value.trim()!==''&&Number.isSafeInteger(target)&&target>=1&&target<=info.normalMax;preview.textContent=valid?'套裝等級 '+info.current+' → '+target+'；積分 '+info.record[23]+'、品質與合成來源保持。':'目標須為 1–'+info.normalMax+' 的整數。';button.disabled=!enabled||!valid;};
  }
  if(info?.isTreasure){
   const input=document.querySelector('[data-edit-value="equipment"]'),button=document.querySelector('[data-edit-apply="equipment"]'),preview=document.querySelector('[data-treasure-level-preview]');
   if(input&&button&&preview)input.oninput=()=>{const target=Number(input.value),valid=input.value.trim()!==''&&Number.isSafeInteger(target)&&target>=1&&target<=info.normalMax;preview.textContent=valid?'寶物等級 '+info.current+' → '+target+'；品質、詞條、歸屬與魂魄保持，不扣魂魄。':'目標須為 1–'+info.normalMax+' 的整數。';button.disabled=!enabled||!valid;};
  }
  if(info?.isInnerPill){
   const input=document.querySelector('[data-edit-value="equipment"]'),button=document.querySelector('[data-edit-apply="equipment"]'),preview=document.querySelector('[data-inner-pill-level-preview]');
   if(input&&button&&preview)input.oninput=()=>{const target=Number(input.value),valid=input.value.trim()!==''&&Number.isSafeInteger(target)&&target>=1&&target<=info.normalMax;preview.textContent=valid?'內丹等級 '+info.current+' → '+target+'；品質、歸屬與魂魄保持，不扣魂魄。':'目標須為 1–'+info.normalMax+' 的整數。';button.disabled=!enabled||!valid;};
  }
  // Preserve an unsubmitted number while toggling modes, but reset after applying or changing target.
  if(state.preserveValue&&old!==undefined)document.querySelector(`[data-edit-value="${kind}"]`).value=old;
  state.preserveValue=false;
 }
