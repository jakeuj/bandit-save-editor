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
 const characterAptitudeReader=createCharacterAptitudeSource({
  KNOWLEDGE,get,C,catalogMaps,backupSetAptitudeRows,inBackupSet,backupSetAptitudeReason,
  activeCharacter,ordinaryEquipment,affixOverLimitAccepted,sixthAffixAccepted,
  ascensionCoefficient,aptitudeAttribute
 });
 function ascensionRecord(m,characterId){return characterAptitudeReader.record(m,characterId);}
 function characterAptitudeSource(m,characterId,aptitude,baseRaw,ascended=false){return characterAptitudeReader.source(m,characterId,aptitude,baseRaw,ascended);}
 // Decimal pill bonus (pillAptitudeBonusDecimal): native B may carry .5 clamp endpoints or float tails; input uses a 0.1 grid.
 const decimalPills=()=>!!KNOWLEDGE.verification.pillAptitudeBonusDecimal;
 const pillBonusReadable=bonus=>decimalPills()?typeof bonus==='number'&&Number.isFinite(bonus)&&bonus>=0:Number.isSafeInteger(bonus)&&bonus>=0;
 const pillGrid=bonus=>Number.isSafeInteger(bonus)?bonus:Math.round(bonus*10)/10;
 function assertPillBonusReadable(bonus){if(!pillBonusReadable(bonus))throw Error(decimalPills()?'丹藥增量須為非負有限數值。':'丹藥增量須為非負整數；既有小數增量保持唯讀。');}
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
