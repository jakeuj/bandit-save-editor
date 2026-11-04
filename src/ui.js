(() => {
  'use strict';
  const C=SaveCore,$=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=v=>typeof v==='number'?v.toLocaleString('zh-TW'):v===null?'null':String(v);
  const htmlValue=value=>esc(fmt(value));
  let model=null,tab='resources',compare=null,diffs=[],diffPage=0,reviewPage=0,custom=[],looked=null,toastTimer,loading=false,revision=0,exportedRevision=-1;
  const pageSize=100;
  const K=C.KNOWLEDGE;
  const knowledgePages={settlement:0,inventory:0,atlas:0,catalog:0};
  let atlasEntityId=null;
  try{
    const saved=JSON.parse(localStorage.getItem('bandit-save-fields-v1')||'[]');
    custom=validateFields(saved);
  }catch{
  }
  function validateFields(a){
    if(!Array.isArray(a)||a.length>100)
      throw Error('欄位設定最多可包含 100 個欄位。');
    const seen=new Set();
    return a.map(f=>{
      if(!f||typeof f.name!=='string'||!f.name.trim()||f.name.length>60||![f.x,f.y,f.z].every(n=>Number.isSafeInteger(n)&&n>=0))
        throw Error('欄位設定格式錯誤。');
      if(seen.has(C.key(f)))
        throw Error('欄位設定包含重複座標。');
      seen.add(C.key(f));
      return {name:f.name.trim(),x:f.x,y:f.y,z:f.z};
    });
  }
  function toast(message,error=false){
    $('toast').textContent=message;
    $('toast').classList.toggle('error',error);
    $('toast').hidden=false;
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>$('toast').hidden=true,error?6500:3500);
  }
  function persist(){
    try{
      localStorage.setItem('bandit-save-fields-v1',JSON.stringify(custom));
    }catch{
      toast('此瀏覽器無法記住設定，請匯出欄位設定檔保留。');
    }
  }
  function displayLabel(c){
    return custom.find(f=>C.key(f)===C.key(c))?.name||C.labelFor(model.original,c);
  }
  function num(input){
    if(input.value.trim()==='')
      throw Error('數量不能空白。');
    const n=Number(input.value);
    if(!Number.isSafeInteger(n))
      throw Error('請輸入安全範圍內的整數。');
    return n;
  }
  function perform(fn){
    if(!model||loading)
      return false;
    try{
      C.transaction(model,fn);
      revision++;
      render();
      return true;
    }catch(e){
      toast(e.message,true);
      render();
      return false;
    }
  }
/*__UI_FILE_OPERATIONS__*/

  function showTab(name){
    tab=name;
    syncNavigation(name);
    document.querySelectorAll('[data-tab]').forEach(b=>{
      b.classList.toggle('active',b.dataset.tab===name);
      if(b.dataset.tab===name)
        b.setAttribute('aria-current','page');else
        b.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.id!=='tab-'+name);
    const publicKnowledge=['atlas','professions'].includes(name);
    $('workspace').hidden=!model&&!publicKnowledge;
    $('dropZone').hidden=!!model||publicKnowledge;
    if(!model&&publicKnowledge)
      renderKnowledgeTab(name);
    if(model){
      renderKnowledgeTab(name);
      if(name==='batch')
        renderBatch();
      if(name==='materials')
        renderMaterials();
      if(name==='compare')
        renderDiff();
      if(name==='advanced'){
        renderCustomList();
        if(looked)
          lookup();
      }
    }
  }
/*__UI_RESOURCES__*/

  function renderFooter(){
    const n=model?.changes.size||0,exported=n&&revision===exportedRevision;
    $('pendingCount').textContent=n;
    $('editorFooter').hidden=!model;
    $('pendingLabel').textContent=exported?'已匯出':'待匯出';
    $('footerHint').textContent=loading?'正在處理存檔…':!model?'載入存檔後即可開始修改':exported?'項數為欄位數 · 目前修改已匯出':n?'項數為欄位數 · 匯出另存副本':'項數為欄位數 · 尚未修改';
    $('downloadBtn').disabled=!model||!n||loading;
    $('reviewBtn').disabled=!n||loading;
    $('undoBtn').disabled=!model?.history.length||loading;
  }
  function render(){
    if(tab==='batch'&&typeof renderBatch==='function')
      renderBatch();
    renderResources();
    renderKnowledgeTab(tab);
    if(tab==='materials')
      renderMaterials();
    if(tab==='advanced'){
      renderCustomList();
      if(looked)
        lookup();
    }
    renderFooter();
    if($('reviewDialog').open)
      renderReview();
  }
  function coordsFromKey(k){
    const [x,y,z]=k.split(',').map(Number);
    return {x,y,z};
  }
  document.addEventListener('change',e=>{
    const input=e.target;
    if(!input.dataset.field||!model)
      return;
    const c=coordsFromKey(input.dataset.field);
    try{
      const value=num(input);
      perform(()=>C.set(model,c,value,displayLabel(c)));
    }catch(err){
      toast(err.message,true);
      input.value=C.get(model,c);
    }
  });
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(!b)
      return;
    if(b.dataset.restore&&model){
      const c=coordsFromKey(b.dataset.restore);
      perform(()=>C.restore(model,c));
    }
    if(b.dataset.close)
      $(b.dataset.close).close();
    if(b.dataset.tab)
      showTab(b.dataset.tab);
    if(b.dataset.mobileTab){
      $('navigationDialog').close('navigate');
      showTab(b.dataset.mobileTab);
    }
    if(b.hasAttribute?.('data-all-positions')){
      $('inventoryPlane').value='';
      renderKnowledgeTab('inventory');
    }
    if(b.dataset.diff!==undefined){
      const d=diffs[Number(b.dataset.diff)];
      if(!d)
        return;
      showTab('advanced');
      $('coordX').value=d.x;
      $('coordY').value=d.y;
      $('coordZ').value=d.z;
      lookup();
    }
    if(b.dataset.remove!==undefined){
      custom=custom.filter(f=>C.key(f)!==b.dataset.remove);
      persist();
      render();
    }
  });
  $('openBtn').onclick=$('emptyOpenBtn').onclick=()=>pick('fileInput');
  $('fileInput').onchange=e=>load(e.target.files[0]);
  for(const type of ['dragenter','dragover'])
    $('dropZone').addEventListener(type,e=>{
      e.preventDefault();
      $('dropZone').classList.add('dragging');
    });
  $('dropZone').ondragleave=()=>$('dropZone').classList.remove('dragging');
  $('dropZone').ondrop=e=>{
    e.preventDefault();
    $('dropZone').classList.remove('dragging');
    load(e.dataTransfer.files[0]);
  };
  $('backupBtn').onclick=()=>{
    if(model)
      download(model.text,outputName(model.name,'.original-backup'));
  };
  $('materialSearch').oninput=renderMaterials;
  $('materialType').onchange=renderMaterials;
  $('heldOnly').onchange=renderMaterials;
  $('materialType').innerHTML+=[...new Set(C.MATERIALS.map(m=>m.type))].map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  $('batchBtn').onclick=()=>{
    try{
      const n=num($('batchValue'));
      if(n<0)
        throw Error('材料數量不能小於 0。');
      const list=visibleMaterials();
      if(perform(()=>{
        for(const m of list)
          C.set(model,m,n,`${m.name}（材料 #${m.id}）`);
      }))
        toast(`已調整 ${list.length} 筆材料，可從「檢視變更」確認。`);
    }catch(e){
      toast(e.message,true);
    }
  };
  $('undoBtn').onclick=()=>{
    if(model&&!loading){
      C.undo(model);
      revision++;
      render();
      toast('已復原上一步。');
    }
  };
