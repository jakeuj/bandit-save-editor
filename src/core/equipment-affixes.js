 const aptitudeNames=['力量','敏捷','智力'];
 const decimal2=value=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER/100&&Math.abs(value*100-Math.round(value*100))<1e-8;
 function ordinaryEquipment(m,itemId,plane=9,overLimitLevel=false,overLimitAffix=false,sixthAffix=false){
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
   if(slot<=slots){
    if(!rules.affixIds.includes(id)||!decimal2(coefficient)||coefficient<10*(q-1)||coefficient>affixOverLimitMax)throw Error('既有詞條或係數不在原版範圍內。');
    if(coefficient>60+10*q&&!overLimitAffix)throw Error('詞條係數已超限，此操作停用；請用超限係數調整，或回遊戲重洗此槽。');
   }
   else if(q===6&&slot===6&&(id!==0||coefficient!==0)){
    if(!sixthAffix)throw Error('此裝備有第六槽詞條，此操作停用；請先用第六槽清除。');
    if(flag!==0||!rules.affixIds.includes(id)||!decimal2(coefficient)||coefficient<sixthAffixRange[0]||coefficient>sixthAffixRange[1])throw Error('第六槽詞條或係數不在原版範圍內。');
    for(let k=1;k<=5;k++)if(get(m,C(itemId,8+k,plane))===id)throw Error('第六槽詞條與其他槽重複。');
   }
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
  return {...info,verified:planeVerified(plane,backpackLike(plane)?'backpackEquipmentAffixCoefficient':'equipmentAffixCoefficient')};
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
 // Affix coefficient over the native range (equipmentAffixCoefficientAdvanced), z7 and z9, selected wash slot only. The range
 // lives only in 装备词条系数 (取得與洗練); 装备属性计算→装备主属性 is linear with no clamp, and the tips and wash-page bars
 // clamp at 120 for display. A native rewash of the slot rolls a fresh in-range value. Over-limit levels stay excluded.
 const affixOverLimitMax=1000,affixOverLimitAccepted=()=>!!KNOWLEDGE.verification.equipmentAffixCoefficientAdvanced;
 function affixAdvancedInfo(m,itemId,slot,plane=9){
  const info=ordinaryEquipment(m,itemId,plane,false,true);
  if(!Number.isInteger(slot)||slot<1||slot>info.slots)throw Error('請選擇品質範圍內的既有詞條槽。');
  if(!info.selected)throw Error('只可調整已選定的洗練槽；請先選槽洗練一次。');
  if(info.selected!==slot)throw Error('只可調整已選定的洗練槽，不能更換選槽。');
  return {...info,slot,coordinate:C(itemId,14+slot,plane),current:get(m,C(itemId,14+slot,plane)),attributeId:get(m,C(itemId,8+slot,plane)),min:10*(info.quality-1),normalMax:60+10*info.quality,max:affixOverLimitMax,verified:planeVerified(plane,'equipmentAffixCoefficientAdvanced')};
 }
 function previewEquipmentAffixCoefficientAdvanced(m,{itemId,slot,coefficient,plane=9}){
  const info=affixAdvancedInfo(m,itemId,slot,plane);
  if(!decimal2(coefficient)||coefficient<info.min||coefficient>info.max)throw Error(`超限係數須為 ${info.min}–${info.max}，最多兩位小數。`);
  const calc={...info,id:itemId,currentLevel:get(m,C(itemId,6,plane))},id=info.attributeId;
  let effect=null,effectError='';
  try{const before=equipmentAffixEffect(m,calc,id),after=equipmentAffixEffect(m,calc,id,{slot,attributeId:id,coefficient});effect={attributeId:id,name:catalogName('attributes',id),unit:KNOWLEDGE.affixReplacement.attributes[id].unit,before,after,delta:after-before};}catch(e){effectError=e.message;}
  return {...info,value:coefficient,unchanged:coefficient===info.current,overLimit:coefficient>info.normalMax,effect,effectError};
 }
 function setEquipmentAffixCoefficientAdvanced(m,{itemId,slot,coefficient,plane=9}){
  const preview=previewEquipmentAffixCoefficientAdvanced(m,{itemId,slot,coefficient,plane});
  if(!preview.verified)throw Error('詞條係數超限尚未完成隔離遊戲冒煙。');
  if(preview.unchanged)return {...preview,unchanged:true};
  return {...batch2Put(m,preview,coefficient,`editing:equipment:${plane}:${itemId}`,`${preview.name}・詞條 ${slot} 係數（超限）`),effect:preview.effect};
 }
 // Sixth affix slot (equipmentSixthAffix), z7 and z9, quality-6 ordinary equipment only. 装备词条数量 clamps to five slots, so
 // 获得物品 and the wash page never touch y14/y20/y33; 装备属性计算 and 物品tips loop all six slots (L=0 for 副词条), 装备排序
 // reads y20, and 装备库存入／取出 copy all 50 fields. The wash flag y33 stays 0: 装备已洗词条数 counts it and would lock the wash page.
 const sixthAffixRange=[50,120],sixthAffixAccepted=()=>!!KNOWLEDGE.verification.equipmentSixthAffix;
 function sixthAffixInfo(m,{itemId,plane=9}){
  const info=ordinaryEquipment(m,itemId,plane,false,affixOverLimitAccepted(),true);
  if(info.quality!==6)throw Error('第六槽只支援品質 6（神話）的一般裝備。');
  const otherIds=[1,2,3,4,5].map(k=>get(m,C(itemId,8+k,plane))),attributeId=get(m,C(itemId,14,plane)),current=get(m,C(itemId,20,plane));
  const candidates=info.rules.affixIds.map(id=>{
   const formula=KNOWLEDGE.affixReplacement?.attributes[id],supported=!!formula&&KNOWLEDGE.affixReplacementLimits?.attributeIds.includes(id),duplicate=otherIds.includes(id);
   return {attributeId:id,name:catalogName('attributes',id),unit:formula?.unit||'',supported,reason:duplicate?'不能新增與其他槽重複的詞條':!supported?'此詞條尚未核對效果公式':''};
  });
  return {...info,itemId,plane,attributeId,current,min:sixthAffixRange[0],max:sixthAffixRange[1],candidates,verified:planeVerified(plane,'equipmentSixthAffix')};
 }
 // attributeId 0 clears the slot (coefficient 0). Effects add the sixth slot to the five-slot item contribution.
 function previewEquipmentSixthAffix(m,{itemId,plane=9,attributeId,coefficient}){
  const info=sixthAffixInfo(m,{itemId,plane});
  if(attributeId===0){if(coefficient!==undefined&&coefficient!==0)throw Error('清除第六槽時係數須為 0。');coefficient=0;}
  else{
   const candidate=info.candidates.find(v=>v.attributeId===attributeId);
   if(!Number.isSafeInteger(attributeId)||!candidate)throw Error('目標詞條不在此裝備的原版合法池。');
   if(candidate.reason)throw Error(candidate.reason);
   if(!decimal2(coefficient)||coefficient<info.min||coefficient>info.max)throw Error(`第六槽係數須為 ${info.min}–${info.max}，最多兩位小數。`);
  }
  const calc={...info,id:itemId,currentLevel:get(m,C(itemId,6,plane))},sixth=(id,a,c)=>a===id&&a!==0?affixEffect(id,info.tier,0,c):0;
  const effects=[...new Set([info.attributeId,attributeId])].filter(id=>id!==0).map(id=>{
   const base=equipmentAffixEffect(m,calc,id),before=base+sixth(id,info.attributeId,info.current),after=base+sixth(id,attributeId,coefficient);
   return {attributeId:id,name:catalogName('attributes',id),unit:KNOWLEDGE.affixReplacement.attributes[id].unit,before,after,delta:after-before};
  });
  const where=`${planeName(plane)} #${itemId}・第六槽`,changes=[[14,info.attributeId,attributeId,where+'詞條'],[20,info.current,coefficient,where+'係數']].filter(([,b,a])=>b!==a).map(([y,before,after,label])=>({coordinate:C(itemId,y,plane),before,after,label}));
  return {...info,before:{attributeId:info.attributeId,coefficient:info.current},after:{attributeId,coefficient},changes,effects,cleared:attributeId===0,unchanged:!changes.length};
 }
 function setEquipmentSixthAffix(m,options){
  const preview=previewEquipmentSixthAffix(m,options);
  if(!preview.verified)throw Error('第六槽尚未完成隔離遊戲冒煙。');
  if(preview.unchanged)return preview;
  const previous=m.currentGroup;m.currentGroup=`editing:equipment:${preview.plane}:${preview.itemId}`;
  try{transaction(m,()=>{for(const c of preview.changes)put(m,c.coordinate,c.after,c.label);},preview.cleared?'清除第六槽':'第六槽詞條');}finally{m.currentGroup=previous;}
  return preview;
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
  const enabled=planeVerified(plane,backpackLike(plane)?'backpackEquipmentAffixReplacement':'equipmentAffixReplacement')&&(!requiresInitialSelection||!!KNOWLEDGE.verification.equipmentAffixInitialSelection);
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
  try{transaction(m,()=>{if(preview.selectionChange)put(m,C(itemId,27+slot,plane),1,`${planeName(plane)} #${itemId}・首次選定洗練槽 ${slot}`);put(m,C(itemId,8+slot,plane),attributeId,`${planeName(plane)} #${itemId}・詞條 ${slot}・${catalogName('attributes',preview.before.attributeId)} → ${catalogName('attributes',attributeId)}`);put(m,C(itemId,14+slot,plane),coefficient,`${planeName(plane)} #${itemId}・詞條 ${slot}・係數`);},'精準洗練');}finally{m.currentGroup=previous;}
  return preview;
 }
 function equipmentQualityInfo(m,{itemId,plane=9}){
  const info=ordinaryEquipment(m,itemId,plane),record=Array.from({length:50},(_,y)=>get(m,C(itemId,y,plane))),data=KNOWLEDGE.equipmentQuality?.items[record[1]];
  if(!data||record[2]!==1)throw Error('品質調整只支援數量為 1 的普通裝備。');
  if(!Number.isSafeInteger(record[8])||record[8]<80+30*(info.quality-1)||record[8]>80+30*info.quality)throw Error('尚未支援此主係數範圍。');
  if(!data.mainSettings.every(v=>typeof v==='number'&&Number.isFinite(v)))throw Error('裝備主屬性設定尚未核對。');
  const targets=Array.from({length:6},(_,i)=>{const quality=i+1,slots=quality-1,normalMax=10+5*(quality-1),group=(backpackLike(plane)?'backpackEquipmentQuality':'equipmentQuality')+(quality>info.quality?'Upgrade':'Downgrade');
   const reason=record[6]>normalMax?'等級超過目標品質上限，請先降低裝備等級。':info.selected>slots?'已選洗練槽會被移除，不能降至此品質。':'';
   return {quality,slots,normalMax,allowed:!reason,reason,group,verified:quality===info.quality||planeVerified(plane,group)};});
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
  const changes=after.flatMap((value,y)=>value!==before[y]?[{coordinate:C(itemId,y,plane),before:before[y],after:value,label:`${planeName(plane)} #${itemId}・品質調整・${y===5?'品質':y===8?'主係數':y>=28?'槽 '+(y-27)+' 旗標':y>=15?'槽 '+(y-14)+' 係數':'槽 '+(y-8)+' 詞條'}`}]:[]);
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
