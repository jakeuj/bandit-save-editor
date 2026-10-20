/* Local save editing core. All unchanged source bytes are preserved. */
/**
 * @typedef {Object} FieldDescriptor
 * @property {string} id Zero-based x,y,z coordinate key.
 * @property {string} label
 * @property {string} category
 * @property {string} entity
 * @property {'string'|'integer'|'decimal'|'boolean'|'object'} type
 * @property {boolean} known
 * @property {boolean} editable Direct setField permission; growth uses addExperience.
 * @property {string} status
 * @property {string} reason Readonly or validation explanation.
 * @property {string} description
 * @property {Array<{x:number,y:number,z:number}>} related Linked fields, never implicit writes.
 * @property {Array<{function:string,sheet:string,sid:number,actionSid:number}>} source
 */
(() => {
 'use strict';
 const BASICS=[
  {name:'銅錢',x:1,y:2,z:0,description:'建設、升級與招募使用的主要貨幣。'},
  {name:'共用經驗',x:2,y:2,z:0,description:'可用於角色升級的共用經驗資源。'},
  {name:'魂魄',x:3,y:2,z:0,description:'遊戲獨立儲存的魂魄資源。'},
  {name:'科技點',x:4,y:2,z:0,description:'用於科技升級的點數。'},
  {name:'操練點',x:5,y:2,z:0,description:'用於操練的點數。'}
 ];
 const KNOWLEDGE=/*__KNOWLEDGE__*/null;
 const MATERIALS=KNOWLEDGE.catalogs.materials.map(m=>({...m,type:m.category}));
 const traditionalMap=Object.fromEntries([...('桦樺枫楓刚剛涧澗矿礦铁鐵铜銅银銀药藥萤螢云雲纹紋络絡雾霧隐隱参參泪淚兰蘭灵靈莲蓮阶階兽獸练練气氣婴嬰炼煉虚虛体體')].reduce((a,c,i,s)=>{if(i%2===0)a.push([c,s[i+1]]);return a;},[]));
 const trad=s=>String(s).replace(/./gu,c=>traditionalMap[c]||c);
 for(const m of MATERIALS){m.name=trad(m.name);m.type=trad(m.type);m.x=m.id;m.y=6;m.z=0;}
 const key=c=>`${c.x},${c.y},${c.z}`;
 const exists=(o,c)=>[c.x,c.y,c.z].every((n,i)=>Number.isInteger(n)&&n>=0&&n<o.size[i]);
 const cell=(o,c)=>o.data[c.x][c.y][c.z];
 function parse(text,name='save.dat'){
  if(typeof text!=='string'||text.length>50*1024*1024)throw Error('檔案過大或無法讀取，請選取遊戲 .dat 存檔。');
  let data;try{data=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error('這不是有效的 JSON 存檔，檔案可能損毀或格式不同。');}
  if(!data||data.c2array!==true||!Array.isArray(data.size)||data.size.length!==3||!data.size.every(n=>Number.isInteger(n)&&n>0)||!Array.isArray(data.data))throw Error('無法辨識：需要遊戲使用的三維陣列存檔。');
  const [nx,ny,nz]=data.size;
  if(nx<221||ny<60||nz<22||nx*ny*nz>30000000||data.data.length!==nx||data.data[0]?.[0]?.[1]!=='szmnqea')throw Error('此檔案不是支援的《塔防山賊模擬器》遊戲存檔。請勿選取 saveinfo.dat。');
  for(const plane of data.data){if(!Array.isArray(plane)||plane.length!==ny)throw Error('存檔資料尺寸不一致。');for(const row of plane)if(!Array.isArray(row)||row.length!==nz||row.some(v=>v!==null&&typeof v==='object'))throw Error('存檔資料結構不完整。');}
  return {name,text,original:data,changes:new Map(),history:[]};
 }
 const get=(m,c)=>m.changes.get(key(c))?.value??cell(m.original,c);
 const catalogMaps=Object.fromEntries(Object.entries(KNOWLEDGE.catalogs).map(([k,v])=>[k,new Map(v.map(r=>[r.id,r]))]));
 const catalogName=(kind,id)=>catalogMaps[kind]?.get(id)?.name||`#${id}`;
 const SKILLS=['伐木','採礦','種植','鍛造','工藝','煉丹','建造','研究','操練'];
 const evidenceIndex=new Map();
 for(const e of KNOWLEDGE.evidence){const k=`${e.z},${e.y}`;if(!evidenceIndex.has(k))evidenceIndex.set(k,[]);evidenceIndex.get(k).push(e);}
 const C=(x,y,z)=>({x,y,z});
 const activeCharacter=(m,x)=>Number.isInteger(x)&&x>0&&exists(m.original,C(x,0,2))&&typeof get(m,C(x,1,2))==='string'&&get(m,C(x,0,2))>0;
 /** @returns {FieldDescriptor} */
 function resolveField(m,c){
  if(!exists(m.original,c))throw Error('座標超出這份存檔的範圍。');
  const {x,y,z}=c,value=get(m,c),plane=KNOWLEDGE.planes[z];
  let f={...c,id:key(c),label:'未辨識欄位',category:plane?.name||'未知層',entity:'',type:typeof value==='number'?(Number.isInteger(value)?'integer':'decimal'):typeof value,editable:false,known:false,status:'未辨識',reason:'未核實用途；圖鑑唯讀',description:'用途與關聯尚未查清。未知數值座標仍可由既有自訂欄位手動輸入整數。',related:[],source:[]};
  const named=(label,extra={})=>{f={...f,label,known:true,status:'程式證據',reason:'關聯資料／第一版唯讀',...extra};};
  const basic=BASICS.find(b=>key(b)===key(c));
  if(basic)named(basic.name,{type:'integer',min:0,editable:true,status:'既有功能',reason:''});
  else if(z===0&&y===6&&catalogMaps.materials.has(x))named(catalogName('materials',x),{entity:`材料 #${x}`,type:'integer',min:0,editable:true,status:'既有功能',reason:''});
  else if(key(c)==='1,1,0')named('山寨名稱',{type:'string',maxLength:6,verification:'names',editable:!!KNOWLEDGE.verification.names,reason:'名稱群組尚待遊戲驗證'});
  else if(z===0&&y===1){const labels={0:'存檔識別',2:'山寨等級',4:'目前地圖',6:'商店刷新時間',7:'引導任務編號',8:'山寨總聲望',12:'存檔年份',13:'存檔天數',14:'存檔小時',15:'累計遊玩秒數',19:'城牆等級',22:'支援者禮包紀錄'};if(labels[x])named(labels[x]);}
  else if(z===0&&y===17&&x===1)named('招募刷新倒數（秒）',{type:'decimal'});
  else if(z===0&&[4,13].includes(y)&&catalogMaps.technologies.has(x))named(y===4?'科技等級':'科技研究狀態',{entity:catalogName('technologies',x)});
  else if(z===0&&y===5&&catalogMaps.professions.has(x))named('職業操練上限',{entity:catalogName('professions',x)});
  else if(z===2&&activeCharacter(m,x)){
   f.entity=get(m,C(x,1,2));
   const labels={0:'角色序號',1:'角色名稱',2:'角色範本',3:'角色等級',4:'角色經驗餘額',6:'目前職業',10:'力量資質',11:'敏捷資質',12:'智力資質',50:'重生階段',51:'性別',56:'共用池購買等級已花經驗',59:'自動轉職預設'};
   if(labels[y])named(labels[y],y===1?{type:'string',maxLength:6,verification:'names',editable:!!KNOWLEDGE.verification.names,reason:'名稱群組尚待遊戲驗證'}:{});
   if(y>=22&&y<=30)named(`${SKILLS[y-22]}等級上限`);
   if(y>=31&&y<=39)named(`${SKILLS[y-31]}等級`);
   if(y>=40&&y<=48)named(`${SKILLS[y-40]}經驗餘額`);
  }else if([4,5].includes(z)&&activeCharacter(m,x)&&catalogMaps.professions.has(y))named(z===4?'職業等級':'職業經驗餘額',{entity:`${get(m,C(x,1,2))}・${catalogName('professions',y)}`,type:z===5?'decimal':'integer'});
  else if(z===12){named(`衍生屬性：${catalogName('attributes',y)}`,{entity:activeCharacter(m,x)?get(m,C(x,1,2)):`角色 #${x}`,type:'decimal'});}
  else if([7,9].includes(z)){
   const labels={0:'物品實體序號',1:'物品範本',2:'物品數量／旗標',3:'物品等階',4:'物品狀態',5:'品質',6:'物品等級',7:'裝備歸屬／狀態',8:'特定主屬性',23:'原始品質',24:'物品狀態 24'};
   if(labels[y])named(labels[y],{entity:catalogName('items',get(m,C(x,1,z)))});
   else if(y>=9&&y<=14)named(`裝備詞條 #${y-8}`,{entity:catalogName('items',get(m,C(x,1,z)))});
   else if(y>=15&&y<=20)named(`裝備詞條係數 #${y-14}`,{type:'decimal',entity:catalogName('items',get(m,C(x,1,z)))});
  }else if(z===15)named(`任務記錄欄位 ${y}`,{entity:catalogName('quests',x)});
  else if([1,6,10,11,13,16,17,18,19,20,21].includes(z))named(`${plane.name}・欄位 ${y}`,{entity:`資料 #${x}`});
  f.source=(evidenceIndex.get(`${z},${y}`)||evidenceIndex.get(`${z},*`)||[]).filter(e=>e.x==='*'||e.x===x).slice(0,4).map(e=>({function:e.function,sheet:e.sheet,sid:e.sid,actionSid:e.actionSid}));
  if(f.known&&f.editable&&f.verification)f={...f,status:'遊戲驗證',reason:''};
  if(f.known)f.description='已定位此資料的用途；關聯狀態與進程仍由遊戲管理。';
  if(basic)f.description=basic.description;
  if(z===0&&y===6&&f.known)f.description='材料數量；直接增加不扣除取得成本。';
  if(f.verification==='names')f.description='繁中介面名稱，1–6 個 UTF-16 字元，不含 ASCII 空格或控制字元。';
  if(z===2&&activeCharacter(m,x)){
   if([3,4,50].includes(y)){f.description='自然經驗逐級結算；上限為（重生階段向下取整 + 1）× 30。不扣共用池、不增加退款基數。';f.related=[C(x,3,2),C(x,4,2),C(x,50,2)];}
   if(y===56)f.description='由共用池購買等級已投入的經驗，供遣散／重生退款計算；不是自然經驗累計值。';
   if(y>=22&&y<=48){const k=y<=30?y-21:y<=39?y-30:y-39;f.description='九項技藝依個別角色上限結算；增加經驗不修改技藝上限。';f.related=[C(x,21+k,2),C(x,30+k,2),C(x,39+k,2)];}
  }
  if([4,5].includes(z)&&f.known){f.description='職業必須已習得；依職業等階計算需求，上限為 min(30, 操練上限)。自動轉職啟用時禁止增加。';f.related=[C(x,y,4),C(x,y,5),C(y,5,0),C(x,59,2)];}
  if(f.related.length&&![50,56,59].includes(y)&&((z===2&&[3,4].includes(y))||(z===2&&y>=31&&y<=48)||[4,5].includes(z)))f.reason='請由角色養成增加經驗，等級與餘額一起結算';
  if(z===12)f.description='屬性與其他角色狀態相關；遊戲另在暫存物件重算數值，第一版不直接寫入。';
  if([7,9].includes(z)&&f.known)f.description='物品實體的原始資料；詞條、係數、背包位置與穿戴歸屬需一起核實，第一版唯讀。';
  return f;
 }
 function put(m,c,value,label){
  if(Object.is(get(m,c),value))return;
  const old=cell(m.original,c);if(Object.is(value,old)||value===old)m.changes.delete(key(c));else m.changes.set(key(c),{...c,original:old,value,label:label||labelFor(m.original,c),operation:m.currentOperation||null,group:m.currentGroup||null});
 }
 function setField(m,c,value,label){
  const f=resolveField(m,c);
  if(!f.editable)throw Error(`${f.label}目前唯讀：${f.reason}`);
  if(f.type==='string'){
   if(typeof cell(m.original,c)!=='string')throw Error('此存檔的欄位型別與知識不相符，已停止修改。');
   if(typeof value!=='string'||value.length<1||value.length>f.maxLength||value.includes(' ')||/[\u0000-\u001f\u007f]/.test(value))throw Error(`名稱須為 1–${f.maxLength} 個 UTF-16 字元，且不能包含 ASCII 空格或控制字元。`);
  }else{
   if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER||(f.type==='integer'&&!Number.isSafeInteger(value)))throw Error('請輸入型別正確且在安全範圍內的數值。');
   if(f.min!==undefined&&value<f.min||f.max!==undefined&&value>f.max)throw Error('數值超出欄位允許範圍。');
   if(typeof cell(m.original,c)!=='number')throw Error('此存檔的欄位型別與知識不相符，已停止修改。');
  }
  put(m,c,value,label||[f.entity,f.label].filter(Boolean).join('・'));
 }
 function set(m,c,value,label){
  if(!exists(m.original,c))throw Error('座標超出這份存檔的範圍。');
  const f=resolveField(m,c);
  if(f.known)return setField(m,c,value,label);
  if(typeof cell(m.original,c)!=='number')throw Error('此欄位不是數值，無法以資源數量修改。');
  if(!Number.isSafeInteger(value))throw Error('請輸入安全範圍內的整數（絕對值最多 9,007,199,254,740,991）。');
  if((BASICS.some(b=>key(b)===key(c))||(c.y===6&&c.z===0&&MATERIALS.some(b=>b.x===c.x)))&&value<0)throw Error('資源數量不能小於 0。');
  put(m,c,value,label);
 }
 function transaction(m,fn,label){if(m.inTransaction){const previous=m.currentOperation;if(label&&!previous){m.operationCounter=(m.operationCounter||0)+1;m.currentOperation=`${m.operationCounter}：${label}`;}try{return fn();}finally{m.currentOperation=previous;} }const before=new Map(m.changes);m.inTransaction=true;if(label){m.operationCounter=(m.operationCounter||0)+1;m.currentOperation=`${m.operationCounter}：${label}`;}try{fn();}catch(e){m.changes=before;throw e;}finally{m.currentOperation=null;m.inTransaction=false;}if(JSON.stringify([...before])!==JSON.stringify([...m.changes])){m.history.push(before);if(m.history.length>100)m.history.shift();}}
 function undo(m){if(m.history.length)m.changes=m.history.pop();}
 function restore(m,c){transaction(m,()=>{const change=m.changes.get(key(c)),group=change?.group,op=change?.operation;if(group)for(const [k,v]of m.changes){if(v.group===group)m.changes.delete(k);}else if(op)for(const [k,v]of m.changes){if(v.operation===op)m.changes.delete(k);}else m.changes.delete(key(c));});}
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
  const previousGroup=m.currentGroup;m.currentGroup=`growth:${kind}:${characterId}:${id??0}`;
  try{transaction(m,()=>{put(m,info.level,level,`${get(m,C(characterId,1,2))}・${info.name}等級`);put(m,info.exp,exp,`${get(m,C(characterId,1,2))}・${info.name}經驗餘額`);},`${get(m,C(characterId,1,2))}・增加${info.name}經驗 ${amount}`);}finally{m.currentGroup=previousGroup;}
  return {level,experience:exp,levelsGained:level-info.currentLevel,cap:info.cap};
 }
 function listEntities(m,kind){
  const rows=[];
  if(kind==='characters'){for(let x=1;x<m.original.size[0];x++)if(activeCharacter(m,x))rows.push({id:x,name:get(m,C(x,1,2)),detail:`Lv ${get(m,C(x,3,2))}・${catalogName('professions',get(m,C(x,6,2)))}`,z:2});}
  else if(kind==='inventory'){for(const z of [7,9])for(let x=1;x<m.original.size[0];x++){const item=get(m,C(x,1,z));if(catalogMaps.items.has(item)&&get(m,C(x,0,z))>0)rows.push({id:x,z,name:catalogName('items',item),detail:`${z===7?'背包':'裝備庫／穿戴'}・品質 ${get(m,C(x,5,z))}・Lv ${get(m,C(x,6,z))}`});}}
  return rows;
 }
 function labelFor(o,c){
  const basic=BASICS.find(v=>key(v)===key(c));if(basic)return basic.name;
  if(c.y===6&&c.z===0){const mat=MATERIALS.find(v=>v.x===c.x);if(mat)return `${mat.name}（材料 #${mat.id}）`;}
  if(c.z===2&&c.y>=40&&c.y<=48){const name=o.data[c.x]?.[1]?.[2];return `${typeof name==='string'?name:`角色 #${c.x}`}・技藝經驗 #${c.y-39}`;}
  if(key(c)==='1,17,0')return '招募刷新倒數（秒）';
  if(key(c)==='14,1,0')return '存檔時間：時';
  if(key(c)==='15,1,0')return '累計遊玩時間（秒）';
  const f=resolveField({original:o,changes:new Map()},c);return [f.entity,f.label].filter(Boolean).join('・');
 }
 function diff(a,b){if(a.size.some((n,i)=>n!==b.size[i]))throw Error('兩份存檔的陣列尺寸不同，請比較相同遊戲版本的存檔。');const out=[];for(let x=0;x<a.size[0];x++)for(let y=0;y<a.size[1];y++)for(let z=0;z<a.size[2];z++){const before=a.data[x][y][z],after=b.data[x][y][z];if(!Object.is(before,after))out.push({x,y,z,before,after,label:labelFor(a,{x,y,z})});}return out;}
 function serialize(m){
  if(!m.changes.size)return m.text;
  const token=/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]/g;
  let match,level=0,stage=0,start=-1,previousToken='';
  while((match=token.exec(m.text))){const t=match[0];if(level===1&&t==='"data"'&&(previousToken==='{'||previousToken===',')){stage=1;continue;}if(stage===1){if(t!==':')throw Error('無法定位 data 欄位。');stage=2;continue;}if(stage===2){if(t!=='[')throw Error('存檔 data 欄位不是陣列。');start=match.index;break;}if(t==='{'||t==='[')level++;if(t==='}'||t===']')level--;previousToken=t;}
  if(start<0)throw Error('找不到存檔資料區域。');
  token.lastIndex=start;let depth=0;const pos=[0,0,0],patches=[];
  while((match=token.exec(m.text))){const t=match[0];if(t==='['){depth++;if(depth<=3)pos[depth-1]=0;}else if(t===']'){depth--;if(depth===0)break;}else if(t===','){pos[depth-1]++;}else if(depth===3){const k=pos.join(',');if(m.changes.has(k)){const change=m.changes.get(k);if(typeof JSON.parse(t)!==typeof change.value)throw Error('原始欄位型別不正確。');patches.push({start:match.index,end:token.lastIndex,value:JSON.stringify(change.value)});}}}
  if(patches.length!==m.changes.size)throw Error('部分修改座標未能定位，已停止匯出。');
  const parts=[];let previous=0;for(const p of patches){parts.push(m.text.slice(previous,p.start),p.value);previous=p.end;}parts.push(m.text.slice(previous));return parts.join('');
 }
 globalThis.SaveCore={BASICS,MATERIALS,KNOWLEDGE,SKILLS,key,exists,cell,parse,get,set,setField,resolveField,addExperience,growthInfo,experienceNeed,listEntities,catalogName,transaction,undo,restore,labelFor,diff,serialize};
})();
