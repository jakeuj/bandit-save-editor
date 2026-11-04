 const RELIC_ELEMENTS=['金','木','水','火','土'];
 const relicTotal=(L,R)=>Math.round(((10*5)*(1+(L*0.2)))*(R/100))/10;
 const relicShare=(G,c,i)=>Math.round((10*G)*(c[i]/((((c[0]+c[1])+c[2])+c[3])+c[4])))/10;
 const relicAverage=a=>Math.round(10*(((((a[0]+a[1])+a[2])+a[3])+a[4])/5))/10;
 function relicWitness(bases,G,k){
  // Normalised shares u_i=c_i·t must sit in their rounding cell and in the random box; Σu=1 picks t (1/Σc).
  const e=1e-9,lo=k.map(n=>(n-0.5)/(10*G)+e),hi=k.map(n=>(n+0.5)/(10*G)-e),boxLo=t=>bases.map(b=>0.6*b*t*(1+e)),boxHi=t=>bases.map(b=>b*t*(1-e));
  const low=t=>boxLo(t).map((v,i)=>Math.max(v,lo[i])),high=t=>boxHi(t).map((v,i)=>Math.min(v,hi[i])),sum=a=>a.reduce((s,v)=>s+v,0);
  const tMin=Math.max(...bases.map((b,i)=>lo[i]/(b*(1-e)))),tMax=Math.min(...bases.map((b,i)=>hi[i]/(0.6*b*(1+e))));
  if(!(tMin<=tMax)||sum(low(tMin))>1||sum(high(tMax))<1)return null;
  const search=(ok,from,to)=>{for(let n=0;n<80;n++){const mid=(from+to)/2;if(ok(mid))to=mid;else from=mid;}return to;};
  const t1=sum(high(tMin))>=1?tMin:search(t=>sum(high(t))>=1,tMin,tMax),t2=sum(low(tMax))<=1?tMax:tMax-search(s=>sum(low(tMax-s))<=1,0,tMax-tMin);
  if(t1>t2)return null;
  const t=(t1+t2)/2,a=low(t),z=high(t),span=sum(z)-sum(a),f=span>0?(1-sum(a))/span:0,c=a.map((v,i)=>(v+f*(z[i]-v))/t),ratios=c.map((v,i)=>v/bases[i]);
  if(ratios.some(r=>!(r>=0.6&&r<1))||k.some((n,i)=>Math.round(relicShare(G,c,i)*10)!==n))return null;
  return {total:G,ratios};
 }
 function relicTotals(level,quality){
  const min=relicTotal(level,80+30*(quality-1)),max=relicTotal(level,80+30*quality-1e-9);
  return Array.from({length:Math.round(max*10)-Math.round(min*10)+1},(_,n)=>(Math.round(max*10)-n)/10);
 }
 // Five roundings move the sum at most 0.25 away from the total, so only a few totals need a witness search.
 function relicSearch(info,k){const sum=k.reduce((s,n)=>s+n,0);for(const G of info.totals){if(Math.abs(G*10-sum)>2.5+1e-9)continue;const w=relicWitness(info.bases,G,k);if(w)return w;}return null;}
 function listRelics(m){
  const rows=[];
  // The game finds relics by template (y1); y0 keeps the row 获得灵物 used and goes stale after 取下灵物 returns it elsewhere.
  for(let x=1;x<m.original.size[0];x++)if(catalogMaps.relics.has(get(m,C(x,1,18))))rows.push({id:x,name:catalogName('relics',get(m,C(x,1,18))),quality:get(m,C(x,4,18)),level:get(m,C(x,2,18))});
  return rows;
 }
 // Row checks and presets shared by backpack (z18) and placed (z19) relics; holder(record) rejects rows outside the caller's scope.
 function relicRowInfo(m,itemId,z,{flag,empty,holder}){
  if(!Number.isSafeInteger(itemId)||itemId<1||itemId>=m.original.size[0])throw Error('無效的靈物列號。');
  const record=Array.from({length:14},(_,y)=>get(m,C(itemId,y,z)));
  if(!record[1])throw Error(empty);
  const relic=catalogMaps.relics.get(record[1]),bases=relic?.bases;
  if(!Number.isSafeInteger(record[0])||record[0]<1)throw Error('靈物列號資料不符。');
  if(!Array.isArray(bases)||bases.length!==5||!bases.every(b=>typeof b==='number'&&Number.isFinite(b)&&b>0))throw Error('此靈物範本的五行基底尚未核對。');
  const level=record[2],quality=record[4],values=record.slice(5,10);
  if(!Number.isSafeInteger(level)||level<0||level>1000||!Number.isSafeInteger(quality)||quality<1||quality>6)throw Error('靈物品質或等級不在已核對範圍。');
  const extra=holder(record);
  if(!values.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)||typeof record[10]!=='number'||!Number.isFinite(record[10]))throw Error('現有五行或平均值不是有效數值。');
  const totals=relicTotals(level,quality);
  const info={itemId,z,record,template:record[1],name:relic.name,category:relic.category,level,quality,bases,elements:RELIC_ELEMENTS,values,average:record[10],totals,total:{min:totals.at(-1),max:totals[0]},verified:!!KNOWLEDGE.verification[flag],...extra};
  // Natural rolls at the largest total: equal ratios keep the base proportions; one element near its full base with the
  // others near 60% is about the highest that element can roll. random(0.6,1) never reaches 1, so each preset steps
  // inside the box until the witness search accepts it.
  const roll=(G,i,hi,rest)=>{for(const d of [1e-6,1e-4,1e-2]){const c=bases.map((b,j)=>b*(j===i?hi-d:rest+d)),a=c.map((_,n)=>relicShare(G,c,n));if(relicSearch(info,a.map(v=>Math.round(v*10))))return a;}return null;};
  info.proportional=roll(totals[0],-1,0,0.8);info.focused=bases.map((_,i)=>roll(totals[0],i,1,0.6));
  info.ranges=bases.map((_,i)=>({min:roll(totals.at(-1),i,0.6+2e-2,1-2e-2)?.[i]??null,max:info.focused[i]?.[i]??null}));
  const k=values.map(v=>Math.round(v*10));
  info.natural=values.every((v,i)=>Math.abs(v*10-k[i])<1e-8)&&!!relicSearch(info,k)&&relicAverage(values)===record[10];
  return info;
 }
 function relicRowPreview(info,values,label){
  if(!Array.isArray(values)||values.length!==5)throw Error('請輸入金、木、水、火、土五項數值。');
  const k=values.map(v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e6||Math.abs(v*10-Math.round(v*10))>1e-8)throw Error('五行數值須為非負數，最多一位小數。');return Math.round(v*10);});
  // Re-entering a displayed value keeps the native token.
  const after=k.map((n,i)=>Math.round(info.values[i]*10)===n?info.values[i]:n/10),unchanged=after.every((v,i)=>Object.is(v,info.values[i]));
  const witness=relicSearch(info,k);
  if(!unchanged&&!witness)throw Error(`這組五行無法由原版生成：同一總靈氣（${info.total.min}–${info.total.max}）須依基底比例 ${info.bases.join('：')} 分配，每項可在基底的 60%–100% 間浮動。`);
  const average=unchanged?info.average:relicAverage(after),{itemId,z}=info;
  const changes=[...after.flatMap((v,i)=>Object.is(v,info.values[i])?[]:[{coordinate:C(itemId,5+i,z),before:info.values[i],after:v,label:`${label}・${RELIC_ELEMENTS[i]}`}]),...(Object.is(average,info.average)?[]:[{coordinate:C(itemId,10,z),before:info.average,after:average,label:`${label}・平均靈氣`}])];
  return {itemId,name:info.name,before:info.values,after,average:{before:info.average,after:average},witness,changes,unchanged,verified:info.verified};
 }
 function relicRowWrite(m,preview,group,operation){
  const previous=m.currentGroup;m.currentGroup=group;
  try{transaction(m,()=>{for(const c of preview.changes)put(m,c.coordinate,c.after,c.label);},operation);}finally{m.currentGroup=previous;}
  return preview;
 }
 function relicAttributesInfo(m,{itemId}){
  return relicRowInfo(m,itemId,18,{flag:'relicAttributes',empty:'此列沒有背包靈物。',holder:r=>{if(r[12]!==0)throw Error('此靈物仍記錄擺放建築，請先在遊戲中取下。');return {};}});
 }
 function previewRelicAttributes(m,{itemId,values}){
  const info=relicAttributesInfo(m,{itemId});
  return relicRowPreview(info,values,`背包靈物 #${itemId}・${info.name}`);
 }
 function setRelicAttributes(m,{itemId,values}){
  const preview=previewRelicAttributes(m,{itemId,values});
  if(!preview.verified)throw Error('靈物五行調整尚未完成隔離遊戲驗證。');
  return relicRowWrite(m,preview,`relic:${itemId}`,`背包靈物 #${itemId}・五行調整`);
 }
 // Placed relics (placedRelicAttributes). 摆放灵物 moves the whole z18 row into the first free z19 row and links both ways:
 // building z1 y9 = z19 row, z19 y12 = building. Only 置物台 (template 67) offers the action, and 刷新地块灵气 adds
 // round(10·a·(1+0.15L))/10 of each element (and of the y10 mean, as tile aura) to every tile in range on map entry,
 // placement, take-off, build and move; nothing caches it in the save. 取下灵物 carries y5–10 back to z18 unchanged.
 const RELIC_STAND=67;
 const relicAura=(a,L)=>Math.round((10*a)*(1+(L*0.15)))/10;
 const relicAuraOf=(values,average,L)=>({elements:values.map(a=>relicAura(a,L)),total:relicAura(average,L),factor:1+L*0.15});
 function listPlacedRelics(m){
  const rows=[];
  for(let x=1;x<m.original.size[0];x++)if(catalogMaps.relics.has(get(m,C(x,1,19))))rows.push({id:x,name:catalogName('relics',get(m,C(x,1,19))),quality:get(m,C(x,4,19)),level:get(m,C(x,2,19)),building:get(m,C(x,12,19))});
  return rows;
 }
 function placedRelicAttributesInfo(m,{itemId}){
  const g=c=>exists(m.original,c)?get(m,c):undefined;
  const info=relicRowInfo(m,itemId,19,{flag:'placedRelicAttributes',empty:'此列沒有擺放中的靈物。',holder:r=>{
   const b=r[12];
   if(!Number.isSafeInteger(b)||b<1||b>=m.original.size[0]||g(C(b,0,1))!==b)throw Error('此靈物記錄的建築不存在。');
   if(g(C(b,1,1))!==RELIC_STAND)throw Error('此靈物不在置物台上；原版只有置物台能擺放靈物。');
   if(g(C(b,9,1))!==itemId)throw Error('置物台與靈物的擺放紀錄沒有互相對應。');
   const level=g(C(b,5,1));if(!Number.isSafeInteger(level)||level<0||level>BUILDING_MAX_LEVEL)throw Error('置物台等級不是原版的 0–4 整數。');
   return {building:{id:b,level,x:g(C(b,2,1)),y:g(C(b,3,1))}};
  }});
  info.aura=relicAuraOf(info.values,info.average,info.building.level);
  return info;
 }
 function previewPlacedRelicAttributes(m,{itemId,values}){
  const info=placedRelicAttributesInfo(m,{itemId}),preview=relicRowPreview(info,values,`置物台 #${info.building.id}・${info.name}`);
  return {...preview,building:info.building,aura:{before:info.aura,after:relicAuraOf(preview.after,preview.average.after,info.building.level)}};
 }
 function setPlacedRelicAttributes(m,{itemId,values}){
  const preview=previewPlacedRelicAttributes(m,{itemId,values});
  if(!preview.verified)throw Error('置物台靈物五行調整尚未完成隔離遊戲驗證。');
  return relicRowWrite(m,preview,`relic:placed:${itemId}`,`置物台 #${preview.building.id}・靈物五行調整`);
 }
 // City wall enhancement level (wallEnhancementLevel). 城墙升级 adds one to [19,1,0] while it is below 城墙强化上限
 // (int(z1 #0 y5)+1)×60 and never touches the current wall HP z1 #0 y11; regeneration (+1%/s) and 采集核心 healing only run
 // below 城墙最大生命 and stop there, and nothing lowers HP above it. Max HP also multiplies by (100+加成属性效果(25))/100,
 // which depends on technologies and stationed characters, so lowering the level caps HP at the bonus-free maximum: never
 // above the real one, and the game regenerates the rest. Raising leaves HP as 城墙升级 does.
