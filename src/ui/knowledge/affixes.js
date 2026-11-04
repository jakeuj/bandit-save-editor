 function renderAffixes(){
  const old=$('affixItem')?.value,slot=$('affixSlot')?.value||'1';
  const choices=equipmentChoices();
  if(!choices.length){emptyEquipment('affixEditor','詞條係數與精準洗練');return;}
  $('affixEditor').innerHTML=`<h3>詞條係數與精準洗練</h3><div class="toolbar"><select id="affixItem" aria-label="詞條裝備">${choices.map(v=>`<option value="${v.z}:${v.id}">${esc(equipmentLabel(v))}</option>`).join('')}</select><select id="affixSlot" aria-label="詞條槽">${Array.from({length:5},(_,i)=>`<option value="${i+1}">詞條槽 ${i+1}</option>`).join('')}</select></div><p id="affixInfo" class="muted small-text" role="status"></p><div class="toolbar"><label>目標係數<input id="affixValue" type="number" step="0.01"></label><button id="affixApply" class="primary small">套用詞條係數</button></div><p class="muted small-text">首次選槽須在精準洗練確認；特殊裝備維持唯讀。超過一般範圍請使用超限係數。</p><details class="rules"><summary>詳細規則</summary><p class="muted small-text">上方係數操作只調既有係數；下方精準洗練可替換合法詞條，兩者皆不重置選槽。首次選槽請使用下方精準洗練並確認；品質請使用品質升降；特殊裝備保持唯讀，超過原版上限請用下方超限係數。</p></details><h4>超限係數</h4><div class="toolbar"><label>超限係數<input id="affixOverValue" type="number" step="0.01"></label><button id="affixOverApply" class="primary small" disabled>套用超限係數</button></div><p id="affixOverInfo" class="muted small-text" role="status"></p><p class="muted small-text">只改已選洗練槽的係數，上限 1000、最多兩位小數；遊戲內重洗此槽會重抽回原版區間，tips 與洗練頁的進度條在 120 封頂。超限後，此件的品質升降、精準洗練與一般係數調整停用。</p><h4>第六槽</h4><div class="toolbar"><select id="sixthTarget" aria-label="第六槽詞條"></select><label>第六槽係數<input id="sixthValue" type="number" step="0.01"></label><button id="sixthApply" class="primary small" disabled>套用第六槽</button><button id="sixthClear" class="small" disabled>清除第六槽</button></div><p id="sixthInfo" class="muted small-text" role="status"></p><div id="sixthPreview" class="small-text" role="status"></div><p class="muted small-text">第六槽不能在遊戲內重洗；有第六槽時，品質升降、精準洗練與係數調整停用。</p><details class="rules"><summary>詳細規則</summary><p class="muted small-text">只限品質 6（神話）的一般裝備；係數 50–120、最多兩位小數，詞條不能與其他槽重複。遊戲照算屬性並在 tips 顯示，但洗練頁只列 5 槽，第六槽不能在遊戲內重洗。有第六槽時，此件的品質升降、精準洗練與係數調整停用。</p></details><h4>精準洗練</h4><div class="toolbar"><input id="affixSearch" type="search" aria-label="搜尋合法詞條" placeholder="搜尋此裝備的合法詞條"><select id="affixTarget" aria-label="目標詞條"></select></div><label class="check" id="affixFirstLabel" hidden><input id="affixFirst" type="checkbox">確認首次選定此槽</label><p id="affixFirstNote" class="muted small-text"></p><div id="affixPreview" class="small-text" role="status"></div><button id="affixReplace" class="primary small" disabled>套用詞條與係數</button><p class="muted small-text">預覽為這件裝備的屬性貢獻，包含同屬性的主屬性與其他詞條；不代表完整角色面板。保留洗練選槽，不扣魂魄。</p>`;
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
   $('affixTarget').innerHTML='';$('affixSearch').value='';candidates();overUpdate(true);sixthUpdate(true);
  };
  // The sixth slot is read on its own entry; it covers quality-6 items the five-slot entries refuse once the slot is filled.
  let sixth=null;
  const sixthPreview=()=>{
   $('sixthApply').disabled=true;$('sixthClear').disabled=!sixth?.verified||!sixth?.attributeId;$('sixthPreview').textContent='';
   if(!sixth?.verified||!$('sixthTarget').value)return;
   try{const p=C.previewEquipmentSixthAffix(model,{...target(),attributeId:Number($('sixthTarget').value),coefficient:Number($('sixthValue').value)});
    $('sixthPreview').innerHTML=`<table><thead><tr><th>裝備屬性</th><th>目前</th><th>套用後</th><th>差異</th></tr></thead><tbody>${p.effects.map(v=>`<tr><td>${esc(v.name)}</td><td>${esc(fmt(v.before))}${esc(v.unit)}</td><td>${esc(fmt(v.after))}${esc(v.unit)}</td><td>${esc(fmt(Math.round(v.delta*100)/100))}</td></tr>`).join('')}</tbody></table>${p.unchanged?'<p>第六槽未改變。</p>':''}`;
    $('sixthApply').disabled=p.unchanged;
   }catch(e){$('sixthPreview').textContent=e.message;}
  };
  const sixthUpdate=(fill=false)=>{
   sixth=null;$('sixthTarget').innerHTML='';
   try{sixth=C.sixthAffixInfo(model,target());
    $('sixthTarget').innerHTML='<option value="">選擇第六槽詞條</option>'+sixth.candidates.map(v=>`<option value="${v.attributeId}" ${v.reason?'disabled':''}>${esc(v.name)}${v.reason?' · '+esc(v.reason):''}</option>`).join('');
    if(sixth.attributeId)$('sixthTarget').value=String(sixth.attributeId);
    if(fill||!$('sixthValue').value.trim())$('sixthValue').value=sixth.attributeId?sixth.current:sixth.max;
    $('sixthValue').min=sixth.min;$('sixthValue').max=sixth.max;
    $('sixthInfo').textContent=(sixth.attributeId?`目前 ${C.catalogName('attributes',sixth.attributeId)} · 係數 ${sixth.current}`:'目前空白')+` · 範圍 ${sixth.min}–${sixth.max}`+(sixth.verified?'':' · 第六槽尚未完成隔離遊戲冒煙，目前停用。');
   }catch(e){$('sixthInfo').textContent=e.message;}
   sixthPreview();
  };
  // The over-limit entry also reads items the ordinary info refuses, so it finds the selected slot itself.
  let overSlot=null;
  const overUpdate=(fill=false)=>{
   $('affixOverApply').disabled=true;
   try{const t=target();let a,error;overSlot=null;
    for(const s of [...new Set([t.slot,1,2,3,4,5])]){try{a=C.affixAdvancedInfo(model,t.itemId,s,t.plane);overSlot=s;break;}catch(e){error=error||e;}}
    if(!a)throw error;
    if(!info){$('affixSlot').innerHTML=`<option value="${overSlot}">詞條槽 ${overSlot}</option>`;$('affixSlot').value=String(overSlot);}
    if(fill||!$('affixOverValue').value.trim())$('affixOverValue').value=a.current;
    $('affixOverValue').min=a.min;$('affixOverValue').max=a.max;
    const head=`槽 ${overSlot} ${C.catalogName('attributes',a.attributeId)} · 目前 ${a.current} · 超限範圍 ${a.min}–${a.max}（原版上限 ${a.normalMax}）`;
    if(!a.verified){$('affixOverInfo').textContent=head+' · 詞條係數超限尚未完成隔離遊戲冒煙，目前停用。';return;}
    let p;try{p=C.previewEquipmentAffixCoefficientAdvanced(model,{...t,slot:overSlot,coefficient:Number($('affixOverValue').value)});}catch(e){$('affixOverInfo').textContent=head+' · '+e.message;return;}
    $('affixOverInfo').textContent=head+(p.effect?` · 此件${p.effect.name} ${fmt(p.effect.before)}${p.effect.unit} → ${fmt(p.effect.after)}${p.effect.unit}`:p.effectError?' · '+p.effectError:'')+(p.unchanged?' · 係數未改變':'');
    $('affixOverApply').disabled=p.unchanged;
   }catch(e){$('affixOverInfo').textContent=e.message;}
  };
  $('affixItem').onchange=update;$('affixSlot').onchange=update;$('affixSearch').oninput=candidates;$('affixTarget').onchange=replacementPreview;$('affixValue').oninput=replacementPreview;$('affixFirst').onchange=replacementPreview;$('affixOverValue').oninput=()=>overUpdate();$('sixthTarget').onchange=sixthPreview;$('sixthValue').oninput=sixthPreview;
  $('sixthApply').onclick=()=>{if(!$('sixthValue').value.trim())return toast('係數不能空白。',true);perform(()=>C.setEquipmentSixthAffix(model,{...target(),attributeId:Number($('sixthTarget').value),coefficient:Number($('sixthValue').value)}));};
  $('sixthClear').onclick=()=>perform(()=>C.setEquipmentSixthAffix(model,{...target(),attributeId:0}));
  $('affixOverApply').onclick=()=>{if(!$('affixOverValue').value.trim())return toast('係數不能空白。',true);perform(()=>C.setEquipmentAffixCoefficientAdvanced(model,{...target(),slot:overSlot,coefficient:Number($('affixOverValue').value)}));};
  $('affixApply').onclick=()=>{if(!$('affixValue').value.trim())return toast('係數不能空白。',true);perform(()=>C.setEquipmentAffixCoefficient(model,{...target(),coefficient:Number($('affixValue').value)}));};
  $('affixReplace').onclick=()=>{if(!$('affixValue').value.trim())return toast('係數不能空白。',true);perform(()=>C.setEquipmentAffix(model,{...target(),attributeId:Number($('affixTarget').value),coefficient:Number($('affixValue').value),selectUnwashedSlot:!!info?.requiresInitialSelection&&$('affixFirst').checked}));};update();
 }
