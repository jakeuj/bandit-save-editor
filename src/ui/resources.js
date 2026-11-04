
  function resourceCard(f){
    const available=C.exists(model.original,f)&&typeof C.cell(model.original,f)==='number',value=available?C.get(model,f):null,descriptor=available?C.resolveField(model,f):null,writable=available&&(!descriptor.known||descriptor.editable),changed=model.changes.has(C.key(f));
    return `<article class="resource-card ${changed?'changed':''}"><div class="resource-title"><span>${esc(f.name)}</span><span class="tag">${changed?'已修改':f.description?'資源':'自訂'}</span></div><p class="resource-desc">${esc(f.description||`座標 [${f.x}, ${f.y}, ${f.z}]`)}</p><input class="value-input" type="number" step="1" ${f.description?'min="0"':''} max="9007199254740991" data-field="${C.key(f)}" value="${available?value:''}" aria-label="${esc(f.name)}數量" ${writable?'':'disabled'}><div class="card-foot"><span>${available?'原始 '+fmt(C.cell(model.original,f)):'此存檔無對應數值欄位'}</span>${changed?`<button data-restore="${C.key(f)}">還原</button>`:'<span>可直接輸入</span>'}</div></article>`;
  }
  function renderResources(){
    if(!model)
      return;
    $('resourceCards').innerHTML=C.BASICS.map(resourceCard).join('');
    const extra=custom.filter(f=>!C.BASICS.some(b=>C.key(b)===C.key(f)));
    $('customSection').hidden=!extra.length;
    $('customCards').innerHTML=extra.map(resourceCard).join('');
  }
  function visibleMaterials(){
    const q=$('materialSearch').value.trim().toLowerCase(),type=$('materialType').value,held=$('heldOnly').checked;
    return C.MATERIALS.filter(m=>C.exists(model.original,m)&&(!q||`${m.name} ${m.type} ${m.id}`.toLowerCase().includes(q))&&(!type||m.type===type)&&(!held||C.get(model,m)>0));
  }
  function renderMaterials(){
    if(!model)
      return;
    const list=visibleMaterials();
    $('materialCount').textContent=`目前篩選 ${list.length} 筆`;
    $('batchBtn').disabled=!list.length;
    $('materialRows').innerHTML=list.length?list.map(m=>{
      const changed=model.changes.has(C.key(m));
      return `<tr class="${changed?'changed':''}"><td class="mono muted">#${m.id}</td><td class="name">${changed?'<i class="change-dot"></i>':''}${esc(m.name)}</td><td>${esc(m.type)}<span class="sub">第 ${m.tier} 階</span></td><td><input type="number" step="1" min="0" max="9007199254740991" value="${esc(C.get(model,m))}" data-field="${C.key(m)}" aria-label="${esc(m.name)} #${m.id} 數量"></td><td class="mono muted">${htmlValue(C.cell(model.original,m))}</td><td>${changed?`<button class="small ghost" data-restore="${C.key(m)}">還原</button>`:''}</td></tr>`;
    }).join(''):'<tr><td colspan="6" class="empty">沒有符合的材料。可以取消「只顯示持有」查看所有項目。</td></tr>';
  }
