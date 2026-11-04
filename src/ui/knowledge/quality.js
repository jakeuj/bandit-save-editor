 function renderQuality(){
  const old=$('qualityItem')?.value,choices=equipmentChoices(),names=['','凡物','優秀','精緻','絕世','傳說','神話'];
  if(!choices.length){emptyEquipment('qualityEditor','裝備品質升降');return;}
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
  if(!choices.length){emptyEquipment('setQualityEditor','套裝品質','此位置沒有可選套裝。');return;}
  $('setQualityEditor').innerHTML=`<h3>套裝品質</h3><div class="toolbar"><select id="setQualityItem" aria-label="套裝品質裝備">${choices.map(v=>`<option value="${v.z}:${v.id}">${esc(equipmentLabel(v))}</option>`).join('')}</select><select id="setQualityTarget" aria-label="套裝目標品質"></select></div><p id="setQualityInfo" class="muted small-text" role="status"></p><p id="setQualityStatus" class="small-text" role="status"></p><details><summary>詞條池與每槽來源</summary><div id="setQualityPools" class="small-text"></div></details><div id="setQualityAdditions"></div><div id="setQualityPreview" class="small-text" role="status"></div><label id="setQualityRemovalLabel" class="check" hidden><input id="setQualityRemoval" type="checkbox">確認移除預覽中的尾端詞條槽</label><div class="toolbar"><button id="setQualityApply" class="primary small" disabled>套用套裝品質</button><button id="setQualityReset" class="small" type="button">重設選項與確認</button></div><details class="rules"><summary>詳細規則</summary><p class="muted small-text">新增尾槽只能用原裝備詞條池（P原），旗標為 0；降品會刪除尾槽，須先確認。主係數每級 ±30、保留槽係數每級 ±10。品質不改等級，超過目標上限須先降低套裝等級。套裝積分與額外套裝效果不隨品質改變。</p></details>`;
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
    $('setQualityStatus').textContent=p.group?`${planeName(info.plane)} · ${dir} · 群組 ${p.group} · ${p.verified?'已通過驗證':'尚待獨立遊戲驗證，套用停用'}`:'品質未改變。';
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
