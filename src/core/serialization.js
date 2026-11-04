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
