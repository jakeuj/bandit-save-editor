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
