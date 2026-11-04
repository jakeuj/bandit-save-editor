 function resolveField(m,c){
  if(!exists(m.original,c))throw Error('座標超出這份存檔的範圍。');
  const {x,y,z}=c,value=get(m,c),plane=KNOWLEDGE.planes[z];
  let f={...c,id:key(c),label:'未辨識欄位',category:plane?.name||'未知層',entity:'',type:typeof value==='number'?(Number.isInteger(value)?'integer':'decimal'):typeof value,editable:false,known:false,status:'未辨識',reason:'未核實用途；圖鑑唯讀',description:'用途與關聯尚未查清。未知數值座標仍可由既有自訂欄位手動輸入整數。',related:[],source:[]};
  const named=(label,extra={})=>{f={...f,label,known:true,status:'程式證據',reason:'關聯資料／第一版唯讀',...extra};};
  const basic=BASICS.find(b=>key(b)===key(c));
  if(basic)named(basic.name,{type:'integer',min:0,editable:true,status:'既有功能',reason:''});
  else if(z===0&&y===6&&catalogMaps.materials.get(x)?.kind==='符文')named(catalogName('materials',x),{entity:`符文 #${x}`,type:'integer',reason:'符文數量與鑲嵌狀態由遊戲管理，尚未開放修改，唯讀'});
  else if(z===0&&y===6&&catalogMaps.materials.has(x))named(catalogName('materials',x),{entity:`材料 #${x}`,type:'integer',min:0,editable:true,status:'既有功能',reason:''});
  else if(key(c)==='1,1,0')named('山寨名稱',{type:'string',maxLength:6,verification:'names',editable:!!KNOWLEDGE.verification.names,reason:'名稱群組尚待遊戲驗證'});
  else if(z===0&&y===1){const labels={0:'存檔識別',2:'山寨等級',4:'目前地圖',6:'商店刷新時間',7:'引導任務編號',8:'山寨總聲望',12:'存檔年份',13:'存檔天數',14:'存檔小時',15:'累計遊玩秒數',19:'城牆等級',22:'支援者禮包紀錄',37:'武庫換裝模式'};if(labels[x])named(labels[x]);}
  else if(z===0&&y===17&&x===1)named('招募刷新倒數（秒）',{type:'decimal'});
  else if(z===0&&[11,21,38,44].includes(y)&&cityRows.has(x))named({11:'城市層數',21:'掛機層數',38:'佔領旗標',44:'首次進入旗標'}[y],{entity:cityRows.get(x),reason:'請使用城市層數具名操作；總聲望與掛機層數一起結算',related:[C(x,11,0),C(x,21,0),C(8,1,0)]});
  else if(z===0&&[4,12,13].includes(y)&&catalogMaps.technologies.has(x))named({4:'科技等級',12:'科技研究點數',13:'科技研究狀態'}[y],{entity:catalogName('technologies',x),...(basicTechnologyIds.includes(x)?{reason:'請使用基礎科技解鎖具名操作；前置科技與研究點數一起結算',related:[C(x,4,0),C(x,12,0),C(x,13,0)]}:{})});
  else if(z===0&&y===5&&catalogMaps.professions.has(x))named('職業操練上限',{entity:catalogName('professions',x)});
  else if(z===1&&[4,5,7,10,11].includes(y)&&(x===0?get(m,C(0,1,1))===21:get(m,C(x,0,1))===x&&catalogMaps.buildings.has(get(m,C(x,1,1))))&&(y!==11||x===0))named({4:'剩餘工程量',5:'建築等級',7:'佔用角色',10:'升階中旗標',11:'城牆目前生命'}[y],{entity:`${catalogName('buildings',get(m,C(x,1,1)))} #${x}`,reason:y===11?'請使用城牆強化等級具名操作；下調時一起結算':'請使用建築等級具名操作；只能升高，施工與升階中不修改',related:[C(x,4,1),C(x,5,1),C(x,10,1)]});
  else if(z===2&&y>=10&&y<=12)named(`${aptitudeNames[y-10]}基礎資質`,{reason:'請由角色養成的三項基礎資質具名操作修改；有名角色載入時會依範本回填',related:[10,11,12,13,14,15].map(y=>C(x,y,2)),verification:'randomCharacterBaseAptitudes'});
  else if(z===2&&y>=13&&y<=15)named(`${aptitudeNames[y-13]}丹藥累積增量`,{reason:'請由角色養成的丹藥增量具名操作修改；每 1 等於資質 0.1 點',related:[10,11,12,13,14,15].map(y=>C(x,y,2))});
  else if(z===2&&y>=22&&y<=48){const k=y<=30?y-21:y<=39?y-30:y-39;named(`${SKILLS[k-1]}${y<=30?'等級上限':y<=39?'等級':'經驗餘額'}`,{entity:activeCharacter(m,x)?get(m,C(x,1,2)):`角色 #${x}`,reason:y<=30?'技藝上限須使用九項具名預覽操作；有名角色依範本回填':'請由角色養成增加經驗，等級與餘額一起結算',related:skillModes(m).has(x)?Array.from({length:27},(_,i)=>C(x,22+i,2)):[C(x,21+k,2),C(x,30+k,2),C(x,39+k,2)]});}
  else if(z===2&&activeCharacter(m,x)){
   f.entity=get(m,C(x,1,2));
   const labels={0:'角色序號',1:'角色名稱',2:'角色範本',3:'角色等級',4:'角色經驗餘額',6:'目前職業',10:'力量資質',11:'敏捷資質',12:'智力資質',50:'重生階段',51:'性別',56:'共用池購買等級已花經驗',59:'自動轉職預設'};
   if(labels[y])named(labels[y],y===1?{type:'string',maxLength:6,verification:'names',editable:!!KNOWLEDGE.verification.names,reason:'名稱群組尚待遊戲驗證'}:{});
  }else if([4,5].includes(z)&&activeCharacter(m,x)&&catalogMaps.professions.has(y))named(z===4?'職業等級':'職業經驗餘額',{entity:`${get(m,C(x,1,2))}・${catalogName('professions',y)}`,type:z===5?'decimal':'integer'});
  else if(z===12&&[1,2,3,21,22,23].includes(y)){const k=y>20?y-20:y;named(`天賦 #${k}${y>20?'等級':'編號'}`,{entity:activeCharacter(m,x)?get(m,C(x,1,2)):`角色 #${x}`,type:'integer',reason:y>20?'請由角色養成的天賦等級具名預覽操作修改；有名角色依範本回填':'天賦 ID 依原版招募固定，不能更換',related:[1,2,3,21,22,23].map(y=>C(x,y,12))});}
  else if(z===12){named(`衍生屬性：${catalogName('attributes',y)}`,{entity:activeCharacter(m,x)?get(m,C(x,1,2)):`角色 #${x}`,type:'decimal'});}
  else if([7,9,22].includes(z)){
   const labels={0:'初始背包列號',1:'物品範本',2:'物品數量／旗標',3:'物品等階',4:'物品狀態',5:'品質',6:'物品等級',7:'裝備歸屬／狀態',8:'主屬性品質係數',22:'物品鎖定',23:'取得參數／套裝關聯值',24:'新取得標記',25:'未辨識物品狀態 25',26:'套裝關聯值 26',27:'套裝原物品資訊'};
   if(labels[y])named(labels[y],{entity:catalogName('items',get(m,C(x,1,z)))});
   else if(y>=9&&y<=14)named(`裝備詞條 #${y-8}`,{entity:catalogName('items',get(m,C(x,1,z)))});
   else if(y>=28&&y<=33)named(`洗練槽標記 #${y-27}`);
   else if(y>=15&&y<=20)named(`裝備詞條係數 #${y-14}`,{type:'decimal',entity:catalogName('items',get(m,C(x,1,z)))});
  }else if(z===15)named(`任務記錄欄位 ${y}`,{entity:catalogName('quests',x)});
  else if(z===16&&y>=1&&y<=16)named(y%2?`第 ${(y+1)/2} 次結丹品質`:`第 ${y/2} 次入體內丹列號`,{entity:activeCharacter(m,x)?get(m,C(x,1,2)):`角色 #${x}`,reason:'請使用角色養成的結丹品質具名操作；入體內丹係數一起結算'});
  else if(z===17)named(({1:'入體內丹範本',3:'入體內丹等階',5:'入體內丹品質',6:'入體內丹等級',7:'入體內丹歸屬角色',8:'入體內丹主屬性品質係數'})[y]||(y>=15&&y<=17?`${aptitudeNames[y-15]}上限係數`:`入體內丹欄位 ${y}`),{entity:catalogName('items',get(m,C(x,1,17))),reason:'入體後原生流程不再修改；結丹係數與等級請使用結丹品質面板的具名操作'});
  else if(z===BACKUP_SET)named(y===0?'目前套裝序號':y<=6?`備用套裝部位 ${y} 裝備列號`:`備用套裝欄位 ${y}`,{entity:activeCharacter(m,x)?get(m,C(x,1,2)):`角色 #${x}`,reason:'換裝由遊戲管理，裝備列號與穿戴歸屬需一起核實，唯讀'});
  else if(z===24)named(y===0?'精通職業選擇':catalogMaps.professions.has(y)?`${catalogName('professions',y)}符文編號`:`職業精通與符文欄位 ${y}`,{entity:activeCharacter(m,x)?get(m,C(x,1,2)):`角色 #${x}`,reason:'職業精通與符文鑲嵌由遊戲管理，尚未開放修改，唯讀'});
  else if([1,6,10,11,13,16,17,18,19,20,21].includes(z))named(`${plane.name}・欄位 ${y}`,{entity:`資料 #${x}`});
  f.source=(evidenceIndex.get(`${z},${y}`)||evidenceIndex.get(`${z},*`)||[]).filter(e=>e.x==='*'||e.x===x).slice(0,4).map(e=>({function:e.function,sheet:e.sheet,sid:e.sid,actionSid:e.actionSid}));
  if(f.known&&f.editable&&f.verification)f={...f,status:'遊戲驗證',reason:''};
  if(f.known)f.description='已定位此資料的用途；關聯狀態與進程仍由遊戲管理。';
  if(basic)f.description=basic.description;
  if(z===0&&y===6&&f.known)f.description=catalogMaps.materials.get(x)?.kind==='符文'?'符文庫存與鑲嵌狀態由遊戲管理，尚未開放修改，唯讀。':'材料數量；直接增加不扣除取得成本。';
  if(f.verification==='names')f.description='繁中介面名稱，1–6 個 UTF-16 字元，不含 ASCII 空格或控制字元。';
  if(z===2&&activeCharacter(m,x)){
   if([3,4,50].includes(y)){f.description='自然經驗逐級結算；上限為（重生階段向下取整 + 1）× 30。不扣共用池、不增加退款基數。';f.related=[C(x,3,2),C(x,4,2),C(x,50,2)];}
   if(y===56)f.description='由共用池購買等級已投入的經驗，供遣散／重生退款計算；不是自然經驗累計值。';
   if(y>=22&&y<=48){const k=y<=30?y-21:y<=39?y-30:y-39;f.description='九項技藝依個別角色上限結算；增加經驗不修改技藝上限。';f.related=skillModes(m).has(x)?Array.from({length:27},(_,i)=>C(x,22+i,2)):[C(x,21+k,2),C(x,30+k,2),C(x,39+k,2)];}
  }
  if([4,5].includes(z)&&f.known){f.description='職業必須已習得；依職業等階計算需求，上限為 min(30, 操練上限)。自動轉職啟用時禁止增加。';f.related=[C(x,y,4),C(x,y,5),C(y,5,0),C(x,59,2)];}
  if(f.related.length&&![50,56,59].includes(y)&&((z===2&&[3,4].includes(y))||(z===2&&y>=31&&y<=48)||[4,5].includes(z)))f.reason='請由角色養成增加經驗，等級與餘額一起結算';
  if(z===12&&![1,2,3,21,22,23].includes(y))f.description='屬性與其他角色狀態相關；遊戲另在暫存物件重算數值，第一版不直接寫入。';
  if([7,9,22].includes(z)&&f.known)f.description='物品實體的原始資料；詞條、係數、背包位置與穿戴歸屬需一起核實，第一版唯讀。';
  if(z===9&&y===6||z===0&&y===5&&catalogMaps.professions.has(x)||z===0&&y===4&&catalogMaps.technologies.get(x)?.advanced){
   const kind=z===9?'equipment':y===5?'training':'technology';
   try{const info=editingInfo(m,kind,x);f.status=info.verified?'遊戲驗證':'程式證據';f.reason='請使用具名修改操作；自訂座標不可繞過模式及關聯檢查';f.description=`一般上限 ${info.normalMax}；進階已驗證上限 ${info.advancedMax}。${kind==='training'?'職業自然成長仍受原版 30 級限制。':''}`;}catch(e){f.reason=e.message;}
  }
  return f;
 }
 function put(m,c,value,label){
  if(Object.is(get(m,c),value))return;
  m.revision=(m.revision||0)+1;
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
 // Transaction state includes the cumulative skill dependency mode, even after cap tokens return to baseline.
 const skillGrowthModes=new WeakMap(),historyStates=new WeakMap(),batchStages=new WeakSet();
 const skillModes=m=>skillGrowthModes.get(m)||new Set();
 function activateSkillGroup(m,characterId){
  const modes=new Set(skillModes(m));modes.add(characterId);skillGrowthModes.set(m,modes);
  for(const [k,v]of m.changes)if(v.x===characterId&&v.z===2&&v.y>=22&&v.y<=48)m.changes.set(k,{...v,group:`skill-growth:${characterId}`});
 }
 /**
  * 同步執行一筆可復原交易，原樣回傳 callback 的結果。
  * 最外層有變更才新增一筆歷史；巢狀交易合併到外層，同值操作不新增歷史。
  * callback 拋錯時還原 changes/history、版本戳、操作編號與私有技藝群組模式。
  * 回滾涵蓋核心管理的交易狀態，不包含直接改 original/text 或其他外部副作用。
  * @template T
  * @param {SaveModel} m
  * @param {function():T} fn 應為同步 callback，透過公開寫入操作改模型；不等待 Promise 或回滾非同步後續。
  * @param {string} [label] 外層操作標記；不取代既有累計群組。
  * @returns {T} fn 的原始回傳值。
  * @throws {*} fn 同步拋出的原始例外，回滾後重新拋出。
  */
 function transaction(m,fn,label){
  // Private batch staging already checkpoints each fixed target and discards the whole model on failure.
  if(batchStages.has(m))return fn();
  const nested=!!m.inTransaction,before=new Map(m.changes),modes=new Set(skillModes(m)),counter=m.operationCounter,revision=m.revision,operation=m.currentOperation,history=[...m.history];
  m.inTransaction=true;
  if(label&&!m.currentOperation){m.operationCounter=(m.operationCounter||0)+1;m.currentOperation=`${m.operationCounter}：${label}`;}
  let result,changed;
  try{
   result=fn();
   changed=JSON.stringify([...before])!==JSON.stringify([...m.changes])||JSON.stringify([...modes])!==JSON.stringify([...skillModes(m)]);
  }catch(e){m.changes=before;m.history=history;m.operationCounter=counter;m.revision=revision;skillGrowthModes.set(m,modes);throw e;}
  finally{m.currentOperation=operation;m.inTransaction=nested;}
  if(!changed)m.operationCounter=counter;
  if(changed&&!nested){historyStates.set(before,{modes,counter});m.history.push(before);if(m.history.length>100)m.history.shift();m.revision=(m.revision||0)+1;}
  return result;
 }
 /**
  * 回到上一筆最外層交易，包含技藝累計群組模式；不新增歷史。
  * @param {SaveModel} m
  * @returns {void} 沒有歷史時不動作；有還原時使舊預覽失效。
  */
 function undo(m){
  if(!m.history.length)return;
  const before=m.history.pop(),state=historyStates.get(before);
  m.changes=before;skillGrowthModes.set(m,new Set(state?.modes||[]));m.operationCounter=state?.counter;m.revision=(m.revision||0)+1;
 }
 /**
  * 還原指定座標的累計變更，仍是一筆可 undo 的交易。
  * 依序還原整個 group、整個 operation，或單一座標；不是回到上一次操作。
  * 技藝群組涵蓋該角色九項 cap/L/E（27 欄）及其私有模式，保留其他角色的修改。
  * @param {SaveModel} m
  * @param {SaveCoord} c 以一個待還原的變更座標選取群組；沒有變更時不動作。
  * @returns {void}
  */
 function restore(m,c){transaction(m,()=>{
  const change=m.changes.get(key(c)),group=change?.group,op=change?.operation;
  if(group){for(const [k,v]of m.changes)if(v.group===group)m.changes.delete(k);if(group.startsWith('skill-growth:')){const modes=new Set(skillModes(m));modes.delete(change.x);skillGrowthModes.set(m,modes);}}
  else if(op){for(const [k,v]of m.changes)if(v.operation===op)m.changes.delete(k);}
  else m.changes.delete(key(c));
 });}
 /**
  * 清除全部差異及私有技藝群組模式，形成一筆可 undo 的交易；不以直接 clear changes 取代。
  * @param {SaveModel} m
  * @returns {void} 差異及私有模式均未改變時不新增歷史。
  */
 function restoreAll(m){transaction(m,()=>{m.changes.clear();skillGrowthModes.set(m,new Set());});}