/*__UI_REVIEW_EXPORT__*/

/*__UI_COMPARE__*/

/*__UI_CUSTOM_FIELDS__*/

  function syncNavigation(name){
    const labels={resources:'常用資源',materials:'材料倉庫',characters:'角色養成',professions:'職業圖鑑',settlement:'山寨與科技',inventory:'物品與裝備',atlas:'欄位圖鑑',batch:'批次操作',compare:'存檔比對',advanced:'自訂欄位'};
    $('mobileCurrent').textContent=labels[name];
    document.querySelectorAll('[data-mobile-tab]').forEach(b=>{
      if(b.dataset.mobileTab===name)
        b.setAttribute('aria-current','page');else
        b.removeAttribute('aria-current');
    });
  }
  function focusPanel(){
    const panel=$('workspace').hidden?$('dropZone'):$('tab-'+tab),heading=panel.querySelector('h2');
    if(heading){
      heading.tabIndex=-1;
      heading.focus({preventScroll:true});
      heading.scrollIntoView({block:'start'});
    }
  }
  $('navigationBtn').onclick=()=>{
    $('navigationDialog').returnValue='';
    $('navigationDialog').showModal();
  };
  $('navigationDialog').addEventListener('close',()=>{
    if($('navigationDialog').returnValue==='navigate')
      focusPanel();else
      $('navigationBtn').focus({preventScroll:true});
  });
  document.querySelectorAll('[data-character-jump]').forEach(link=>link.addEventListener('click',e=>{
    e.preventDefault();
    const target=$(link.dataset.characterJump);
    if(target.tagName==='DETAILS')
      target.open=true;
    const heading=target.querySelector('summary,h3');
    if(heading.tagName!=='SUMMARY')
      heading.tabIndex=-1;
    heading.focus({preventScroll:true});
    target.scrollIntoView({block:'start'});
  }));
 // Measure the real bar, including wrapping and device safe areas, instead of assuming a fixed height.
  if(typeof ResizeObserver!=='undefined'){
    const footer=$('editorFooter');
    new ResizeObserver(()=>{
      document.documentElement.style.setProperty('--footer-space',footer.hidden?'0px':footer.getBoundingClientRect().height+'px');
    }).observe(footer);
  }

 /*__KNOWLEDGE_UI__*/


 /*__PROFESSION_UI__*/


 /*__BATCH_UI__*/


 /*__RELIC_UI__*/


 /*__WALL_UI__*/


 /*__CITY_UI__*/


 /*__TECH_UI__*/


 /*__BUILDING_UI__*/


 /*__ASCENSION_UI__*/

  showTab('resources');
  renderFooter();
})();
