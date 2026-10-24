/* Local save editing core. All unchanged source bytes are preserved. */
/**
 * @typedef {Object} FieldDescriptor
 * @property {string} id Zero-based x,y,z coordinate key.
 * @property {string} label
 * @property {string} category
 * @property {string} entity
 * @property {'string'|'integer'|'decimal'|'boolean'|'object'} type
 * @property {boolean} known
 * @property {boolean} editable Direct setField permission; growth uses addExperience.
 * @property {string} status
 * @property {string} reason Readonly or validation explanation.
 * @property {string} description
 * @property {Array<{x:number,y:number,z:number}>} related Linked fields, never implicit writes.
 * @property {Array<{function:string,sheet:string,sid:number,actionSid:number}>} source
 */
(() => {
 'use strict';
 const BASICS=[
  {name:'銅錢',x:1,y:2,z:0,description:'建設、升級與招募使用的主要貨幣。'},
  {name:'共用經驗',x:2,y:2,z:0,description:'可用於角色升級的共用經驗資源。'},
  {name:'魂魄',x:3,y:2,z:0,description:'遊戲獨立儲存的魂魄資源。'},
  {name:'科技點',x:4,y:2,z:0,description:'用於科技升級的點數。'},
  {name:'操練點',x:5,y:2,z:0,description:'用於操練的點數。'}
 ];
 const KNOWLEDGE=/*__KNOWLEDGE__*/null;
 const MATERIALS=KNOWLEDGE.catalogs.materials.map(m=>({...m,type:m.category}));
 const traditionalMap=Object.fromEntries([...('桦樺枫楓刚剛涧澗矿礦铁鐵铜銅银銀药藥萤螢云雲纹紋络絡雾霧隐隱参參泪淚兰蘭灵靈莲蓮阶階兽獸练練气氣婴嬰炼煉虚虛体體')].reduce((a,c,i,s)=>{if(i%2===0)a.push([c,s[i+1]]);return a;},[]));
 const trad=s=>String(s).replace(/./gu,c=>traditionalMap[c]||c);
 for(const m of MATERIALS){m.name=trad(m.name);m.type=trad(m.type);m.x=m.id;m.y=6;m.z=0;}
 const key=c=>`${c.x},${c.y},${c.z}`;
 const exists=(o,c)=>[c.x,c.y,c.z].every((n,i)=>Number.isInteger(n)&&n>=0&&n<o.size[i]);
 const cell=(o,c)=>o.data[c.x][c.y][c.z];
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
 function buildingLevel(m,template){
  let level=0;
  for(let x=1;x<m.original.size[0];x++)if(get(m,C(x,0,1))===x&&get(m,C(x,1,1))===template){const n=get(m,C(x,5,1));if(!Number.isSafeInteger(n)||n<0)throw Error('建築等級資料不符。');level=Math.max(level,n);}
  return level;
 }
 function busyFacility(m,target,buildingTemplate){
  for(let x=1;x<m.original.size[0];x++)if(get(m,C(x,0,21))===x&&get(m,C(x,3,21))===target){
   const parent=get(m,C(x,2,21));if(Number.isSafeInteger(parent)&&parent>0&&parent<m.original.size[0]&&get(m,C(parent,1,1))===buildingTemplate)return true;
  }
  return false;
 }
 // Set-level candidates are independent of ordinary equipment and remain gated until their own first proof.
 function setEquipmentLevelInfo(m,{itemId,plane=9}){
  const fail=reason=>{throw Error('套裝等級：'+reason);},rules=KNOWLEDGE.setEquipmentLevel;
  if(!rules||rules.version!==1||![7,9].includes(plane)||!Number.isSafeInteger(itemId)||itemId<1||itemId>=m.original.size[0])fail('庫別、資料或編號不符。');
  const record=Array.from({length:60},(_,y)=>get(m,C(itemId,y,plane))),item=catalogMaps.items.get(record[1]),t=rules.items[record[1]],origin=rules.origins[record[27]],quality=record[5],level=record[6],owner=record[7];
  if(!item||item.kind!=='套装'||!t||!rules.sets[t.setLink]?.members.includes(record[1])||t.slot!==item.slot||t.part!==t.slot)fail('範本或 setLink 尚未涵蓋。');
  if(!Number.isSafeInteger(record[0])||record[0]<1||record[0]>=m.original.size[0]||record[2]!==1||record[3]!==t.tier||!Number.isSafeInteger(t.tier)||t.tier<1||t.tier>9)fail('識別、數量或等階不符。');
  if(!Number.isSafeInteger(quality)||quality<1||quality>6||!Number.isSafeInteger(level)||level<1||level>10+5*(quality-1))fail('只支援原版品質與等級，超限停用。');
  // Only the first conversion of an ordinary template is covered; repeated set conversion is unknown.
  if(!origin||origin.slot!==t.slot||origin.tier!==t.tier||!Number.isSafeInteger(record[23])||record[23]<1||record[23]>6||!decimal2(record[26])||record[26]<0||!Number.isSafeInteger(Math.round(record[26]*10))||Math.abs(record[26]*10-Math.round(record[26]*10))>1e-7)fail('合成來源 metadata 尚未涵蓋。');
  if(![0,1].includes(record[24])||record[25]!==0||!Number.isSafeInteger(record[8])||record[8]<80+30*(quality-1)||record[8]>80+30*quality||!Number.isSafeInteger(owner)||owner<0)fail('特殊狀態、主係數或歸屬不符。');
  // Cross-pool scope reuses the set-quality pool (P套) for the one selected slot, behind its own per-plane first proof; closed, it is the original-pool check.
  const crossPool=KNOWLEDGE.verification[plane===7?'backpackSetEquipmentLevelCrossPool':'setEquipmentLevelCrossPool']===true?KNOWLEDGE.setEquipmentQuality?.pools?.[record[1]]:undefined;
  let selected=0;
  for(let slot=1;slot<=6;slot++){
   const id=record[8+slot],coefficient=record[14+slot],flag=record[27+slot];
   if(![0,1].includes(flag))fail('洗練旗標不符。');
   if(slot<quality){if(!(origin.affixIds.includes(id)||flag===1&&!!crossPool?.affixIds.includes(id))||!decimal2(coefficient)||coefficient<10*(quality-1)||coefficient>60+10*quality)fail('原裝備詞條或係數不符。');}
   else if(id!==0||coefficient!==0||flag!==0)fail('品質外詞條槽仍有資料。');
   if(flag&&++selected>1)fail('多個已選洗練槽尚未涵蓋。');
  }
  let references=0;
  for(let x=1;plane===9&&x<m.original.size[0];x++)for(let slot=1;slot<=6;slot++)if(get(m,C(x,15+slot,2))===itemId){
   references++;if(owner!==x||!activeCharacter(m,x)||slot!==t.slot)fail('穿戴雙向指標不一致。');
  }
  if(plane===7&&owner!==0||owner>0&&(!activeCharacter(m,owner)||references!==1)||owner===0&&references!==0)fail('穿戴雙向指標不一致。');
  const group=plane===7?'backpackSetEquipmentLevel':'setEquipmentLevel',normalMax=10+5*(quality-1);
  return {kind:'equipment',isSet:true,id:itemId,itemId,plane,name:item.name,coordinate:C(itemId,6,plane),current:level,min:1,normalMax,advancedMax:normalMax,advancedVerified:false,verified:KNOWLEDGE.verification[group]===true,group,record,template:t,metadataStatus:'preserved; independent-native-proof-required'};
 }
 // Treasure-level candidates (y6 only) are independent of ordinary and set equipment; gated by their own first proof.
 function treasureLevelInfo(m,{itemId,plane=9}){
  const fail=reason=>{throw Error('寶物等級：'+reason);},rules=KNOWLEDGE.treasureLevel;
  if(!rules||rules.version!==1||![7,9].includes(plane)||!Number.isSafeInteger(itemId)||itemId<1||itemId>=m.original.size[0])fail('庫別、資料或編號不符。');
  const record=Array.from({length:60},(_,y)=>get(m,C(itemId,y,plane))),item=catalogMaps.items.get(record[1]),t=rules.items[record[1]],quality=record[5],level=record[6],owner=record[7],limits=rules.limits;
  if(!item||item.kind!=='宝物'||!t||t.slot!==limits.slot)fail('範本尚未涵蓋。');
  if(record.some(v=>typeof v!=='number'||!Number.isFinite(v))||!Number.isSafeInteger(record[0])||record[0]<1||record[0]>=m.original.size[0])fail('識別或欄位型別不符。');
  if(record[2]!==limits.quantity||record[3]!==t.tier||record[4]!==0||![0,1].includes(record[22]))fail('數量、等階或特殊狀態不符。');
  if(!Number.isSafeInteger(quality)||quality<rules.qualities.min||quality>rules.qualities.max)fail('只支援原版品質。');
  const normalMax=rules.qualities.capBase+rules.qualities.capStep*(quality-1);
  if(!Number.isSafeInteger(level)||level<1||level>normalMax)fail('只支援原版等級，超限停用。');
  // Native slot replacement leaves the displaced treasure with its old owner (observed); that stale owner must name an active character.
  if(!Number.isSafeInteger(owner)||owner<0||owner>0&&!activeCharacter(m,owner))fail('歸屬不符。');
  let references=0;
  for(let x=1;plane===9&&x<m.original.size[0];x++)for(let slot=1;slot<=6;slot++)if(get(m,C(x,15+slot,2))===itemId){
   references++;if(owner!==x||!activeCharacter(m,x)||slot!==limits.slot)fail('穿戴雙向指標不一致。');
  }
  // references===1 is a worn row; references===0 with an active owner is the observed native stale-owner state.
  if(plane===9&&references>1)fail('穿戴雙向指標不一致。');
  const group=plane===7?'backpackTreasureLevel':'treasureLevel';
  return {kind:'equipment',isTreasure:true,id:itemId,itemId,plane,name:item.name,coordinate:C(itemId,6,plane),current:level,min:1,normalMax,advancedMax:normalMax,advancedVerified:false,verified:KNOWLEDGE.verification[group]===true,group,record,template:t,metadataStatus:'preserved; independent-native-proof-required'};
 }
 // Set-quality candidate eligibility (A3): read-only, cross-pool policy for isolated tests only. Formal level/quality entries keep their proven scope.
 function setEquipmentQualityCandidateInfo(m,{itemId,plane=9}){
  const fail=reason=>{throw Error('套裝品質候選：'+reason);},rules=KNOWLEDGE.setEquipmentQuality,levels=KNOWLEDGE.setEquipmentLevel;
  if(!rules||rules.version!==1||!levels||levels.version!==1||!rules.limits.planes.includes(plane)||!Number.isSafeInteger(itemId)||itemId<1||itemId>=m.original.size[0])fail('庫別、資料或編號不符。');
  const record=Array.from({length:60},(_,y)=>get(m,C(itemId,y,plane))),item=catalogMaps.items.get(record[1]),t=levels.items[record[1]],pool=rules.pools[record[1]],q=rules.quality,quality=record[5],level=record[6],owner=record[7];
  if(!item||item.kind!=='套装'||!t||!pool||!levels.sets[t.setLink]?.members.includes(record[1])||t.slot!==item.slot||t.part!==t.slot||pool.tier!==t.tier||pool.slot!==t.slot)fail('範本或詞條池尚未涵蓋。');
  if(!Number.isSafeInteger(record[0])||record[0]<1||record[0]>=m.original.size[0]||record[2]!==rules.limits.quantity||record[3]!==t.tier||t.tier<rules.limits.minTier||t.tier>rules.limits.maxTier)fail('識別、數量或等階不符。');
  const normalMax=q.levelCapBase+q.levelCapStep*(quality-1);
  if(!Number.isSafeInteger(quality)||quality<q.min||quality>q.max||!Number.isSafeInteger(level)||level<1||level>normalMax)fail('只支援原版品質與等級，超限停用。');
  // y27 names the ordinary source (P原); it must share tier and slot with the set template (P套).
  const origin=Number.isSafeInteger(record[27])&&record[27]>0?levels.origins[record[27]]:undefined;
  if(!origin)fail('缺少合成來源 y27。');
  if(origin.tier!==pool.tier||origin.slot!==pool.slot)fail('合成來源同階／部位不符。');
  if(!Number.isSafeInteger(record[23])||record[23]<1||record[23]>6||!decimal2(record[26])||record[26]<0||Math.abs(record[26]*10-Math.round(record[26]*10))>1e-7)fail('合成來源 metadata 尚未涵蓋。');
  if(![0,1].includes(record[24])||record[25]!==0||!Number.isSafeInteger(record[8])||record[8]<q.mainBase+q.mainStep*(quality-1)||record[8]>q.mainBase+q.mainStep*quality||!Number.isSafeInteger(owner)||owner<0)fail('特殊狀態、主係數或歸屬不符。');
  const slots=[];let selected=0;
  for(let slot=1;slot<=6;slot++){
   const id=record[8+slot],coefficient=record[14+slot],flag=record[27+slot];
   if(![0,1].includes(flag))fail('洗練旗標不符。');
   if(slot>=quality){if(id!==0||coefficient!==0||flag!==0)fail('品質外詞條槽仍有資料。');continue;}
   if(flag){if(selected)fail('多個已選洗練槽。');selected=slot;}
   const inOrigin=origin.affixIds.includes(id),inSet=pool.affixIds.includes(id),source=inOrigin&&inSet?'both':inOrigin?'origin':inSet?'set':'none';
   if(flag?source==='none':!inOrigin)fail(flag?'已選槽詞條不在原裝備或套裝池。':'未選槽只能使用原裝備詞條。');
   if(!decimal2(coefficient)||coefficient<q.subStep*(quality-1)||coefficient>q.subSpan+q.subStep*quality)fail('詞條係數不符。');
   slots.push({slot,attributeId:id,coefficient,selected:!!flag,source});
  }
  let references=0;
  for(let x=1;plane===9&&x<m.original.size[0];x++)for(let s=1;s<=6;s++)if(get(m,C(x,15+s,2))===itemId){
   references++;if(owner!==x||!activeCharacter(m,x)||s!==t.slot)fail('穿戴雙向指標不一致。');
  }
  if(plane===7&&owner!==rules.limits.backpackOwner||owner>0&&(!activeCharacter(m,owner)||references!==1)||owner===0&&references!==0)fail('穿戴雙向指標不一致。');
  const prefix=plane===7?'backpackSetEquipmentQuality':'setEquipmentQuality',groups={upgrade:prefix+'Upgrade',downgrade:prefix+'Downgrade'};
  return {kind:'setEquipmentQualityCandidate',candidate:true,itemId,plane,name:item.name,quality,level,normalMax,mainCoefficient:record[8],originId:record[27],selectedSlot:selected||null,slots,
   groups,verified:{upgrade:KNOWLEDGE.verification[groups.upgrade]===true,downgrade:KNOWLEDGE.verification[groups.downgrade]===true},
   pools:{origin:[...origin.affixIds],set:[...pool.affixIds]},policies:{...rules.policies},record,template:t,metadataStatus:'candidate-only; independent-native-proof-required'};
 }
 // Set-quality candidate preview (A4): read-only shift/slot/cap/pool plan dispatched to one of four groups; never writes or opens a transaction.
 function previewSetEquipmentQualityCandidate(m,{itemId,plane=9,quality,addedAffixes=[]}){
  const fail=reason=>{throw Error('套裝品質候選：'+reason);},info=setEquipmentQualityCandidateInfo(m,{itemId,plane}),q=KNOWLEDGE.setEquipmentQuality.quality;
  if(!Number.isSafeInteger(quality)||quality<q.min||quality>q.max)fail(`目標品質須為 ${q.min}–${q.max} 的整數。`);
  const delta=quality-info.quality,direction=delta>0?'upgrade':delta<0?'downgrade':'none',group=direction==='none'?null:info.groups[direction];
  const currentSlots=info.quality-1,targetSlots=quality-1,normalMax=q.levelCapBase+q.levelCapStep*(quality-1);
  // Quality never lowers level implicitly; the set-level entry must reduce it first.
  if(info.level>normalMax)fail('等級超過目標品質上限，請先用套裝等級功能降低。');
  if(info.selectedSlot&&info.selectedSlot>targetSlots)fail('已選洗練槽會被移除，不能降至此品質。');
  if(!Array.isArray(addedAffixes))fail('新增詞條資料格式不正確。');
  if(addedAffixes.length!==Math.max(0,targetSlots-currentSlots))fail('請明確指定每個新增尾槽，不能增減其他槽。');
  // Existing duplicates are kept; added tails come from P原 only and may not duplicate any kept slot.
  const before=info.record,bySlot=new Map(),ids=new Set(before.slice(9,9+Math.min(currentSlots,targetSlots)));
  for(const a of addedAffixes){
   if(!a||!Number.isSafeInteger(a.slot)||a.slot<=currentSlots||a.slot>targetSlots||bySlot.has(a.slot))fail('新增槽須為連續尾槽且不得重複。');
   if(!Number.isSafeInteger(a.attributeId)||!info.pools.origin.includes(a.attributeId))fail('新增尾槽只能使用原裝備詞條。');
   if(ids.has(a.attributeId))fail('不能新增與其他槽重複的詞條。');
   if(!decimal2(a.coefficient)||a.coefficient<q.subStep*(quality-1)||a.coefficient>q.subSpan+q.subStep*quality)fail('新增詞條係數超出目標品質範圍或超過兩位小數。');
   ids.add(a.attributeId);bySlot.set(a.slot,a);
  }
  const after=before.slice();after[5]=quality;after[8]=before[8]+q.shift.main*delta;
  const slots=[];
  for(let slot=1;slot<=Math.max(currentSlots,targetSlots);slot++){
   const kind=slot>currentSlots?'added':slot>targetSlots?'removed':'retained';
   if(kind==='retained')after[14+slot]=delta?(Math.round(before[14+slot]*100)+q.shift.sub*100*delta)/100:before[14+slot];
   else if(kind==='added'){const a=bySlot.get(slot);after[8+slot]=a.attributeId;after[14+slot]=a.coefficient;after[27+slot]=0;}
   else{after[8+slot]=0;after[14+slot]=0;after[27+slot]=0;}
   const source=kind==='added'?'origin':info.slots[slot-1].source;
   slots.push({slot,kind,source,before:{attributeId:before[8+slot],coefficient:before[14+slot],flag:before[27+slot]},after:{attributeId:after[8+slot],coefficient:after[14+slot],flag:after[27+slot]}});
  }
  const name=plane===7?'背包':'裝備庫',changes=after.flatMap((value,y)=>value!==before[y]?[{coordinate:C(itemId,y,plane),before:before[y],after:value,label:`${name} #${itemId}・套裝品質候選・${y===5?'品質':y===8?'主係數':y>=28?'槽 '+(y-27)+' 旗標':y>=15?'槽 '+(y-14)+' 係數':'槽 '+(y-8)+' 詞條'}`}]:[]);
  return {kind:'setEquipmentQualityCandidatePreview',candidate:true,itemId,plane,quality,previousQuality:info.quality,direction,group,verified:group?info.verified[direction]:false,
   level:info.level,normalMax,previousMax:info.normalMax,targetSlots,previousSlots:currentSlots,mainCoefficient:{before:before[8],after:after[8]},selectedSlot:info.selectedSlot,slots,changes,
   pools:info.pools,requiresRemovalConfirmation:targetSlots<currentSlots,unchanged:changes.length===0,metadataStatus:info.metadataStatus};
 }
 // Set-quality candidate transaction (A5 upgrade, A6 downgrade). Writes exactly the preview changes under the item's editing group, gated per plane and direction.
 function applySetEquipmentQualityCandidate(m,{itemId,plane=9,quality,addedAffixes=[],confirmRemovedAffixes=false,advanced=false}){
  const fail=reason=>{throw Error('套裝品質候選：'+reason);};
  if(advanced!==false)fail('未開放超限模式。');
  if(typeof confirmRemovedAffixes!=='boolean')fail('刪槽確認格式不正確。');
  const preview=previewSetEquipmentQualityCandidate(m,{itemId,plane,quality,addedAffixes});
  if(preview.unchanged)return preview;
  if(!preview.verified)fail('此庫別與方向尚未完成獨立遊戲驗證。');
  if(preview.requiresRemovalConfirmation&&!confirmRemovedAffixes)fail('請確認移除預覽中的尾端詞條槽。');
  const previous=m.currentGroup;m.currentGroup=`editing:equipment:${plane}:${itemId}`;
  try{transaction(m,()=>{
   for(const c of preview.changes)put(m,c.coordinate,c.after,c.label);
   // Re-read the written record; any mismatch throws and the transaction rolls back.
   const after=setEquipmentQualityCandidateInfo(m,{itemId,plane});
   if(after.quality!==quality||preview.changes.some(c=>!Object.is(get(m,c.coordinate),c.after)))fail('寫入後檢查不符。');
  },preview.direction==='upgrade'?'套裝品質候選升品':'套裝品質候選降品');}finally{m.currentGroup=previous;}
  return preview;
 }
 // Set-quality candidate effects (B3): read-only single-item before/after effects for the previewed record; no write, no transaction.
 function setEquipmentQualityCandidateEffects(m,{itemId,plane=9,quality,addedAffixes=[]}){
  const info=setEquipmentQualityCandidateInfo(m,{itemId,plane}),preview=previewSetEquipmentQualityCandidate(m,{itemId,plane,quality,addedAffixes}),levels=KNOWLEDGE.setEquipmentLevel,t=info.template;
  const before=info.record,after=before.slice();for(const c of preview.changes)after[c.coordinate.y]=c.after;
  const calc=(record,id,coefficient,setting,L)=>{
   const rule=levels.attributes[id],T=record[3],Q=record[5];if(!rule)throw Error('套裝品質候選：此效果公式尚未核對。');let value;
   if(rule.kind==='attack'){const n=((T-1)*30)+1,base=Math.ceil(((5*n)+(65*Math.pow(1.036,n)))-55);value=Math.floor((((base*(1+(0.04*L)))*(coefficient/100))*(setting/100))+(L*Q));}
   else if(rule.kind==='aptitude')value=Math.floor((((((100*0.003)*Math.pow(T,1.6))*(1+(0.04*L)))*100)*(coefficient/100))*(setting/100))/100;
   else if(rule.kind==='work'){const base=Math.round(8+(2*Math.pow(((T-1)*10)+1,1.2)));value=Math.floor(((((0.4*base)*(1+(0.04*L)))*(coefficient/100))*(setting/100))+L);}
   else if(rule.kind==='percent')value=Math.floor(((rule.base+(rule.tier*T)+(rule.level*L))*(coefficient/100))*100)/100;
   else throw Error('套裝品質候選：此效果公式尚未核對。');
   if(!Number.isFinite(value))throw Error('套裝品質候選：效果超出可計算範圍。');return value;
  };
  const total=(record,id)=>{let sum=0;t.mainAttributes.forEach((main,s)=>{if(main===id)sum+=calc(record,id,record[8],t.mainSettings[s],record[6]);});for(let s=1;s<=6;s++)if(record[8+s]===id)sum+=calc(record,id,record[14+s],100,0);return sum;};
  const ids=new Set([...t.mainAttributes.filter(Boolean),...before.slice(9,15),...after.slice(9,15)].filter(Boolean)),effects=[...ids].sort((a,b)=>a-b).map(id=>{
   const rule=levels.attributes[id],a=total(before,id),b=total(after,id);
   return {attributeId:id,name:catalogName('attributes',id),unit:rule?.format==='百分比'?'%':'',before:a,after:b,delta:b-a,removed:b===0&&a!==0};
  });
  return {kind:'setEquipmentQualityCandidateEffects',candidate:true,itemId,plane,quality,effects,effectUnchanged:effects.every(v=>v.before===v.after),setBonusNote:'套裝積分、件數與額外套裝效果不隨品質改變。'};
 }
 function editingInfo(m,kind,id,plane=9){
  if(kind==='equipment'&&![7,9].includes(plane))throw Error('裝備庫別只接受 7 或 9。');
  if(!Number.isSafeInteger(id)||id<1||id>=m.original.size[0])throw Error('無效的資料編號。');
  if(kind==='equipment'&&catalogMaps.items.get(get(m,C(id,1,plane)))?.kind==='套装')return setEquipmentLevelInfo(m,{itemId:id,plane});
  if(kind==='equipment'&&catalogMaps.items.get(get(m,C(id,1,plane)))?.kind==='宝物')return treasureLevelInfo(m,{itemId:id,plane});
  let coordinate,normalMax,min=1,name;
  if(kind==='equipment'){
   const item=catalogMaps.items.get(get(m,C(id,1,plane))),quality=get(m,C(id,5,plane)),owner=get(m,C(id,7,plane));
   const originSlot=get(m,C(id,0,plane));
   if(!Number.isSafeInteger(originSlot)||originSlot<1||originSlot>=m.original.size[0]||!item||item.category!=='裝備'||['宝物','内丹'].includes(item.kind)||!Number.isInteger(item.slot)||item.slot<1||item.slot>6)throw Error('只支援有效一般裝備，不包含寶物及內丹。');
   if(!Number.isSafeInteger(quality)||quality<1||!Number.isSafeInteger(owner)||owner<0)throw Error('裝備品質或歸屬資料不符。');
   if(plane===7){
    const rules=KNOWLEDGE.batch2Data?.items[item.id],tier=get(m,C(id,3,plane));
    if(get(m,C(id,2,plane))!==1||owner!==0)throw Error('背包普通裝備須數量為 1 且歸屬為 0。');
    if(item.kind!=='普通'||item.slot>4||!rules||rules.setLink!==0||quality>6||!Number.isSafeInteger(tier)||tier<1||tier>9||tier!==rules.tier)throw Error('背包只支援原版等階、品質的一般裝備，不包含套裝。');
    if(![0,1].includes(get(m,C(id,24,plane)))||[25,26,27].some(y=>get(m,C(id,y,plane))!==0))throw Error('裝備包含尚未涵蓋的特殊狀態。');
   }else{
    const rules=KNOWLEDGE.batch2Data?.items[item.id];
    if(item.kind!=='普通'||!rules||rules.setLink!==0)throw Error('只支援一般裝備，套裝等級尚未隔離驗證。');
    let references=0;
    for(let x=1;x<m.original.size[0];x++)if(activeCharacter(m,x))for(let slot=1;slot<=6;slot++)if(get(m,C(x,15+slot,2))===id){references++;if(owner!==x||slot!==item.slot)throw Error('裝備穿戴雙向指標不一致。');}
    if(owner>0&&(!activeCharacter(m,owner)||references!==1)||owner===0&&references!==0)throw Error('裝備穿戴雙向指標不一致。');
   }
   coordinate=C(id,6,plane);normalMax=10+(quality-1)*5;name=item.name;
  }else if(kind==='training'){
   const profession=catalogMaps.professions.get(id);if(!profession)throw Error('無效的職業編號。');
   if(get(m,C(id,15,0))!==0||busyFacility(m,id,6))throw Error('此職業正在操練，請先在遊戲內停止。');
   for(let x=1;x<m.original.size[0];x++)if(activeCharacter(m,x)){const level=get(m,C(x,id,4));if(!Number.isSafeInteger(level)||level<0)throw Error('角色職業等級資料不符。');min=Math.max(min,level);}
   coordinate=C(id,5,0);const building=buildingLevel(m,6);normalMax=building?5+(building+1)*5:0;name=profession.name;
  }else if(kind==='technology'){
   const technology=catalogMaps.technologies.get(id);if(!technology?.advanced)throw Error('只支援有效的進階科技（31–44）。');
   if(get(m,C(id,13,0))!==0||busyFacility(m,id,5))throw Error('此科技正在研究，請先在遊戲內停止。');
   coordinate=C(id,4,0);const building=buildingLevel(m,5);normalMax=building?Math.min(technology.tableLimit-1,Math.max(1,(building+1)*60-1)):0;name=technology.name;
  }else throw Error('未知的修改類型。');
  const current=get(m,coordinate);if(!Number.isSafeInteger(current)||current<0||kind==='equipment'&&current<1)throw Error('現有數值與欄位型別不符。');
  const group=kind==='equipment'&&plane===7?'backpackEquipmentLevel':EDIT_GROUPS[kind],limits=KNOWLEDGE.editingLimits?.[kind];
  return {kind,id,plane,name,coordinate,current,min,normalMax,advancedMax:limits?.maxById?.[id]??limits?.max??0,verified:!!KNOWLEDGE.verification[group],advancedVerified:!!KNOWLEDGE.verification[group+'Advanced']};
 }
 function setEditingValue(m,kind,id,value,advanced=false,plane=9){
  if(typeof advanced!=='boolean')throw Error('進階模式參數不正確。');
  const info=editingInfo(m,kind,id,plane);
  // Backpack over-limit (z7 advanced) keeps the structural checks but lets an already over-limit row be edited.
  if(kind==='equipment'&&plane===7&&!info.isSet&&!info.isTreasure)ordinaryEquipment(m,id,plane,info.advancedVerified);
  if(!info.verified||advanced&&!info.advancedVerified)throw Error('此修改模式尚未完成隔離遊戲驗證，目前停用。');
  if(!Number.isSafeInteger(value)||value<info.min)throw Error(`請輸入不小於 ${info.min} 的安全整數；操練上限不得低於角色現有職業等級。`);
  const max=advanced?info.advancedMax:Math.min(info.normalMax,info.advancedMax);
  if(value>max)throw Error(`超出${advanced?'已驗證的進階':'一般模式'}上限 ${max}。`);
  if(kind==='equipment'){
   if([...m.changes.values()].some(c=>c.x===id&&c.z===plane&&((c.y>=9&&c.y<=20)||(c.y>=28&&c.y<=33)))&&value>info.normalMax)throw Error('已修改詞條係數或 ID 的裝備，本輪不能再調為超限等級。');
   const tier=get(m,C(id,3,plane));
   if(!Number.isSafeInteger(tier)||tier<1||![(tier-1)*30+value,(tier*6/9-1)*30+4*value].every(d=>Number.isFinite(10*1.05**d-1)))throw Error('裝備等階或升級公式超出可計算範圍。');
  }
  if(kind==='training'){
   const tier=catalogMaps.professions.get(id).tier,d=tier<4?10*(tier-1)+value+1:50*(tier-3)+(tier-1)*(value+1);
   if(!Number.isFinite(35*d**1.9*1.0375**d*3)||!Number.isFinite(150*d**1.7*1.009**d*5))throw Error('操練公式超出可計算範圍。');
  }
  if(kind==='technology'&&id===32&&400+2*value>m.original.size[0]-1)throw Error('背包容量會超過這份存檔的實體空間。');
  if(kind==='technology'&&[32,44].includes(id)){
   let held=0;
   for(let x=1;x<m.original.size[0];x++)if(id===32?get(m,C(x,0,7))>0:get(m,C(x,0,1))>0&&get(m,C(x,1,1))===67)held++;
   if(held>(id===32?400+2*value:10+Math.floor((value+1)/5)))throw Error('下調後的容量小於現有物品或置物台數量。');
  }
  if(kind==='technology'){
   const d=value+6,cost=35*d**1.9*1.0375**d,currency=150*d**1.7*1.009**d;
   if(!Number.isFinite(cost)||!Number.isFinite(currency))throw Error('科技公式超出可計算範圍。');
  }
  const previous=m.currentGroup;m.currentGroup=kind==='equipment'?`editing:equipment:${plane}:${id}`:`editing:${kind}:${id}`;
  try{transaction(m,()=>put(m,info.coordinate,value,`${info.name}・${kind==='training'?'操練上限':'等級'}`),`${advanced?'進階・':''}${info.name}調整`);}finally{m.currentGroup=previous;}
  return {...info,value};
 }
 const setEquipmentLevel=(m,{itemId,level,advanced=false,plane=9})=>setEditingValue(m,'equipment',itemId,level,advanced,plane);
 const setProfessionTrainingCap=(m,{professionId,cap,advanced=false})=>setEditingValue(m,'training',professionId,cap,advanced);
 const setAdvancedTechnologyLevel=(m,{technologyId,level,advanced=false})=>setEditingValue(m,'technology',technologyId,level,advanced);
 // Batch-two operations intentionally have no advanced mode.
 const aptitudeNames=['力量','敏捷','智力'];
 const decimal2=value=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER/100&&Math.abs(value*100-Math.round(value*100))<1e-8;
 function ordinaryEquipment(m,itemId,plane=9,overLimitLevel=false){
  const info=editingInfo(m,'equipment',itemId,plane),item=catalogMaps.items.get(get(m,C(itemId,1,plane))),rules=KNOWLEDGE.batch2Data?.items[item.id];
  const q=get(m,C(itemId,5,plane)),tier=get(m,C(itemId,3,plane));
  if(item.kind!=='普通'||!rules||rules.setLink!==0||item.slot>4||q>6||!Number.isSafeInteger(tier)||tier<1||tier>9||tier!==rules.tier||!overLimitLevel&&info.current>info.normalMax)throw Error('只支援原版等階、品質與等級範圍的一般裝備；套裝、寶物、內丹與超限裝備停用。');
  const newItemMarker=get(m,C(itemId,24,plane));
  if(![0,1].includes(newItemMarker)||[25,26,27].some(y=>get(m,C(itemId,y,plane))!==0))throw Error('裝備包含特殊狀態，尚未涵蓋飛升或套裝轉換。');
  if(plane===9&&newItemMarker===1&&!KNOWLEDGE.verification.equipmentNewItemMarker)throw Error('新取得裝備狀態尚待隔離驗證。');
  const slots=q-1;let selected=0;
  for(let slot=1;slot<=6;slot++){
   const id=get(m,C(itemId,8+slot,plane)),coefficient=get(m,C(itemId,14+slot,plane)),flag=get(m,C(itemId,27+slot,plane));
   if(![0,1].includes(flag))throw Error('洗練旗標不符。');
   if(slot<=slots){if(!rules.affixIds.includes(id)||!decimal2(coefficient)||coefficient<10*(q-1)||coefficient>60+10*q)throw Error('既有詞條或係數不在原版範圍內。');}
   else if(id!==0||coefficient!==0||flag!==0)throw Error('品質以外的詞條槽仍有資料。');
   if(flag){if(selected)throw Error('未涵蓋多個已洗練槽的裝備。');selected=slot;}
  }
  return {...info,quality:q,tier,selected,slots,rules,newItemMarker};
 }
 function equipmentSlotInfo(m,itemId,slot,plane=9){
  const info=ordinaryEquipment(m,itemId,plane);
  if(!Number.isInteger(slot)||slot<1||slot>info.slots)throw Error('請選擇品質範圍內的既有詞條槽。');
  if(info.selected&&info.selected!==slot)throw Error('只可調整已選定的洗練槽，不能更換選槽。');
  return {...info,slot,coordinate:C(itemId,14+slot,plane),current:get(m,C(itemId,14+slot,plane)),attributeId:get(m,C(itemId,8+slot,plane)),min:10*(info.quality-1),max:60+10*info.quality};
 }
 function affixInfo(m,itemId,slot,plane=9){
  const info=equipmentSlotInfo(m,itemId,slot,plane);
  if(!info.selected)throw Error('只可調整已選定的洗練槽；請先選槽洗練一次。');
  return {...info,verified:!!KNOWLEDGE.verification[plane===7?'backpackEquipmentAffixCoefficient':'equipmentAffixCoefficient']};
 }
 function batch2Put(m,info,value,group,label){
  const previous=m.currentGroup;m.currentGroup=group;
  try{transaction(m,()=>put(m,info.coordinate,value,label),label);}finally{m.currentGroup=previous;}
  return {...info,value};
 }
 function setEquipmentAffixCoefficient(m,{itemId,slot,coefficient,advanced=false,plane=9}){
  if(advanced!==false)throw Error('詞條係數尚未開放超限模式。');
  const info=affixInfo(m,itemId,slot,plane);
  if(!info.verified)throw Error('詞條係數尚未完成隔離遊戲驗證。');
  if(!decimal2(coefficient)||coefficient<info.min||coefficient>info.max)throw Error(`係數須為 ${info.min}–${info.max}，最多兩位小數。`);
  return batch2Put(m,info,coefficient,`editing:equipment:${plane}:${itemId}`,`${info.name}・詞條 ${slot} 係數`);
 }
 // Each slot is rounded by the game before addition. Secondary affixes force L=0.
 function affixEffect(attributeId,tier,level,coefficient){
  const r=KNOWLEDGE.affixReplacement?.attributes[attributeId];
  if(!r)throw Error('此詞條尚未核對效果公式。');
  const value=Math.floor(((r.base+r.tier*tier+r.level*level)*(coefficient/100))*100)/100;
  if(!Number.isFinite(value))throw Error('裝備效果超出可計算範圍。');
  return value;
 }
 function equipmentAffixReplacementInfo(m,{itemId,slot,plane=9}){
  const info=equipmentSlotInfo(m,itemId,slot,plane),requiresInitialSelection=!info.selected;
  const enabled=!!KNOWLEDGE.verification[plane===7?'backpackEquipmentAffixReplacement':'equipmentAffixReplacement']&&(!requiresInitialSelection||!!KNOWLEDGE.verification.equipmentAffixInitialSelection);
  const otherIds=Array.from({length:info.slots},(_,i)=>i+1).filter(i=>i!==slot).map(i=>get(m,C(itemId,8+i,plane)));
  const candidates=info.rules.affixIds.map(attributeId=>{
   const formula=KNOWLEDGE.affixReplacement?.attributes[attributeId];
   const duplicate=attributeId!==info.attributeId&&otherIds.includes(attributeId);
   const supported=!!formula&&KNOWLEDGE.affixReplacementLimits?.attributeIds.includes(attributeId);
   return {attributeId,name:catalogName('attributes',attributeId),unit:formula?.unit||'',supported,verified:enabled&&supported&&!duplicate,reason:duplicate?'不能新增與其他槽重複的詞條':!supported?'此詞條尚未核對效果公式':!enabled?(requiresInitialSelection&&!KNOWLEDGE.verification.equipmentAffixInitialSelection?'首次選槽尚待原生遊戲 UI 驗證':'精準洗練尚待隔離驗證'):''};
  });
  return {...info,verified:enabled,candidates,requiresInitialSelection,selectedSlot:info.selected||null,selectableSlots:info.selected?[info.selected]:Array.from({length:info.slots},(_,i)=>i+1)};
 }
 function equipmentAffixEffect(m,info,attributeId,replacement){
  let total=0;
  for(const id of info.rules.mainAttributes)if(id===attributeId){
   const q=get(m,C(info.id,8,info.plane));
   if(!Number.isSafeInteger(q)||q<80+(info.quality-1)*30||q>80+info.quality*30)throw Error('主屬性品質係數不在已核對範圍，無法預覽重疊屬性。');
   total+=affixEffect(attributeId,info.tier,info.currentLevel,q);
  }
  for(let slot=1;slot<=info.slots;slot++){
   const id=replacement?.slot===slot?replacement.attributeId:get(m,C(info.id,8+slot,info.plane));
   const value=replacement?.slot===slot?replacement.coefficient:get(m,C(info.id,14+slot,info.plane));
   if(id===attributeId)total+=affixEffect(id,info.tier,0,value);
  }
  return total;
 }
 function previewEquipmentAffixReplacement(m,{itemId,slot,attributeId,coefficient,plane=9,selectUnwashedSlot=false}){
  const info=equipmentAffixReplacementInfo(m,{itemId,slot,plane});
  if(typeof selectUnwashedSlot!=='boolean')throw Error('首次選槽參數不正確。');
  if(selectUnwashedSlot&&!info.requiresInitialSelection)throw Error('此裝備已有選槽，不能再次首次選槽。');
  if(info.requiresInitialSelection&&!selectUnwashedSlot)throw Error('請確認首次選定此槽，才可套用詞條。');
  const candidate=info.candidates.find(v=>v.attributeId===attributeId);
  if(!Number.isSafeInteger(attributeId)||!candidate)throw Error('目標詞條不在此裝備的原版合法池。');
  if(!candidate.supported||candidate.reason.startsWith('不能'))throw Error(candidate.reason);
  if(!decimal2(coefficient)||coefficient<info.min||coefficient>info.max)throw Error(`係數須為 ${info.min}–${info.max}，最多兩位小數。`);
  // affixInfo.current is the coefficient; level remains a separate dependency.
  const calc={...info,id:itemId,currentLevel:get(m,C(itemId,6,plane))};
  const effects=[...new Set([info.attributeId,attributeId])].map(id=>{
   const before=equipmentAffixEffect(m,calc,id),after=equipmentAffixEffect(m,calc,id,{slot,attributeId,coefficient});
   return {attributeId:id,name:catalogName('attributes',id),unit:KNOWLEDGE.affixReplacement.attributes[id].unit,before,after,delta:after-before};
  });
  return {itemId,plane,slot,selectionChange:info.requiresInitialSelection?{before:0,after:slot}:null,before:{attributeId:info.attributeId,coefficient:info.current},after:{attributeId,coefficient},effects,unchanged:!info.requiresInitialSelection&&info.attributeId===attributeId&&info.current===coefficient,effectUnchanged:effects.every(v=>v.before===v.after),verified:candidate.verified};
 }
 function setEquipmentAffix(m,{itemId,slot,attributeId,coefficient,advanced=false,plane=9,selectUnwashedSlot=false}){
  if(advanced!==false)throw Error('精準洗練尚未開放超限模式。');
  const preview=previewEquipmentAffixReplacement(m,{itemId,slot,attributeId,coefficient,plane,selectUnwashedSlot});
  if(!preview.verified)throw Error('精準洗練尚未完成隔離遊戲驗證。');
  const previous=m.currentGroup;m.currentGroup=`editing:equipment:${plane}:${itemId}`;
  try{transaction(m,()=>{if(preview.selectionChange)put(m,C(itemId,27+slot,plane),1,`${plane===7?'背包':'裝備庫'} #${itemId}・首次選定洗練槽 ${slot}`);put(m,C(itemId,8+slot,plane),attributeId,`${plane===7?'背包':'裝備庫'} #${itemId}・詞條 ${slot}・${catalogName('attributes',preview.before.attributeId)} → ${catalogName('attributes',attributeId)}`);put(m,C(itemId,14+slot,plane),coefficient,`${plane===7?'背包':'裝備庫'} #${itemId}・詞條 ${slot}・係數`);},'精準洗練');}finally{m.currentGroup=previous;}
  return preview;
 }
 function equipmentQualityInfo(m,{itemId,plane=9}){
  const info=ordinaryEquipment(m,itemId,plane),record=Array.from({length:50},(_,y)=>get(m,C(itemId,y,plane))),data=KNOWLEDGE.equipmentQuality?.items[record[1]];
  if(!data||record[2]!==1)throw Error('品質調整只支援數量為 1 的普通裝備。');
  if(!Number.isSafeInteger(record[8])||record[8]<80+30*(info.quality-1)||record[8]>80+30*info.quality)throw Error('尚未支援此主係數範圍。');
  if(!data.mainSettings.every(v=>typeof v==='number'&&Number.isFinite(v)))throw Error('裝備主屬性設定尚未核對。');
  const targets=Array.from({length:6},(_,i)=>{const quality=i+1,slots=quality-1,normalMax=10+5*(quality-1),group=(plane===7?'backpackEquipmentQuality':'equipmentQuality')+(quality>info.quality?'Upgrade':'Downgrade');
   const reason=record[6]>normalMax?'等級超過目標品質上限，請先降低裝備等級。':info.selected>slots?'已選洗練槽會被移除，不能降至此品質。':'';
   return {quality,slots,normalMax,allowed:!reason,reason,group,verified:quality===info.quality||!!KNOWLEDGE.verification[group]};});
  return {...info,record,data,mainCoefficient:record[8],selectedSlot:info.selected||null,targets,candidates:info.rules.affixIds.map(attributeId=>({attributeId,name:catalogName('attributes',attributeId)}))};
 }
 function qualityAttributeEffect(record,attributeId){
  const data=KNOWLEDGE.equipmentQuality,template=data.items[record[1]],rule=data.attributes[attributeId];if(!rule)throw Error('此裝備效果公式尚未核對。');
  const T=record[3],Q=record[5];
  const calc=(L,coefficient,setting)=>{let value;
   if(rule.kind==='attack'){const n=((T-1)*30)+1,base=Math.ceil(((5*n)+(65*Math.pow(1.036,n)))-55);value=Math.floor((((base*(1+(0.04*L)))*(coefficient/100))*(setting/100))+(L*Q));}
   else if(rule.kind==='aptitude')value=Math.floor((((((100*0.003)*Math.pow(T,1.6))*(1+(0.04*L)))*100)*(coefficient/100))*(setting/100))/100;
   else if(rule.kind==='work'){const base=Math.round(8+(2*Math.pow(((T-1)*10)+1,1.2)));value=Math.floor(((((0.4*base)*(1+(0.04*L)))*(coefficient/100))*(setting/100))+L);}
   else value=Math.floor(((rule.base+(rule.tier*T)+(rule.level*L))*(coefficient/100))*100)/100;
   if(!Number.isFinite(value))throw Error('裝備效果超出可計算範圍。');return value;
  };
  let total=0;template.mainAttributes.forEach((id,s)=>{if(id===attributeId)total+=calc(record[6],record[8],template.mainSettings[s]);});
  for(let s=1;s<=6;s++)if(record[8+s]===attributeId)total+=calc(0,record[14+s],100);
  return total;
 }
 function previewEquipmentQualityChange(m,{itemId,plane=9,quality,addedAffixes=[]}){
  const info=equipmentQualityInfo(m,{itemId,plane}),target=info.targets.find(v=>v.quality===quality);
  if(!Number.isSafeInteger(quality)||!target)throw Error('目標品質須為 1–6 的整數。');if(!target.allowed)throw Error(target.reason);
  if(!Array.isArray(addedAffixes))throw Error('新增詞條資料格式不正確。');
  const required=Math.max(0,target.slots-info.slots);if(addedAffixes.length!==required)throw Error('請明確指定每個新增尾槽，不能增減其他槽。');
  const bySlot=new Map(),ids=new Set(info.record.slice(9,9+Math.min(info.slots,target.slots)));
  for(const a of addedAffixes){if(!a||!Number.isSafeInteger(a.slot)||a.slot<=info.slots||a.slot>target.slots||bySlot.has(a.slot))throw Error('新增槽須為連續尾槽且不得重複。');if(!Number.isSafeInteger(a.attributeId)||!info.rules.affixIds.includes(a.attributeId))throw Error('新增詞條不在此裝備原版合法池。');if(ids.has(a.attributeId))throw Error('不能新增與其他槽重複的詞條。');if(!decimal2(a.coefficient)||a.coefficient<10*(quality-1)||a.coefficient>60+10*quality)throw Error('新增詞條係數超出目標品質範圍或超過兩位小數。');ids.add(a.attributeId);bySlot.set(a.slot,a);}
  const before=info.record,after=before.slice(),delta=quality-info.quality;after[5]=quality;after[8]+=30*delta;
  const slots=[];
  for(let slot=1;slot<=6;slot++){
   if(slot<=Math.min(info.slots,target.slots))after[14+slot]=delta?(Math.round(before[14+slot]*100)+1000*delta)/100:before[14+slot];
   else if(slot<=target.slots){const a=bySlot.get(slot);if(!a)throw Error('缺少新增尾槽。');after[8+slot]=a.attributeId;after[14+slot]=a.coefficient;after[27+slot]=0;}
   else{after[8+slot]=0;after[14+slot]=0;after[27+slot]=0;}
   if(slot<=Math.max(info.slots,target.slots))slots.push({slot,kind:slot>info.slots?'added':slot>target.slots?'removed':'retained',before:{attributeId:before[8+slot],coefficient:before[14+slot],flag:before[27+slot]},after:{attributeId:after[8+slot],coefficient:after[14+slot],flag:after[27+slot]}});
  }
  const changes=after.flatMap((value,y)=>value!==before[y]?[{coordinate:C(itemId,y,plane),before:before[y],after:value,label:`${plane===7?'背包':'裝備庫'} #${itemId}・品質調整・${y===5?'品質':y===8?'主係數':y>=28?'槽 '+(y-27)+' 旗標':y>=15?'槽 '+(y-14)+' 係數':'槽 '+(y-8)+' 詞條'}`}]:[]);
  const effects=Object.keys(KNOWLEDGE.equipmentQuality.attributes).map(Number).map(attributeId=>{const old=qualityAttributeEffect(before,attributeId),value=qualityAttributeEffect(after,attributeId);return {attributeId,name:catalogName('attributes',attributeId),unit:KNOWLEDGE.equipmentQuality.attributes[attributeId].unit,before:old,after:value,delta:value-old};});
  return {itemId,plane,quality,previousQuality:info.quality,normalMax:target.normalMax,previousMax:info.normalMax,mainCoefficient:{before:before[8],after:after[8]},selectedSlot:info.selectedSlot,slots,changes,effects,requiresRemovalConfirmation:target.slots<info.slots,unchanged:changes.length===0,effectUnchanged:effects.every(v=>v.before===v.after),group:target.group,verified:target.verified};
 }
 function setEquipmentQuality(m,{itemId,plane=9,quality,addedAffixes=[],confirmRemovedAffixes=false,advanced=false}){
  if(advanced!==false)throw Error('品質調整未開放超限模式。');if(typeof confirmRemovedAffixes!=='boolean')throw Error('刪槽確認格式不正確。');
  const preview=previewEquipmentQualityChange(m,{itemId,plane,quality,addedAffixes});
  if(!preview.verified)throw Error('此庫別與方向的品質調整尚未完成獨立遊戲驗證。');
  if(preview.requiresRemovalConfirmation&&!confirmRemovedAffixes)throw Error('請確認移除預覽中的尾端詞條槽。');
  const previous=m.currentGroup;m.currentGroup=`editing:equipment:${plane}:${itemId}`;
  try{transaction(m,()=>{for(const c of preview.changes)put(m,c.coordinate,c.after,c.label);},'裝備品質調整');}finally{m.currentGroup=previous;}
  return preview;
 }
 // Skill cap rules begin. Independently bound by the skill-cap proof.
 function skillCapAptitudeWitness(quality,raw,orientation){
  const rules=KNOWLEDGE.randomCharacterSkillCaps;
  if(!rules||!Number.isInteger(quality)||quality<1||quality>rules.totals.length||!Array.isArray(raw)||raw.length!==3||!Number.isInteger(orientation)||orientation<0||orientation>3||quality===1&&orientation!==3||Array.from(raw).some(v=>!Number.isSafeInteger(v)||v<1||v>300))return null;
  const [minimum,maximum]=rules.totals[quality-1],sum=raw.reduce((a,b)=>a+b,0);
  for(let total=Math.max(minimum,sum-1);total<=Math.min(maximum,sum+1);total++){
   const weights=rules.weights[orientation],n=BigInt(total),lo=raw.map(v=>BigInt(2*v-1)),hi=raw.map(v=>BigInt(2*v+1));
   // lambda = sum(weights)/(2*N). Each weight lies in [max(a,lo*lambda),min(b,hi*lambda)).
   const start=rational(weights.reduce((s,w)=>s+w[0],0),2n*n),end=rational(weights.reduce((s,w)=>s+w[1],0),2n*n);
   const points=[start,end,...weights.flatMap(([a,b],i)=>[rational(a,lo[i]),rational(b,hi[i])])].filter(p=>rationalCompare(p,start)>=0n&&rationalCompare(p,end)<=0n).sort((a,b)=>rationalCompare(a,b)<0n?-1:rationalCompare(a,b)>0n?1:0).filter((p,i,a)=>!i||rationalCompare(p,a[i-1])!==0n);
   for(let segment=0;segment<points.length-1;segment++){
    let left=points[segment],right=points[segment+1],leftOpen=false,rightOpen=true;
    const mid=rational(left.n*right.d+right.n*left.d,2n*left.d*right.d);
    const lower=weights.map(([a],i)=>BigInt(a)*mid.d>=lo[i]*mid.n?[0n,BigInt(a)]:[lo[i],0n]);
    const upper=weights.map(([,b],i)=>BigInt(b)*mid.d<=hi[i]*mid.n?[0n,BigInt(b)]:[hi[i],0n]);
    // Enforce a*lambda+b <= 0 (or <0), intersecting one-dimensional rational intervals.
    const constrain=(a,b,strict)=>{
     if(a===0n)return strict?b<0n:b<=0n;
     const edge=rational(-b,a);
     if(a>0n){const cmp=rationalCompare(edge,right);if(cmp<0n){right=edge;rightOpen=strict;}else if(cmp===0n)rightOpen ||= strict;}
     else{const cmp=rationalCompare(edge,left);if(cmp>0n){left=edge;leftOpen=strict;}else if(cmp===0n)leftOpen ||= strict;}
     const cmp=rationalCompare(left,right);return cmp<0n||cmp===0n&&!leftOpen&&!rightOpen;
    };
    const ls=lower.reduce((s,v)=>[s[0]+v[0],s[1]+v[1]],[0n,0n]),us=upper.reduce((s,v)=>[s[0]+v[0],s[1]+v[1]],[0n,0n]);
    if(lower.every((l,i)=>constrain(l[0]-upper[i][0],l[1]-upper[i][1],true))&&constrain(ls[0]-2n*n,ls[1],false)&&constrain(2n*n-us[0],-us[1],true))return {total,orientation};
   }
  }
  return null;
 }
 function skillCapCombinations(quality,raw,talents,talentLevels,caps){
  const rules=KNOWLEDGE.randomCharacterSkillCaps;
  if(!rules||!Number.isInteger(quality)||quality<1||quality>6||!Array.isArray(caps)||caps.length!==9||Array.from(caps).some(v=>!Number.isSafeInteger(v))||!Array.isArray(talents)||talents.length!==3||new Set(talents).size!==3||!Array.isArray(talentLevels)||talentLevels.length!==3)return [];
  if(Array.from(talents).some((id,i)=>!Number.isSafeInteger(id)||id<=0||!rules.talents[id]||!Number.isSafeInteger(talentLevels[i])||!rules.talentLevels[quality-1].includes(talentLevels[i])))return [];
  const witnesses=[],ranges=rules.ranges[quality-1],within=(v,r)=>v>=r[0]&&v<=r[1];
  for(let orientation=0;orientation<4;orientation++){
   const aptitude=skillCapAptitudeWitness(quality,raw,orientation);if(!aptitude)continue;
   const selected=talents.map(id=>rules.talents[id]);
   if(quality!==1&&selected.some(t=>orientation===3?!['生产','通用'].includes(t.category):![rules.orientations[orientation],'通用'].includes(t.orientation)))continue;
   for(let primary=1;primary<=9;primary++){
    if(!within(caps[primary-1],ranges.primary)||selected.some(t=>t.excludedPrimary.includes(primary)))continue;
    for(let secondary=1;secondary<=9;secondary++)if(primary!==secondary&&caps.every((v,i)=>within(v,i+1===primary?ranges.primary:i+1===secondary?ranges.secondary:ranges.base)))witnesses.push({...aptitude,orientation:quality===1?'通用':rules.orientations[orientation],primary,secondary});
   }
  }
  return witnesses;
 }
 function randomCharacterSkillCapsInfo(m,{characterId}){
  const reasons=[],verified=!!KNOWLEDGE.verification.randomCharacterSkillCaps,info={characterId,verified,eligible:false,reasons,skills:[],witnesses:[]};
  try{
   if(!activeCharacter(m,characterId)||get(m,C(characterId,0,2))!==characterId)throw Error('找不到有效的已招募角色。');
   if(get(m,C(characterId,2,2))!==0)throw Error('有名角色載入／數值更新會依範本回填技藝上限；只支援範本 0。');
   if(get(m,C(characterId,55,2))!==0)throw Error('目前只支援非在監的已招募角色。');
   // randomCharacterSkillCapsAscended: 渡劫结束 and its callees never write z2 y10–12, y22–49 or z12, and 获得技艺经验 reads
   // only y22–48, so the witness is unchanged; the record is still checked like the other ascended entries.
   if(ascendedSkillCaps())info.ascensions=ascensionRecord(m,characterId).count;
   else if(get(m,C(characterId,50,2))!==0||Array.from({length:16},(_,i)=>get(m,C(characterId,i+1,16))).some(v=>v!==0))throw Error('目前只支援無結丹及重生階段紀錄的角色。');
   info.quality=get(m,C(characterId,49,2));
   if(!Number.isSafeInteger(info.quality)||info.quality<1||info.quality>6)throw Error('角色品質須為原版 1–6。');
   info.raw=[10,11,12].map(y=>get(m,C(characterId,y,2)));
   info.talents=[1,2,3].map(y=>get(m,C(characterId,y,12)));
   info.talentLevels=[21,22,23].map(y=>get(m,C(characterId,y,12)));
   info.skills=SKILLS.map((name,i)=>({id:i+1,name,cap:get(m,C(characterId,22+i,2)),level:get(m,C(characterId,31+i,2)),experience:get(m,C(characterId,40+i,2))}));
   if(info.skills.some(s=>!Number.isSafeInteger(s.cap)||!Number.isSafeInteger(s.level)||s.level<1||s.cap<s.level||typeof s.experience!=='number'||!Number.isFinite(s.experience)||s.experience<0||s.experience>Number.MAX_SAFE_INTEGER))throw Error('現有技藝上限、等級或餘額型別／範圍不符。');
   info.witnesses=skillCapCombinations(info.quality,info.raw,info.talents,info.talentLevels,info.skills.map(s=>s.cap));
   if(!info.witnesses.length)throw Error('目前九上限與固定基礎資質／三槽天賦沒有原版共同生成見證，保持唯讀。');
   info.eligible=true;
  }catch(e){reasons.push(e.message);}
  return info;
 }
 const skillCapPreviews=new WeakMap();
 function skillCapPreviewState(m,characterId){
  // Small dependency signature also detects direct changes to public parsed input, not only named transactions.
  const row=Number.isSafeInteger(characterId)&&characterId>0&&characterId<m.original.size[0]?m.original.data[characterId]:null;
  return JSON.stringify([KNOWLEDGE.randomCharacterSkillCaps,row?.map(v=>[v[2],v[12],v[16]]),[...m.changes],m.revision]);
 }
 function previewCharacterSkillCaps(m,options){
  const {characterId,caps}=options,info=randomCharacterSkillCapsInfo(m,{characterId}),reasons=[...info.reasons];
  if(Object.keys(options).some(k=>!['characterId','caps'].includes(k)))reasons.push('技藝上限只接受角色編號與完整九項數值。');
  if(!Array.isArray(caps)||caps.length!==9||Array.from(caps).some(v=>!Number.isSafeInteger(v)))reasons.push('請輸入完整九項上限安全整數。');
  let rows=[],changes=[],witnesses=[];
  if(info.eligible&&!reasons.length){
   witnesses=skillCapCombinations(info.quality,info.raw,info.talents,info.talentLevels,caps);
   if(!witnesses.length)reasons.push('目標九上限與固定基礎資質／天賦沒有共同生成見證。');
   rows=info.skills.map((s,i)=>{
    if(caps[i]<s.level)reasons.push(`${s.name}上限不得低於目前等級 ${s.level}。`);
    if(caps[i]<s.cap&&caps[i]===s.level&&s.experience>0)reasons.push(`${s.name}下調至目前等級時仍有餘額 ${s.experience}；不自動清零，已阻擋。`);
    return {id:s.id,name:s.name,before:{cap:s.cap,level:s.level,experience:s.experience},after:{cap:caps[i],level:s.level,experience:s.experience}};
   });
   changes=rows.filter(r=>r.before.cap!==r.after.cap).map(r=>({id:r.id,name:r.name,before:r.before.cap,after:r.after.cap}));
  }
  const result={...info,reasons,rows,changes,witnesses,unchanged:rows.length===9&&!changes.length,canApply:info.verified&&!reasons.length&&!!changes.length,restoreScope:'此角色全部九項技藝上限、等級與經驗餘額會一起還原'};
  skillCapPreviews.set(result,{model:m,request:JSON.stringify(options),snapshot:batchSnapshot(m),state:skillCapPreviewState(m,characterId)});
  return result;
 }
 function setCharacterSkillCaps(m,options,{preview}={}){
  const prior=preview&&skillCapPreviews.get(preview);
  if(!prior||prior.model!==m||prior.request!==JSON.stringify(options))throw Error('技藝上限預覽不相符，請重新預覽。');
  assertBatchCurrent(m,prior.snapshot);
  if(prior.state!==skillCapPreviewState(m,options.characterId))throw Error('技藝上限輸入、模型或規則已改變，請重新預覽。');
  const checked=previewCharacterSkillCaps(m,options);
  if(checked.reasons.length)throw Error(checked.reasons.join('；'));
  if(!checked.verified)throw Error('一般隨機角色技藝上限尚未完成獨立隔離驗證。');
  if(!checked.unchanged){
   const previous=m.currentGroup;m.currentGroup=`skill-growth:${options.characterId}`;
   try{transaction(m,()=>{activateSkillGroup(m,options.characterId);for(const change of checked.changes)put(m,C(options.characterId,21+change.id,2),change.after,`${get(m,C(options.characterId,1,2))}・${change.name}上限`);},'九項技藝上限調整');}finally{m.currentGroup=previous;}
  }
  skillCapPreviews.delete(preview);
  return checked;
 }
 // Skill cap rules end.
 // Talent level rules. Ids, empty slots and quality stay as recruited; only pooled levels change.
 function talentEffect(attributeId,coefficient,level){
  const rule=KNOWLEDGE.randomCharacterTalents?.attributes[attributeId],c=coefficient,L=level;
  if(!rule||typeof c!=='number'||!Number.isSafeInteger(L)||L<1)return null;
  // Same operand order as the native 天赋属性 branches.
  return {levelTenth:()=>L*(c/10),coefficientPlusTwoLevels:()=>c+2*L,coefficientTimesLevel:()=>c*L,regeneration:()=>Math.round(100*L*c)/10000,multiplier:()=>Math.floor(c*Math.pow(1.79,L-1))/100,growth:()=>Math.floor(c*Math.pow(1.8,L-1))}[rule.formula]?.()??null;
 }
 function talentSlotEffects(id,level){
  const talent=KNOWLEDGE.batch2Data.talents[id];
  return talent.attributes.flatMap((attributeId,k)=>attributeId?[{attributeId,name:catalogName('attributes',attributeId),unit:KNOWLEDGE.randomCharacterTalents.attributes[attributeId]?.unit||'',value:talentEffect(attributeId,talent.coefficients[k],level)}]:[]);
 }
 function randomCharacterTalentsInfo(m,{characterId}){
  const reasons=[],rules=KNOWLEDGE.randomCharacterTalents,verified=!!KNOWLEDGE.verification.randomCharacterTalents,info={characterId,verified,eligible:false,reasons,slots:[]};
  try{
   if(!rules)throw Error('天賦規則尚未載入。');
   if(!activeCharacter(m,characterId)||get(m,C(characterId,0,2))!==characterId)throw Error('找不到有效的已招募角色。');
   if(get(m,C(characterId,2,2))!==0)throw Error('有名角色載入／數值更新會依範本回填天賦；只支援範本 0。');
   if(get(m,C(characterId,55,2))!==0)throw Error('目前只支援非在監的已招募角色。');
   if(ascendedTalents()){const ascension=ascensionRecord(m,characterId);info.ascensions=ascension.count;info.multiplier=ascension.multiplier;}
   else if(get(m,C(characterId,50,2))!==0||Array.from({length:16},(_,i)=>get(m,C(characterId,i+1,16))).some(v=>v!==0))throw Error('目前只支援無結丹及重生階段紀錄的角色。');
   info.quality=get(m,C(characterId,49,2));
   if(!Number.isSafeInteger(info.quality)||info.quality<1||info.quality>6)throw Error('角色品質須為原版 1–6。');
   info.levelPool=rules.talentLevels[info.quality-1];
   const ids=[1,2,3].map(y=>get(m,C(characterId,y,12))),levels=[21,22,23].map(y=>get(m,C(characterId,y,12)));
   if(ids.some(id=>!Number.isSafeInteger(id)||id<=0||!KNOWLEDGE.batch2Data.talents[id])||new Set(ids).size!==3)throw Error('三槽天賦須為互不重複的已知 ID；空槽或重複資料保持唯讀。');
   if(levels.some(level=>!Number.isSafeInteger(level)||!info.levelPool.includes(level)))throw Error('現有天賦等級不在此品質的原版等級池內，保持唯讀。');
   info.slots=ids.map((id,i)=>({slot:i+1,id,name:catalogName('talents',id),level:levels[i],aptitude:KNOWLEDGE.batch2Data.talents[id].attributes.some(a=>a>=104&&a<=106),effects:talentSlotEffects(id,levels[i])}));
   info.eligible=true;
  }catch(e){reasons.push(e.message);}
  return info;
 }
 // Base aptitude after replacing talent levels, in the same accumulation order as characterAptitudeSource.
 function talentAptitudeBase(m,characterId,aptitude,levels){
  let base=get(m,C(characterId,9+aptitude,2))/10;
  for(let i=0;i<3;i++){const talent=KNOWLEDGE.batch2Data.talents[get(m,C(characterId,1+i,12))];for(let k=0;k<3;k++)if(talent.attributes[k]===103+aptitude)base+=levels[i]*talent.coefficients[k]/10;}
  return base;
 }
 const talentPreviews=new WeakMap();
 function talentPreviewState(m,characterId){
  const row=Number.isSafeInteger(characterId)&&characterId>0&&characterId<m.original.size[0]?m.original.data[characterId]:null;
  return JSON.stringify([KNOWLEDGE.randomCharacterTalents,KNOWLEDGE.batch2Data.talents,row?.map(v=>[v[2],v[12],v[16]]),[...m.changes],m.revision]);
 }
 function previewCharacterTalents(m,options){
  const {characterId,levels}=options,info=randomCharacterTalentsInfo(m,{characterId}),reasons=[...info.reasons];
  if(Object.keys(options).some(k=>!['characterId','levels'].includes(k)))reasons.push('天賦只接受角色編號與三槽等級；不能更換天賦 ID。');
  if(!Array.isArray(levels)||levels.length!==3||Array.from(levels).some(v=>!Number.isSafeInteger(v)))reasons.push('請輸入三槽天賦等級安全整數。');
  let changes=[],aptitudes=[];
  if(info.eligible&&!reasons.length){
   info.slots.forEach((s,i)=>{if(!info.levelPool.includes(levels[i]))reasons.push(`${s.name}等級須為此品質原版等級 ${info.levelPool.join('、')} 之一。`);});
   if(!reasons.length){
    changes=info.slots.filter((s,i)=>s.level!==levels[i]).map(s=>({slot:s.slot,id:s.id,name:s.name,before:s.level,after:levels[s.slot-1],aptitude:s.aptitude,effects:talentSlotEffects(s.id,levels[s.slot-1])}));
    // Aptitude talents move the pill cap; an existing bonus above the new cap blocks instead of being clipped.
    const touched=[1,2,3].filter(a=>changes.some(c=>KNOWLEDGE.batch2Data.talents[c.id].attributes.includes(103+a)));
    try{
     const ascended=ascendedTalents();
     aptitudes=touched.map(aptitude=>{
      const source=characterAptitudeSource(m,characterId,aptitude,undefined,ascended),before=source.base,base=talentAptitudeBase(m,characterId,aptitude,levels),bonus=get(m,C(characterId,12+aptitude,2));
      assertPillBonusReadable(bonus);
      const cap=aptitudeCap(base,source.ascension),total=Math.round(100*(base+bonus/10))/100,name=aptitudeNames[aptitude-1];
      if(total>cap)reasons.push(`${name}丹藥增量 ${pillGrid(bonus)} 使新總資質 ${total} 超過上限 ${cap}；請先降低丹藥增量。`);
      return {aptitude,name,before:{base:before,cap:aptitudeCap(before,source.ascension)},after:{base,bonus,total,cap}};
     });
    }catch(e){reasons.push(e.message);}
   }
  }
  const result={...info,levels,changes,aptitudes,reasons,unchanged:info.eligible&&!reasons.length&&!changes.length,canApply:info.verified&&!reasons.length&&!!changes.length,restoreScope:'此角色三槽天賦等級、三項基礎資質與丹藥增量會一起還原'};
  talentPreviews.set(result,{model:m,request:JSON.stringify(options),snapshot:batchSnapshot(m),state:talentPreviewState(m,characterId)});
  return result;
 }
 function setCharacterTalents(m,options,{preview}={}){
  const prior=preview&&talentPreviews.get(preview);
  if(!prior||prior.model!==m||prior.request!==JSON.stringify(options))throw Error('天賦等級預覽不相符，請重新預覽。');
  assertBatchCurrent(m,prior.snapshot);
  if(prior.state!==talentPreviewState(m,options.characterId))throw Error('天賦輸入、模型或規則已改變，請重新預覽。');
  const checked=previewCharacterTalents(m,options);
  if(checked.reasons.length)throw Error(checked.reasons.join('；'));
  if(!checked.verified)throw Error('一般隨機角色天賦等級尚未完成獨立隔離驗證。');
  if(!checked.unchanged){
   // Shares the v2.7 aptitude group: talent levels, base aptitudes and pill bonuses restore together.
   const previous=m.currentGroup;m.currentGroup=`aptitude:${options.characterId}`;
   try{transaction(m,()=>{for(const change of checked.changes)put(m,C(options.characterId,20+change.slot,12),change.after,`${get(m,C(options.characterId,1,2))}・${change.name}等級`);},'三槽天賦等級調整');}finally{m.currentGroup=previous;}
  }
  talentPreviews.delete(preview);
  return checked;
 }
 // Talent level rules end.
 // Exact recruitment feasibility. Rationals keep strict random/round upper bounds distinct.
 const rational=(n,d=1n)=>{n=BigInt(n);d=BigInt(d);return d<0n?{n:-n,d:-d}:{n,d};};
 const rationalCompare=(a,b)=>a.n*b.d-b.n*a.d;
 function recruitmentCombination(quality,raw){
  const rules=KNOWLEDGE.randomCharacterGrowth;
  if(!rules||!Number.isInteger(quality)||quality<1||quality>rules.totals.length||!Array.isArray(raw)||raw.length!==3||raw.some(v=>!Number.isSafeInteger(v)||v<1||v>300))return null;
  const [minimum,maximum]=rules.totals[quality-1],sum=raw.reduce((a,b)=>a+b,0);
  for(let total=Math.max(minimum,sum-1);total<=Math.min(maximum,sum+1);total++)for(let orientation=0;orientation<rules.weights.length;orientation++){
   const weights=rules.weights[orientation],n=BigInt(total),lo=raw.map(v=>BigInt(2*v-1)),hi=raw.map(v=>BigInt(2*v+1));
   // lambda = sum(weights)/(2*N). Each weight lies in [max(a,lo*lambda),min(b,hi*lambda)).
   const start=rational(weights.reduce((s,w)=>s+w[0],0),2n*n),end=rational(weights.reduce((s,w)=>s+w[1],0),2n*n);
   const points=[start,end,...weights.flatMap(([a,b],i)=>[rational(a,lo[i]),rational(b,hi[i])])].filter(p=>rationalCompare(p,start)>=0n&&rationalCompare(p,end)<=0n).sort((a,b)=>rationalCompare(a,b)<0n?-1:rationalCompare(a,b)>0n?1:0).filter((p,i,a)=>!i||rationalCompare(p,a[i-1])!==0n);
   for(let segment=0;segment<points.length-1;segment++){
    let left=points[segment],right=points[segment+1],leftOpen=false,rightOpen=true;
    const mid=rational(left.n*right.d+right.n*left.d,2n*left.d*right.d);
    const lower=weights.map(([a],i)=>BigInt(a)*mid.d>=lo[i]*mid.n?[0n,BigInt(a)]:[lo[i],0n]);
    const upper=weights.map(([,b],i)=>BigInt(b)*mid.d<=hi[i]*mid.n?[0n,BigInt(b)]:[hi[i],0n]);
    // Enforce a*lambda+b <= 0 (or <0), intersecting one-dimensional rational intervals.
    const constrain=(a,b,strict)=>{
     if(a===0n)return strict?b<0n:b<=0n;
     const edge=rational(-b,a);
     if(a>0n){const cmp=rationalCompare(edge,right);if(cmp<0n){right=edge;rightOpen=strict;}else if(cmp===0n)rightOpen ||= strict;}
     else{const cmp=rationalCompare(edge,left);if(cmp>0n){left=edge;leftOpen=strict;}else if(cmp===0n)leftOpen ||= strict;}
     const cmp=rationalCompare(left,right);return cmp<0n||cmp===0n&&!leftOpen&&!rightOpen;
    };
    const ls=lower.reduce((s,v)=>[s[0]+v[0],s[1]+v[1]],[0n,0n]),us=upper.reduce((s,v)=>[s[0]+v[0],s[1]+v[1]],[0n,0n]);
    if(lower.every((l,i)=>constrain(l[0]-upper[i][0],l[1]-upper[i][1],true))&&constrain(ls[0]-2n*n,ls[1],false)&&constrain(2n*n-us[0],-us[1],true))return {total,orientation};
   }
  }
  return null;
 }
 // Ascended pills (pillAptitudeBonusAscended): 角色资质上限倍率 is 1.5 plus z17[z16[c,2k],15] for k=1..y50. 内丹属性计算 only
 // counts the stored inner pills' wp main attributes, and no V1.0.11.2 template, affix or set effect is 104–106, so A stays
 // raw/10 plus talents; such an attribute is rejected instead of modelled.
 const ascendedPills=()=>!!KNOWLEDGE.verification.pillAptitudeBonusAscended;
 // Base aptitudes and talent levels (randomCharacterBaseAptitudesAscended／randomCharacterTalentsAscended) reuse the same record
 // and per-piece wearing check; 渡劫结束 never writes z2 y10–12, y49 or z12, so only the cap multiplier moves.
 const ascendedBaseAptitudes=()=>!!KNOWLEDGE.verification.randomCharacterBaseAptitudesAscended;
 const ascendedTalents=()=>!!KNOWLEDGE.verification.randomCharacterTalentsAscended;
 const ascendedSkillCaps=()=>!!KNOWLEDGE.verification.randomCharacterSkillCapsAscended;
 // 角色资质上限 rounds 100×(A×M); without a record the v2.7 product order for M=1.5 stays.
 const aptitudeCap=(base,ascension)=>ascension?Math.round(100*(base*ascension.multiplier))/100:Math.round(100*base*1.5)/100;
 const aptitudeAttribute=id=>id>=104&&id<=106;
 // 结丹资质提升系数(品阶 q, 渡劫等阶 k), which 渡劫结束 writes to z17 y15–17 of the k-th stored inner pill.
 const ascensionCoefficient=(quality,round)=>Math.round(100*(Math.pow(1.2,round-1)*(0.4+((round+quality)-2)*0.2)))/100;
 function ascensionRecord(m,characterId){
  const count=get(m,C(characterId,50,2)),rows=new Set(),templates=new Set(),records=[];let sum=0;
  if(!Number.isSafeInteger(count)||count<0||count>8)throw Error('結丹次數須為原版 0–8。');
  for(let k=1;k<=8;k++){
   const quality=get(m,C(characterId,2*k-1,16)),row=get(m,C(characterId,2*k,16));
   if(k>count){if(quality!==0||row!==0)throw Error('結丹次數以外的結丹紀錄仍有資料。');continue;}
   if(!Number.isSafeInteger(quality)||quality<1||quality>9)throw Error('結丹品質須為原版 1–9。');
   if(!Number.isSafeInteger(row)||row<1||row>=m.original.size[0]||rows.has(row))throw Error('入體內丹列號越界或重複。');
   const templateId=get(m,C(row,1,17)),item=catalogMaps.items.get(templateId),rules=KNOWLEDGE.batch2Data.items[templateId],coefficient=ascensionCoefficient(quality,k);
   if(!item||item.kind!=='内丹'||!rules||templates.has(templateId))throw Error('入體內丹範本不符或重複。');
   if(get(m,C(row,7,17))!==characterId)throw Error('入體內丹 owner 與角色不符。');
   if([9,10,11].some((y,i)=>get(m,C(row,y,17))!==107+i)||[15,16,17].some(y=>get(m,C(row,y,17))!==coefficient))throw Error('入體內丹的資質上限詞條與原版結丹係數不符。');
   if(rules.mainAttributes.some(aptitudeAttribute))throw Error('入體內丹的資質加成尚未涵蓋。');
   rows.add(row);templates.add(templateId);sum+=coefficient;records.push({round:k,quality,row,templateId,coefficient});
  }
  // Native 角色重生 clears only the first z17 row it owns (删除角色内丹数据 never resets 次数), so later stored pills stay as
  // unreferenced rows; nothing reads them through z16, so they do not change A or M and are not rejected.
  return {count,multiplier:1.5+sum,records};
 }
 // 装备属性计算 reads every worn z9 row's wp main attributes, affix ids y9–14 and tz set effects; none may be an aptitude.
 function aptitudeNeutralEquipment(m,characterId){
  const worn=[];
  for(let slot=1;slot<=6;slot++){
   const itemId=get(m,C(characterId,15+slot,2));if(itemId===0)continue;
   if(!Number.isSafeInteger(itemId)||itemId<1||itemId>=m.original.size[0])throw Error('穿戴裝備列號越界。');
   const templateId=get(m,C(itemId,1,9)),item=catalogMaps.items.get(templateId),rules=KNOWLEDGE.batch2Data.items[templateId];
   if(get(m,C(itemId,7,9))!==characterId||!item||item.slot!==slot||!rules)throw Error('穿戴裝備與角色或部位不符。');
   const set=rules.setLink>0?KNOWLEDGE.setEquipmentLevel?.sets?.[rules.setLink]:null;
   if(rules.setLink>0&&!set)throw Error('套裝效果尚未辨識。');
   if(rules.mainAttributes.some(aptitudeAttribute)||Array.from({length:6},(_,i)=>get(m,C(itemId,9+i,9))).some(aptitudeAttribute)||set?.effects.some(e=>aptitudeAttribute(e.attributeId)))throw Error('穿戴裝備的資質加成尚未涵蓋。');
   worn.push(itemId);
  }
  for(let i=1;i<m.original.size[0];i++)if(get(m,C(i,7,9))===characterId&&get(m,C(i,0,9))>0&&!worn.includes(i))throw Error('有 owner 指向角色但未穿戴的裝備。');
 }
 function characterAptitudeSource(m,characterId,aptitude,baseRaw,ascended=false){
  if(!activeCharacter(m,characterId)||get(m,C(characterId,0,2))!==characterId)throw Error('找不到有效角色。');
  const templateId=get(m,C(characterId,2,2));
  if(!Number.isSafeInteger(templateId)||templateId<0)throw Error('角色範本尚未辨識。');
  const template=templateId===0?{base:[10,11,12].map(y=>get(m,C(characterId,y,2))),talents:[1,2,3].map(y=>get(m,C(characterId,y,12))),talentLevels:[21,22,23].map(y=>get(m,C(characterId,y,12)))}:KNOWLEDGE.batch2Data?.characters[templateId];
  if(!template||!template.base.every(v=>Number.isSafeInteger(v)&&v>0))throw Error('角色範本或基礎資質尚未辨識。');
  const ascension=ascended?ascensionRecord(m,characterId):null;
  if(!ascended&&(get(m,C(characterId,50,2))!==0||Array.from({length:16},(_,i)=>get(m,C(characterId,i+1,16))).some(v=>v!==0)))throw Error('目前只支援無結丹及重生階段紀錄的角色。');
  for(let i=0;i<3;i++)if(get(m,C(characterId,10+i,2))!==template.base[i]||get(m,C(characterId,1+i,12))!==template.talents[i]||get(m,C(characterId,21+i,12))!==template.talentLevels[i])throw Error('角色基礎資質或天賦與載入範本不一致，請先回遊戲存檔。');
  if(ascended)aptitudeNeutralEquipment(m,characterId);
  else{
   for(let slot=1;slot<=6;slot++){
    const itemId=get(m,C(characterId,15+slot,2));if(itemId===0)continue;
    const equipment=ordinaryEquipment(m,itemId);
    if(get(m,C(itemId,7,9))!==characterId||catalogMaps.items.get(get(m,C(itemId,1,9))).slot!==slot||equipment.rules.mainAttributes.some(id=>id>=104&&id<=106))throw Error('穿戴裝備的資質加成尚未涵蓋。');
   }
   // Also catch an orphan owner which is absent from the character's slot array.
   for(let i=1;i<m.original.size[0];i++)if(get(m,C(i,7,9))===characterId&&get(m,C(i,0,9))>0)ordinaryEquipment(m,i);
  }
  let base=(baseRaw||template.base)[aptitude-1]/10;
  for(let i=0;i<3;i++){
   const id=template.talents[i],level=template.talentLevels[i];if(id===0&&level===0)continue;
   const talent=KNOWLEDGE.batch2Data.talents[id];
   if(!talent||!Number.isSafeInteger(level)||level<0)throw Error('天賦資料不符。');
   for(let k=0;k<3;k++)if(talent.attributes[k]===103+aptitude)base+=level*talent.coefficients[k]/10;
  }
  return {base,template,ascension};
 }
 function randomCharacterGrowthInfo(m,{characterId}){
  const reasons=[],quality=Number.isSafeInteger(characterId)&&exists(m.original,C(characterId,49,2))?get(m,C(characterId,49,2)):undefined;
  try{
   if(!activeCharacter(m,characterId)||get(m,C(characterId,0,2))!==characterId)throw Error('找不到有效的已招募角色。');
   if(get(m,C(characterId,2,2))!==0)throw Error('有名角色載入時會依範本回填；本功能只支援範本 0。');
   if(get(m,C(characterId,55,2))!==0)throw Error('目前只支援非在監的已招募角色。');
   if(!Number.isSafeInteger(quality)||quality<1||quality>6)throw Error('角色品質須為原版 1–6。');
   const talents=[1,2,3].map(y=>get(m,C(characterId,y,12))),seen=new Set();
   talents.forEach((id,i)=>{const level=get(m,C(characterId,21+i,12));if(id===0&&level===0)return;if(!Number.isSafeInteger(id)||!KNOWLEDGE.batch2Data.talents[id]||!Number.isSafeInteger(level)||level<1||level>5||seen.has(id))throw Error('天賦 ID／等級、空槽或重複資料不符，保持唯讀。');seen.add(id);});
   const raw=[10,11,12].map(y=>get(m,C(characterId,y,2)));
   if(!recruitmentCombination(quality,raw))throw Error('目前三項基礎資質不屬於此品質的原版招募組合。');
   const ascended=ascendedBaseAptitudes();let ascension=null;
   const aptitudes=[1,2,3].map(aptitude=>{
    const source=characterAptitudeSource(m,characterId,aptitude,undefined,ascended),base=source.base,bonus=get(m,C(characterId,12+aptitude,2));
    assertPillBonusReadable(bonus);ascension=source.ascension;
    const cap=aptitudeCap(base,ascension),total=Math.round(100*(base+bonus/10))/100;
    if(!Number.isFinite(total)||total>cap)throw Error('目前丹藥增量超過角色資質上限，請先降低增量。');
    return {aptitude,name:aptitudeNames[aptitude-1],raw:raw[aptitude-1],base,bonus,total,cap};
   });
   return {characterId,quality,baseRaw:raw,aptitudes,ascended,multiplier:ascension?ascension.multiplier:1.5,ascensions:ascension?.count??0,eligible:true,reasons,verified:!!KNOWLEDGE.verification.randomCharacterBaseAptitudes};
  }catch(e){reasons.push(e.message);return {characterId,quality,eligible:false,reasons,verified:!!KNOWLEDGE.verification.randomCharacterBaseAptitudes};}
 }
 function previewCharacterBaseAptitudes(m,options){
  const {characterId,baseRaw}=options,info=randomCharacterGrowthInfo(m,{characterId}),reasons=[...info.reasons];
  if(Object.keys(options).some(k=>!['characterId','baseRaw'].includes(k)))reasons.push('基礎資質只接受角色編號與完整三項數值。');
  if(!Array.isArray(baseRaw)||baseRaw.length!==3||baseRaw.some(v=>!Number.isSafeInteger(v)||v<1||v>300))reasons.push('請輸入三項原始資質安全整數；每 1 代表顯示 0.1 點。');
  if(!info.eligible||reasons.length)return {...info,reasons,canApply:false,changes:[]};
  const combination=recruitmentCombination(info.quality,baseRaw);
  if(!combination)reasons.push('三項數值無法由此品質的任一原版招募傾向共同生成。');
  const aptitudes=info.aptitudes.map(before=>{
   const source=characterAptitudeSource(m,characterId,before.aptitude,baseRaw,info.ascended),base=source.base,cap=aptitudeCap(base,source.ascension),total=Math.round(100*(base+before.bonus/10))/100;
   if(total>cap)reasons.push(`${before.name}丹藥增量 ${pillGrid(before.bonus)} 使新總資質 ${total} 超過上限 ${cap}；請先降低丹藥增量。`);
   return {aptitude:before.aptitude,name:before.name,before,after:{raw:baseRaw[before.aptitude-1],base,bonus:before.bonus,total,cap}};
  });
  const changes=aptitudes.filter(a=>a.before.raw!==a.after.raw).map(a=>({coordinate:C(characterId,9+a.aptitude,2),before:a.before.raw,after:a.after.raw,label:`${get(m,C(characterId,1,2))}・${a.name}基礎資質`}));
  return {...info,aptitudes,combination,changes,reasons,unchanged:!changes.length,canApply:info.verified&&!reasons.length&&!!changes.length};
 }
 function setCharacterBaseAptitudes(m,options){
  const preview=previewCharacterBaseAptitudes(m,options);
  if(preview.reasons.length)throw Error(preview.reasons.join('；'));
  if(!preview.verified)throw Error('一般隨機角色基礎資質尚未完成獨立隔離驗證。');
  const previous=m.currentGroup;m.currentGroup=`aptitude:${options.characterId}`;
  try{transaction(m,()=>{for(const c of preview.changes)put(m,c.coordinate,c.after,c.label);},'三項基礎資質調整');}finally{m.currentGroup=previous;}
  return preview;
 }
 // Decimal pill bonus (pillAptitudeBonusDecimal): native B may carry .5 clamp endpoints or float tails; input uses a 0.1 grid.
 const decimalPills=()=>!!KNOWLEDGE.verification.pillAptitudeBonusDecimal;
 const pillBonusReadable=bonus=>decimalPills()?typeof bonus==='number'&&Number.isFinite(bonus)&&bonus>=0:Number.isSafeInteger(bonus)&&bonus>=0;
 const pillGrid=bonus=>Number.isSafeInteger(bonus)?bonus:Math.round(bonus*10)/10;
 function assertPillBonusReadable(bonus){if(!pillBonusReadable(bonus))throw Error(decimalPills()?'丹藥增量須為非負有限數值。':'丹藥增量須為非負整數；既有小數增量保持唯讀。');}
 function pillInfo(m,characterId,aptitude,pillId){
  if(!Number.isInteger(aptitude)||aptitude<1||aptitude>3)throw Error('無效的資質類型。');
  const ascended=ascendedPills(),{base,ascension}=characterAptitudeSource(m,characterId,aptitude,undefined,ascended);
  if(!Number.isSafeInteger(pillId)||pillId<1||pillId>=m.original.size[0])throw Error('無效的丹藥編號。');
  const pill=KNOWLEDGE.batch2Data.pills[pillId];
  if(!pill||pill.aptitude!==aptitude||!Number.isSafeInteger(get(m,C(pillId,6,0)))||get(m,C(pillId,6,0))<1)throw Error('請選擇已持有的對應資質丹藥作為上限依據。');
  // 角色资质上限 rounds 100×(A×M); the flag-off path keeps the v2.2 product order for M=1.5.
  const multiplier=ascension?ascension.multiplier:1.5,cap=ascension?Math.round(100*(base*multiplier))/100:Math.round(100*base*1.5)/100;
  const decimal=decimalPills(),room=Math.min(cap,pill.cap)-base,max=decimal?Math.floor(room*100+1e-6)/10:Math.floor(room*10+1e-8),coordinate=C(characterId,12+aptitude,2),current=get(m,coordinate);
  if(!Number.isFinite(base)||base<=0||!Number.isFinite(max)||max<0||!pillBonusReadable(current))throw Error(decimal?'現有增量或資質上限尚未涵蓋。':'現有增量或資質上限尚未涵蓋；小數原始增量保持唯讀。');
  return {characterId,aptitude,pillId,coordinate,current,display:pillGrid(current),step:decimal?0.1:1,decimal,min:0,max,base,cap,multiplier,ascensions:ascension?.count??0,pillCap:pill.cap,total:Math.round(100*(base+current/10))/100,name:aptitudeNames[aptitude-1],verified:!!KNOWLEDGE.verification.pillAptitudeBonus};
 }
 function setPillAptitudeBonus(m,{characterId,aptitude,pillId,bonus,advanced=false}){
  if(advanced!==false)throw Error('丹藥增量尚未開放超限模式。');
  const info=pillInfo(m,characterId,aptitude,pillId);
  if(!info.verified)throw Error('丹藥增量尚未完成隔離遊戲驗證。');
  if(info.decimal){
   if(typeof bonus!=='number'||!Number.isFinite(bonus)||Math.abs(bonus*10-Math.round(bonus*10))>1e-8)throw Error(`累積增量須為 0–${info.max}，最多一位小數（每 1 等於資質 0.1 點）。`);
   bonus=pillGrid(bonus);
   // Re-entering the displayed value keeps the native token, including binary float tails.
   if(bonus===info.display)return {...info,value:info.current,unchanged:true};
   if(bonus<0||bonus>info.max)throw Error(`累積增量須為 0–${info.max}，最多一位小數（每 1 等於資質 0.1 點）。`);
  }else if(!Number.isSafeInteger(bonus)||bonus<0||bonus>info.max)throw Error(`累積增量須為 0–${info.max} 的整數（每 1 等於資質 0.1 點）。`);
  return batch2Put(m,info,bonus,`aptitude:${characterId}`,`${get(m,C(characterId,1,2))}・${info.name}丹藥累積增量`);
 }
 // Ascension quality (ascensionQuality). 渡劫结束 writes z16[c,2k−1]=q and the k-th stored pill's z17 y15–17 =
 // 结丹资质提升系数(q,k); nothing else writes them after the ascension, and only 角色资质上限倍率 reads y15. A new q rewrites
 // all four cells together, matching an ascension at that quality, and moves only M. Template-0 characters only; a lower
 // quality is blocked while any current A+B/10 exceeds the new cap (native pills never leave B above it).
 function ascensionQualityInfo(m,{characterId}){
  const reasons=[],verified=!!KNOWLEDGE.verification.ascensionQuality;
  try{
   if(!activeCharacter(m,characterId)||get(m,C(characterId,0,2))!==characterId)throw Error('找不到有效的已招募角色。');
   if(get(m,C(characterId,2,2))!==0)throw Error('有名角色載入時會依範本回填資質；本功能只支援範本 0。');
   if(get(m,C(characterId,55,2))!==0)throw Error('目前只支援非在監的已招募角色。');
   if(ascensionRecord(m,characterId).count===0)throw Error('角色尚未結丹。');
   let ascension=null;
   const aptitudes=[1,2,3].map(aptitude=>{
    const source=characterAptitudeSource(m,characterId,aptitude,undefined,true),bonus=get(m,C(characterId,12+aptitude,2));
    assertPillBonusReadable(bonus);ascension=source.ascension;
    const cap=aptitudeCap(source.base,ascension),total=Math.round(100*(source.base+bonus/10))/100;
    if(!Number.isFinite(total)||total>cap)throw Error('目前丹藥增量超過角色資質上限，請先降低增量。');
    return {aptitude,name:aptitudeNames[aptitude-1],base:source.base,bonus,total,cap};
   });
   return {characterId,records:ascension.records.map(r=>({...r,name:catalogName('items',r.templateId)})),ascensions:ascension.count,multiplier:ascension.multiplier,aptitudes,eligible:true,reasons,verified};
  }catch(e){reasons.push(e.message);return {characterId,eligible:false,reasons,verified};}
 }
 function previewAscensionQuality(m,options){
  const {characterId,round,quality}=options,info=ascensionQualityInfo(m,{characterId}),reasons=[...info.reasons];
  if(Object.keys(options).some(k=>!['characterId','round','quality'].includes(k)))reasons.push('結丹品質只接受角色編號、結丹次序與品質。');
  if(info.eligible&&(!Number.isSafeInteger(round)||round<1||round>info.ascensions))reasons.push(`結丹次序須為 1–${info.ascensions} 的整數。`);
  if(!Number.isSafeInteger(quality)||quality<1||quality>9)reasons.push('結丹品質須為原版 1–9 的整數。');
  if(!info.eligible||reasons.length)return {...info,reasons,canApply:false,changes:[]};
  const record=info.records[round-1],coefficient=ascensionCoefficient(quality,round);
  // Same summation order as ascensionRecord: from 0 in round order, 1.5 added last.
  let sum=0;for(const r of info.records)sum+=r.round===round?coefficient:r.coefficient;
  const nextMultiplier=1.5+sum,aptitudes=info.aptitudes.map(before=>{
   const cap=aptitudeCap(before.base,{multiplier:nextMultiplier});
   if(before.total>cap)reasons.push(`${before.name}目前總資質 ${before.total} 超過新上限 ${cap}；請先降低丹藥增量或選較高品質。`);
   return {aptitude:before.aptitude,name:before.name,before,after:{...before,cap}};
  });
  const name=get(m,C(characterId,1,2)),changes=quality===record.quality?[]:[{coordinate:C(characterId,2*round-1,16),before:record.quality,after:quality,label:`${name}・第 ${round} 次結丹品質`},...[15,16,17].map((y,i)=>({coordinate:C(record.row,y,17),before:record.coefficient,after:coefficient,label:`${name}・第 ${round} 次入體內丹・${aptitudeNames[i]}上限係數`}))];
  return {...info,round,quality,record,coefficient,nextMultiplier,aptitudes,changes,reasons,unchanged:!changes.length,canApply:info.verified&&!reasons.length&&!!changes.length};
 }
 function setAscensionQuality(m,options){
  const preview=previewAscensionQuality(m,options);
  if(preview.reasons.length)throw Error(preview.reasons.join('；'));
  if(!preview.verified)throw Error('結丹品質尚未完成隔離遊戲驗證。');
  const previous=m.currentGroup;m.currentGroup=`aptitude:${options.characterId}`;
  try{transaction(m,()=>{for(const c of preview.changes)put(m,c.coordinate,c.after,c.label);},'結丹品質調整');}finally{m.currentGroup=previous;}
  return preview;
 }
 // Backpack relic attributes (relicAttributes). 获得灵物 draws c_i=b_i×random(0.6,1) from lw y6–10, splits one total G by
 // c_i/Σc and rounds each share to 0.1 (z18 y5–9); y10 is the rounded mean. Five values are accepted only together, and only
 // when a witness (G, c) reproduces every share with the game's own expressions; template, quality and level stay fixed.
 const RELIC_ELEMENTS=['金','木','水','火','土'];
 const relicTotal=(L,R)=>Math.round(((10*5)*(1+(L*0.2)))*(R/100))/10;
 const relicShare=(G,c,i)=>Math.round((10*G)*(c[i]/((((c[0]+c[1])+c[2])+c[3])+c[4])))/10;
 const relicAverage=a=>Math.round(10*(((((a[0]+a[1])+a[2])+a[3])+a[4])/5))/10;
 function relicWitness(bases,G,k){
  // Normalised shares u_i=c_i·t must sit in their rounding cell and in the random box; Σu=1 picks t (1/Σc).
  const e=1e-9,lo=k.map(n=>(n-0.5)/(10*G)+e),hi=k.map(n=>(n+0.5)/(10*G)-e),boxLo=t=>bases.map(b=>0.6*b*t*(1+e)),boxHi=t=>bases.map(b=>b*t*(1-e));
  const low=t=>boxLo(t).map((v,i)=>Math.max(v,lo[i])),high=t=>boxHi(t).map((v,i)=>Math.min(v,hi[i])),sum=a=>a.reduce((s,v)=>s+v,0);
  const tMin=Math.max(...bases.map((b,i)=>lo[i]/(b*(1-e)))),tMax=Math.min(...bases.map((b,i)=>hi[i]/(0.6*b*(1+e))));
  if(!(tMin<=tMax)||sum(low(tMin))>1||sum(high(tMax))<1)return null;
  const search=(ok,from,to)=>{for(let n=0;n<80;n++){const mid=(from+to)/2;if(ok(mid))to=mid;else from=mid;}return to;};
  const t1=sum(high(tMin))>=1?tMin:search(t=>sum(high(t))>=1,tMin,tMax),t2=sum(low(tMax))<=1?tMax:tMax-search(s=>sum(low(tMax-s))<=1,0,tMax-tMin);
  if(t1>t2)return null;
  const t=(t1+t2)/2,a=low(t),z=high(t),span=sum(z)-sum(a),f=span>0?(1-sum(a))/span:0,c=a.map((v,i)=>(v+f*(z[i]-v))/t),ratios=c.map((v,i)=>v/bases[i]);
  if(ratios.some(r=>!(r>=0.6&&r<1))||k.some((n,i)=>Math.round(relicShare(G,c,i)*10)!==n))return null;
  return {total:G,ratios};
 }
 function relicTotals(level,quality){
  const min=relicTotal(level,80+30*(quality-1)),max=relicTotal(level,80+30*quality-1e-9);
  return Array.from({length:Math.round(max*10)-Math.round(min*10)+1},(_,n)=>(Math.round(max*10)-n)/10);
 }
 // Five roundings move the sum at most 0.25 away from the total, so only a few totals need a witness search.
 function relicSearch(info,k){const sum=k.reduce((s,n)=>s+n,0);for(const G of info.totals){if(Math.abs(G*10-sum)>2.5+1e-9)continue;const w=relicWitness(info.bases,G,k);if(w)return w;}return null;}
 function listRelics(m){
  const rows=[];
  // The game finds relics by template (y1); y0 keeps the row 获得灵物 used and goes stale after 取下灵物 returns it elsewhere.
  for(let x=1;x<m.original.size[0];x++)if(catalogMaps.relics.has(get(m,C(x,1,18))))rows.push({id:x,name:catalogName('relics',get(m,C(x,1,18))),quality:get(m,C(x,4,18)),level:get(m,C(x,2,18))});
  return rows;
 }
 function relicAttributesInfo(m,{itemId}){
  if(!Number.isSafeInteger(itemId)||itemId<1||itemId>=m.original.size[0])throw Error('無效的靈物列號。');
  const record=Array.from({length:14},(_,y)=>get(m,C(itemId,y,18)));
  if(!record[1])throw Error('此列沒有背包靈物。');
  const relic=catalogMaps.relics.get(record[1]),bases=relic?.bases;
  if(!Number.isSafeInteger(record[0])||record[0]<1)throw Error('靈物列號資料不符。');
  if(!Array.isArray(bases)||bases.length!==5||!bases.every(b=>typeof b==='number'&&Number.isFinite(b)&&b>0))throw Error('此靈物範本的五行基底尚未核對。');
  const level=record[2],quality=record[4],values=record.slice(5,10);
  if(!Number.isSafeInteger(level)||level<0||level>1000||!Number.isSafeInteger(quality)||quality<1||quality>6)throw Error('靈物品質或等級不在已核對範圍。');
  if(record[12]!==0)throw Error('此靈物仍記錄擺放建築，請先在遊戲中取下。');
  if(!values.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)||typeof record[10]!=='number'||!Number.isFinite(record[10]))throw Error('現有五行或平均值不是有效數值。');
  const totals=relicTotals(level,quality);
  const info={itemId,record,template:record[1],name:relic.name,category:relic.category,level,quality,bases,elements:RELIC_ELEMENTS,values,average:record[10],totals,total:{min:totals.at(-1),max:totals[0]},verified:!!KNOWLEDGE.verification.relicAttributes};
  // Natural rolls at the largest total: equal ratios keep the base proportions; one element near its full base with the
  // others near 60% is about the highest that element can roll. random(0.6,1) never reaches 1, so each preset steps
  // inside the box until the witness search accepts it.
  const roll=(G,i,hi,rest)=>{for(const d of [1e-6,1e-4,1e-2]){const c=bases.map((b,j)=>b*(j===i?hi-d:rest+d)),a=c.map((_,n)=>relicShare(G,c,n));if(relicSearch(info,a.map(v=>Math.round(v*10))))return a;}return null;};
  info.proportional=roll(totals[0],-1,0,0.8);info.focused=bases.map((_,i)=>roll(totals[0],i,1,0.6));
  info.ranges=bases.map((_,i)=>({min:roll(totals.at(-1),i,0.6+2e-2,1-2e-2)?.[i]??null,max:info.focused[i]?.[i]??null}));
  const k=values.map(v=>Math.round(v*10));
  info.natural=values.every((v,i)=>Math.abs(v*10-k[i])<1e-8)&&!!relicSearch(info,k)&&relicAverage(values)===record[10];
  return info;
 }
 function previewRelicAttributes(m,{itemId,values}){
  const info=relicAttributesInfo(m,{itemId});
  if(!Array.isArray(values)||values.length!==5)throw Error('請輸入金、木、水、火、土五項數值。');
  const k=values.map(v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e6||Math.abs(v*10-Math.round(v*10))>1e-8)throw Error('五行數值須為非負數，最多一位小數。');return Math.round(v*10);});
  // Re-entering a displayed value keeps the native token.
  const after=k.map((n,i)=>Math.round(info.values[i]*10)===n?info.values[i]:n/10),unchanged=after.every((v,i)=>Object.is(v,info.values[i]));
  const witness=relicSearch(info,k);
  if(!unchanged&&!witness)throw Error(`這組五行無法由原版生成：同一總靈氣（${info.total.min}–${info.total.max}）須依基底比例 ${info.bases.join('：')} 分配，每項可在基底的 60%–100% 間浮動。`);
  const average=unchanged?info.average:relicAverage(after),label=`背包靈物 #${itemId}・${info.name}`;
  const changes=[...after.flatMap((v,i)=>Object.is(v,info.values[i])?[]:[{coordinate:C(itemId,5+i,18),before:info.values[i],after:v,label:`${label}・${RELIC_ELEMENTS[i]}`}]),...(Object.is(average,info.average)?[]:[{coordinate:C(itemId,10,18),before:info.average,after:average,label:`${label}・平均靈氣`}])];
  return {itemId,name:info.name,before:info.values,after,average:{before:info.average,after:average},witness,changes,unchanged,verified:info.verified};
 }
 function setRelicAttributes(m,{itemId,values}){
  const preview=previewRelicAttributes(m,{itemId,values});
  if(!preview.verified)throw Error('靈物五行調整尚未完成隔離遊戲驗證。');
  const previous=m.currentGroup;m.currentGroup=`relic:${itemId}`;
  try{transaction(m,()=>{for(const c of preview.changes)put(m,c.coordinate,c.after,c.label);},`背包靈物 #${itemId}・五行調整`);}finally{m.currentGroup=previous;}
  return preview;
 }
 // City wall enhancement level (wallEnhancementLevel). 城墙升级 adds one to [19,1,0] while it is below 城墙强化上限
 // (int(z1 #0 y5)+1)×60 and never touches the current wall HP z1 #0 y11; regeneration (+1%/s) and 采集核心 healing only run
 // below 城墙最大生命 and stop there, and nothing lowers HP above it. Max HP also multiplies by (100+加成属性效果(25))/100,
 // which depends on technologies and stationed characters, so lowering the level caps HP at the bonus-free maximum: never
 // above the real one, and the game regenerates the rest. Raising leaves HP as 城墙升级 does.
 const wallLife=(L,B)=>Math.round(((80+Math.ceil(((3.34*Math.pow(L+2,2.5))*Math.pow(1.02,L+2))))*Math.pow(1.2,B)));
 function wallEnhancementInfo(m){
  const g=c=>exists(m.original,c)?get(m,c):undefined,level=g(C(19,1,0)),building=g(C(0,5,1)),life=g(C(0,11,1));
  if(g(C(0,1,1))!==21)throw Error('找不到城牆資料（z1 第 0 列不是城牆）。');
  if(!Number.isSafeInteger(building)||building<0)throw Error('城牆建築等級不是有效整數。');
  if(!Number.isSafeInteger(level)||level<0)throw Error('城牆強化等級不是有效整數。');
  if(typeof life!=='number'||!Number.isFinite(life)||life<0)throw Error('城牆目前生命不是有效數值。');
  return {level,building,cap:(building+1)*60,life,baseLife:wallLife(level,building),verified:!!KNOWLEDGE.verification.wallEnhancementLevel};
 }
 function previewWallEnhancementLevel(m,{level}){
  const info=wallEnhancementInfo(m);
  if(!Number.isSafeInteger(level)||level<0||level>info.cap)throw Error(`城牆強化等級須為 0–${info.cap} 的整數（上限依城牆建築等級 ${info.building}）。`);
  const baseLife=wallLife(level,info.building),life=level<info.level&&info.life>baseLife?baseLife:info.life;
  const changes=[...(level===info.level?[]:[{coordinate:C(19,1,0),before:info.level,after:level,label:'城牆強化等級'}]),...(life===info.life?[]:[{coordinate:C(0,11,1),before:info.life,after:life,label:'城牆目前生命'}])];
  return {level:{before:info.level,after:level},life:{before:info.life,after:life},baseLife,cap:info.cap,changes,unchanged:!changes.length,verified:info.verified};
 }
 function setWallEnhancementLevel(m,{level}){
  const preview=previewWallEnhancementLevel(m,{level});
  if(!preview.verified)throw Error('城牆強化等級尚未完成隔離遊戲驗證。');
  const previous=m.currentGroup;m.currentGroup='wall:enhancement';
  try{transaction(m,()=>{for(const c of preview.changes)put(m,c.coordinate,c.after,c.label);},'城牆強化等級調整');}finally{m.currentGroup=previous;}
  return preview;
 }
 // City layers (cityLayerLevel). Outside debug mode 挑战胜利 is the only writer of a city's layer y11 (+1, then 获得声望
 // recomputes 山寨总声望 into the [8,1,0] cache). Nothing recomputes that cache on load and 山寨扩张 only reads it, so the
 // total is rewritten here as round(Σ cities int(y11)+[y44=1]). 生成战斗地图 sets y44 on a city's first visit, so unvisited
 // cities are refused. Waves start only below 城市层数上限, which caps y11 at maxLayer (149, where 攻城 opens); an occupied
 // city (y38=1) stays there. Lowering clamps the idle layer y21 to the new layer as 生成战斗地图 does; raising leaves it.
 const cityRows=new Map((KNOWLEDGE.cityLayers?.cities||[]).map(c=>[c.x,c.name]));
 function cityLayersInfo(m){
  const data=KNOWLEDGE.cityLayers;if(!data?.cities?.length)throw Error('知識目錄缺少城市資料。');
  const g=c=>exists(m.original,c)?get(m,c):undefined,total=g(C(8,1,0));
  if(typeof total!=='number'||!Number.isFinite(total))throw Error('山寨總聲望不是有效數值。');
  let sum=0;
  const cities=data.cities.map(({x,name})=>{
   const layer=g(C(x,11,0)),visited=g(C(x,44,0));
   if(!Number.isSafeInteger(layer)||layer<0)throw Error(`${name}的城市層數不是有效整數。`);
   if(visited!==0&&visited!==1)throw Error(`${name}的首次進入旗標不是 0 或 1。`);
   sum+=layer+visited;
   return {x,name,layer,visited:visited===1,idle:g(C(x,21,0)),occupied:g(C(x,38,0))===1};
  });
  const computed=Math.round(sum);
  return {cities,total,computed,consistent:total===computed,maxLayer:data.maxLayer,verified:!!KNOWLEDGE.verification.cityLayerLevel};
 }
 function previewCityLayer(m,{x,layer}){
  const info=cityLayersInfo(m),city=info.cities.find(c=>c.x===x);
  if(!city)throw Error('只能調整城市的層數。');
  if(!city.visited)throw Error(`${city.name}尚未進入過，請先在遊戲內進城一次。`);
  if(!Number.isSafeInteger(city.idle)||city.idle<0)throw Error(`${city.name}的掛機層數不是有效整數。`);
  if(![0,1].includes(get(m,C(x,38,0))))throw Error(`${city.name}的佔領旗標不是 0 或 1。`);
  if(!Number.isSafeInteger(layer)||layer<0||layer>info.maxLayer)throw Error(`城市層數須為 0–${info.maxLayer} 的整數。`);
  if(city.occupied&&layer<info.maxLayer)throw Error(`${city.name}已佔領，層數不能低於 ${info.maxLayer}。`);
  const idle=layer<city.layer&&city.idle>layer?layer:city.idle,total=layer===city.layer?info.total:info.computed-city.layer+layer;
  const changes=layer===city.layer?[]:[{coordinate:C(x,11,0),before:city.layer,after:layer,label:`${city.name}・城市層數`},...(idle===city.idle?[]:[{coordinate:C(x,21,0),before:city.idle,after:idle,label:`${city.name}・掛機層數`}]),...(total===info.total?[]:[{coordinate:C(8,1,0),before:info.total,after:total,label:'山寨總聲望'}])];
  return {city:{x,name:city.name},layer:{before:city.layer,after:layer},idle:{before:city.idle,after:idle},total:{before:info.total,after:total},consistent:info.consistent,maxLayer:info.maxLayer,changes,unchanged:!changes.length,verified:info.verified};
 }
 function setCityLayer(m,options){
  const preview=previewCityLayer(m,options);
  if(!preview.verified)throw Error('城市層數尚未完成隔離遊戲驗證。');
  // One group for every city: restoring it also restores the shared reputation cache.
  const previous=m.currentGroup;m.currentGroup='city:layers';
  try{transaction(m,()=>{for(const c of preview.changes)put(m,c.coordinate,c.after,c.label);},`${preview.city.name}・城市層數調整`);}finally{m.currentGroup=previous;}
  return preview;
 }
 /** @returns {FieldDescriptor} */
 function resolveField(m,c){
  if(!exists(m.original,c))throw Error('座標超出這份存檔的範圍。');
  const {x,y,z}=c,value=get(m,c),plane=KNOWLEDGE.planes[z];
  let f={...c,id:key(c),label:'未辨識欄位',category:plane?.name||'未知層',entity:'',type:typeof value==='number'?(Number.isInteger(value)?'integer':'decimal'):typeof value,editable:false,known:false,status:'未辨識',reason:'未核實用途；圖鑑唯讀',description:'用途與關聯尚未查清。未知數值座標仍可由既有自訂欄位手動輸入整數。',related:[],source:[]};
  const named=(label,extra={})=>{f={...f,label,known:true,status:'程式證據',reason:'關聯資料／第一版唯讀',...extra};};
  const basic=BASICS.find(b=>key(b)===key(c));
  if(basic)named(basic.name,{type:'integer',min:0,editable:true,status:'既有功能',reason:''});
  else if(z===0&&y===6&&catalogMaps.materials.has(x))named(catalogName('materials',x),{entity:`材料 #${x}`,type:'integer',min:0,editable:true,status:'既有功能',reason:''});
  else if(key(c)==='1,1,0')named('山寨名稱',{type:'string',maxLength:6,verification:'names',editable:!!KNOWLEDGE.verification.names,reason:'名稱群組尚待遊戲驗證'});
  else if(z===0&&y===1){const labels={0:'存檔識別',2:'山寨等級',4:'目前地圖',6:'商店刷新時間',7:'引導任務編號',8:'山寨總聲望',12:'存檔年份',13:'存檔天數',14:'存檔小時',15:'累計遊玩秒數',19:'城牆等級',22:'支援者禮包紀錄'};if(labels[x])named(labels[x]);}
  else if(z===0&&y===17&&x===1)named('招募刷新倒數（秒）',{type:'decimal'});
  else if(z===0&&[11,21,38,44].includes(y)&&cityRows.has(x))named({11:'城市層數',21:'掛機層數',38:'佔領旗標',44:'首次進入旗標'}[y],{entity:cityRows.get(x),reason:'請使用城市層數具名操作；總聲望與掛機層數一起結算',related:[C(x,11,0),C(x,21,0),C(8,1,0)]});
  else if(z===0&&[4,13].includes(y)&&catalogMaps.technologies.has(x))named(y===4?'科技等級':'科技研究狀態',{entity:catalogName('technologies',x)});
  else if(z===0&&y===5&&catalogMaps.professions.has(x))named('職業操練上限',{entity:catalogName('professions',x)});
  else if(z===2&&y>=10&&y<=12)named(`${aptitudeNames[y-10]}基礎資質`,{reason:'請由角色養成的三項基礎資質具名操作修改；有名角色載入時會依範本回填',related:[10,11,12,13,14,15].map(y=>C(x,y,2)),verification:'randomCharacterBaseAptitudes'});
  else if(z===2&&y>=13&&y<=15)named(`${aptitudeNames[y-13]}丹藥累積增量`,{reason:'請由角色養成的丹藥增量具名操作修改；每 1 等於資質 0.1 點',related:[10,11,12,13,14,15].map(y=>C(x,y,2))});
  else if(z===2&&y>=22&&y<=48){const k=y<=30?y-21:y<=39?y-30:y-39;named(`${SKILLS[k-1]}${y<=30?'等級上限':y<=39?'等級':'經驗餘額'}`,{entity:activeCharacter(m,x)?get(m,C(x,1,2)):`角色 #${x}`,reason:y<=30?'技藝上限須使用九項具名預覽操作；有名角色依範本回填':'請由角色養成增加經驗，等級與餘額一起結算',related:skillModes(m).has(x)?Array.from({length:27},(_,i)=>C(x,22+i,2)):[C(x,21+k,2),C(x,30+k,2),C(x,39+k,2)]});}
  else if(z===2&&activeCharacter(m,x)){
   f.entity=get(m,C(x,1,2));
   const labels={0:'角色序號',1:'角色名稱',2:'角色範本',3:'角色等級',4:'角色經驗餘額',6:'目前職業',10:'力量資質',11:'敏捷資質',12:'智力資質',50:'重生階段',51:'性別',56:'共用池購買等級已花經驗',59:'自動轉職預設'};
   if(labels[y])named(labels[y],y===1?{type:'string',maxLength:6,verification:'names',editable:!!KNOWLEDGE.verification.names,reason:'名稱群組尚待遊戲驗證'}:{});
  }else if([4,5].includes(z)&&activeCharacter(m,x)&&catalogMaps.professions.has(y))named(z===4?'職業等級':'職業經驗餘額',{entity:`${get(m,C(x,1,2))}・${catalogName('professions',y)}`,type:z===5?'decimal':'integer'});
  else if(z===12&&[1,2,3,21,22,23].includes(y)){const k=y>20?y-20:y;named(`天賦 #${k}${y>20?'等級':'編號'}`,{entity:activeCharacter(m,x)?get(m,C(x,1,2)):`角色 #${x}`,type:'integer',reason:y>20?'請由角色養成的天賦等級具名預覽操作修改；有名角色依範本回填':'天賦 ID 依原版招募固定，不能更換',related:[1,2,3,21,22,23].map(y=>C(x,y,12))});}
  else if(z===12){named(`衍生屬性：${catalogName('attributes',y)}`,{entity:activeCharacter(m,x)?get(m,C(x,1,2)):`角色 #${x}`,type:'decimal'});}
  else if([7,9].includes(z)){
   const labels={0:'初始背包列號',1:'物品範本',2:'物品數量／旗標',3:'物品等階',4:'物品狀態',5:'品質',6:'物品等級',7:'裝備歸屬／狀態',8:'主屬性品質係數',23:'取得參數／套裝關聯值',24:'新取得標記',25:'未辨識物品狀態 25',26:'套裝關聯值 26',27:'套裝原物品資訊'};
   if(labels[y])named(labels[y],{entity:catalogName('items',get(m,C(x,1,z)))});
   else if(y>=9&&y<=14)named(`裝備詞條 #${y-8}`,{entity:catalogName('items',get(m,C(x,1,z)))});
   else if(y>=28&&y<=33)named(`洗練槽標記 #${y-27}`);
   else if(y>=15&&y<=20)named(`裝備詞條係數 #${y-14}`,{type:'decimal',entity:catalogName('items',get(m,C(x,1,z)))});
  }else if(z===15)named(`任務記錄欄位 ${y}`,{entity:catalogName('quests',x)});
  else if(z===16&&y>=1&&y<=16)named(y%2?`第 ${(y+1)/2} 次結丹品質`:`第 ${y/2} 次入體內丹列號`,{entity:activeCharacter(m,x)?get(m,C(x,1,2)):`角色 #${x}`,reason:'請使用角色養成的結丹品質具名操作；入體內丹係數一起結算'});
  else if(z===17)named(({1:'入體內丹範本',3:'入體內丹等階',5:'入體內丹品質',6:'入體內丹等級',7:'入體內丹歸屬角色',8:'入體內丹主屬性品質係數'})[y]||(y>=15&&y<=17?`${aptitudeNames[y-15]}上限係數`:`入體內丹欄位 ${y}`),{entity:catalogName('items',get(m,C(x,1,17))),reason:'入體後原生流程不再修改；結丹係數請使用結丹品質具名操作'});
  else if([1,6,10,11,13,16,17,18,19,20,21].includes(z))named(`${plane.name}・欄位 ${y}`,{entity:`資料 #${x}`});
  f.source=(evidenceIndex.get(`${z},${y}`)||evidenceIndex.get(`${z},*`)||[]).filter(e=>e.x==='*'||e.x===x).slice(0,4).map(e=>({function:e.function,sheet:e.sheet,sid:e.sid,actionSid:e.actionSid}));
  if(f.known&&f.editable&&f.verification)f={...f,status:'遊戲驗證',reason:''};
  if(f.known)f.description='已定位此資料的用途；關聯狀態與進程仍由遊戲管理。';
  if(basic)f.description=basic.description;
  if(z===0&&y===6&&f.known)f.description='材料數量；直接增加不扣除取得成本。';
  if(f.verification==='names')f.description='繁中介面名稱，1–6 個 UTF-16 字元，不含 ASCII 空格或控制字元。';
  if(z===2&&activeCharacter(m,x)){
   if([3,4,50].includes(y)){f.description='自然經驗逐級結算；上限為（重生階段向下取整 + 1）× 30。不扣共用池、不增加退款基數。';f.related=[C(x,3,2),C(x,4,2),C(x,50,2)];}
   if(y===56)f.description='由共用池購買等級已投入的經驗，供遣散／重生退款計算；不是自然經驗累計值。';
   if(y>=22&&y<=48){const k=y<=30?y-21:y<=39?y-30:y-39;f.description='九項技藝依個別角色上限結算；增加經驗不修改技藝上限。';f.related=skillModes(m).has(x)?Array.from({length:27},(_,i)=>C(x,22+i,2)):[C(x,21+k,2),C(x,30+k,2),C(x,39+k,2)];}
  }
  if([4,5].includes(z)&&f.known){f.description='職業必須已習得；依職業等階計算需求，上限為 min(30, 操練上限)。自動轉職啟用時禁止增加。';f.related=[C(x,y,4),C(x,y,5),C(y,5,0),C(x,59,2)];}
  if(f.related.length&&![50,56,59].includes(y)&&((z===2&&[3,4].includes(y))||(z===2&&y>=31&&y<=48)||[4,5].includes(z)))f.reason='請由角色養成增加經驗，等級與餘額一起結算';
  if(z===12&&![1,2,3,21,22,23].includes(y))f.description='屬性與其他角色狀態相關；遊戲另在暫存物件重算數值，第一版不直接寫入。';
  if([7,9].includes(z)&&f.known)f.description='物品實體的原始資料；詞條、係數、背包位置與穿戴歸屬需一起核實，第一版唯讀。';
  if(z===9&&y===6||z===0&&y===5&&catalogMaps.professions.has(x)||z===0&&y===4&&catalogMaps.technologies.get(x)?.advanced){
   const kind=z===9?'equipment':y===5?'training':'technology';
   try{const info=editingInfo(m,kind,x);f.status=info.verified?'遊戲驗證':'程式證據';f.reason='請使用具名修改操作；自訂座標不可繞過模式及關聯檢查';f.description=`一般上限 ${info.normalMax}；進階已驗證上限 ${info.advancedMax}。${kind==='training'?'職業自然成長仍受原版 30 級限制。':''}`;}catch(e){f.reason=e.message;}
  }
  return f;
 }
 function put(m,c,value,label){
  if(Object.is(get(m,c),value))return;
  m.revision=(m.revision||0)+1;
  const old=cell(m.original,c);if(Object.is(value,old)||value===old)m.changes.delete(key(c));else m.changes.set(key(c),{...c,original:old,value,label:label||labelFor(m.original,c),operation:m.currentOperation||null,group:m.currentGroup||null});
 }
 function setField(m,c,value,label){
  const f=resolveField(m,c);
  if(!f.editable)throw Error(`${f.label}目前唯讀：${f.reason}`);
  if(f.type==='string'){
   if(typeof cell(m.original,c)!=='string')throw Error('此存檔的欄位型別與知識不相符，已停止修改。');
   if(typeof value!=='string'||value.length<1||value.length>f.maxLength||value.includes(' ')||/[\u0000-\u001f\u007f]/.test(value))throw Error(`名稱須為 1–${f.maxLength} 個 UTF-16 字元，且不能包含 ASCII 空格或控制字元。`);
  }else{
   if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER||(f.type==='integer'&&!Number.isSafeInteger(value)))throw Error('請輸入型別正確且在安全範圍內的數值。');
   if(f.min!==undefined&&value<f.min||f.max!==undefined&&value>f.max)throw Error('數值超出欄位允許範圍。');
   if(typeof cell(m.original,c)!=='number')throw Error('此存檔的欄位型別與知識不相符，已停止修改。');
  }
  put(m,c,value,label||[f.entity,f.label].filter(Boolean).join('・'));
 }
 function set(m,c,value,label){
  if(!exists(m.original,c))throw Error('座標超出這份存檔的範圍。');
  const f=resolveField(m,c);
  if(f.known)return setField(m,c,value,label);
  if(typeof cell(m.original,c)!=='number')throw Error('此欄位不是數值，無法以資源數量修改。');
  if(!Number.isSafeInteger(value))throw Error('請輸入安全範圍內的整數（絕對值最多 9,007,199,254,740,991）。');
  if((BASICS.some(b=>key(b)===key(c))||(c.y===6&&c.z===0&&MATERIALS.some(b=>b.x===c.x)))&&value<0)throw Error('資源數量不能小於 0。');
  put(m,c,value,label);
 }
 // Transaction state includes the cumulative skill dependency mode, even after cap tokens return to baseline.
 const skillGrowthModes=new WeakMap(),historyStates=new WeakMap(),batchStages=new WeakSet();
 const skillModes=m=>skillGrowthModes.get(m)||new Set();
 function activateSkillGroup(m,characterId){
  const modes=new Set(skillModes(m));modes.add(characterId);skillGrowthModes.set(m,modes);
  for(const [k,v]of m.changes)if(v.x===characterId&&v.z===2&&v.y>=22&&v.y<=48)m.changes.set(k,{...v,group:`skill-growth:${characterId}`});
 }
 function transaction(m,fn,label){
  // Private batch staging already checkpoints each fixed target and discards the whole model on failure.
  if(batchStages.has(m))return fn();
  const nested=!!m.inTransaction,before=new Map(m.changes),modes=new Set(skillModes(m)),counter=m.operationCounter,revision=m.revision,operation=m.currentOperation,history=[...m.history];
  m.inTransaction=true;
  if(label&&!m.currentOperation){m.operationCounter=(m.operationCounter||0)+1;m.currentOperation=`${m.operationCounter}：${label}`;}
  let result,changed;
  try{
   result=fn();
   changed=JSON.stringify([...before])!==JSON.stringify([...m.changes])||JSON.stringify([...modes])!==JSON.stringify([...skillModes(m)]);
  }catch(e){m.changes=before;m.history=history;m.operationCounter=counter;m.revision=revision;skillGrowthModes.set(m,modes);throw e;}
  finally{m.currentOperation=operation;m.inTransaction=nested;}
  if(!changed)m.operationCounter=counter;
  if(changed&&!nested){historyStates.set(before,{modes,counter});m.history.push(before);if(m.history.length>100)m.history.shift();m.revision=(m.revision||0)+1;}
  return result;
 }
 function undo(m){
  if(!m.history.length)return;
  const before=m.history.pop(),state=historyStates.get(before);
  m.changes=before;skillGrowthModes.set(m,new Set(state?.modes||[]));m.operationCounter=state?.counter;m.revision=(m.revision||0)+1;
 }
 function restore(m,c){transaction(m,()=>{
  const change=m.changes.get(key(c)),group=change?.group,op=change?.operation;
  if(group){for(const [k,v]of m.changes)if(v.group===group)m.changes.delete(k);if(group.startsWith('skill-growth:')){const modes=new Set(skillModes(m));modes.delete(change.x);skillGrowthModes.set(m,modes);}}
  else if(op){for(const [k,v]of m.changes)if(v.operation===op)m.changes.delete(k);}
  else m.changes.delete(key(c));
 });}
 function restoreAll(m){transaction(m,()=>{m.changes.clear();skillGrowthModes.set(m,new Set());});}
 const experienceNeed={
  character:L=>Math.round(Math.round(2000*Math.pow(L,1.4)+10000*Math.pow(1.057,L)-11570)/1000)*1000,
  skill:L=>Math.round(Math.round(10000*Math.pow(1.05,L-1)+500*(L-1))/500)*500,
  profession:(L,T)=>Math.round((2500+500*L)*T*T*Math.pow(1.2,T-1)/500)*([2,3].includes(T)?250:500)
 };
 function growthInfo(m,kind,x,id){
  if(!activeCharacter(m,x))throw Error('找不到有效角色。');
  let level,exp,cap,tier=1,name,verified;
  if(kind==='character'){level=C(x,3,2);exp=C(x,4,2);cap=(Math.trunc(get(m,C(x,50,2)))+1)*30;name='角色';verified='characterExperience';}
  else if(kind==='profession'){
   if(!catalogMaps.professions.has(id))throw Error('無效的職業編號。');
   level=C(x,id,4);exp=C(x,id,5);cap=Math.min(30,Math.trunc(get(m,C(id,5,0))));tier=catalogMaps.professions.get(id).tier;name=catalogName('professions',id);verified='professionExperience';
  }else if(kind==='skill'){
   if(!Number.isInteger(id)||id<1||id>9)throw Error('技藝編號須為 1–9。');
   level=C(x,30+id,2);exp=C(x,39+id,2);cap=Math.trunc(get(m,C(x,21+id,2)));name=SKILLS[id-1];verified='skillExperience';
  }else throw Error('未知的經驗類型。');
  const l=get(m,level),e=get(m,exp);
  if(!Number.isSafeInteger(l)||l<1||!Number.isSafeInteger(cap)||cap<l||cap>10000||typeof e!=='number'||!Number.isFinite(e)||e<0||!Number.isSafeInteger(tier)||tier<1)throw Error('現有等級、上限或經驗與已核對規則不符，請先在遊戲中確認。');
  return {kind,id,name,level,exp,cap,tier,currentLevel:l,currentExperience:e,need:experienceNeed[kind](l,tier),verified:!!KNOWLEDGE.verification[verified]};
 }
 function addExperience(m,{kind,characterId,id,amount}){
  const info=growthInfo(m,kind,characterId,id);
  if(!info.verified)throw Error('此經驗群組尚待隔離遊戲驗證，目前唯讀。');
  if(typeof amount!=='number'||!Number.isFinite(amount)||amount<=0||amount>Number.MAX_SAFE_INTEGER||(kind!=='profession'&&!Number.isSafeInteger(amount))||(kind==='profession'&&Math.abs(amount*10-Math.round(amount*10))>1e-6))throw Error('經驗增加量須為正整數；職業可使用一位小數。');
  if(kind==='profession'&&get(m,C(characterId,59,2))>0)throw Error('此角色已設定自動轉職，請先在遊戲內關閉再增加職業經驗。');
  let level=info.currentLevel,exp=kind==='profession'?Math.round((Math.floor(info.currentExperience)+amount)*10)/10:Math.round(Math.floor(info.currentExperience)+amount);
  if(!Number.isFinite(exp)||exp>Number.MAX_SAFE_INTEGER)throw Error('經驗總量超出安全範圍。');
  while(level<info.cap){const need=experienceNeed[kind](level,info.tier);if(!Number.isSafeInteger(need)||need<=0)throw Error('升級公式超出安全範圍。');if(exp<need)break;exp=Math.round((kind==='profession'?Math.trunc(exp):exp)-need);level++;}
  if(level>=info.cap)exp=0;
  const previousGroup=m.currentGroup;m.currentGroup=kind==='skill'&&skillModes(m).has(characterId)?`skill-growth:${characterId}`:`growth:${kind}:${characterId}:${id??0}`;
  try{transaction(m,()=>{put(m,info.level,level,`${get(m,C(characterId,1,2))}・${info.name}等級`);put(m,info.exp,exp,`${get(m,C(characterId,1,2))}・${info.name}經驗餘額`);},`${get(m,C(characterId,1,2))}・增加${info.name}經驗 ${amount}`);}finally{m.currentGroup=previousGroup;}
  return {level,experience:exp,levelsGained:level-info.currentLevel,cap:info.cap};
 }
 function listEntities(m,kind){
  const rows=[];
  if(kind==='characters'){for(let x=1;x<m.original.size[0];x++)if(activeCharacter(m,x))rows.push({id:x,name:get(m,C(x,1,2)),detail:`Lv ${get(m,C(x,3,2))}・${catalogName('professions',get(m,C(x,6,2)))}`,z:2});}
  else if(kind==='inventory'){for(const z of [7,9])for(let x=1;x<m.original.size[0];x++){const item=get(m,C(x,1,z));if(catalogMaps.items.has(item)&&get(m,C(x,0,z))>0)rows.push({id:x,z,name:catalogName('items',item),detail:`${z===7?'背包':'裝備庫／穿戴'}・品質 ${get(m,C(x,5,z))}・Lv ${get(m,C(x,6,z))}`});}}
  return rows;
 }
 const batchLabels={characterExperience:'角色經驗',professionExperience:'已習得職業經驗',skillExperience:'九項技藝經驗',equipmentMax:'普通裝備升滿',technologyLevel:'進階科技同值'};
 // Requests describe player actions, never arbitrary methods or coordinates.
 function batchTargets(m,request){
  if(!request||typeof request!=='object'||Array.isArray(request)||!Object.hasOwn(batchLabels,request.kind))throw Error('未知的批次操作。');
  const allowed={characterExperience:['kind','characterIds','amount'],professionExperience:['kind','characterId','amount'],skillExperience:['kind','characterId','amount'],equipmentMax:['kind','plane','includeEquipped'],technologyLevel:['kind','level']}[request.kind];
  if(Object.keys(request).some(k=>!allowed.includes(k)))throw Error('批次只接受指定動作的參數，不能傳入方法、座標或進階模式。');
  const r=JSON.parse(JSON.stringify(request)),targets=[],excluded=[];
  const character=(x,kind,id)=>({name:`${activeCharacter(m,x)?get(m,C(x,1,2)):'角色'} #${x}${kind==='profession'?'・'+catalogName('professions',id):kind==='skill'?'・'+SKILLS[id-1]:''}`,method:'experience',options:{kind,characterId:x,id,amount:r.amount},coordinates:kind==='character'?[C(x,3,2),C(x,4,2)]:kind==='profession'?[C(x,id,4),C(x,id,5)]:[C(x,30+id,2),C(x,39+id,2)]});
  if(r.kind==='characterExperience'){
   if(!Array.isArray(r.characterIds)||!r.characterIds.length||r.characterIds.length>m.original.size[0]-1||r.characterIds.some(x=>!Number.isSafeInteger(x)||x<1||x>=m.original.size[0])||new Set(r.characterIds).size!==r.characterIds.length)throw Error('請選擇不重複且在範圍內的角色。');
   for(const x of r.characterIds)targets.push(character(x,'character'));
  }else if(['professionExperience','skillExperience'].includes(r.kind)){
   if(!activeCharacter(m,r.characterId))throw Error('找不到有效角色。');
   const ids=r.kind==='skillExperience'?SKILLS.map((_,i)=>i+1):KNOWLEDGE.catalogs.professions.filter(p=>get(m,C(r.characterId,p.id,4))!==0).map(p=>p.id);
   for(const id of ids)targets.push(character(r.characterId,r.kind==='skillExperience'?'skill':'profession',id));
  }else if(r.kind==='equipmentMax'){
   if(![7,9].includes(r.plane)||r.includeEquipped!==undefined&&typeof r.includeEquipped!=='boolean')throw Error('請選擇背包或裝備庫，穿戴選項須為布林值。');
   for(let x=1;x<m.original.size[0];x++){
    if(!get(m,C(x,0,r.plane)))continue;
    const item=catalogMaps.items.get(get(m,C(x,1,r.plane))),name=`${r.plane===7?'背包':'裝備庫'} #${x}・${item?.name||'未知物品'}`;
    if(!item||item.category!=='裝備'||item.kind!=='普通'){excluded.push({name,reason:'非本次範圍：只處理已辨識的普通裝備。',status:'excluded'});continue;}
    if(r.plane===9&&!r.includeEquipped&&get(m,C(x,7,9))>0){excluded.push({name,reason:'未勾選包含穿戴裝備。',status:'excluded'});continue;}
    targets.push({name,method:'equipment',options:{itemId:x,plane:r.plane},coordinates:[C(x,6,r.plane)]});
   }
  }else for(let id=31;id<=44;id++)targets.push({name:`${catalogName('technologies',id)} #${id}`,method:'technology',options:{technologyId:id,level:r.level},coordinates:[C(id,4,0)]});
  return {request:r,targets,excluded,label:batchLabels[r.kind]};
 }
 function executeBatchTarget(m,target){
  if(target.method==='experience')return addExperience(m,target.options);
  if(target.method==='equipment'){
   const info=editingInfo(m,'equipment',target.options.itemId,target.options.plane);
   if(info.current>info.normalMax)throw Error('現有裝備超過原版上限，本批次不會自動降級。');
   return setEquipmentLevel(m,{...target.options,level:info.normalMax,advanced:false});
  }
  return setAdvancedTechnologyLevel(m,{...target.options,advanced:false});
 }
 const batchPreviews=new WeakMap();
 const batchClock=()=>globalThis.performance?.now()??Date.now();
 function batchSnapshot(m){return {original:m.original,text:m.text,changes:new Map(m.changes),history:[...m.history],counter:m.operationCounter,revision:m.revision,skillModes:JSON.stringify([...skillModes(m)]),gates:JSON.stringify(KNOWLEDGE.verification)};}
 function assertBatchCurrent(m,snapshot){
  if(m.revision!==snapshot.revision||JSON.stringify([...skillModes(m)])!==snapshot.skillModes||m.original!==snapshot.original||m.text!==snapshot.text||m.operationCounter!==snapshot.counter||m.changes.size!==snapshot.changes.size||[...snapshot.changes].some(([k,v])=>m.changes.get(k)!==v)||m.history.length!==snapshot.history.length||m.history.some((v,i)=>v!==snapshot.history[i])||JSON.stringify(KNOWLEDGE.verification)!==snapshot.gates)throw Error('存檔或驗證狀態已改變，請重新預覽批次。');
 }
 async function runBatch(m,request,{signal,onProgress,preview}={},commit=false){
  if(m.inTransaction)throw Error('批次不能在同步交易內執行。');
  const requestKey=JSON.stringify(request),prior=preview&&batchPreviews.get(preview);
  if(preview){if(!prior||prior.model!==m||prior.requestKey!==requestKey)throw Error('批次預覽不相符，請重新預覽。');assertBatchCurrent(m,prior.snapshot);}
  const snapshot=batchSnapshot(m),spec=batchTargets(m,request),operation=`${(m.operationCounter||0)+1}：批次・${spec.label}`;
  // Only this private model stays inside a transaction across yields. No callback in transaction() is async.
  const staged={...m,changes:new Map(m.changes),history:[],inTransaction:true,currentOperation:operation,currentGroup:null},rows=[];
  skillGrowthModes.set(staged,new Set(skillModes(m)));batchStages.add(staged);
  const check=()=>{if(signal?.aborted)throw Error('已取消批次，沒有套用任何修改。');if(JSON.stringify(request)!==requestKey)throw Error('批次參數已改變，請重新預覽。');assertBatchCurrent(m,snapshot);};
  const progress=done=>onProgress?.({done,total:spec.targets.length});
  check();progress(0);await new Promise(resolve=>setTimeout(resolve,0));check();
  let sliceStart=batchClock();
  for(let i=0;i<spec.targets.length;i++){
   const target=spec.targets[i],before=target.coordinates.map(c=>get(staged,c)),saved=target.coordinates.map(c=>staged.changes.get(key(c)));
   let reason='';try{executeBatchTarget(staged,target);}catch(error){reason=error.message;target.coordinates.forEach((c,j)=>{if(saved[j])staged.changes.set(key(c),saved[j]);else staged.changes.delete(key(c));});}
   const after=target.coordinates.map(c=>get(staged,c)),changed=after.filter((v,j)=>!Object.is(v,before[j])).length;
   rows.push({name:target.name,status:reason?'blocked':changed?'changed':'unchanged',reason,before,after,coordinates:target.coordinates,changedCells:changed});
   if(batchClock()-sliceStart>=12){progress(i+1);await new Promise(resolve=>setTimeout(resolve,0));check();sliceStart=batchClock();}
  }
  progress(spec.targets.length);check();
  const summary={targets:rows.length,changed:rows.filter(r=>r.status==='changed').length,unchanged:rows.filter(r=>r.status==='unchanged').length,excluded:spec.excluded.length,blocked:rows.filter(r=>r.status==='blocked').length,changedCells:rows.reduce((n,r)=>n+r.changedCells,0)};
  const result={label:spec.label,summary,rows:[...rows,...spec.excluded],canApply:summary.targets>0&&summary.blocked===0&&summary.changed>0};
  if(commit){
   if(summary.blocked)throw Error(`整批未套用：${summary.blocked} 個目標不合格。${rows.find(r=>r.status==='blocked').name}：${rows.find(r=>r.status==='blocked').reason}`);
   if(!summary.targets)throw Error('沒有可操作的目標，整批未套用。');
   if(result.canApply){transaction(m,()=>{m.changes=staged.changes;skillGrowthModes.set(m,new Set(skillModes(staged)));},`批次・${spec.label}`);}
  }else batchPreviews.set(result,{model:m,snapshot,requestKey});
  return result;
 }
 const previewBatch=(m,request,options)=>runBatch(m,request,options,false);
 const applyBatch=(m,request,options)=>runBatch(m,request,options,true);
 function labelFor(o,c){
  const basic=BASICS.find(v=>key(v)===key(c));if(basic)return basic.name;
  if(c.y===6&&c.z===0){const mat=MATERIALS.find(v=>v.x===c.x);if(mat)return `${mat.name}（材料 #${mat.id}）`;}
  if(c.z===2&&c.y>=40&&c.y<=48){const name=o.data[c.x]?.[1]?.[2];return `${typeof name==='string'?name:`角色 #${c.x}`}・技藝經驗 #${c.y-39}`;}
  if(key(c)==='1,17,0')return '招募刷新倒數（秒）';
  if(key(c)==='14,1,0')return '存檔時間：時';
  if(key(c)==='15,1,0')return '累計遊玩時間（秒）';
  const f=resolveField({original:o,changes:new Map()},c);return [f.entity,f.label].filter(Boolean).join('・');
 }
 function diff(a,b){if(a.size.some((n,i)=>n!==b.size[i]))throw Error('兩份存檔的陣列尺寸不同，請比較相同遊戲版本的存檔。');const out=[];for(let x=0;x<a.size[0];x++)for(let y=0;y<a.size[1];y++)for(let z=0;z<a.size[2];z++){const before=a.data[x][y][z],after=b.data[x][y][z];if(!Object.is(before,after))out.push({x,y,z,before,after,label:labelFor(a,{x,y,z})});}return out;}
 function serialize(m){
  if(!m.changes.size)return m.text;
  const token=/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]/g;
  let match,level=0,stage=0,start=-1,previousToken='';
  while((match=token.exec(m.text))){const t=match[0];if(level===1&&t==='"data"'&&(previousToken==='{'||previousToken===',')){stage=1;continue;}if(stage===1){if(t!==':')throw Error('無法定位 data 欄位。');stage=2;continue;}if(stage===2){if(t!=='[')throw Error('存檔 data 欄位不是陣列。');start=match.index;break;}if(t==='{'||t==='[')level++;if(t==='}'||t===']')level--;previousToken=t;}
  if(start<0)throw Error('找不到存檔資料區域。');
  token.lastIndex=start;let depth=0;const pos=[0,0,0],patches=[];
  while((match=token.exec(m.text))){const t=match[0];if(t==='['){depth++;if(depth<=3)pos[depth-1]=0;}else if(t===']'){depth--;if(depth===0)break;}else if(t===','){pos[depth-1]++;}else if(depth===3){const k=pos.join(',');if(m.changes.has(k)){const change=m.changes.get(k);if(typeof JSON.parse(t)!==typeof change.value)throw Error('原始欄位型別不正確。');patches.push({start:match.index,end:token.lastIndex,value:JSON.stringify(change.value)});}}}
  if(patches.length!==m.changes.size)throw Error('部分修改座標未能定位，已停止匯出。');
  const parts=[];let previous=0;for(const p of patches){parts.push(m.text.slice(previous,p.start),p.value);previous=p.end;}parts.push(m.text.slice(previous));return parts.join('');
 }
 globalThis.SaveCore={ascensionQualityInfo,previewAscensionQuality,setAscensionQuality,cityLayersInfo,previewCityLayer,setCityLayer,wallEnhancementInfo,previewWallEnhancementLevel,setWallEnhancementLevel,relicAttributesInfo,previewRelicAttributes,setRelicAttributes,listRelics,setEquipmentLevelInfo,treasureLevelInfo,setEquipmentQualityCandidateInfo,previewSetEquipmentQualityCandidate,applySetEquipmentQualityCandidate,setEquipmentQualityCandidateEffects,randomCharacterTalentsInfo,previewCharacterTalents,setCharacterTalents,talentEffect,randomCharacterSkillCapsInfo,previewCharacterSkillCaps,setCharacterSkillCaps,skillCapAptitudeWitness,skillCapCombinations,recruitmentCombination,randomCharacterGrowthInfo,previewCharacterBaseAptitudes,setCharacterBaseAptitudes,BASICS,MATERIALS,KNOWLEDGE,SKILLS,key,exists,cell,parse,get,set,setField,resolveField,addExperience,growthInfo,experienceNeed,editingInfo,setEquipmentLevel,setProfessionTrainingCap,setAdvancedTechnologyLevel,affixInfo,pillInfo,setEquipmentAffixCoefficient,setPillAptitudeBonus,equipmentAffixReplacementInfo,previewEquipmentAffixReplacement,setEquipmentAffix,equipmentQualityInfo,previewEquipmentQualityChange,setEquipmentQuality,listEntities,catalogName,transaction,undo,restore,restoreAll,labelFor,diff,serialize,previewBatch,applyBatch};
})();
