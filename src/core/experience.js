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
  else if(kind==='inventory'){for(const z of [7,9,ARMORY].filter(z=>z<m.original.size[2]))for(let x=1;x<m.original.size[0];x++){const item=get(m,C(x,1,z));if(catalogMaps.items.has(item)&&get(m,C(x,0,z))>0)rows.push({id:x,z,name:catalogName('items',item),detail:`${z===9?'裝備庫／穿戴':planeName(z)}・品質 ${get(m,C(x,5,z))}・Lv ${get(m,C(x,6,z))}`});}}
  return rows;
 }
