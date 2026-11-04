 function renderSkillCaps(draft){
  const characterId=Number($('characterSelect').value);
  if(skillCapsMode.model!==model||skillCapsMode.characterId!==characterId){skillCapsMode={model,characterId,advanced:false};draft=null;}
  const advanced=skillCapsMode.advanced,info=(advanced?C.randomCharacterSkillCapsAdvancedInfo:C.randomCharacterSkillCapsInfo)(model,{characterId});
  const previewCaps=advanced?C.previewCharacterSkillCapsAdvanced:C.previewCharacterSkillCaps,setCaps=advanced?C.setCharacterSkillCapsAdvanced:C.setCharacterSkillCaps;
  $('skillCapsEditor').innerHTML=`<h3>一般隨機角色九項技藝上限</h3><div class="toolbar"><label class="check"><input id="skillCapsAdvanced" type="checkbox" ${advanced?'checked':''}>進階 1–100</label><button id="skillCapsFill100Btn" type="button" class="small" ${advanced?'':'hidden'} ${info.eligible?'':'disabled'}>全部填入 100</button></div><p class="muted small-text" id="skillCapsStatus" role="status"></p><div class="aptitude-inputs">${C.SKILLS.map((name,i)=>`<label for="skillCap${i+1}">${esc(name)}上限<input id="skillCap${i+1}" type="number" min="1" max="100" step="1" value="${esc(draft?.[i]??read(characterId,22+i,2))}" aria-describedby="skillCapReason${i+1}" ${info.eligible?'':'disabled'}><span id="skillCapReason${i+1}" class="negative small-text" hidden></span></label>`).join('')}</div><p class="${advanced?'negative':'muted'} small-text">${advanced?'九項可獨立設定為 1–100，可超出原版共同生成組合；保留基礎資質與天賦。':'九項須符合一般招募或初始角色的共同生成條件。'}不能低於目前等級；降低到目前等級時，經驗餘額必須為零。</p><details class="rules"><summary>詳細規則</summary><p class="muted small-text">一般模式要求九項與目前品質、原始資質及三項天賦具有原版共同生成見證；初始角色規則只適用於品質 1。進階模式不要求生成見證，只開放目前上限均在 1–100 的一般隨機角色。只調上限，不改資質或天賦；提高上限保留等級與經驗餘額，不會立即升級。低於目前等級，或降低至目前等級且仍有餘額時，整筆阻擋。</p></details><details class="rules"><summary>還原與復原規則</summary><p class="muted small-text" id="skillCapsRestoreNote">首次有效上限調整後，此角色九項上限、等級與經驗餘額共 27 欄會累計一起還原，包含先前及後續的單項／全部技藝經驗修改。還原回載入時；復原一步只撤回上一筆操作。其他角色不受影響。</p></details><div class="toolbar"><button id="skillCapsPreviewBtn" class="small">預覽九項上限</button><button id="skillCapsApplyBtn" class="primary small" disabled>套用九項上限</button></div><div id="skillCapsPreview" aria-live="polite"></div>`;
  const sourceNames=[...new Set(info.witnesses.map(w=>w.source==='initial'?'初始角色':'一般招募'))].join('／');
  $('skillCapsStatus').textContent=info.eligible?`品質 ${info.quality} · ${advanced?'進階 1–100':`目前九項有共同生成條件（${sourceNames}）`}${info.ascensions?` · 結丹 ${info.ascensions} 次`:''}${info.verified?' · 已通過獨立隔離驗證':' · 尚待獨立隔離驗證，可預覽，套用停用'}`:info.reasons.join('；');
  $('skillCapsAdvanced').onchange=()=>{const values=C.SKILLS.map((_,i)=>$('skillCap'+(i+1)).value);skillCapsMode.advanced=$('skillCapsAdvanced').checked;renderSkillCaps(values);$('skillCapsPreview').textContent='模式已變更，請重新預覽。';};
  $('skillCapsPreviewBtn').disabled=!info.eligible;
  let snapshot=null;
  const request=()=>({characterId,caps:C.SKILLS.map((_,i)=>{const value=$('skillCap'+(i+1)).value;if(!value.trim())throw Error('九項上限不能空白。');return Number(value);})});
  const clearRowReasons=()=>{for(let i=1;i<=9;i++){$('skillCap'+i).removeAttribute('aria-invalid');$('skillCapReason'+i).textContent='';$('skillCapReason'+i).hidden=true;}};
  const invalidate=()=>{snapshot=null;clearRowReasons();$('skillCapsApplyBtn').disabled=true;$('skillCapsPreview').textContent='輸入已變更，請重新預覽。';};
  for(let i=1;i<=9;i++)$('skillCap'+i).oninput=invalidate;
  $('skillCapsFill100Btn').onclick=()=>{if(!advanced||!info.eligible)return;for(let i=1;i<=9;i++)$('skillCap'+i).value='100';invalidate();};
  $('skillCapsPreviewBtn').onclick=()=>{try{
   const options=request(),preview=previewCaps(model,options);snapshot={model,revision,request:JSON.stringify(options),preview};
   const witness=preview.witnesses[0],orientation=witness?.orientation==='生产'?'生產':witness?.orientation;
   clearRowReasons();
   for(const row of preview.rows)if(row.reasons.length){$('skillCapReason'+row.id).textContent=row.reasons.join('；');$('skillCapReason'+row.id).hidden=false;$('skillCap'+row.id).setAttribute('aria-invalid','true');}
   $('skillCapsPreview').innerHTML=(preview.reasons.length?`<p class="negative">整筆未套用，請修正下列問題後重新預覽：</p><ul class="negative">${preview.reasons.map(reason=>`<li>${esc(reason)}</li>`).join('')}</ul>`:'')+(preview.rows.length?`<div class="tablewrap"><table><thead><tr><th>技藝</th><th>上限（目前 → 套用後）</th><th>等級（目前 → 套用後）</th><th>經驗餘額（目前 → 套用後）</th></tr></thead><tbody>${preview.rows.map(row=>`<tr${row.before.cap!==row.after.cap?' class="changed"':''}><td>${esc(row.name)}</td>${['cap','level','experience'].map(key=>`<td>${htmlValue(row.before[key])} → ${htmlValue(row.after[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="small-text">${preview.unchanged?'九項均無變更，不會新增歷史。':`上限變更 ${preview.changes.length} 項；全部九項等級與經驗餘額保持原值。`}</p>`:'')+(witness?`<p class="muted small-text">可行招募組合之一（${witness.source==='initial'?'初始角色':'一般招募'}）：${esc(orientation)}傾向、主要${esc(C.SKILLS[witness.primary-1])}、次要${esc(C.SKILLS[witness.secondary-1])}。這是固定資質與天賦下的可生成條件，不代表角色的招募歷史。</p>`:advanced?'<p class="negative">進階模式：九項獨立設定，可超出原版生成組合。</p>':'')+(!preview.verified?'<p class="negative">尚待相符來源的獨立隔離驗證，目前不能套用。</p>':'');
   $('skillCapsApplyBtn').disabled=!preview.canApply;
  }catch(error){snapshot=null;clearRowReasons();$('skillCapsApplyBtn').disabled=true;$('skillCapsPreview').textContent=error.message;}};
  $('skillCapsApplyBtn').onclick=()=>{try{
   const options=request();if(!snapshot||snapshot.model!==model||snapshot.revision!==revision||snapshot.request!==JSON.stringify(options))throw Error('存檔或輸入已變更，請重新預覽。');
   if(perform(()=>setCaps(model,options,{preview:snapshot.preview})))toast('九項上限已套用；此角色全部技藝會累計一起還原。');
  }catch(error){invalidate();toast(error.message,true);}};
 }
