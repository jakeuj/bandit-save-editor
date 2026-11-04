 // Knowledge is embedded by build-editor so the downloaded HTML is self-contained.
 const coord=(x,y,z)=>({x,y,z}),read=(x,y,z)=>C.exists(model.original,coord(x,y,z))?C.get(model,coord(x,y,z)):null;
 const stat=(name,value)=>`<div class="stat"><strong>${esc(fmt(value))}</strong><span>${esc(name)}</span></div>`;
 const short=v=>{const text=fmt(v);return text.length>150?text.slice(0,150)+'…':text;};
 const sourceHtml=rows=>rows.length?rows.map(e=>`<div class="source-detail">${esc(e.function)}<br>${esc(e.sheet)} · SID ${esc(e.sid)}</div>`).join(''):'<span class="source-detail">尚未定位欄位事件</span>';
 const editingState=Object.fromEntries(['equipment','training','technology'].map(kind=>[kind,{id:null,advanced:false}]));
 function inventoryEntities(){
  const rows=C.listEntities(model,'inventory'),known=new Set(rows.map(r=>`${r.z}:${r.id}`));
  // Keep occupied but unrecognised records visible so an empty state never hides corrupt data.
  for(const z of [7,9,22].filter(z=>z<model.original.size[2]))for(let x=1;x<model.original.size[0];x++){
   const template=read(x,1,z);
   if((read(x,0,z)!==0||template!==0)&&!known.has(`${z}:${x}`))rows.push({id:x,z,name:`未辨識物品（範本 #${template}）`,detail:'資料異常或範本未支援'});
  }
  return rows;
 }
 const equipmentChoices=()=>inventoryEntities().filter(v=>!$('inventoryPlane').value||String(v.z)===$('inventoryPlane').value);
 const innerPillRow=(plane,itemId)=>K.catalogs.items.find(i=>i.id===read(itemId,1,plane))?.kind==='内丹';
 // z22 (武庫, V1.0.13.0) rows follow the backpack rules; older saves have no z22.
 const planeName=z=>z===7?'背包':z===22?'武庫':'裝備庫';
 // A z9 row the owner keeps in the backup set (z23 y1–6, V1.0.17.0) is not worn; label it so the editors' gate reads right.
 const storedInBackupSet=(id,owner)=>owner>0&&[1,2,3,4,5,6].some(y=>read(owner,y,23)===id);
 const equipmentLabel=v=>{const owner=read(v.id,7,9);return `${v.z!==9?planeName(v.z):owner>0?(storedInBackupSet(v.id,owner)?'備用套裝・':'穿戴・')+read(owner,1,2):'裝備庫'} #${v.id} ${v.name}`;};
 function emptyEquipment(editor,title,message='此位置沒有可選物品。'){
  $(editor).innerHTML=`<h3>${title}</h3><p class="muted small-text" role="status">${message}</p><button class="small" data-all-positions>查看所有位置</button>`;
 }
