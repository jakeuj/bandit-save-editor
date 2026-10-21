 // Read-only progression, derived from the game's table; community work hints stay separate.
 const professions=K.catalogs.professions,professionById=new Map(professions.map(p=>[p.id,p]));
 const professionFamilies={1:'力量系',2:'敏捷系',3:'法術系（智力）',4:'生產系'};
 const professionGuide=K.professionGuide;
 let selectedProfession=1;
 const requiredProfessionLevel=id=>id===professionGuide.rules.initialProfessionId?professionGuide.rules.initialRequiredLevel:professionGuide.rules.otherRequiredLevel;
 const professionWork=p=>{
  const skills=professionGuide.workSkills[p.id];
  return skills===undefined?'原圖未涵蓋第六階':skills.length?skills.map(k=>C.SKILLS[k-1]).join('、'):'原圖虛線，未標工作';
 };
 function professionPath(p){return p.prerequisites.length?[...professionPath(professionById.get(p.prerequisites[0])),p]:[p];}
 const professionPaths=professions.filter(p=>!professions.some(next=>next.prerequisites.includes(p.id))).map(professionPath);
 const professionIdentityText=p=>`${p.id} ${p.name} ${p.category} ${professionFamilies[p.family]} 第${p.tier}階`.toLowerCase();
 const professionSearchText=p=>`${professionIdentityText(p)} ${professionWork(p)}`.toLowerCase();
 const professionButton=(p,small=false)=>`<button class="${small?'small':'profession-node'} profession-family" data-family="${p.tier<=2?'':p.family}" data-profession-link="${p.id}" aria-pressed="${p.id===selectedProfession}">${esc(p.name)}${small?'':`<small>#${p.id}</small>`}</button>`;
 function renderProfessions(){
  const q=$('professionSearch').value.trim().toLowerCase(),family=Number($('professionFamily').value),listView=$('professionView').value==='list';
  const old=$('professionCharacter').value,characters=model?C.listEntities(model,'characters'):[];
  $('professionCharacter').hidden=!characters.length;
  $('professionCharacter').innerHTML='<option value="">不對照角色</option>'+characters.map(r=>`<option value="${r.id}">對照：${esc(r.name)} #${r.id}</option>`).join('');
  if(characters.some(r=>String(r.id)===old))$('professionCharacter').value=old;
  const rows=professions.filter(p=>(!family||p.family===family)&&(!q||professionSearchText(p).includes(q)));
  // Shared starting jobs list every task; use the deepest illustrated job for work searches.
  const paths=professionPaths.filter(path=>(!family||path.at(-1).family===family)&&(!q||path.some(p=>professionIdentityText(p).includes(q))||professionWork(path.filter(p=>p.tier<=5).at(-1)).includes(q)));
  const visible=listView?rows:paths.flat();
  if(visible.length&&!visible.some(p=>p.id===selectedProfession))selectedProfession=(visible.find(p=>q&&professionSearchText(p).includes(q))||visible[0]).id;
  $('professionDetail').hidden=!visible.length;
  $('professionCount').textContent=listView?`顯示 ${rows.length} / ${professions.length} 個職業`:`顯示 ${paths.length} / ${professionPaths.length} 條路線 · 點選職業查看詳情`;
  $('professionRoutesWrap').hidden=listView;$('professionList').hidden=!listView;
  $('professionRoutes').innerHTML=paths.length?paths.map(path=>`<tr>${path.map(p=>`<td>${professionButton(p)}</td>`).join('')}</tr>`).join(''):'<tr><td colspan="6" class="profession-empty">沒有符合的路線。請調整搜尋或系別。</td></tr>';
  $('professionList').innerHTML=rows.length?rows.map(p=>`<button class="profession-card profession-family" data-family="${p.tier<=2?'':p.family}" data-profession-link="${p.id}" aria-pressed="${p.id===selectedProfession}"><strong>${esc(p.name)}</strong><small>#${p.id} · 第 ${p.tier} 階 · ${esc(professionFamilies[p.family])}</small><small>前置：${p.prerequisites.length?p.prerequisites.map(id=>`${esc(professionById.get(id).name)} Lv ${requiredProfessionLevel(id)}`).join('、'):'起始職業'}</small><small>指南建議工作：${esc(professionWork(p))}</small></button>`).join(''):'<p class="profession-empty">沒有符合的職業。請調整搜尋或系別。</p>';
  if(visible.length)renderProfessionDetail();
 }
 function renderProfessionDetail(){
  const p=professionById.get(selectedProfession),next=professions.filter(n=>n.prerequisites.includes(p.id)),x=Number($('professionCharacter').value);
  const requirements=p.prerequisites.map(id=>`${professionButton(professionById.get(id),true)} Lv ${requiredProfessionLevel(id)}`).join('、');
  let progress='<p class="muted">載入存檔並選擇對照角色，可查看已習得等級與解鎖狀態。</p>';
  if(model&&x){
   const level=read(x,p.id,4),cap=read(p.id,5,0),current=read(x,6,2)===p.id;
   progress=`<p><strong>${esc(read(x,1,2))}</strong> · ${current?'目前職業 · ':''}${level>0?`已習得 Lv ${htmlValue(level)}`:'尚未習得'} · 操練上限 ${htmlValue(cap)}</p>`;
   if(p.prerequisites.length)progress+=`<p>${p.prerequisites.map(id=>{const actual=read(x,id,4),required=requiredProfessionLevel(id);return `${esc(professionById.get(id).name)} Lv ${htmlValue(actual)} / ${required}（${actual>=required?'已達標':'未達標'}）`;}).join('；')} · 目標職業${cap>0?'已解鎖':'未解鎖'}</p>`;
  }
  $('professionDetail').innerHTML=`<div class="section-head"><div><span class="eyebrow">職業 #${p.id} / 第 ${p.tier} 階</span><h3 class="profession-family" data-family="${p.tier<=2?'':p.family}">${esc(p.name)}</h3></div><span class="tag">${esc(professionFamilies[p.family])}</span></div><p class="sub muted small-text">${professionPath(p).map(n=>esc(n.name)).join(' → ')}</p><div class="profession-detail-grid"><div><h4>轉職條件 · 遊戲事件</h4><p>${requirements||'起始職業，無前置職業'}${p.prerequisites.length?'<br>目標職業已解鎖（操練上限 > 0）':''}</p></div><div><h4>後續職業</h4><p>${next.length?next.map(n=>professionButton(n,true)).join(''):'目前資料的最高階'}</p></div><div><h4>指南建議工作 · 社群附圖</h4><p>${esc(professionWork(p))}</p></div></div><div class="profession-progress">${progress}</div><p class="source-detail" style="max-width:none;margin-top:12px">前置關係：zy[職業,10–12] · 條件 SID ${professionGuide.rules.conditionSid} · 等級 SID ${professionGuide.rules.levelSid}</p>`;
 }
 for(const id of ['professionSearch','professionFamily','professionView','professionCharacter'])$(id)[id==='professionSearch'?'oninput':'onchange']=renderProfessions;
 $('professionReset').onclick=()=>{$('professionSearch').value='';$('professionFamily').value='';renderProfessions();};
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-profession-link]');if(!b)return;
  const id=Number(b.dataset.professionLink);if(!professionById.has(id))return;
  if(tab!=='professions'){$('professionSearch').value='';$('professionFamily').value='';}
  selectedProfession=id;showTab('professions');
  // A related profession can lie outside the active search; clear it so selection stays visible.
  if($('professionDetail').hidden||selectedProfession!==id){$('professionSearch').value='';$('professionFamily').value='';selectedProfession=id;renderProfessions();}
  $('professionDetail').focus({preventScroll:true});$('professionDetail').scrollIntoView({block:'nearest',behavior:'instant'});
 });
 $('characterProfessionBtn').onclick=()=>{
  const x=Number($('characterSelect').value);if(!model||!x)return;
  const id=read(x,6,2);if(!professionById.has(id))return;
  selectedProfession=id;$('professionSearch').value='';$('professionFamily').value='';showTab('professions');$('professionCharacter').value=String(x);renderProfessions();
 };
