
  function pick(id){
    $(id).value='';
    $(id).click();
  }
  function download(text,name,type='application/octet-stream'){
    const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;
    a.download=name;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function outputName(name,kind){
    return name.replace(/\.(dat|json)$/i,'')+kind+'.dat';
  }
  async function busy(fn){
    loading=true;
    $('workspace').setAttribute('aria-busy','true');
    $('openBtn').disabled=true;
    renderFooter();
    await new Promise(r=>setTimeout(r,30));
    try{
      await fn();
    }catch(e){
      toast(e.message,true);
    }finally{
      loading=false;
      $('workspace').setAttribute('aria-busy','false');
      $('openBtn').disabled=false;
      renderFooter();
    }
  }
  const readSave=async file=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await file.arrayBuffer());
  async function load(file){
    if(!file||loading)
      return;
    if(file.size>50*1024*1024){
      toast('檔案超過 50 MB，無法載入。',true);
      return;
    }
    if(model?.changes.size&&revision!==exportedRevision&&!confirm('目前有尚未匯出的變更。確定要開啟其他存檔並捨棄這些變更？'))
      return;
    await busy(async()=>{
      const next=C.parse(await readSave(file),file.name);
      model=next;
      document.querySelectorAll('[data-character-section]').forEach(section=>section.open=false);
      for(const state of Object.values(editingState)){
        state.id=null;
        state.advanced=false;
        state.preserveValue=false;
      }
      compare=null;
      diffs=[];
      diffPage=0;
      looked=null;
      reviewPage=0;
      revision++;
      if(typeof resetBatch==='function')
        resetBatch();
      $('fileName').textContent=file.name;
      $('fileInfo').textContent=`${fmt(file.size)} bytes · 山寨：${String(next.original.data[1][1][0])} · 所有修改另存副本`;
      $('shapeTag').textContent=next.original.size.join(' × ');
      $('filebar').hidden=false;
      $('dropZone').hidden=true;
      $('workspace').hidden=false;
      $('backupBtn').disabled=false;
      $('backupBtn').hidden=false;
      $('compareName').textContent='加入另一份存檔';
      $('diffResults').hidden=true;
      showTab('resources');
      render();
      toast('存檔已載入。');
    });
  }
