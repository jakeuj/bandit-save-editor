 /**
  * @typedef {EditingInfo & {quality:number,tier:number,selected:number,slots:number,rules:Object,newItemMarker:number}} OrdinaryEquipmentInfo 一般裝備的結構讀值；selected=0 表示尚未鎖定洗練槽，slots=品質減一。
  */
 /**
  * @typedef {EquipmentRef & {slot:number,coefficient:number}} AffixCoefficientRequest slot 為 1 起算既有槽，coefficient 為數值、最多兩位小數；進階模式以獨立方法選擇。
  */
 /**
  * @typedef {OrdinaryEquipmentInfo & {slot:number,attributeId:number,max:number}} AffixCoefficientInfo current 與 coordinate 改指係數。一般入口 normalMax 仍是等級上限；進階入口才覆寫為係數一般上限。advancedVerified 仍是等級旗標，詞條資格看 verified。
  */
 /**
  * @typedef {{attributeId:number,name:string,unit:string,before:number,after:number,delta:number}} EquipmentEffect 單件物品的指定屬性貢獻；不是角色面板或原生即時快取。
  */
 /**
  * @typedef {{coordinate:SaveCoord,before:SaveScalar,after:SaveScalar,label:string}} EquipmentTokenChange 預覽用 token 差異，不是可自行套用的寫入授權。
  */
 /**
  * @typedef {AffixCoefficientInfo & {value:number,unchanged:boolean,overLimit:boolean,effect:(EquipmentEffect|null),effectError:string}} AffixCoefficientPreview 效果計算失敗會保留 effectError；此診斷不阻擋合格係數的寫入，沒有 canApply。
  */
 /**
  * @typedef {{attributeId:number,name:string,unit:string,supported:(boolean|undefined),reason:string,verified?:boolean}} EquipmentAffixCandidate supported 僅表示公式支援，缺限制資料時可為 undefined。精準洗練另有 verified；第六槽候選沒有該欄，依 reason 及整體旗標判讀。
  */
 /**
  * @typedef {{attributeId:number,coefficient:number,flag?:number}} EquipmentSlotValue 詞條 ID／係數；品質增刪槽的觀察值另含洗練 flag。
  */
 /**
  * @typedef {EquipmentRef & {attributeId:number,coefficient?:number}} EquipmentSixthAffixRequest ID=0 清除時可省略係數或傳 0；其他 ID 必須明示 50–120 係數，最多兩位小數。
  */
 /**
  * @typedef {OrdinaryEquipmentInfo & {itemId:number,attributeId:number,min:number,max:number,candidates:EquipmentAffixCandidate[]}} EquipmentSixthAffixInfo current 是第六槽係數；繼承的 coordinate 仍指等級 y6，寫入必須由具名入口依預覽 changes 處理。
  */
 /**
  * @typedef {EquipmentSixthAffixInfo & {before:EquipmentSlotValue,after:EquipmentSlotValue,changes:EquipmentTokenChange[],effects:EquipmentEffect[],cleared:boolean,unchanged:boolean}} EquipmentSixthAffixPreview y14／y20 的差異；不改 y33 洗練旗標，沒有私有預覽授權身分。
  */
 /**
  * @typedef {EquipmentRef & {slot:number,attributeId:number,coefficient:number,selectUnwashedSlot?:boolean}} EquipmentAffixRequest 未選槽須明示 selectUnwashedSlot=true；已有選槽時再傳 true 會拒絕。
  */
 /**
  * @typedef {AffixCoefficientInfo & {candidates:EquipmentAffixCandidate[],requiresInitialSelection:boolean,selectedSlot:(number|null),selectableSlots:number[]}} EquipmentAffixInfo 精準洗練資訊；已鎖槽只能查該槽，尚未鎖槽可選品質範圍內既有槽。
  */
 /**
  * @typedef {{itemId:number,plane:EquipmentPlane,slot:number,selectionChange:({before:number,after:number}|null),before:EquipmentSlotValue,after:EquipmentSlotValue,effects:EquipmentEffect[],unchanged:boolean,effectUnchanged:boolean,verified:boolean}} EquipmentAffixPreview 單次唯讀計算。純鎖槽時 unchanged=false，即使效果沒有改變；沒有 changes／canApply／reasons 欄位。
  */
 /**
  * @typedef {{slot:number,attributeId:number,coefficient:number}} EquipmentAddedAffix 升品時每個新增連續尾槽各列一次；ID 須在原版池且不新增重複。
  */
 /**
  * @typedef {EquipmentRef & {quality:number,addedAffixes?:EquipmentAddedAffix[]}} EquipmentQualityRequest 普通裝備目標品質 1–6；新增槽須完整指定，降品與同品時 addedAffixes 為空。
  */
 /**
  * @typedef {{quality:number,slots:number,normalMax:number,allowed:boolean,reason:string,group:string,verified:boolean}} EquipmentQualityTarget allowed 是等級／鎖槽結構限制，verified 是庫別／方向旗標；目前品質的 verified 固定為 true。
  */
 /**
  * @typedef {OrdinaryEquipmentInfo & {record:SaveScalar[],data:Object,mainCoefficient:number,selectedSlot:(number|null),targets:EquipmentQualityTarget[],candidates:Array<{attributeId:number,name:string}>}} EquipmentQualityInfo 50 欄單件觀察值與六個品質目標；沒有整體 verified 作為品質方向授權，應查 targets。
  */
 /**
  * @typedef {{slot:number,kind:('added'|'removed'|'retained'),before:EquipmentSlotValue,after:EquipmentSlotValue}} EquipmentQualitySlotChange 尾槽增刪與保留槽係數變動，保留鎖槽語意。
  */
 /**
  * @typedef {{itemId:number,plane:EquipmentPlane,quality:number,previousQuality:number,normalMax:number,previousMax:number,mainCoefficient:{before:number,after:number},selectedSlot:(number|null),slots:EquipmentQualitySlotChange[],changes:EquipmentTokenChange[],effects:EquipmentEffect[],requiresRemovalConfirmation:boolean,unchanged:boolean,effectUnchanged:boolean,group:string,verified:boolean}} EquipmentQualityPreview 方向旗標與當次差異；group 是旗標名稱，累計還原群組另由 set 決定。沒有私有授權或 canApply。
  */
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
 /**
  * 讀取已鎖定槽的原版範圍係數資訊；無效來源直接拋錯，旗標關閉仍可供觀察。
  * @param {SaveModel} m
  * @param {number} itemId
  * @param {number} slot 1 起算；必須等於既有唯一洗練選槽。
  * @param {EquipmentPlane} [plane=9]
  * @returns {AffixCoefficientInfo} current 是係數，min／max 是係數範圍。
  * @throws {Error} 品質、超限、選槽、型別或穿戴互指不符。
  */
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
 /**
  * 只寫既有選槽的係數，不改詞條 ID 或鎖槽；每次重查來源及旗標。
  * @param {SaveModel} m
  * @param {AffixCoefficientRequest & {advanced?:false}} options advanced 只接受 false；超限用獨立方法。
  * @returns {AffixCoefficientInfo & {value:number}} current 為操作前係數，value 為目標；合法同值不新增歷史。
  * @throws {Error} 旗標未開、係數非數值／超過兩位小數或超出原版範圍。
  * 與同物品等級／品質共用 editing:equipment:plane:itemId 累計還原。
  */
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
 /**
  * 讀取既有唯一洗練槽的超限係數範圍，保留原版等級與結構限制。
  * @param {SaveModel} m
  * @param {number} itemId
  * @param {number} slot
  * @param {EquipmentPlane} [plane=9]
  * @returns {AffixCoefficientInfo} min 為原版下限、normalMax 為係數一般上限、max=1000；verified 是獨立超限旗標。
  * @throws {Error} 未選槽、非既有選槽、裝備等級超限或資料不符。
  */
 function affixAdvancedInfo(m,itemId,slot,plane=9){
  const info=ordinaryEquipment(m,itemId,plane,false,true);
  if(!Number.isInteger(slot)||slot<1||slot>info.slots)throw Error('請選擇品質範圍內的既有詞條槽。');
  if(!info.selected)throw Error('只可調整已選定的洗練槽；請先選槽洗練一次。');
  if(info.selected!==slot)throw Error('只可調整已選定的洗練槽，不能更換選槽。');
  return {...info,slot,coordinate:C(itemId,14+slot,plane),current:get(m,C(itemId,14+slot,plane)),attributeId:get(m,C(itemId,8+slot,plane)),min:10*(info.quality-1),normalMax:60+10*info.quality,max:affixOverLimitMax,verified:planeVerified(plane,'equipmentAffixCoefficientAdvanced')};
 }
 /**
  * 唯讀預覽指定係數；效果診斷與可寫資格分開。
  * @param {SaveModel} m
  * @param {AffixCoefficientRequest} options
  * @returns {AffixCoefficientPreview} 效果無法計算時 effect=null 並回傳 effectError；不新增模型變更。
  * @throws {Error} 資格或係數值域／兩位小數限制不符；效果計算錯誤另收在回傳值。
  */
 function previewEquipmentAffixCoefficientAdvanced(m,{itemId,slot,coefficient,plane=9}){
  const info=affixAdvancedInfo(m,itemId,slot,plane);
  if(!decimal2(coefficient)||coefficient<info.min||coefficient>info.max)throw Error(`超限係數須為 ${info.min}–${info.max}，最多兩位小數。`);
  const calc={...info,id:itemId,currentLevel:get(m,C(itemId,6,plane))},id=info.attributeId;
  let effect=null,effectError='';
  try{const before=equipmentAffixEffect(m,calc,id),after=equipmentAffixEffect(m,calc,id,{slot,attributeId:id,coefficient});effect={attributeId:id,name:catalogName('attributes',id),unit:KNOWLEDGE.affixReplacement.attributes[id].unit,before,after,delta:after-before};}catch(e){effectError=e.message;}
  return {...info,value:coefficient,unchanged:coefficient===info.current,overLimit:coefficient>info.normalMax,effect,effectError};
 }
 /**
  * 重算目前模型的超限係數預覽後套用，不接收先前 preview 作為授權。
  * @param {SaveModel} m
  * @param {AffixCoefficientRequest} options
  * @returns {AffixCoefficientPreview} 包含 value 及操作前 current；effectError 不阻擋合格寫入，同值不新增歷史。
  * @throws {Error} 資格／係數不符或超限旗標未開；仍與同物品其他操作累計還原。
  */
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
 /**
  * 讀取品質 6 一般裝備的第六槽與合法池；與原有五槽及洗練選槽分開。
  * @param {SaveModel} m
  * @param {EquipmentRef} options
  * @returns {EquipmentSixthAffixInfo} current 為 y20 係數，attributeId 為 y14；verified 是第六槽旗標。
  * @throws {Error} 品質、既有第六槽、重複 ID 或來源結構不符。
  */
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
 /**
  * 唯讀計算第六槽新增、替換或清除；清除不需要目標屬性的候選資格。
  * @param {SaveModel} m
  * @param {EquipmentSixthAffixRequest} options
  * @returns {EquipmentSixthAffixPreview} 只有 y14／y20 差異，changes 可為空；不以旗標關閉阻擋預覽。
  * @throws {Error} 非法池／新增重複、係數或效果計算不符；ID=0 時非零係數也拒絕。
  */
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
 /**
  * 以目前模型重新預覽並檢查第六槽旗標，原子套用兩個 token。
  * @param {SaveModel} m
  * @param {EquipmentSixthAffixRequest} options
  * @returns {EquipmentSixthAffixPreview} 同值回傳預覽且不新增歷史；不消耗私有預覽權杖。
  * @throws {Error} 預覽失敗或旗標未開；y33 保持不變，同件裝備共用累計還原群組。
  */
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
 /**
  * 讀取精準洗練的合法候選、選槽要求與各候選資格。
  * @param {SaveModel} m
  * @param {EquipmentRef & {slot:number}} options
  * @returns {EquipmentAffixInfo} verified 表示流程旗標；候選須另看 supported、verified、reason。
  * @throws {Error} 結構、超限或指定槽不符；候選個別阻擋另放在 reason。
  */
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
 /**
  * 唯讀預覽目前單件貢獻；首次鎖槽也算變更，不要求與技藝上限相同的私有預覽身分。
  * @param {SaveModel} m
  * @param {EquipmentAffixRequest} options
  * @returns {EquipmentAffixPreview} 可在旗標關閉時預覽 verified=false；效果不變不代表沒有鎖槽寫入。
  * @throws {Error} 首次選槽確認、非法 ID／重複、係數或效果計算不符。
  */
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
 /**
  * 重讀目前資格，原子套用鎖槽旗標（如需要）、ID 與係數；不採用呼叫端的預覽結果。
  * @param {SaveModel} m
  * @param {EquipmentAffixRequest & {advanced?:false}} options advanced 只接受 false。
  * @returns {EquipmentAffixPreview} 回傳當次重算結果；合法同值不新增歷史。
  * @throws {Error} 預覽失敗或候選 verified=false；與同物品等級／品質共用累計還原。
  */
 function setEquipmentAffix(m,{itemId,slot,attributeId,coefficient,advanced=false,plane=9,selectUnwashedSlot=false}){
  if(advanced!==false)throw Error('精準洗練尚未開放超限模式。');
  const preview=previewEquipmentAffixReplacement(m,{itemId,slot,attributeId,coefficient,plane,selectUnwashedSlot});
  if(!preview.verified)throw Error('精準洗練尚未完成隔離遊戲驗證。');
  const previous=m.currentGroup;m.currentGroup=`editing:equipment:${plane}:${itemId}`;
  try{transaction(m,()=>{if(preview.selectionChange)put(m,C(itemId,27+slot,plane),1,`${planeName(plane)} #${itemId}・首次選定洗練槽 ${slot}`);put(m,C(itemId,8+slot,plane),attributeId,`${planeName(plane)} #${itemId}・詞條 ${slot}・${catalogName('attributes',preview.before.attributeId)} → ${catalogName('attributes',attributeId)}`);put(m,C(itemId,14+slot,plane),coefficient,`${planeName(plane)} #${itemId}・詞條 ${slot}・係數`);},'精準洗練');}finally{m.currentGroup=previous;}
  return preview;
 }
 /**
  * 讀取普通裝備品質結構及六個目標；數量、主係數與效果設定須符合資格。
  * @param {SaveModel} m
  * @param {EquipmentRef} options
  * @returns {EquipmentQualityInfo} targets 的 allowed 與 verified 各自判讀；繼承 verified 是等級旗標。
  * @throws {Error} 非普通裝備、特殊狀態、主係數或數量不符；不以 eligible/reasons 形式回傳失敗。
  */
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
 /**
  * 唯讀計算品質變動、完整尾槽增刪與單件效果；不確認降品刪槽。
  * @param {SaveModel} m
  * @param {EquipmentQualityRequest} options
  * @returns {EquipmentQualityPreview} requiresRemovalConfirmation 留給 set 檢查；旗標關閉仍可預覽 verified=false。
  * @throws {Error} 目標、結構限制、新增槽池／重複／係數或效果計算不符。
  */
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
 /**
  * 以目前模型重算品質預覽，檢查方向旗標及明示刪槽確認後原子套用。
  * @param {SaveModel} m
  * @param {EquipmentQualityRequest & {confirmRemovedAffixes?:boolean,advanced?:false}} options 確認須為布林；advanced 只接受 false。
  * @returns {EquipmentQualityPreview} 合法同品變更可為空，不新增歷史；沒有預覽消耗或 canApply 語意。
  * @throws {Error} 預覽失敗、方向未驗證或刪槽未確認；同物品累計還原，undo 退前次交易。
  */
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
