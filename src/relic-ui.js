 // Relic elements, backpack (z18) and placed on a 置物台 (z19): the five values are edited together and the mean follows the
 // game's formula. Placed options carry a "p" prefix and also preview the stand's tile aura.
 function renderRelics(){
  const old=$('relicItem')?.value,rows=C.listRelics(model),placed=C.listPlacedRelics(model);
  if(!rows.length&&!placed.length){$('relicEditor').innerHTML='<h3>靈物五行</h3><p class="muted small-text">背包與置物台上都沒有靈物。</p>';return;}
  const group=(label,list,prefix,text)=>list.length?`<optgroup label="${label}">${list.map(r=>`<option value="${prefix}${r.id}">${text(r)} ${esc(r.name)}・品質 ${esc(r.quality)}・Lv ${esc(r.level)}</option>`).join('')}</optgroup>`:'';
  $('relicEditor').innerHTML=`<h3>靈物五行</h3><div class="toolbar"><select id="relicItem" aria-label="靈物">${group('背包',rows,'',r=>`背包靈物 #${r.id}`)}${group('置物台',placed,'p',r=>`置物台 #${esc(r.building)}`)}</select><select id="relicPreset" aria-label="填入原版可生成的組合"></select></div><p id="relicInfo" class="muted small-text" role="status"></p><div class="relic-inputs" id="relicInputs"></div><div id="relicPreview" class="small-text" role="status"></div><button id="relicApply" class="primary small" disabled>套用五行調整</button><p class="muted small-text">只接受原版能生成的組合：同一總靈氣依範本基底比例分配，每項在基底的 60%–100% 間浮動並取到 0.1；平均靈氣依原版公式自動重算。不改範本、品質與等級，也不扣成本。置物台上的靈物不必取下；進入山寨時遊戲會依新數值重算地塊靈氣。</p>`;
  if([...$('relicItem').options].some(o=>o.value===old))$('relicItem').value=old;
  let info=null,isPlaced=false;
  const values=()=>info.elements.map((_,i)=>{const v=$('relicValue'+i).value.trim();if(!v)throw Error('五行數值不能空白。');return Number(v);});
  const aura=p=>`<p>置物台每個範圍內地塊（×${esc(p.aura.after.factor)}）：${info.elements.map((name,i)=>`${name} ${esc(p.aura.before.elements[i])} → ${esc(p.aura.after.elements[i])}`).join('・')}・環境靈氣 ${esc(p.aura.before.total)} → ${esc(p.aura.after.total)}</p>`;
  const preview=()=>{try{
   if(!info)throw Error('請選擇有效的靈物。');
   const o={itemId:info.itemId,values:values()},p=isPlaced?C.previewPlacedRelicAttributes(model,o):C.previewRelicAttributes(model,o);
   $('relicPreview').innerHTML=p.unchanged?'<p>與目前數值相同，不會寫入。</p>':`<p>平均靈氣 ${esc(p.average.before)} → ${esc(p.average.after)} · 原版可生成：總靈氣 ${esc(p.witness.total)}，各項浮動 ${p.witness.ratios.map(r=>Math.round(r*100)+'%').join('／')}</p>${isPlaced?aura(p):''}${p.verified?'':'<p class="muted">此功能尚待隔離遊戲驗證，目前只能預覽。</p>'}`;
   $('relicApply').disabled=!p.verified||p.unchanged;
  }catch(e){$('relicPreview').textContent=e.message;$('relicApply').disabled=true;}};
  const update=()=>{info=null;const v=$('relicItem').value;isPlaced=v.startsWith('p');try{
   info=isPlaced?C.placedRelicAttributesInfo(model,{itemId:Number(v.slice(1))}):C.relicAttributesInfo(model,{itemId:Number(v)});
   $('relicInfo').textContent=`${isPlaced?`置物台 #${info.building.id}（Lv ${info.building.level}）上的`:''}${info.category}・品質 ${info.quality}・等級 ${info.level} · 總靈氣原版範圍 ${info.total.min}–${info.total.max} · 目前平均 ${info.average} · ${info.natural?'目前數值可由原版生成':'目前數值不在原版生成範圍，可改成合法組合'}`;
   $('relicInputs').innerHTML=info.elements.map((name,i)=>`<label>${name}<small>基底 ${esc(info.bases[i])} · 約 ${esc(info.ranges[i].min??'—')}–${esc(info.ranges[i].max??'—')}</small><input id="relicValue${i}" type="number" min="0" step="0.1" value="${esc(info.values[i])}" aria-label="${name}"></label>`).join('');
   $('relicPreset').innerHTML='<option value="">填入組合…</option>'+(info.proportional?'<option value="all">總靈氣上限・依基底比例</option>':'')+info.elements.map((name,i)=>info.focused[i]?`<option value="${i}">總靈氣上限・${name}最高</option>`:'').join('')+'<option value="current">目前數值</option>';
   for(let i=0;i<5;i++)$('relicValue'+i).oninput=preview;
   preview();
  }catch(e){$('relicInfo').textContent=e.message;$('relicInputs').innerHTML='';$('relicPreset').innerHTML='';$('relicPreview').textContent='';$('relicApply').disabled=true;}};
  $('relicItem').onchange=update;
  $('relicPreset').onchange=()=>{const v=$('relicPreset').value;$('relicPreset').value='';if(!info||!v)return;(v==='all'?info.proportional:v==='current'?info.values:info.focused[Number(v)]).forEach((x,i)=>$('relicValue'+i).value=x);preview();};
  $('relicApply').onclick=()=>{try{const o={itemId:info.itemId,values:values()};perform(()=>isPlaced?C.setPlacedRelicAttributes(model,o):C.setRelicAttributes(model,o));}catch(e){toast(e.message,true);}};
  update();
 }
