 function setEquipmentLevelInfo(m,{itemId,plane=9}){
  const fail=reason=>{throw Error('套裝等級：'+reason);},rules=KNOWLEDGE.setEquipmentLevel;
  if(!rules||rules.version!==1||!equipmentPlane(m,plane)||!Number.isSafeInteger(itemId)||itemId<1||itemId>=m.original.size[0])fail('庫別、資料或編號不符。');
  const record=Array.from({length:60},(_,y)=>get(m,C(itemId,y,plane))),item=catalogMaps.items.get(record[1]),t=rules.items[record[1]],origin=rules.origins[record[27]],quality=record[5],level=record[6],owner=record[7];
  if(!item||item.kind!=='套装'||!t||!rules.sets[t.setLink]?.members.includes(record[1])||t.slot!==item.slot||t.part!==t.slot)fail('範本或 setLink 尚未涵蓋。');
  if(!Number.isSafeInteger(record[0])||record[0]<1||record[0]>=m.original.size[0]||record[2]!==1||record[3]!==t.tier||!Number.isSafeInteger(t.tier)||t.tier<1||t.tier>9)fail('識別、數量或等階不符。');
  if(!Number.isSafeInteger(quality)||quality<1||quality>6||!Number.isSafeInteger(level)||level<1||level>10+5*(quality-1))fail('只支援原版品質與等級，超限停用。');
  // Only the first conversion of an ordinary template is covered; repeated set conversion is unknown.
  if(!origin||origin.slot!==t.slot||origin.tier!==t.tier||!Number.isSafeInteger(record[23])||record[23]<1||record[23]>6||!decimal2(record[26])||record[26]<0||!Number.isSafeInteger(Math.round(record[26]*10))||Math.abs(record[26]*10-Math.round(record[26]*10))>1e-7)fail('合成來源 metadata 尚未涵蓋。');
  if(![0,1].includes(record[24])||record[25]!==0||!Number.isSafeInteger(record[8])||record[8]<80+30*(quality-1)||record[8]>80+30*quality||!Number.isSafeInteger(owner)||owner<0)fail('特殊狀態、主係數或歸屬不符。');
  // The cross-pool lines below are pinned verbatim by the B7 equivalence (scripts/set-equipment-quality-equivalence.cjs), so z22 reads the z9 cross-pool group.
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
  if(plane===9&&!references)references=backupSetReferences(m,itemId,owner,t.slot);
  if(backpackLike(plane)&&owner!==0||owner>0&&(!activeCharacter(m,owner)||references!==1)||owner===0&&references!==0)fail('穿戴雙向指標不一致。');
  const group=backpackLike(plane)?'backpackSetEquipmentLevel':'setEquipmentLevel',normalMax=10+5*(quality-1);
  return {kind:'equipment',isSet:true,id:itemId,itemId,plane,name:item.name,coordinate:C(itemId,6,plane),current:level,min:1,normalMax,advancedMax:normalMax,advancedVerified:false,verified:planeVerified(plane,group),group,record,template:t,metadataStatus:'preserved; independent-native-proof-required'};
 }
 // Treasure-level candidates (y6 only) are independent of ordinary and set equipment; gated by their own first proof.
 function treasureLevelInfo(m,{itemId,plane=9}){
  const fail=reason=>{throw Error('寶物等級：'+reason);},rules=KNOWLEDGE.treasureLevel;
  if(!rules||rules.version!==1||!equipmentPlane(m,plane)||!Number.isSafeInteger(itemId)||itemId<1||itemId>=m.original.size[0])fail('庫別、資料或編號不符。');
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
  if(plane===9&&!references)references=backupSetReferences(m,itemId,owner,limits.slot);
  // references===1 is a worn row; references===0 with an active owner is the observed native stale-owner state.
  if(plane===9&&references>1)fail('穿戴雙向指標不一致。');
  const group=backpackLike(plane)?'backpackTreasureLevel':'treasureLevel';
  return {kind:'equipment',isTreasure:true,id:itemId,itemId,plane,name:item.name,coordinate:C(itemId,6,plane),current:level,min:1,normalMax,advancedMax:normalMax,advancedVerified:false,verified:planeVerified(plane,group),group,record,template:t,metadataStatus:'preserved; independent-native-proof-required'};
 }
 // Set-quality candidate eligibility (A3): read-only, cross-pool policy for isolated tests only. Formal level/quality entries keep their proven scope.
 function setEquipmentQualityCandidateInfo(m,{itemId,plane=9}){
  const fail=reason=>{throw Error('套裝品質候選：'+reason);},rules=KNOWLEDGE.setEquipmentQuality,levels=KNOWLEDGE.setEquipmentLevel;
  if(!rules||rules.version!==1||!levels||levels.version!==1||!(rules.limits.planes.includes(plane)||plane===ARMORY&&rules.limits.planes.includes(7))||!equipmentPlane(m,plane)||!Number.isSafeInteger(itemId)||itemId<1||itemId>=m.original.size[0])fail('庫別、資料或編號不符。');
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
  if(plane===9&&!references)references=backupSetReferences(m,itemId,owner,t.slot);
  if(backpackLike(plane)&&owner!==rules.limits.backpackOwner||owner>0&&(!activeCharacter(m,owner)||references!==1)||owner===0&&references!==0)fail('穿戴雙向指標不一致。');
  const prefix=backpackLike(plane)?'backpackSetEquipmentQuality':'setEquipmentQuality',groups={upgrade:prefix+'Upgrade',downgrade:prefix+'Downgrade'};
  return {kind:'setEquipmentQualityCandidate',candidate:true,itemId,plane,name:item.name,quality,level,normalMax,mainCoefficient:record[8],originId:record[27],selectedSlot:selected||null,slots,
   groups,verified:{upgrade:planeVerified(plane,groups.upgrade),downgrade:planeVerified(plane,groups.downgrade)},
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
  const name=planeName(plane),changes=after.flatMap((value,y)=>value!==before[y]?[{coordinate:C(itemId,y,plane),before:before[y],after:value,label:`${name} #${itemId}・套裝品質候選・${y===5?'品質':y===8?'主係數':y>=28?'槽 '+(y-27)+' 旗標':y>=15?'槽 '+(y-14)+' 係數':'槽 '+(y-8)+' 詞條'}`}]:[]);
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
  if(kind==='equipment'&&!equipmentPlane(m,plane))throw Error('裝備庫別只接受背包、裝備庫或這份存檔的武庫。');
  if(!Number.isSafeInteger(id)||id<1||id>=m.original.size[0])throw Error('無效的資料編號。');
  if(kind==='equipment'&&catalogMaps.items.get(get(m,C(id,1,plane)))?.kind==='套装')return setEquipmentLevelInfo(m,{itemId:id,plane});
  if(kind==='equipment'&&catalogMaps.items.get(get(m,C(id,1,plane)))?.kind==='宝物')return treasureLevelInfo(m,{itemId:id,plane});
  let coordinate,normalMax,min=1,name;
  if(kind==='equipment'){
   const item=catalogMaps.items.get(get(m,C(id,1,plane))),quality=get(m,C(id,5,plane)),owner=get(m,C(id,7,plane));
   const originSlot=get(m,C(id,0,plane));
   if(!Number.isSafeInteger(originSlot)||originSlot<1||originSlot>=m.original.size[0]||!item||item.category!=='裝備'||['宝物','内丹'].includes(item.kind)||!Number.isInteger(item.slot)||item.slot<1||item.slot>6)throw Error('只支援有效一般裝備，不包含寶物及內丹。');
   if(!Number.isSafeInteger(quality)||quality<1||!Number.isSafeInteger(owner)||owner<0)throw Error('裝備品質或歸屬資料不符。');
   if(backpackLike(plane)){
    const rules=KNOWLEDGE.batch2Data?.items[item.id],tier=get(m,C(id,3,plane));
    if(get(m,C(id,2,plane))!==1||owner!==0)throw Error('背包普通裝備須數量為 1 且歸屬為 0。');
    if(item.kind!=='普通'||item.slot>4||!rules||rules.setLink!==0||quality>6||!Number.isSafeInteger(tier)||tier<1||tier>9||tier!==rules.tier)throw Error('背包只支援原版等階、品質的一般裝備，不包含套裝。');
    if(![0,1].includes(get(m,C(id,24,plane)))||[25,26,27].some(y=>get(m,C(id,y,plane))!==0))throw Error('裝備包含尚未涵蓋的特殊狀態。');
   }else{
    const rules=KNOWLEDGE.batch2Data?.items[item.id];
    if(item.kind!=='普通'||!rules||rules.setLink!==0)throw Error('只支援一般裝備，套裝等級尚未隔離驗證。');
    let references=0;
    for(let x=1;x<m.original.size[0];x++)if(activeCharacter(m,x))for(let slot=1;slot<=6;slot++)if(get(m,C(x,15+slot,2))===id){references++;if(owner!==x||slot!==item.slot)throw Error('裝備穿戴雙向指標不一致。');}
    if(plane===9&&!references)references=backupSetReferences(m,id,owner,item.slot);
    if(owner>0&&(!activeCharacter(m,owner)||references!==1)||owner===0&&references!==0)throw Error('裝備穿戴雙向指標不一致。');
   }
   coordinate=C(id,6,plane);normalMax=10+(quality-1)*5;name=item.name;
  }else if(kind==='training'){
   const profession=catalogMaps.professions.get(id);if(!profession)throw Error('無效的職業編號。');
   if(get(m,C(id,15,0))!==0||busyFacility(m,id,6))throw Error('此職業正在操練，請先在遊戲內停止。');
   for(let x=1;x<m.original.size[0];x++)if(activeCharacter(m,x)){const level=get(m,C(x,id,4));if(!Number.isSafeInteger(level)||level<0)throw Error('角色職業等級資料不符。');min=Math.max(min,level);}
   coordinate=C(id,5,0);normalMax=buildingNormalMax('training',id,buildingLevel(m,6));name=profession.name;
  }else if(kind==='technology'){
   const technology=catalogMaps.technologies.get(id);if(!technology?.advanced)throw Error('只支援有效的進階科技（31–44）。');
   if(get(m,C(id,13,0))!==0||busyFacility(m,id,5))throw Error('此科技正在研究，請先在遊戲內停止。');
   coordinate=C(id,4,0);normalMax=buildingNormalMax('technology',id,buildingLevel(m,5));name=technology.name;
  }else throw Error('未知的修改類型。');
  const current=get(m,coordinate);if(!Number.isSafeInteger(current)||current<0||kind==='equipment'&&current<1)throw Error('現有數值與欄位型別不符。');
  const group=kind==='equipment'&&backpackLike(plane)?'backpackEquipmentLevel':EDIT_GROUPS[kind],limits=KNOWLEDGE.editingLimits?.[kind];
  return {kind,id,plane,name,coordinate,current,min,normalMax,advancedMax:limits?.maxById?.[id]??limits?.max??0,verified:planeVerified(plane,group),advancedVerified:planeVerified(plane,group+'Advanced')};
 }
 function setEditingValue(m,kind,id,value,advanced=false,plane=9){
  if(typeof advanced!=='boolean')throw Error('進階模式參數不正確。');
  const info=editingInfo(m,kind,id,plane);
  // Backpack over-limit (z7 advanced) keeps the structural checks but lets an already over-limit row be edited.
  // An over-limit affix coefficient or a sixth slot does not enter the level formula (副词条 forces L=0), so it does not block level edits.
  if(kind==='equipment'&&backpackLike(plane)&&!info.isSet&&!info.isTreasure)ordinaryEquipment(m,id,plane,info.advancedVerified,affixOverLimitAccepted(),sixthAffixAccepted());
  if(!info.verified||advanced&&!info.advancedVerified)throw Error('此修改模式尚未完成隔離遊戲驗證，目前停用。');
  if(!Number.isSafeInteger(value)||value<info.min)throw Error(`請輸入不小於 ${info.min} 的安全整數；操練上限不得低於角色現有職業等級。`);
  const max=advanced?info.advancedMax:Math.min(info.normalMax,info.advancedMax);
  if(value>max)throw Error(`超出${advanced?'已驗證的進階':'一般模式'}上限 ${max}。`);
  if(kind==='equipment'){
   if([...m.changes.values()].some(c=>c.x===id&&c.z===plane&&((c.y>=9&&c.y<=20)||(c.y>=28&&c.y<=33)))&&value>info.normalMax)throw Error('已修改詞條係數或 ID 的裝備，本輪不能再調為超限等級。');
   const tier=get(m,C(id,3,plane));
   // Souls use 1.04 since V1.0.14.0 (was 1.05); the currency difficulty keeps the 1.05 bound.
   if(!Number.isSafeInteger(tier)||tier<1||!Number.isFinite(10*1.05**((tier-1)*30+value)-1)||!Number.isFinite(10*1.04**((tier*6/9-1)*30+4*value)-1))throw Error('裝備等階或升級公式超出可計算範圍。');
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
  const previous=m.currentGroup;m.currentGroup=raisedBuildingGroup(m,kind,id,value,info.normalMax)||(kind==='equipment'?`editing:equipment:${plane}:${id}`:`editing:${kind}:${id}`);
  try{transaction(m,()=>put(m,info.coordinate,value,`${info.name}・${kind==='training'?'操練上限':'等級'}`),`${advanced?'進階・':''}${info.name}調整`);}finally{m.currentGroup=previous;}
  return {...info,value};
 }
 const setEquipmentLevel=(m,{itemId,level,advanced=false,plane=9})=>setEditingValue(m,'equipment',itemId,level,advanced,plane);
 const setProfessionTrainingCap=(m,{professionId,cap,advanced=false})=>setEditingValue(m,'training',professionId,cap,advanced);
 const setAdvancedTechnologyLevel=(m,{technologyId,level,advanced=false})=>setEditingValue(m,'technology',technologyId,level,advanced);
 // Recruitment technology #33 over its 299 cap (recruitTechnologyAdvanced). Only 加成属性效果(24)=L reads it for effect, and
 // every refresh resets [1,17,0] to 600−L with no lower clamp; 科技等级上限 still stops research at 299 and 招募處 already
 // reaches tier 4 at 239. 300–599 keeps the interval ≥1 s; at 598–599 主动寻访 (needs a countdown >1) is partly or always
 // refused. Only [33,4,0] is written; the running countdown is left as a finished research would leave it.
 const recruitTechnologyRange=[300,599];
 function recruitTechnologyInfo(m){
  const info=editingInfo(m,'technology',33),countdown=get(m,C(1,17,0)),[min,max]=recruitTechnologyRange;
  return {technologyId:33,name:info.name,coordinate:info.coordinate,current:info.current,min,max,interval:Math.max(0,600-info.current),countdown:typeof countdown==='number'&&Number.isFinite(countdown)?countdown:null,verified:!!KNOWLEDGE.verification.recruitTechnologyAdvanced};
 }
 function setRecruitTechnologyLevel(m,{level}){
  const info=recruitTechnologyInfo(m);
  if(!info.verified)throw Error('招募科技超限尚未完成隔離遊戲冒煙。');
  if(!Number.isSafeInteger(level)||level<info.min||level>info.max)throw Error(`招募科技超限須為 ${info.min}–${info.max} 的整數；299 以下請用一般或進階模式。`);
  if(level===info.current)return {...info,value:level,unchanged:true};
  return {...batch2Put(m,info,level,'editing:technology:33',`${info.name}・等級（超限）`),interval:600-level};
 }
 // Batch-two operations intentionally have no advanced mode.
