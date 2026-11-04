 function paged(kind,list,render,container){
  const size=50,max=Math.max(0,Math.ceil(list.length/size)-1);knowledgePages[kind]=Math.min(knowledgePages[kind],max);
  const page=knowledgePages[kind],start=page*size;
  $(container).innerHTML=list.length?list.slice(start,start+size).map(render).join(''):(container==='catalogRows'?'<p class="muted">沒有符合的資料。</p>':'<tr><td colspan="5" class="empty">沒有符合的資料。</td></tr>');
  $(kind+'PageInfo').textContent=list.length?`${start+1}–${Math.min(start+size,list.length)} / ${htmlValue(list.length)} 筆`:'0 筆';
  $(kind+'Prev').disabled=page===0;$(kind+'Next').disabled=page===max;
 }
 function renderKnowledgeTab(name){if(name==='professions')renderProfessions();if(name==='atlas')renderAtlas();if(!model)return;if(name==='characters')renderCharacters();if(name==='settlement')renderSettlement();if(name==='inventory')renderInventory();}
 function renderCharacters(){
  const q=$('characterSearch').value.trim().toLowerCase(),old=$('characterSelect').value;
  const rows=C.listEntities(model,'characters').filter(r=>q.startsWith('#')?String(r.id)===q.slice(1):`${r.id} ${r.name}`.toLowerCase().includes(q));
  $('characterMatchInfo').textContent=rows.length>50?`符合 ${rows.length} 名，先顯示 50 名；請搜尋名稱或 #ID。`:'';
  const visible=rows.slice(0,50);
  $('characterSelect').innerHTML=visible.map(r=>`<option value="${r.id}">#${r.id} ${esc(r.name)} · ${esc(r.detail)}</option>`).join('');
  if(visible.some(r=>String(r.id)===old))$('characterSelect').value=old;
  $('characterEmpty').hidden=!!rows.length;$('characterBody').hidden=!rows.length;if(!rows.length)return;
  const x=Number($('characterSelect').value);
  $('characterName').value=read(x,1,2);$('renameCharacterBtn').disabled=!K.verification.names;
  $('characterSummary').innerHTML=stat('角色等級',read(x,3,2))+stat('自然經驗餘額',read(x,4,2))+stat('等級上限',(Math.floor(read(x,50,2))+1)*30)+stat('目前職業',C.catalogName('professions',read(x,6,2)))+stat('共用池已投入經驗',read(x,56,2))+stat('自動轉職預設',read(x,59,2));
  $('skillRows').innerHTML=C.SKILLS.map((name,i)=>`<tr><td>${esc(name)}</td><td>${htmlValue(read(x,31+i,2))} / ${htmlValue(read(x,22+i,2))}</td><td>${htmlValue(read(x,40+i,2))}</td><td>${htmlValue(C.experienceNeed.skill(read(x,31+i,2)))}</td></tr>`).join('');
  $('growthStatus').textContent=['names','characterExperience','professionExperience','skillExperience'].every(k=>K.verification[k])?'名稱與經驗已通過隔離驗證':'部分養成功能待遊戲驗證';
  renderGrowth();renderBaseAptitudes();renderSkillCaps();renderTalentLevels();renderPills();if(typeof renderAscensionQuality==='function')renderAscensionQuality();
  summarizeCharacter(x);
 }

 function summarizeCharacter(x){
  for(const [key,status,values] of [
   ['baseAptitude','baseAptitudeStatus',`原始值 ${[10,11,12].map(y=>read(x,y,2)).join('／')}`],
   ['skillCaps','skillCapsStatus',`目前上限 ${Array.from({length:9},(_,i)=>read(x,22+i,2)).join('／')}`],
   ['talentLevels','talentLevelsStatus',`目前等級 ${[21,22,23].map(y=>read(x,y,12)).join('／')}`],['pill','pillInfo',''],['ascensionQuality','ascensionQualityStatus','']]){
   const summary=$(key+'Summary');if(summary)summary.textContent=[values,$(status)?.textContent].filter(Boolean).join(' · ');
  }
 }

 function renderGrowth(){
  const x=Number($('characterSelect').value),kind=$('growthKind').value,old=$('growthTarget').value;
  const targets=kind==='profession'?K.catalogs.professions.filter(r=>read(x,r.id,4)>0):kind==='skill'?C.SKILLS.map((name,i)=>({id:i+1,name})):[];
  $('growthTarget').hidden=kind==='character';$('growthTarget').innerHTML=targets.map(r=>`<option value="${r.id}">${esc(r.name)} #${r.id}</option>`).join('');
  if(targets.some(r=>String(r.id)===old))$('growthTarget').value=old;
  $('growthAmount').step=kind==='profession'?'0.1':'1';$('growthAmount').min=kind==='profession'?'0.1':'1';
  try{
   const i=C.growthInfo(model,kind,x,kind==='character'?undefined:Number($('growthTarget').value));
   $('growthInfo').textContent=`${i.name}：Lv ${i.currentLevel} / ${i.cap} · 經驗 ${htmlValue(i.currentExperience)} / ${htmlValue(i.need)}${i.verified?'':' · 尚待遊戲驗證'}${kind==='profession'&&read(x,59,2)>0?' · 請先在遊戲中關閉自動轉職':''}`;
   $('growthApplyBtn').disabled=!i.verified||i.currentLevel>=i.cap||(kind==='profession'&&read(x,59,2)>0);
  }catch(e){$('growthInfo').textContent=e.message;$('growthApplyBtn').disabled=true;}
 }
 function renderSettlement(){
  $('settlementName').value=read(1,1,0);$('renameSettlementBtn').disabled=!K.verification.names;
  $('settlementSummary').innerHTML=stat('山寨等級',read(2,1,0))+stat('目前地圖',read(4,1,0))+stat('累計遊玩秒數',read(15,1,0));if(typeof renderWall==='function')renderWall();if(typeof renderCity==='function')renderCity();if(typeof renderBasicTech==='function')renderBasicTech();if(typeof renderBuilding==='function')renderBuilding();
  const kind=$('settlementCategory').value,q=$('settlementSearch').value.trim().toLowerCase();
  $('settlementNote').textContent=['buildings','facilities','quests'].includes(kind)?'以下為遊戲資料表，不代表已建造、已擁有或已完成。配置與進程請從欄位圖鑑對照原始記錄。':'可從下方調整操練上限或進階科技；研究與操練進行中不修改。';
  const rows=K.catalogs[kind].filter(r=>`${r.id} ${r.name} ${r.category}`.toLowerCase().includes(q));
  paged('settlement',rows,r=>`<tr><td><span class="mono muted">#${r.id}</span> ${esc(r.name)}</td><td>${esc(r.category)}</td><td>${kind==='technologies'?`科技等級 ${htmlValue(read(r.id,4,0))} · 研究狀態 ${htmlValue(read(r.id,13,0))}`:kind==='professions'?`操練上限 ${htmlValue(read(r.id,5,0))}`:'資料表 · 唯讀'}</td></tr>`,'settlementRows');
  renderEditing('training');renderEditing('technology');
 }
 function renderInventory(){
  const q=$('inventorySearch').value.trim().toLowerCase(),z=$('inventoryPlane').value;
  const rows=inventoryEntities().filter(r=>(!z||r.z===Number(z))&&`${r.id} ${r.name} ${r.detail}`.toLowerCase().includes(q));
  paged('inventory',rows,r=>`<tr><td class="mono">#${r.id} / ${esc(read(r.id,1,r.z))}</td><td>${esc(r.name)}</td><td>${r.z===9?'裝備庫／穿戴':planeName(r.z)}</td><td>${htmlValue(read(r.id,5,r.z))} / Lv ${htmlValue(read(r.id,6,r.z))}</td><td><button class="small" data-inspect-item="${r.id}" data-plane="${r.z}">查看欄位</button></td></tr>`,'inventoryRows');
  renderEditing('equipment');renderAffixes();renderQuality();renderSetQuality();if(typeof renderRelics==='function')renderRelics();
 }
