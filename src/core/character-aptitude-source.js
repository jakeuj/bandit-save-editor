 /**
  * @typedef {Object} CharacterAptitudeServices 唯讀宿主能力；組合位置須傳入核心原有參照。
  * @property {Object} KNOWLEDGE 同一份知識物件；每次查詢讀取目前資料／旗標，不複製布林快照。
  * @property {function(SaveModel,SaveCoord):SaveScalar} get 包含尚未匯出的 token 變更。
  * @property {function(number,number,number):SaveCoord} C 座標建構。
  * @property {{items:Map<number,Object>}} catalogMaps 同一份物品索引。
  * @property {function(SaveModel,number):Array<number[]>} backupSetAptitudeRows 已檢查資格的 [部位,列號] 清單。
  * @property {function(SaveModel,number,number):boolean} inBackupSet
  * @property {string} backupSetAptitudeReason
  * @property {function(SaveModel,number):boolean} activeCharacter
  * @property {function(SaveModel,number,number,boolean,boolean,boolean):Object} ordinaryEquipment 沿用一般裝備驗證及拒絕訊息。
  * @property {function():boolean} affixOverLimitAccepted 即時讀取旗標。
  * @property {function():boolean} sixthAffixAccepted 即時讀取旗標。
  * @property {function(number,number):number} ascensionCoefficient 共用原版品質／輪次公式。
  * @property {function(number):boolean} aptitudeAttribute
  */
 /**
  * @typedef {Object} CharacterAscensionRecord 已驗證的結丹紀錄，沒有結丹時 multiplier 仍為 1.5。
  * @property {number} count
  * @property {number} multiplier
  * @property {Array<{round:number,quality:number,row:number,templateId:number,coefficient:number}>} records
  */
 /**
  * @typedef {Object} CharacterAptitudeContext 基礎資質／天賦／穿戴／備用套裝檢查後的唯讀來源。
  * @property {number} base
  * @property {Object} template
  * @property {CharacterAscensionRecord|null} ascension
  */
 /**
  * @typedef {Object} CharacterAptitudeReader 私有 module interface；不持有模型、不寫 token、不快取資格。
  * @property {function(SaveModel,number):CharacterAscensionRecord} record
  * @property {function(SaveModel,number,number,(number[]|undefined),boolean):CharacterAptitudeContext} source
  */
 /**
  * 建立資質與結丹來源的唯讀模組。所有 host 相依明確注入，知識及 flags 在每次查詢時讀取。
  * services 來自既有核心的資料讀取、catalog、穿戴／備用套裝檢查及結丹係數；不接受寫入操作。
  * @param {CharacterAptitudeServices} services 不在建立時讀模型，所有檢查在呼叫 record/source 時執行。
  * @returns {CharacterAptitudeReader} record/source 只讀取參數中的模型，拒絕條件及訊息沿用原實作。
  */
 function createCharacterAptitudeSource(services){
  const {
   KNOWLEDGE,get,C,catalogMaps,backupSetAptitudeRows,inBackupSet,backupSetAptitudeReason,
   activeCharacter,ordinaryEquipment,affixOverLimitAccepted,sixthAffixAccepted,
   ascensionCoefficient,aptitudeAttribute
  }=services;
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
   for(const [slot,itemId] of [...[1,2,3,4,5,6].map(slot=>[slot,get(m,C(characterId,15+slot,2))]),...backupSetAptitudeRows(m,characterId)]){
    if(itemId===0)continue;
    if(!Number.isSafeInteger(itemId)||itemId<1||itemId>=m.original.size[0])throw Error('穿戴裝備列號越界。');
    const templateId=get(m,C(itemId,1,9)),item=catalogMaps.items.get(templateId),rules=KNOWLEDGE.batch2Data.items[templateId];
    if(get(m,C(itemId,7,9))!==characterId||!item||item.slot!==slot||!rules)throw Error('穿戴裝備與角色或部位不符。');
    const set=rules.setLink>0?KNOWLEDGE.setEquipmentLevel?.sets?.[rules.setLink]:null;
    if(rules.setLink>0&&!set)throw Error('套裝效果尚未辨識。');
    if(rules.mainAttributes.some(aptitudeAttribute)||Array.from({length:6},(_,i)=>get(m,C(itemId,9+i,9))).some(aptitudeAttribute)||set?.effects.some(e=>aptitudeAttribute(e.attributeId)))throw Error('穿戴裝備的資質加成尚未涵蓋。');
    worn.push(itemId);
   }
   for(let i=1;i<m.original.size[0];i++)if(get(m,C(i,7,9))===characterId&&get(m,C(i,0,9))>0&&!worn.includes(i))throw Error(inBackupSet(m,i,characterId)?backupSetAptitudeReason:'有 owner 指向角色但未穿戴的裝備。');
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
    for(const [slot,itemId] of [...[1,2,3,4,5,6].map(slot=>[slot,get(m,C(characterId,15+slot,2))]),...backupSetAptitudeRows(m,characterId)]){
     if(itemId===0)continue;
     // Ordinary affix pools have no 104–106, so an over-limit coefficient or a sixth slot leaves the aptitude sum alone.
     const equipment=ordinaryEquipment(m,itemId,9,false,affixOverLimitAccepted(),sixthAffixAccepted());
     if(get(m,C(itemId,7,9))!==characterId||catalogMaps.items.get(get(m,C(itemId,1,9))).slot!==slot||equipment.rules.mainAttributes.some(id=>id>=104&&id<=106))throw Error('穿戴裝備的資質加成尚未涵蓋。');
    }
    // Also catch an orphan owner which is absent from the character's slot array.
    if(KNOWLEDGE.verification.backupSetAptitude!==true)for(let i=1;i<m.original.size[0];i++)if(get(m,C(i,7,9))===characterId&&get(m,C(i,0,9))>0&&inBackupSet(m,i,characterId))throw Error(backupSetAptitudeReason);
    for(let i=1;i<m.original.size[0];i++)if(get(m,C(i,7,9))===characterId&&get(m,C(i,0,9))>0)ordinaryEquipment(m,i,9,false,affixOverLimitAccepted(),sixthAffixAccepted());
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
  return {record:ascensionRecord,source:characterAptitudeSource};
 }
