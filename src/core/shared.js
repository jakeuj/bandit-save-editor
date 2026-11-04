 const BASICS=[
  {name:'銅錢',x:1,y:2,z:0,description:'建設、升級與招募使用的主要貨幣。'},
  {name:'共用經驗',x:2,y:2,z:0,description:'可用於角色升級的共用經驗資源。'},
  {name:'魂魄',x:3,y:2,z:0,description:'遊戲獨立儲存的魂魄資源。'},
  {name:'科技點',x:4,y:2,z:0,description:'用於科技升級的點數。'},
  {name:'操練點',x:5,y:2,z:0,description:'用於操練的點數。'}
 ];
 const KNOWLEDGE=/*__KNOWLEDGE__*/null;
 const MATERIALS=KNOWLEDGE.catalogs.materials.filter(m=>m.kind!=='符文').map(m=>({...m,type:m.category}));
 const traditionalMap=Object.fromEntries([...('桦樺枫楓刚剛涧澗矿礦铁鐵铜銅银銀药藥萤螢云雲纹紋络絡雾霧隐隱参參泪淚兰蘭灵靈莲蓮阶階兽獸练練气氣婴嬰炼煉虚虛体體')].reduce((a,c,i,s)=>{if(i%2===0)a.push([c,s[i+1]]);return a;},[]));
 const trad=s=>String(s).replace(/./gu,c=>traditionalMap[c]||c);
 for(const m of MATERIALS){m.name=trad(m.name);m.type=trad(m.type);m.x=m.id;m.y=6;m.z=0;}
 const key=c=>`${c.x},${c.y},${c.z}`;
 const exists=(o,c)=>[c.x,c.y,c.z].every((n,i)=>Number.isInteger(n)&&n>=0&&n<o.size[i]);
 const cell=(o,c)=>o.data[c.x][c.y][c.z];
 /**
  * 解析遊戲存檔並保留原始文字；欄位資格仍由各操作檢查。
  * @param {string} text 含 BOM 亦可；大小及三維資料結構須符合支援範圍。
  * @param {string} [name='save.dat']
  * @returns {SaveModel} 新模型；changes/history 初始為空。
  * @throws {Error} JSON、尺寸或遊戲識別不符合要求。
  */
 function parse(text,name='save.dat'){
  if(typeof text!=='string'||text.length>50*1024*1024)throw Error('檔案過大或無法讀取，請選取遊戲 .dat 存檔。');
  let data;try{data=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error('這不是有效的 JSON 存檔，檔案可能損毀或格式不同。');}
  if(!data||data.c2array!==true||!Array.isArray(data.size)||data.size.length!==3||!data.size.every(n=>Number.isInteger(n)&&n>0)||!Array.isArray(data.data))throw Error('無法辨識：需要遊戲使用的三維陣列存檔。');
  const [nx,ny,nz]=data.size;
  if(nx<221||ny<60||nz<22||nx*ny*nz>30000000||data.data.length!==nx||data.data[0]?.[0]?.[1]!=='szmnqea')throw Error('此檔案不是支援的《塔防山賊模擬器》遊戲存檔。請勿選取 saveinfo.dat。');
  for(const plane of data.data){if(!Array.isArray(plane)||plane.length!==ny)throw Error('存檔資料尺寸不一致。');for(const row of plane)if(!Array.isArray(row)||row.length!==nz||row.some(v=>v!==null&&typeof v==='object'))throw Error('存檔資料結構不完整。');}
  return {name,text,original:data,changes:new Map(),history:[]};
 }
 const get=(m,c)=>m.changes.get(key(c))?.value??cell(m.original,c);
 const catalogMaps=Object.fromEntries(Object.entries(KNOWLEDGE.catalogs).map(([k,v])=>[k,new Map(v.map(r=>[r.id,r]))]));
 const catalogName=(kind,id)=>catalogMaps[kind]?.get(id)?.name||`#${id}`;
 const SKILLS=['伐木','採礦','種植','鍛造','工藝','煉丹','建造','研究','操練'];
 const evidenceIndex=new Map();
 for(const e of KNOWLEDGE.evidence){const k=`${e.z},${e.y}`;if(!evidenceIndex.has(k))evidenceIndex.set(k,[]);evidenceIndex.get(k).push(e);}
 const C=(x,y,z)=>({x,y,z});
 const activeCharacter=(m,x)=>Number.isInteger(x)&&x>0&&exists(m.original,C(x,0,2))&&typeof get(m,C(x,1,2))==='string'&&get(m,C(x,0,2))>0;
 const EDIT_GROUPS={equipment:'equipmentLevel',training:'professionTrainingCap',technology:'advancedTechnologyLevel'};
 // V1.0.13.0 armory (z22): 仓库存入／仓库取出 copy y0–49 verbatim between z7 and z22, so an armory row takes the backpack
 // rules and groups; every armory write also needs armoryEquipment. Saves from older versions have no z22.
 const ARMORY=22,equipmentPlane=(m,plane)=>[7,9,ARMORY].includes(plane)&&plane<m.original.size[2];
 const backpackLike=plane=>plane===7||plane===ARMORY,planeName=plane=>plane===7?'背包':plane===ARMORY?'武庫':'裝備庫';
 // V1.0.17.0 backup set (z23, 角色换装): y0 is the active set number, y1–6 the z9 rows of the stored set. Those rows keep
 // owner=character but no z2 slot points at them. Behind backupSetEquipment the equipment editors treat a stored row as the
 // owner's one worn reference (z23 y1–6 mirror z2 y16–21 slot for slot); closed, they refuse with this reason. The swap
 // never runs 内丹入体存入 (only 渡劫结束 does, on z2 y20) and 属性计算 never reads z23, so a stored inner pill swapped back
 // is an ordinary worn pill (backupSetInnerPillLevel), and aptitude edits check the stored rows like worn ones so either
 // set gives the same A (backupSetAptitude).
 const BACKUP_SET=23,inBackupSet=(m,itemId,owner)=>BACKUP_SET<m.original.size[2]&&owner>0&&[1,2,3,4,5,6].some(slot=>get(m,C(owner,slot,BACKUP_SET))===itemId);
 const backupSetReason='這件裝備在角色的備用套裝中，請先在遊戲換回這套再修改。',backupSetAptitudeReason='角色的備用套裝有裝備，請先在遊戲卸下備用套裝再修改資質相關項目。';
 function backupSetReferences(m,itemId,owner,slot,group='backupSetEquipment'){
  if(!inBackupSet(m,itemId,owner))return 0;
  if(KNOWLEDGE.verification[group]!==true)throw Error(backupSetReason);
  const slots=[1,2,3,4,5,6].filter(s=>get(m,C(owner,s,BACKUP_SET))===itemId);
  if(!activeCharacter(m,owner)||slots.length!==1||slots[0]!==slot)throw Error('備用套裝指標與裝備部位不一致。');
  return 1;
 }
 // [slot,itemId] of the stored set when backupSetAptitude is open; aptitude checks then treat them as worn slots.
 function backupSetAptitudeRows(m,characterId){
  if(KNOWLEDGE.verification.backupSetAptitude!==true||BACKUP_SET>=m.original.size[2])return [];
  const rows=[];
  for(let slot=1;slot<=6;slot++){
   const itemId=get(m,C(characterId,slot,BACKUP_SET));if(itemId===0)continue;
   if(!Number.isSafeInteger(itemId)||itemId<1||itemId>=m.original.size[0])throw Error('備用套裝列號越界。');
   if([1,2,3,4,5,6].some(s=>get(m,C(characterId,15+s,2))===itemId))throw Error('備用套裝與穿戴指向同一件裝備。');
   rows.push([slot,itemId]);
  }
  return rows;
 }
 const planeVerified=(plane,group)=>KNOWLEDGE.verification[group]===true&&(plane!==ARMORY||KNOWLEDGE.verification.armoryEquipment===true);
 function buildingLevel(m,template){
  let level=0;
  for(let x=1;x<m.original.size[0];x++)if(get(m,C(x,0,1))===x&&get(m,C(x,1,1))===template){const n=get(m,C(x,5,1));if(!Number.isSafeInteger(n)||n<0)throw Error('建築等級資料不符。');level=Math.max(level,n);}
  return level;
 }
 // Normal caps that follow 校場 (操练等级上限) and 書院 (科技等级上限); 0 keeps the editor's earlier refusal without the building.
 function buildingNormalMax(kind,id,building){
  if(kind==='training')return building?5+(building+1)*5:0;
  return building?Math.min(catalogMaps.technologies.get(id).tableLimit-1,Math.max(1,(building+1)*60-1)):0;
 }
 // A training cap or advanced tech that only fits under a raised 校場／書院 joins that building's restore group, so restoring
 // the building never leaves it above the original cap. Values within the original cap, or past the new one (advanced mode,
 // which never depended on the building), keep their own group.
 function raisedBuildingGroup(m,kind,id,value,normalMax){
  if(kind!=='training'&&kind!=='technology')return null;
  const template=kind==='training'?6:5;let original=0,raised=null;
  for(let x=1;x<m.original.size[0];x++)if(cell(m.original,C(x,0,1))===x&&cell(m.original,C(x,1,1))===template){
   const before=cell(m.original,C(x,5,1)),after=get(m,C(x,5,1));
   if(Number.isSafeInteger(before))original=Math.max(original,before);
   if(after>before&&(!raised||after>raised.after))raised={x,after};
  }
  return raised&&value>buildingNormalMax(kind,id,original)&&value<=normalMax?`building:${raised.x}`:null;
 }
 function busyFacility(m,target,buildingTemplate){
  for(let x=1;x<m.original.size[0];x++)if(get(m,C(x,0,21))===x&&get(m,C(x,3,21))===target){
   const parent=get(m,C(x,2,21));if(Number.isSafeInteger(parent)&&parent>0&&parent<m.original.size[0]&&get(m,C(parent,1,1))===buildingTemplate)return true;
  }
  return false;
 }
 // Set-level candidates are independent of ordinary equipment and remain gated until their own first proof.
