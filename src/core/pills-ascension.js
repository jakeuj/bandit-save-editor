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
 // Over-cap pill bonus (pillAptitudeBonusAdvanced). Only 角色资质计算 reads y13–15 and adds B/10 without a cap; 属性计算 1–3
 // passes the total on, the panel bars clamp their width, and 服用普通丹药 (and 刷新丹药) refuse further pills while the total
 // is at or above C or P, so an over-cap B stays until 角色重生 clears it. Integer B 0–1000 (+100 aptitude), no pill needed,
 // characters without ascension or rebirth-stage records only; it shares the aptitude restore group.
 const pillAdvancedMax=1000;
 function pillAdvancedInfo(m,{characterId,aptitude}){
  if(!Number.isInteger(aptitude)||aptitude<1||aptitude>3)throw Error('無效的資質類型。');
  const {base}=characterAptitudeSource(m,characterId,aptitude,undefined,false),cap=aptitudeCap(base,null),coordinate=C(characterId,12+aptitude,2),current=get(m,coordinate);
  if(!Number.isFinite(base)||base<=0||!pillBonusReadable(current))throw Error('現有增量或資質來源尚未涵蓋。');
  const total=Math.round(100*(base+current/10))/100;
  return {characterId,aptitude,coordinate,current,display:pillGrid(current),step:1,min:0,max:pillAdvancedMax,base,cap,capMax:Math.max(0,Math.floor((cap-base)*10+1e-8)),total,overCap:total>cap,name:aptitudeNames[aptitude-1],verified:!!KNOWLEDGE.verification.pillAptitudeBonusAdvanced};
 }
 function setPillAptitudeBonusAdvanced(m,{characterId,aptitude,bonus}){
  const info=pillAdvancedInfo(m,{characterId,aptitude});
  if(!info.verified)throw Error('丹藥超限尚未完成隔離遊戲冒煙。');
  if(!Number.isSafeInteger(bonus)||bonus<0||bonus>info.max)throw Error(`超限累積增量須為 0–${info.max} 的整數（每 1 等於資質 0.1 點）。`);
  if(bonus===info.current)return {...info,value:info.current,unchanged:true};
  return batch2Put(m,info,bonus,`aptitude:${characterId}`,`${get(m,C(characterId,1,2))}・${info.name}丹藥累積增量（超限）`);
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
 // Unabsorbed inner pill level (backpackInnerPillLevel z7／innerPillLevel z9). 升级装备／升级最大装备 share the treasure OR
 // branch: z9 y6+1 up to 装备等级上限(y5)=10+(q−1)×5, paid in souls; z7 has no native upgrade. A worn pill's y6 feeds
 // 装备属性计算, 内丹破镜值 (渡劫 speed) and is copied to z17 by 内丹入体存入, as after a native upgrade; 装备价格 ignores it.
 // 获得物品 zeroes y9–23 and 词条洗练 only takes category 装备, so the affix columns stay 0. z9 rows must be worn (slot 5) or stored in the backup set.
 const innerPillQualityMax=6;
 function innerPillLevelInfo(m,{itemId,plane=9}){
  const fail=reason=>{throw Error('內丹等級：'+reason);};
  if(!equipmentPlane(m,plane)||!Number.isSafeInteger(itemId)||itemId<1||itemId>=m.original.size[0])fail('庫別或編號不符。');
  const record=Array.from({length:60},(_,y)=>get(m,C(itemId,y,plane))),item=catalogMaps.items.get(record[1]),t=KNOWLEDGE.batch2Data?.items[record[1]],quality=record[5],level=record[6],owner=record[7];
  if(!item||item.kind!=='内丹'||item.slot!==5||!t)fail('不是已辨識的內丹範本。');
  if(record.some(v=>typeof v!=='number'||!Number.isFinite(v))||!Number.isSafeInteger(record[0])||record[0]<1||record[0]>=m.original.size[0])fail('識別或欄位型別不符。');
  if(record[2]!==1||record[3]!==t.tier||record[4]!==0)fail('數量、等階或狀態不符。');
  if(![0,1].includes(record[22])||![0,1].includes(record[24])||[...record.slice(9,22),record[23],...record.slice(25,50)].some(v=>v!==0))fail('包含尚未涵蓋的詞條或特殊狀態。');
  if(!Number.isSafeInteger(quality)||quality<1||quality>innerPillQualityMax)fail('只支援原版品質 1–6。');
  const normalMax=10+5*(quality-1);
  if(!Number.isSafeInteger(level)||level<1||level>normalMax)fail('只支援原版等級，超限停用。');
  // Native slot replacement returns the displaced item to z7 without clearing its owner; that stale owner must be active.
  if(!Number.isSafeInteger(owner)||owner<0||owner>0&&!activeCharacter(m,owner))fail('歸屬不符。');
  let references=0;
  for(let x=1;plane===9&&x<m.original.size[0];x++)for(let slot=1;slot<=6;slot++)if(get(m,C(x,15+slot,2))===itemId){
   references++;if(owner!==x||!activeCharacter(m,x)||slot!==5)fail('穿戴雙向指標不一致。');
  }
  let stored=false;
  if(plane===9&&!references){try{references=backupSetReferences(m,itemId,owner,5,'backupSetInnerPillLevel');}catch(e){fail(e.message);}stored=references===1;}
  if(plane===9&&references!==1)fail('裝備庫只支援穿戴中的內丹。');
  const group=backpackLike(plane)?'backpackInnerPillLevel':'innerPillLevel';
  return {kind:'equipment',isInnerPill:true,id:itemId,itemId,plane,name:item.name,coordinate:C(itemId,6,plane),current:level,min:1,normalMax,advancedMax:normalMax,advancedVerified:false,verified:planeVerified(plane,group),group,record,tier:t.tier,quality,owner,worn:references===1&&!stored,stored};
 }
 function previewInnerPillLevel(m,options){
  const {itemId,plane=9,level}=options,reasons=[];let info=null;
  if(Object.keys(options).some(k=>!['itemId','plane','level'].includes(k)))reasons.push('內丹等級只接受物品編號、庫別與等級。');
  try{info=innerPillLevelInfo(m,{itemId,plane});}catch(e){reasons.push(e.message);}
  if(info&&(!Number.isSafeInteger(level)||level<1||level>info.normalMax))reasons.push(`內丹等級須為 1–${info.normalMax} 的整數。`);
  if(!info||reasons.length)return {...info,itemId,plane,level,reasons,changes:[],canApply:false};
  const changes=level===info.current?[]:[{coordinate:info.coordinate,before:info.current,after:level,label:`${info.name}・內丹等級`}];
  return {...info,level,reasons,changes,unchanged:!changes.length,canApply:info.verified&&!!changes.length};
 }
 function setInnerPillLevel(m,options){
  const preview=previewInnerPillLevel(m,options);
  if(preview.reasons.length)throw Error(preview.reasons.join('；'));
  if(!preview.verified)throw Error('內丹等級尚未完成隔離遊戲驗證。');
  if(!preview.changes.length)return preview;
  const previous=m.currentGroup;m.currentGroup=`inner-pill:${preview.plane}:${preview.itemId}`;
  try{transaction(m,()=>put(m,preview.coordinate,preview.level,preview.changes[0].label),`${preview.name}等級調整`);}finally{m.currentGroup=previous;}
  return preview;
 }
 // Ascended inner pill level (ascendedInnerPillLevel). 内丹入体存入 copies the worn z9 row to z17 and nothing writes y6 again
 // (删除角色内丹数据 only clears on rebirth／dismissal). 内丹属性计算 reads it through z16 for wp main attributes only — never
 // 104–106, and 角色资质上限倍率 reads y15 — so it moves only combat stats; page icons merely display it. Range 1 to
 // 装备等级上限(y5), the native range before absorbing. Any template or prison state: no z16／z17 writer depends on either.
 // Rebirth leftovers (rows no z16 entry references) are never read and stay read-only.
 function ascendedInnerPillLevelInfo(m,{characterId}){
  const reasons=[],verified=KNOWLEDGE.verification.ascendedInnerPillLevel===true;
  try{
   if(!activeCharacter(m,characterId)||get(m,C(characterId,0,2))!==characterId)throw Error('找不到有效的已招募角色。');
   const ascension=ascensionRecord(m,characterId);
   if(ascension.count===0)throw Error('角色尚未結丹。');
   const records=ascension.records.map(({round,row,templateId})=>{
    const record=Array.from({length:60},(_,y)=>get(m,C(row,y,17))),item=catalogMaps.items.get(templateId),t=KNOWLEDGE.batch2Data.items[templateId],quality=record[5],level=record[6],problems=[];
    if(item.slot!==5)problems.push('不是部位 5 的內丹範本。');
    else if(record.some(v=>typeof v!=='number'||!Number.isFinite(v))||!Number.isSafeInteger(record[0])||record[0]<1||record[0]>=m.original.size[0])problems.push('識別或欄位型別不符。');
    else if(record[2]!==1||record[3]!==t.tier||record[4]!==0)problems.push('數量、等階或狀態不符。');
    else if(![0,1].includes(record[22])||![0,1].includes(record[24])||[...record.slice(12,15),...record.slice(18,22),record[23],...record.slice(25,50)].some(v=>v!==0))problems.push('包含尚未涵蓋的詞條或特殊狀態。');
    else if(!Number.isSafeInteger(quality)||quality<1||quality>innerPillQualityMax)problems.push('只支援原版品質 1–6。');
    else if(!Number.isSafeInteger(level)||level<1||level>10+5*(quality-1))problems.push('只支援原版等級，超限停用。');
    return {round,row,templateId,name:item.name,tier:t.tier,quality,current:level,min:1,max:problems.length?null:10+5*(quality-1),coordinate:C(row,6,17),eligible:!problems.length,reasons:problems};
   });
   return {characterId,records,ascensions:ascension.count,eligible:true,reasons,verified};
  }catch(e){reasons.push(e.message);return {characterId,records:[],eligible:false,reasons,verified};}
 }
 function previewAscendedInnerPillLevel(m,options){
  const {characterId,round,level}=options,info=ascendedInnerPillLevelInfo(m,{characterId}),reasons=[...info.reasons];
  if(Object.keys(options).some(k=>!['characterId','round','level'].includes(k)))reasons.push('入體內丹等級只接受角色編號、結丹次序與等級。');
  const record=info.eligible&&Number.isSafeInteger(round)?info.records[round-1]:undefined;
  if(info.eligible&&!record)reasons.push(`結丹次序須為 1–${info.ascensions} 的整數。`);
  if(record)reasons.push(...record.reasons.map(r=>'入體內丹等級：'+r));
  if(record?.eligible&&(!Number.isSafeInteger(level)||level<1||level>record.max))reasons.push(`入體內丹等級須為 1–${record.max} 的整數。`);
  if(reasons.length)return {...info,round,level,record,reasons,changes:[],canApply:false};
  const changes=level===record.current?[]:[{coordinate:record.coordinate,before:record.current,after:level,label:`${get(m,C(characterId,1,2))}・第 ${round} 次入體內丹・${record.name}等級`}];
  return {...info,round,level,record,reasons,changes,unchanged:!changes.length,canApply:info.verified&&!!changes.length};
 }
 function setAscendedInnerPillLevel(m,options){
  const preview=previewAscendedInnerPillLevel(m,options);
  if(preview.reasons.length)throw Error(preview.reasons.join('；'));
  if(!preview.verified)throw Error('入體內丹等級尚未完成隔離遊戲驗證。');
  if(!preview.changes.length)return preview;
  const previous=m.currentGroup;m.currentGroup=`inner-pill:17:${preview.record.row}`;
  try{transaction(m,()=>put(m,preview.record.coordinate,preview.level,preview.changes[0].label),`${preview.record.name}入體等級調整`);}finally{m.currentGroup=previous;}
  return preview;
 }
 // Backpack relic attributes (relicAttributes). 获得灵物 draws c_i=b_i×random(0.6,1) from lw y6–10, splits one total G by
 // c_i/Σc and rounds each share to 0.1 (z18 y5–9); y10 is the rounded mean. Five values are accepted only together, and only
 // when a witness (G, c) reproduces every share with the game's own expressions; template, quality and level stay fixed.
