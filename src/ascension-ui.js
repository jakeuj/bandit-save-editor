 // Ascension quality: pick one past ascension and a 1–9 quality; the stored pill's coefficient and the cap multiplier follow.
 // The same round also picks the ascended inner pill whose level (1 to its absorbed quality's cap) can change on its own.
 function renderAscensionQuality(){
  if(!$('ascensionQualityEditor'))return;
  const characterId=Number($('characterSelect').value),info=C.ascensionQualityInfo(model,{characterId}),pills=C.ascendedInnerPillLevelInfo(model,{characterId}),old=$('ascensionRound')?.value;
  if(!info.eligible&&!pills.eligible){$('ascensionQualityEditor').innerHTML=`<h3>結丹品質</h3><p id="ascensionQualityStatus" class="muted small-text" role="status">${esc(info.reasons.join('；'))}</p>`;return;}
  const records=info.eligible?info.records:pills.records;
  const status=info.eligible?`結丹 ${esc(info.ascensions)} 次 · 倍率 ${esc(info.multiplier)}${info.verified?'':' · 尚待隔離遊戲驗證，可預覽，套用停用'}`:`結丹 ${esc(pills.ascensions)} 次 · 結丹品質：${esc(info.reasons.join('；'))}`;
  const qualityControls=info.eligible?`<select id="ascensionQuality" aria-label="結丹品質">${[1,2,3,4,5,6,7,8,9].map(q=>`<option value="${q}">品質 ${q}</option>`).join('')}</select><button id="ascensionQualityApply" class="primary small" disabled>套用結丹品質</button>`:'';
  const qualityNotes=info.eligible?`<div id="ascensionQualityPreview" class="small-text" role="status"></div><p class="muted small-text">降低品質時，總資質超過新上限會阻擋；還原會連同此角色的基礎資質、天賦與丹藥增量撤回。</p><details class="rules"><summary>詳細規則</summary><p class="muted small-text">等同當初以該品質渡劫：一併改寫入體內丹的三項上限係數，只影響資質上限倍率，不改內丹、等級或結丹次數。降低品質時，任一項目前總資質超過新上限就整筆阻擋。還原會和此角色的基礎資質、天賦等級與丹藥增量一起撤回。</p></details>`:'';
  const levelSection=pills.eligible?`<h4>入體內丹等級</h4><p id="ascendedInnerPillStatus" class="muted small-text" role="status"></p><div class="toolbar"><input id="ascendedInnerPillLevel" type="number" min="1" step="1" aria-label="入體內丹等級"><button id="ascendedInnerPillApply" class="primary small" disabled>套用入體等級</button></div><div id="ascendedInnerPillPreview" class="small-text" role="status"></div><p class="muted small-text">只影響所選內丹的主屬性，不扣魂魄；每顆內丹各自還原。</p><details class="rules"><summary>詳細規則</summary><p class="muted small-text">只改所選這顆入體內丹的等級，影響角色主屬性（與入體前原生升級同一公式），不影響資質上限倍率或渡劫速度；上限依入體時的內丹品質 10+(Q−1)×5，不扣魂魄。每顆內丹各自還原。</p></details>`:'';
  $('ascensionQualityEditor').innerHTML=`<h3>結丹品質</h3><p id="ascensionQualityStatus" class="muted small-text" role="status">${status}</p><div class="toolbar"><select id="ascensionRound" aria-label="結丹次序">${records.map(r=>`<option value="${r.round}">第 ${r.round} 次・${esc(r.name)}${info.eligible?`・品質 ${r.quality}・係數 ${esc(r.coefficient)}`:''}</option>`).join('')}</select>${qualityControls}</div>${qualityNotes}${levelSection}`;
  if(records.some(r=>String(r.round)===old))$('ascensionRound').value=old;
  const round=()=>Number($('ascensionRound').value);
  const request=()=>({characterId,round:round(),quality:Number($('ascensionQuality').value)});
  const preview=()=>{try{
   const p=C.previewAscensionQuality(model,request());
   $('ascensionQualityPreview').innerHTML=(p.reasons.length?`<p class="negative">${esc(p.reasons.join('；'))}</p>`:'')+(p.unchanged?'<p class="muted">與目前品質相同，不會寫入。</p>':p.aptitudes?.[0]?.after?`<p>第 ${esc(p.round)} 次品質 ${esc(p.record.quality)} → ${esc(p.quality)} · 係數 ${esc(p.record.coefficient)} → ${esc(p.coefficient)} · 倍率 ${esc(p.multiplier)} → ${esc(p.nextMultiplier)}</p><div class="tablewrap"><table><thead><tr><th>資質</th><th>總資質</th><th>上限 C（目前 → 套用後）</th></tr></thead><tbody>${p.aptitudes.map(a=>`<tr${a.before.total>a.after.cap?' class="changed"':''}><td>${esc(a.name)}</td><td>${esc(a.before.total)}</td><td>${esc(a.before.cap)} → ${esc(a.after.cap)}</td></tr>`).join('')}</tbody></table></div>`:'');
   $('ascensionQualityApply').disabled=!p.canApply;
  }catch(e){$('ascensionQualityPreview').textContent=e.message;$('ascensionQualityApply').disabled=true;}};
  const levelRequest=()=>({characterId,round:round(),level:Number($('ascendedInnerPillLevel').value)});
  const levelPreview=()=>{try{
   const p=C.previewAscendedInnerPillLevel(model,levelRequest());
   $('ascendedInnerPillPreview').innerHTML=(p.reasons.length?`<p class="negative">${esc(p.reasons.join('；'))}</p>`:'')+(p.unchanged?'<p class="muted">與目前等級相同，不會寫入。</p>':p.changes.length?`<p>${esc(p.record.name)} 等級 ${esc(p.record.current)} → ${esc(p.level)}</p>`:'');
   $('ascendedInnerPillApply').disabled=!p.canApply;
  }catch(e){$('ascendedInnerPillPreview').textContent=e.message;$('ascendedInnerPillApply').disabled=true;}};
  const syncLevel=()=>{
   const r=pills.records[round()-1];
   $('ascendedInnerPillStatus').textContent=r.eligible?`${r.name} · 等階 T${r.tier} · 品質 Q${r.quality} · 目前 ${r.current} · 上限 ${r.max}${pills.verified?'':' · 入體內丹等級尚待隔離遊戲冒煙，目前停用'}`:r.reasons.join('；');
   $('ascendedInnerPillLevel').value=r.current;$('ascendedInnerPillLevel').max=r.max??'';$('ascendedInnerPillLevel').disabled=!r.eligible;levelPreview();
  };
  const sync=()=>{if(info.eligible){$('ascensionQuality').value=info.records[round()-1].quality;preview();}if(pills.eligible)syncLevel();};
  $('ascensionRound').onchange=sync;
  if(info.eligible){$('ascensionQuality').onchange=preview;$('ascensionQualityApply').onclick=()=>{try{const o=request();perform(()=>C.setAscensionQuality(model,o));}catch(e){toast(e.message,true);}};}
  if(pills.eligible){$('ascendedInnerPillLevel').oninput=levelPreview;$('ascendedInnerPillApply').onclick=()=>{try{const o=levelRequest();perform(()=>C.setAscendedInnerPillLevel(model,o));}catch(e){toast(e.message,true);}};}
  sync();
 }
