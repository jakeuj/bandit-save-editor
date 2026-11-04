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
  const witnesses=[],sources=[{source:'recruitment',ranges:rules.ranges[quality-1]}],within=(v,r)=>v>=r[0]&&v<=r[1];
  if(rules.initial?.quality===quality)sources.push({source:'initial',ranges:rules.initial.ranges});
  for(let orientation=0;orientation<4;orientation++){
   const aptitude=skillCapAptitudeWitness(quality,raw,orientation);if(!aptitude)continue;
   const selected=talents.map(id=>rules.talents[id]);
   if(quality!==1&&selected.some(t=>orientation===3?!['生产','通用'].includes(t.category):![rules.orientations[orientation],'通用'].includes(t.orientation)))continue;
   for(const {source,ranges} of sources)for(let primary=1;primary<=9;primary++){
    if(!within(caps[primary-1],ranges.primary)||selected.some(t=>t.excludedPrimary.includes(primary)))continue;
    for(let secondary=1;secondary<=9;secondary++)if(primary!==secondary&&caps.every((v,i)=>within(v,i+1===primary?ranges.primary:i+1===secondary?ranges.secondary:ranges.base)))witnesses.push({...aptitude,orientation:quality===1?'通用':rules.orientations[orientation],primary,secondary,source});
   }
  }
  return witnesses;
 }
 function skillCapWitnessVerified(witnesses){return witnesses.some(w=>w.source==='recruitment'||w.source==='initial'&&KNOWLEDGE.verification.randomCharacterSkillCapsInitial);}
 function skillCapsCharacterInfo(m,{characterId},advanced=false){
  const reasons=[],verified=!!KNOWLEDGE.verification.randomCharacterSkillCaps&&(!advanced||!!KNOWLEDGE.verification.randomCharacterSkillCapsAdvanced),info={characterId,verified,eligible:false,reasons,skills:[],witnesses:[],advanced};
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
   if(advanced){
    if(info.skills.some(s=>s.cap>100))throw Error('進階技藝上限只支援目前九項均在 1–100 的角色。');
   }else{
    info.witnesses=skillCapCombinations(info.quality,info.raw,info.talents,info.talentLevels,info.skills.map(s=>s.cap));
    if(!info.witnesses.length)throw Error('目前九上限與固定基礎資質／三槽天賦沒有原版共同生成見證；可切換進階 1–100 模式。');
    info.verified &&= skillCapWitnessVerified(info.witnesses);
   }
   info.eligible=true;
  }catch(e){reasons.push(e.message);}
  return info;
 }
 function randomCharacterSkillCapsInfo(m,options){return skillCapsCharacterInfo(m,options);}
 function randomCharacterSkillCapsAdvancedInfo(m,options){return skillCapsCharacterInfo(m,options,true);}
 const skillCapPreviews=new WeakMap();
 function skillCapPreviewState(m,characterId){
  // Small dependency signature also detects direct changes to public parsed input, not only named transactions.
  const row=Number.isSafeInteger(characterId)&&characterId>0&&characterId<m.original.size[0]?m.original.data[characterId]:null;
  return JSON.stringify([KNOWLEDGE.randomCharacterSkillCaps,KNOWLEDGE.verification,row?.map(v=>[v[2],v[12],v[16]]),[...m.changes],m.revision]);
 }
 function previewSkillCaps(m,options,advanced=false){
  const {characterId,caps}=options,info=skillCapsCharacterInfo(m,{characterId},advanced),reasons=[...info.reasons];
  if(Object.keys(options).some(k=>!['characterId','caps'].includes(k)))reasons.push('技藝上限只接受角色編號與完整九項數值。');
  if(!Array.isArray(caps)||caps.length!==9||Array.from(caps).some(v=>!Number.isSafeInteger(v)))reasons.push('請輸入完整九項上限安全整數。');
  if(advanced&&Array.isArray(caps)&&Array.from(caps).some(v=>v<1||v>100))reasons.push('進階技藝上限須為 1–100 的整數。');
  let rows=[],changes=[],witnesses=[];
  if(info.eligible&&!reasons.length){
   if(!advanced){
    witnesses=skillCapCombinations(info.quality,info.raw,info.talents,info.talentLevels,caps);
    if(!witnesses.length)reasons.push('目標九上限與固定基礎資質／天賦沒有共同生成見證。');
    info.verified &&= skillCapWitnessVerified(witnesses);
   }
   rows=info.skills.map((s,i)=>{
    const rowReasons=[];
    if(caps[i]<s.level)rowReasons.push(`${s.name}目標上限 ${caps[i]} 不得低於目前等級 ${s.level}；請提高上限。`);
    if(caps[i]<s.cap&&caps[i]===s.level&&s.experience>0)rowReasons.push(`${s.name}目標上限 ${caps[i]} 等於目前等級 ${s.level}，下調時仍有經驗餘額 ${s.experience}；不自動清零，請設為 ${s.level+1} 以上。`);
    reasons.push(...rowReasons);
    return {id:s.id,name:s.name,before:{cap:s.cap,level:s.level,experience:s.experience},after:{cap:caps[i],level:s.level,experience:s.experience},reasons:rowReasons};
   });
   changes=rows.filter(r=>r.before.cap!==r.after.cap).map(r=>({id:r.id,name:r.name,before:r.before.cap,after:r.after.cap}));
  }
  const result={...info,reasons,rows,changes,witnesses,unchanged:rows.length===9&&!changes.length,canApply:info.verified&&!reasons.length&&!!changes.length,restoreScope:'此角色全部九項技藝上限、等級與經驗餘額會一起還原'};
  skillCapPreviews.set(result,{model:m,advanced,request:JSON.stringify(options),snapshot:batchSnapshot(m),state:skillCapPreviewState(m,characterId)});
  return result;
 }
 function previewCharacterSkillCaps(m,options){return previewSkillCaps(m,options);}
 function previewCharacterSkillCapsAdvanced(m,options){return previewSkillCaps(m,options,true);}
 function applySkillCaps(m,options,{preview}={},advanced=false){
  const prior=preview&&skillCapPreviews.get(preview);
  if(!prior||prior.model!==m||prior.advanced!==advanced||prior.request!==JSON.stringify(options))throw Error('技藝上限預覽不相符，請重新預覽。');
  assertBatchCurrent(m,prior.snapshot);
  if(prior.state!==skillCapPreviewState(m,options.characterId))throw Error('技藝上限輸入、模型或規則已改變，請重新預覽。');
  const checked=previewSkillCaps(m,options,advanced);
  if(checked.reasons.length)throw Error(checked.reasons.join('；'));
  if(!checked.verified)throw Error('一般隨機角色技藝上限尚未完成獨立隔離驗證。');
  if(!checked.unchanged){
   const previous=m.currentGroup;m.currentGroup=`skill-growth:${options.characterId}`;
   try{transaction(m,()=>{activateSkillGroup(m,options.characterId);for(const change of checked.changes)put(m,C(options.characterId,21+change.id,2),change.after,`${get(m,C(options.characterId,1,2))}・${change.name}上限`);},'九項技藝上限調整');}finally{m.currentGroup=previous;}
  }
  skillCapPreviews.delete(preview);
  return checked;
 }
 function setCharacterSkillCaps(m,options,context){return applySkillCaps(m,options,context);}
 function setCharacterSkillCapsAdvanced(m,options,context){return applySkillCaps(m,options,context,true);}
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
