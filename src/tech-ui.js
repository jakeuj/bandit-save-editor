 // Basic technologies: unlock a locked tech (0→1) with its missing prerequisite chain; lowering is not offered.
 let basicTechChoice=null;
 function renderBasicTech(){
  let info;
  try{info=C.basicTechnologiesInfo(model);}catch(e){$('basicTechEditor').innerHTML=`<h3>基礎科技</h3><p class="muted small-text">${esc(e.message)}</p>`;return;}
  const locked=info.technologies.filter(t=>t.level===0);
  if(!locked.some(t=>t.id===basicTechChoice))basicTechChoice=locked[0]?.id??null;
  $('basicTechEditor').innerHTML=`<h3>基礎科技</h3><p id="basicTechInfo" class="muted small-text" role="status">已掌握 ${esc(info.unlocked)} / ${esc(info.technologies.length)} 項 · 只能解鎖，缺少的前置科技一起解鎖</p>${locked.length?`<div class="toolbar"><select id="basicTechPick" aria-label="基礎科技">${locked.map(t=>`<option value="${esc(t.id)}"${t.id===basicTechChoice?' selected':''}>#${esc(t.id)} ${esc(t.name)}${t.researching?'（研究中）':''}</option>`).join('')}</select><button id="basicTechApply" class="small" disabled>解鎖</button></div><div id="basicTechPreview" class="muted small-text"></div>`:'<p>基礎科技已全部掌握。</p>'}`;
  if(!locked.length)return;
  const preview=()=>{try{
   const p=C.previewBasicTechnology(model,{technologyId:basicTechChoice});
   $('basicTechPreview').innerHTML=`<p>解鎖 ${p.chain.map(t=>`#${esc(t.id)} ${esc(t.name)}`).join(' → ')}${p.chain.length>1?`（含 ${esc(p.chain.length-1)} 項前置）`:''}${p.changes.some(c=>c.coordinate.y===12)?' · 研究點數歸零':''}</p>${p.verified?'':'<p class="muted">此功能尚待隔離遊戲驗證，目前只能預覽。</p>'}`;
   $('basicTechApply').disabled=!p.verified||p.unchanged;
  }catch(e){$('basicTechPreview').textContent=e.message;$('basicTechApply').disabled=true;}};
  $('basicTechPick').onchange=()=>{basicTechChoice=Number($('basicTechPick').value);preview();};
  $('basicTechApply').onclick=()=>{try{const o={technologyId:basicTechChoice};perform(()=>C.setBasicTechnology(model,o));}catch(e){toast(e.message,true);}};
  preview();
 }
