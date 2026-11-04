
  function renderReview(){
    const list=[...model.changes.values()],size=50;
    reviewPage=Math.max(0,Math.min(reviewPage,Math.ceil(list.length/size)-1));
    const start=reviewPage*size;
    $('reviewRows').innerHTML=list.length?list.slice(start,start+size).map(c=>`<tr><td>${esc(c.label)}${c.operation?`<span class="operation-note">${esc(c.operation)}</span>`:''}${c.group?.startsWith('skill-growth:')?'<span class="sub">還原會一起撤回此角色九項上限、等級與餘額的累計修改（27 欄）。</span>':''}${c.group?.startsWith('aptitude:')?'<span class="sub">還原會一起撤回此角色三槽天賦等級、三項基礎資質與丹藥增量（12 欄），以及結丹品質。</span>':''}${c.group?.startsWith('relic:')?'<span class="sub">還原會一起撤回此靈物的五行與平均靈氣。</span>':''}${c.group?.startsWith('wall:')?'<span class="sub">還原會一起撤回城牆強化等級、城牆建築等級與一起下修的目前生命。</span>':''}${c.group?.startsWith('city:')?'<span class="sub">還原會一起撤回所有城市層數、一起下修的掛機層數與山寨總聲望。</span>':''}${c.group?.startsWith('building:')?'<span class="sub">還原會一起撤回此建築等級，以及依新等級才放得下的進階科技或操練上限。</span>':''}${c.group==='technology:basic'?'<span class="sub">還原會一起撤回所有基礎科技解鎖（含一起解鎖的前置科技）與歸零的研究點數。</span>':''}<span class="sub mono">[${c.x}, ${c.y}, ${c.z}]</span></td><td class="mono muted">${htmlValue(c.original)}</td><td class="mono positive">${htmlValue(c.value)}</td><td><button class="small ghost" data-restore="${C.key(c)}">還原</button></td></tr>`).join(''):'<tr><td colspan="4" class="empty">所有修改已還原。</td></tr>';
    $('reviewPageInfo').textContent=`第 ${reviewPage+1} / ${Math.max(1,Math.ceil(list.length/size))} 頁 · ${list.length} 個欄位`;
    $('reviewPrev').disabled=reviewPage===0;
    $('reviewNext').disabled=start+size>=list.length;
    $('reviewDownloadBtn').disabled=!list.length||loading;
  }
  $('reviewPrev').onclick=()=>{
    reviewPage--;
    renderReview();
  };
  $('reviewNext').onclick=()=>{
    reviewPage++;
    renderReview();
  };
  $('reviewBtn').onclick=()=>{
    reviewPage=0;
    renderReview();
    $('reviewDialog').showModal();
  };
  $('resetBtn').onclick=()=>{
    if(loading)
      return;
    perform(()=>C.restoreAll(model));
    $('reviewDialog').close();
    toast('所有修改已還原。');
  };
  async function save(){
    if(!model?.changes.size||loading)
      return;
    await busy(async()=>{
      const text=C.serialize(model);
      download(text,outputName(model.name,'.modified'));
      exportedRevision=revision;
      toast(`已匯出 ${model.changes.size} 個變更。請結束遊戲後將副本改回原檔名。`);
    });
  }
  $('downloadBtn').onclick=$('reviewDownloadBtn').onclick=save;
  $('mobileHelpBtn').onclick=$('helpBtn').onclick=()=>$('helpDialog').showModal();
  $('mobileChangelogBtn').onclick=()=>$('changelogDialog').showModal();
  $('changelogBtn').onclick=$('versionBtn').onclick=()=>$('changelogDialog').showModal();
  $('compareBtn').onclick=()=>pick('compareInput');
  $('compareInput').onchange=async e=>{
    const file=e.target.files[0];
    if(!file||!model)
      return;
    if(file.size>50*1024*1024){
      toast('比對檔案超過 50 MB。',true);
      return;
    }
    await busy(async()=>{
      const next=C.parse(await readSave(file),file.name),result=C.diff(model.original,next.original);
      compare=next;
      diffs=result;
      diffPage=0;
      $('compareName').textContent=file.name;
      $('diffLeftName').textContent=model.name;
      $('diffRightName').textContent=file.name;
      $('diffResults').hidden=false;
      renderDiff();
      toast(`比對完成，共 ${diffs.length} 個欄位不同。`);
    });
  };
