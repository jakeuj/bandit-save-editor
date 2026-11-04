
  function readCoords(){
    const c={x:num($('coordX')),y:num($('coordY')),z:num($('coordZ'))};
    if(!C.exists(model.original,c))
      throw Error(`座標超出範圍。此檔案尺寸為 ${model.original.size.join(' × ')}。`);
    return c;
  }
  function lookup(){
    try{
      const c=readCoords();
      looked=c;
      const value=C.get(model,c),numeric=typeof value==='number',field=C.resolveField(model,c),writable=field.editable||(!field.known&&numeric);
      $('coordValue').type=field.type==='string'?'text':'number';
      $('coordValue').step=field.type==='decimal'?'any':'1';
      $('coordPath').textContent=`data[${c.x}][${c.y}][${c.z}]`;
      $('coordInfo').textContent=`${displayLabel(c)} · 原始值：${fmt(C.cell(model.original,c))} · 目前值：${fmt(value)}`;
      $('coordValue').disabled=!writable;
      $('coordApplyBtn').disabled=!writable;
      $('pinBtn').disabled=!numeric;
      $('coordValue').value=writable?value:'';
      $('coordInfo').textContent+=` · ${field.status}${writable?'':`（唯讀：${field.reason}）`}`;
    }catch(e){
      looked=null;
      $('coordInfo').textContent=e.message;
      $('coordValue').disabled=$('coordApplyBtn').disabled=$('pinBtn').disabled=true;
      toast(e.message,true);
    }
  }
  $('lookupBtn').onclick=lookup;
  for(const id of ['coordX','coordY','coordZ'])
    $(id).oninput=()=>{
      looked=null;
      $('coordApplyBtn').disabled=$('pinBtn').disabled=true;
      $('coordValue').disabled=true;
      $('coordInfo').textContent='座標已變更，請重新讀取欄位。';
    };
  $('coordApplyBtn').onclick=()=>{
    if(!looked)
      return;
    try{
      const c={...looked},f=C.resolveField(model,c),n=f.type==='string'?$('coordValue').value:f.type==='decimal'?Number($('coordValue').value):num($('coordValue'));
      perform(()=>f.known?C.setField(model,c,n,displayLabel(c)):C.set(model,c,n,displayLabel(c)));
    }catch(e){
      toast(e.message,true);
    }
  };
  $('pinBtn').onclick=()=>{
    if(!looked)
      return;
    const c={...looked},name=$('customName').value.trim()||`自訂欄位 [${c.x}, ${c.y}, ${c.z}]`;
    try{
      const next=custom.filter(f=>C.key(f)!==C.key(c));
      next.push({name,...c});
      custom=validateFields(next);
      persist();
      render();
      toast('已加入常用資源。');
    }catch(e){
      toast(e.message,true);
    }
  };
  function renderCustomList(){
    $('customList').innerHTML=custom.length?custom.map(f=>`<div class="custom-item"><div>${esc(f.name)}<div class="muted mono">[${f.x}, ${f.y}, ${f.z}]</div></div><button class="small ghost" data-remove="${C.key(f)}">移除</button></div>`).join(''):'<p class="muted" style="font-size:13px">尚未加入自訂欄位。</p>';
  }
  $('exportConfigBtn').onclick=()=>download(JSON.stringify({version:1,game:'szmnqea',fields:custom},null,2),'山寨帳房欄位設定.json','application/json');
  $('importConfigBtn').onclick=()=>pick('configInput');
  $('configInput').onchange=async e=>{
    const file=e.target.files[0];
    if(!file)
      return;
    try{
      if(file.size>256000)
        throw Error('設定檔過大。');
      const config=JSON.parse(await file.text());
      if(config.version!==1||config.game!=='szmnqea')
        throw Error('這不是支援的欄位設定檔。');
      const imported=validateFields(config.fields),merged=new Map(custom.map(f=>[C.key(f),f]));
      for(const f of imported)
        merged.set(C.key(f),f);
      custom=validateFields([...merged.values()]);
      persist();
      render();
      toast(`已匯入 ${imported.length} 個欄位設定。`);
    }catch(e){
      toast(e.message,true);
    }
  };
  window.addEventListener('beforeunload',e=>{
    if(model?.changes.size&&revision!==exportedRevision){
      e.preventDefault();
      e.returnValue='';
    }
  });

 // Navigation and folding only change presentation; save transactions stay in their existing handlers.
