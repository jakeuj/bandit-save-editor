 function renderTalentLevels(){
  // The container is added with the task-9 rebuild; an older page simply skips this editor.
  if(!$('talentLevelsEditor'))return;
  const characterId=Number($('characterSelect').value),info=C.randomCharacterTalentsInfo(model,{characterId});
  const effect=e=>`${esc(e.name)} ${htmlValue(e.value)}${e.unit==='百分比'?'%':''}`,effects=list=>list.map(effect).join('、');
  $('talentLevelsEditor').innerHTML=`<h3>一般隨機角色天賦等級</h3><p class="muted small-text" id="talentLevelsStatus" role="status"></p>${info.eligible?`<div class="tablewrap"><table><thead><tr><th>槽</th><th>天賦</th><th>等級</th><th>目前效果</th></tr></thead><tbody>${info.slots.map(s=>`<tr><td>${s.slot}</td><td>#${s.id} ${esc(s.name)}</td><td><select id="talentLevel${s.slot}" aria-label="第 ${s.slot} 槽天賦等級" ${info.levelPool.length>1?'':'disabled'}>${info.levelPool.map(l=>`<option value="${l}" ${l===s.level?'selected':''}>Lv ${l}</option>`).join('')}</select></td><td>${effects(s.effects)}</td></tr>`).join('')}</tbody></table></div>`:''}<details class="rules"><summary>詳細規則</summary><p class="muted small-text">只調整三槽天賦等級，等級須在角色品質的原版等級池內；天賦 ID 依原版招募固定，不能更換或清空。力量／敏捷／智力強化會改變資質來源與丹藥上限，既有丹藥增量超過新上限時整筆阻擋，不會截斷。</p></details><details class="rules"><summary>還原與復原規則</summary><p class="muted small-text" id="talentLevelsRestoreNote">此角色三槽天賦等級、三項基礎資質與丹藥增量共 12 欄會累計一起還原；復原一步只撤回上一筆操作。其他角色與技藝上限不受影響。</p></details><div class="toolbar"><button id="talentLevelsPreviewBtn" class="small">預覽天賦等級</button><button id="talentLevelsApplyBtn" class="primary small" disabled>套用天賦等級</button></div><div id="talentLevelsPreview" aria-live="polite"></div>`;
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
