 // City layers: 0 to the native maximum for visited cities; the reputation total and a higher idle layer follow in one step.
 let cityChoice=null;
 function renderCity(){
  let info;
  try{info=C.cityLayersInfo(model);}catch(e){$('cityEditor').innerHTML=`<h3>城市層數</h3><p class="muted small-text">${esc(e.message)}</p>`;return;}
  const visited=info.cities.filter(c=>c.visited);
  if(!visited.some(c=>c.x===cityChoice))cityChoice=visited[0]?.x??null;
  const city=info.cities.find(c=>c.x===cityChoice);
  $('cityEditor').innerHTML=`<h3>城市層數</h3><p id="cityInfo" class="muted small-text" role="status">山寨總聲望 ${esc(fmt(info.total))}${info.consistent?'':`（依城市層數應為 ${esc(fmt(info.computed))}，套用時一併更正）`} · 已進入 ${esc(visited.length)} / ${esc(info.cities.length)} 座城市</p>${visited.length?`<div class="toolbar"><select id="cityPick" aria-label="城市">${visited.map(c=>`<option value="${esc(c.x)}"${c.x===cityChoice?' selected':''}>${esc(c.name)}（已通關 ${esc(c.layer)} 層${c.occupied?'・已佔領':''}）</option>`).join('')}</select><input id="cityLayer" type="number" min="0" max="${info.maxLayer}" step="1" value="${esc(city.layer)}" aria-label="已通關層數"><button id="cityMax" class="small">填入上限</button><button id="cityApply" class="primary small" disabled>套用城市層數</button></div><div id="cityPreview" class="small-text" role="status"></div>`:'<p class="muted small-text">尚未進入過任何城市；請先在遊戲內進城一次。</p>'}<p class="muted small-text">數值是「已通關層數」，遊戲顯示的最高層為此值 +1；上限 ${esc(info.maxLayer)} 時可攻城。只列出進入過的城市；已佔領的城市不能低於上限。降低時掛機層數超過新值會一起下修；已領取的聲望獎勵、招募與兌換不會收回。</p>`;
  if(!visited.length)return;
  const layer=()=>{const v=$('cityLayer').value.trim();if(!v)throw Error('請輸入城市層數。');return Number(v);};
  const preview=()=>{try{
   const p=C.previewCityLayer(model,{x:cityChoice,layer:layer()});
   $('cityPreview').innerHTML=p.unchanged?'<p>與目前數值相同，不會寫入。</p>':`<p>${esc(p.city.name)} 已通關 ${esc(p.layer.before)} → ${esc(p.layer.after)} 層 · 山寨總聲望 ${esc(fmt(p.total.before))} → ${esc(fmt(p.total.after))}${p.idle.after===p.idle.before?'':` · 掛機層數 ${esc(p.idle.before)} → ${esc(p.idle.after)}`}</p>${p.verified?'':'<p class="muted">此功能尚待隔離遊戲驗證，目前只能預覽。</p>'}`;
   $('cityApply').disabled=!p.verified||p.unchanged;
  }catch(e){$('cityPreview').textContent=e.message;$('cityApply').disabled=true;}};
  $('cityPick').onchange=()=>{cityChoice=Number($('cityPick').value);renderCity();};
  $('cityLayer').oninput=preview;
  $('cityMax').onclick=()=>{$('cityLayer').value=info.maxLayer;preview();};
  $('cityApply').onclick=()=>{try{const o={x:cityChoice,layer:layer()};perform(()=>C.setCityLayer(model,o));}catch(e){toast(e.message,true);}};
  preview();
 }
