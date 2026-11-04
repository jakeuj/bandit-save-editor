
  function renderDiff(){
    if(!compare)
      return;
    $('diffCount').textContent=fmt(diffs.length);
    const start=diffPage*pageSize,list=diffs.slice(start,start+pageSize);
    $('diffRows').innerHTML=list.length?list.map((d,i)=>{
      const numeric=typeof d.before==='number'&&typeof d.after==='number',delta=numeric?d.after-d.before:null;
      return `<tr><td>${esc(d.label)}<span class="entity-context">${esc(C.KNOWLEDGE.planes[d.z]?.name||'未知層')}</span><span class="sub mono">[${d.x}, ${d.y}, ${d.z}]</span></td><td class="rowvalue">${esc(fmt(d.before))}</td><td class="rowvalue">${esc(fmt(d.after))}</td><td class="mono ${delta>0?'positive':delta<0?'negative':''}">${numeric?(delta>0?'+':'')+fmt(delta):'—'}</td><td>${typeof d.before==='number'?`<button class="small" data-diff="${start+i}">編輯此欄位</button>`:'文字欄位'}</td></tr>`;
    }).join(''):'<tr><td colspan="5" class="empty">兩份存檔的資料欄位完全相同。</td></tr>';
    $('diffPageInfo').textContent=diffs.length?`顯示 ${start+1}–${Math.min(start+pageSize,diffs.length)} / ${fmt(diffs.length)} 筆`:'0 筆差異';
    $('diffPrev').disabled=diffPage===0;
    $('diffNext').disabled=start+pageSize>=diffs.length;
  }
  $('diffPrev').onclick=()=>{
    diffPage--;
    renderDiff();
  };
  $('diffNext').onclick=()=>{
    diffPage++;
    renderDiff();
  };
  const csvCell=v=>{
    let s=String(v??'');
    if(/^[=+\-@]/.test(s))
      s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  };
  $('diffCsvBtn').onclick=()=>{
    const rows=[['欄位','X','Y','Z',model.name,compare.name,'差額'],...diffs.map(d=>[d.label,d.x,d.y,d.z,d.before,d.after,typeof d.before==='number'&&typeof d.after==='number'?d.after-d.before:''])];
    download('\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'存檔差異.csv','text/csv;charset=utf-8');
  };
