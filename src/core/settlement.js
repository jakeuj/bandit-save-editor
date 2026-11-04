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
 // Basic technologies (basicTechnologyLevel). kj 1–30 are 0/1 unlocks (#29 武库 since V1.0.13.0, #30 备用装备 since V1.0.17.0;
 // both were empty rows): 科技等级上限 returns kj[id,5]=1 for 基础 rows. Every reader of [id,4,0] is a UI gate (build menu,
 // feature buttons, research page) or the research flow; building caps read the advanced techs only (jz column 34), #8 only
 // enables the expansion button and #30 only shows the two 换装 buttons (角色换装 itself reads no tech). Research completion
 // (采集核心碰撞) adds 1 without a cap check, so a tech under research is refused. Raising writes 1 and clears the research
 // points y12 as that completion does, unlocking the missing prerequisite chain (kj column 7) in the same step. Nothing lowers
 // a tech natively, so lowering is not offered; 初始化设置 starts every game with #1 and #2 at 1.
 const basicTechnologyIds=KNOWLEDGE.catalogs.technologies.filter(t=>t.id>=1&&t.id<=30&&!t.advanced&&Number.isSafeInteger(t.prerequisite)).map(t=>t.id);
 function basicTechnologiesInfo(m){
  if(basicTechnologyIds.length!==30)throw Error('知識目錄缺少基礎科技前置資料。');
  const technologies=basicTechnologyIds.map(id=>{
   const t=catalogMaps.technologies.get(id),level=get(m,C(id,4,0)),points=get(m,C(id,12,0)),flag=get(m,C(id,13,0));
   if(level!==0&&level!==1)throw Error(`${t.name}的科技等級不是 0 或 1。`);
   if(typeof points!=='number'||!Number.isFinite(points)||points<0)throw Error(`${t.name}的研究點數不是有效數值。`);
   if(flag!==0&&flag!==1)throw Error(`${t.name}的研究狀態不是 0 或 1。`);
   return {id,name:t.name,prerequisite:t.prerequisite,level,points,researching:flag===1||busyFacility(m,id,5)};
  });
  return {technologies,unlocked:technologies.filter(t=>t.level===1).length,verified:!!KNOWLEDGE.verification.basicTechnologyLevel};
 }
 function previewBasicTechnology(m,{technologyId}){
  const info=basicTechnologiesInfo(m),byId=new Map(info.technologies.map(t=>[t.id,t])),target=byId.get(technologyId);
  if(!target)throw Error('只支援基礎科技 1–30。');
  if(target.level===1)return {technology:{id:target.id,name:target.name},chain:[],changes:[],unchanged:true,verified:info.verified};
  const chain=[];
  for(let t=target;t&&t.level===0;t=byId.get(t.prerequisite)){if(chain.includes(t))throw Error('前置科技形成循環。');chain.unshift(t);}
  const busy=chain.filter(t=>t.researching);
  if(busy.length)throw Error(`${busy.map(t=>t.name).join('、')}正在研究，請先在遊戲內停止。`);
  const changes=chain.flatMap(t=>[{coordinate:C(t.id,4,0),before:0,after:1,label:`${t.name}・基礎科技`},...(t.points===0?[]:[{coordinate:C(t.id,12,0),before:t.points,after:0,label:`${t.name}・研究點數`}])]);
  return {technology:{id:target.id,name:target.name},chain:chain.map(t=>({id:t.id,name:t.name})),changes,unchanged:false,verified:info.verified};
 }
 function setBasicTechnology(m,options){
  const preview=previewBasicTechnology(m,options);
  if(!preview.verified)throw Error('基礎科技尚未完成隔離遊戲驗證。');
  if(preview.unchanged)return preview;
  // One group for every basic tech: restoring a prerequisite also restores the techs unlocked on top of it.
  const previous=m.currentGroup;m.currentGroup='technology:basic';
  try{transaction(m,()=>{for(const c of preview.changes)put(m,c.coordinate,c.after,c.label);},`${preview.technology.name}・基礎科技解鎖`);}finally{m.currentGroup=previous;}
  return preview;
 }
 // Building levels (buildingLevel). z1 row x: y1 template, y4 work left, y5 level (0 基础 … 4 大师), y7 occupant, y10 upgrading.
 // 建筑升阶 adds one to y5 when (advanced tech jz[t,34] + 1) ≥ (L+1)×60 (建筑满足检测) and the button only shows below 4; the
 // walls (row 0, template 21) rise at once, other rows after their work y4 runs out (建筑建造成功 adds one while y10=1). Every
 // reader computes live from y5: facility cap, barracks population, recruitment, 聚义厅 expansion, research／training caps,
 // crafting tiers, 置物台 spirit (re-run by OnLayoutStart), 破境值 and the wall caps. So only y5 is written, upward only.
 // Rows under construction or upgrade are refused (completion and refunds read y5), as are occupied rows (native upgrades
 // refuse 占用角色). 建造局 has no upgrade tech and no art past level 2, so it stays at 0 as in the game.
 const BUILDING_MAX_LEVEL=4,BUILDING_TECH_STEP=60;
 function buildingLevelsInfo(m){
  const g=c=>exists(m.original,c)?get(m,c):undefined,rows=[];
  for(let x=0;x<m.original.size[0];x++){
   const template=g(C(x,1,1)),building=catalogMaps.buildings.get(template);
   if(!building?.upgradeTechnology||(x===0?template!==21:g(C(x,0,1))!==x||template===21))continue;
   const level=g(C(x,5,1)),work=g(C(x,4,1)),upgrading=g(C(x,10,1)),occupant=g(C(x,7,1)),tech=g(C(building.upgradeTechnology,4,0));
   const row={x,template,name:building.name,level,technology:{id:building.upgradeTechnology,name:catalogName('technologies',building.upgradeTechnology),level:tech}};
   if(!Number.isSafeInteger(level)||level<0||level>BUILDING_MAX_LEVEL)row.reason='建築等級不是原版的 0–4 整數。';
   else if(typeof work!=='number'||!Number.isFinite(work)||work<0||![0,1].includes(upgrading))row.reason='施工資料不是原版數值。';
   else if(!Number.isSafeInteger(occupant)||occupant<0)row.reason='佔用角色欄位不是有效整數。';
   else if(!Number.isSafeInteger(tech)||tech<0)row.reason=`${row.technology.name}等級不是有效整數。`;
   else{
    row.cap=Math.min(BUILDING_MAX_LEVEL,Math.floor((tech+1)/BUILDING_TECH_STEP));
    if(upgrading===1)row.reason='升階中，請先在遊戲內完成或取消。';
    else if(work>0)row.reason='施工中，請先在遊戲內完成建造。';
    else if(occupant>0)row.reason='有角色佔用，請先在遊戲內移除。';
    else if(level>=BUILDING_MAX_LEVEL)row.reason='已是最高等級。';
    else if(row.cap<=level)row.reason=`${row.technology.name}需達 Lv ${(level+1)*BUILDING_TECH_STEP} 才能升到下一階。`;
   }
   rows.push(row);
  }
  return {rows,maxLevel:BUILDING_MAX_LEVEL,verified:!!KNOWLEDGE.verification.buildingLevel};
 }
 function previewBuildingLevel(m,{x,level}){
  const info=buildingLevelsInfo(m),row=info.rows.find(r=>r.x===x);
  if(!row)throw Error('只能調整已建造且可升階的建築（建造局與裝飾不在範圍）。');
  if(row.reason)throw Error(`${row.name}：${row.reason}`);
  if(!Number.isSafeInteger(level)||level<=row.level||level>row.cap)throw Error(`${row.name}等級只能升高，須為 ${row.level+1}–${row.cap} 的整數（上限依${row.technology.name} Lv ${row.technology.level}）。`);
  const group=row.template===21?'wall:enhancement':`building:${x}`;
  return {building:{x,template:row.template,name:row.name},level:{before:row.level,after:level},cap:row.cap,group,changes:[{coordinate:C(x,5,1),before:row.level,after:level,label:`${row.name} #${x}・建築等級`}],verified:info.verified};
 }
 function setBuildingLevel(m,options){
  const preview=previewBuildingLevel(m,options);
  if(!preview.verified)throw Error('建築等級尚未完成隔離遊戲驗證。');
  // The walls share the enhancement group: restoring either never leaves enhancement above the restored wall cap.
  const previous=m.currentGroup;m.currentGroup=preview.group;
  try{transaction(m,()=>{for(const c of preview.changes)put(m,c.coordinate,c.after,c.label);},`${preview.building.name}・建築等級調整`);}finally{m.currentGroup=previous;}
  return preview;
 }
 /** @returns {FieldDescriptor} */
