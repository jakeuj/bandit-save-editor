 // City wall enhancement level: 0 to the native cap; lowering it also caps the current HP at the bonus-free maximum.
 function renderWall(){
  let info;
  try{info=C.wallEnhancementInfo(model);}catch(e){$('wallEditor').innerHTML=`<h3>城牆強化等級</h3><p class="muted small-text">${esc(e.message)}</p>`;return;}
  $('wallEditor').innerHTML=`<h3>城牆強化等級</h3><p id="wallInfo" class="muted small-text" role="status">目前 Lv ${esc(info.level)} / 上限 ${esc(info.cap)}（城牆建築等級 ${esc(info.building)}）· 目前生命 ${esc(fmt(info.life))} · 不含加成的最大生命 ${esc(fmt(info.baseLife))}</p><div class="toolbar"><input id="wallLevel" type="number" min="0" max="${info.cap}" step="1" value="${esc(info.level)}" aria-label="城牆強化等級"><button id="wallMax" class="small">填入上限</button><button id="wallApply" class="primary small" disabled>套用城牆強化等級</button></div><div id="wallPreview" class="small-text" role="status"></div><p class="muted small-text">不扣除或退還強化貨幣。降低等級時，目前生命超過新等級不含加成的最大生命會一起下修，遊戲會在非戰鬥時每秒回復到實際上限。</p>`;
  const level=()=>{const v=$('wallLevel').value.trim();if(!v)throw Error('請輸入城牆強化等級。');return Number(v);};
  const preview=()=>{try{
   const p=C.previewWallEnhancementLevel(model,{level:level()});
   $('wallPreview').innerHTML=p.unchanged?'<p>與目前數值相同，不會寫入。</p>':`<p>Lv ${esc(p.level.before)} → ${esc(p.level.after)} · 目前生命 ${esc(fmt(p.life.before))}${p.life.after===p.life.before?'（不變）':` → ${esc(fmt(p.life.after))}`} · 新等級不含加成的最大生命 ${esc(fmt(p.baseLife))}</p>${p.verified?'':'<p class="muted">此功能尚待隔離遊戲驗證，目前只能預覽。</p>'}`;
   $('wallApply').disabled=!p.verified||p.unchanged;
  }catch(e){$('wallPreview').textContent=e.message;$('wallApply').disabled=true;}};
  $('wallLevel').oninput=preview;
  $('wallMax').onclick=()=>{$('wallLevel').value=info.cap;preview();};
  $('wallApply').onclick=()=>{try{const o={level:level()};perform(()=>C.setWallEnhancementLevel(model,o));}catch(e){toast(e.message,true);}};
  preview();
 }
