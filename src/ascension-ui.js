 // Ascension quality: pick one past ascension and a 1–9 quality; the stored pill's coefficient and the cap multiplier follow.
 function renderAscensionQuality(){
  if(!$('ascensionQualityEditor'))return;
  const characterId=Number($('characterSelect').value),info=C.ascensionQualityInfo(model,{characterId}),old=$('ascensionRound')?.value;
  if(!info.eligible){$('ascensionQualityEditor').innerHTML=`<h3>結丹品質</h3><p id="ascensionQualityStatus" class="muted small-text" role="status">${esc(info.reasons.join('；'))}</p>`;return;}
  $('ascensionQualityEditor').innerHTML=`<h3>結丹品質</h3><p id="ascensionQualityStatus" class="muted small-text" role="status">結丹 ${esc(info.ascensions)} 次 · 倍率 ${esc(info.multiplier)}${info.verified?'':' · 尚待隔離遊戲驗證，可預覽，套用停用'}</p><div class="toolbar"><select id="ascensionRound" aria-label="結丹次序">${info.records.map(r=>`<option value="${r.round}">第 ${r.round} 次・${esc(r.name)}・品質 ${r.quality}・係數 ${esc(r.coefficient)}</option>`).join('')}</select><select id="ascensionQuality" aria-label="結丹品質">${[1,2,3,4,5,6,7,8,9].map(q=>`<option value="${q}">品質 ${q}</option>`).join('')}</select><button id="ascensionQualityApply" class="primary small" disabled>套用結丹品質</button></div><div id="ascensionQualityPreview" class="small-text" role="status"></div><p class="muted small-text">等同當初以該品質渡劫：一併改寫入體內丹的三項上限係數，只影響資質上限倍率，不改內丹、等級或結丹次數。降低品質時，任一項目前總資質超過新上限就整筆阻擋。還原會和此角色的基礎資質、天賦等級與丹藥增量一起撤回。</p>`;
  if(info.records.some(r=>String(r.round)===old))$('ascensionRound').value=old;
  const sync=()=>{$('ascensionQuality').value=info.records[Number($('ascensionRound').value)-1].quality;preview();};
  const request=()=>({characterId,round:Number($('ascensionRound').value),quality:Number($('ascensionQuality').value)});
  const preview=()=>{try{
   const p=C.previewAscensionQuality(model,request());
   $('ascensionQualityPreview').innerHTML=(p.reasons.length?`<p class="negative">${esc(p.reasons.join('；'))}</p>`:'')+(p.unchanged?'<p class="muted">與目前品質相同，不會寫入。</p>':p.aptitudes?.[0]?.after?`<p>第 ${esc(p.round)} 次品質 ${esc(p.record.quality)} → ${esc(p.quality)} · 係數 ${esc(p.record.coefficient)} → ${esc(p.coefficient)} · 倍率 ${esc(p.multiplier)} → ${esc(p.nextMultiplier)}</p><div class="tablewrap"><table><thead><tr><th>資質</th><th>總資質</th><th>上限 C（目前 → 套用後）</th></tr></thead><tbody>${p.aptitudes.map(a=>`<tr${a.before.total>a.after.cap?' class="changed"':''}><td>${esc(a.name)}</td><td>${esc(a.before.total)}</td><td>${esc(a.before.cap)} → ${esc(a.after.cap)}</td></tr>`).join('')}</tbody></table></div>`:'');
   $('ascensionQualityApply').disabled=!p.canApply;
  }catch(e){$('ascensionQualityPreview').textContent=e.message;$('ascensionQualityApply').disabled=true;}};
  $('ascensionRound').onchange=sync;$('ascensionQuality').onchange=preview;
  $('ascensionQualityApply').onclick=()=>{try{const o=request();perform(()=>C.setAscensionQuality(model,o));}catch(e){toast(e.message,true);}};
  sync();
 }
