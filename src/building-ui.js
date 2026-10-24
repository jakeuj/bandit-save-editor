 // Building levels: raise a finished, unoccupied building up to min(4, its advanced tech gate); lowering is not offered.
 let buildingChoice=null;
 const buildingTiers=['基礎','中級','高級','頂級','大師'];
 function renderBuilding(){
  let info;
  try{info=C.buildingLevelsInfo(model);}catch(e){$('buildingEditor').innerHTML=`<h3>建築等級</h3><p class="muted small-text">${esc(e.message)}</p>`;return;}
  const open=info.rows.filter(r=>!r.reason);
  if(!info.rows.some(r=>r.x===buildingChoice))buildingChoice=(open[0]||info.rows[0])?.x??null;
  const tier=l=>`${esc(l)}（${esc(buildingTiers[l]??'?')}）`;
  $('buildingEditor').innerHTML=`<h3>建築等級</h3><p id="buildingInfo" class="muted small-text" role="status">${esc(info.rows.length)} 座建築 · ${esc(open.length)} 座可升階 · 只能升高，上限依對應進階科技（每 60 級一階，最高 ${tier(info.maxLevel)}）</p>${info.rows.length?`<div class="toolbar"><select id="buildingPick" aria-label="建築">${info.rows.map(r=>`<option value="${esc(r.x)}"${r.x===buildingChoice?' selected':''}>#${esc(r.x)} ${esc(r.name)} Lv ${esc(r.level)}${r.reason?'（不可升）':''}</option>`).join('')}</select><input id="buildingLevel" type="number" min="0" max="${info.maxLevel}" step="1" aria-label="新建築等級"><button id="buildingMax" class="small ghost">填入上限</button><button id="buildingApply" class="small" disabled>套用</button></div><div id="buildingPreview" class="muted small-text"></div>`:'<p>這份存檔沒有可升階的建築。</p>'}`;
  if(!info.rows.length)return;
  const row=()=>info.rows.find(r=>r.x===buildingChoice);
  const level=()=>{const v=$('buildingLevel').value.trim();if(!v)throw Error('請輸入新的建築等級。');return Number(v);};
  const preview=()=>{const r=row();try{
   if(r.reason)throw Error(`${r.name} Lv ${r.level}：${r.reason}`);
   const p=C.previewBuildingLevel(model,{x:buildingChoice,level:level()});
   $('buildingPreview').innerHTML=`<p>${esc(p.building.name)} #${esc(p.building.x)} Lv ${tier(p.level.before)} → ${tier(p.level.after)} · 上限 ${esc(p.cap)}（${esc(r.technology.name)} Lv ${esc(r.technology.level)}）</p>${p.verified?'':'<p class="muted">此功能尚待隔離遊戲驗證，目前只能預覽。</p>'}`;
   $('buildingApply').disabled=!p.verified;
  }catch(e){$('buildingPreview').textContent=e.message;$('buildingApply').disabled=true;}};
  const pick=()=>{const r=row();$('buildingLevel').value=r.reason?'':Math.min(r.level+1,r.cap);$('buildingLevel').disabled=$('buildingMax').disabled=!!r.reason;preview();};
  $('buildingPick').onchange=()=>{buildingChoice=Number($('buildingPick').value);pick();};
  $('buildingLevel').oninput=preview;
  $('buildingMax').onclick=()=>{$('buildingLevel').value=row().cap;preview();};
  $('buildingApply').onclick=()=>{try{const o={x:buildingChoice,level:level()};perform(()=>C.setBuildingLevel(model,o));}catch(e){toast(e.message,true);}};
  pick();
 }
