'use strict';
// Runs the real knowledge-ui handlers against a small DOM adapter (same technique as equipment-ui.test.cjs).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const catalog=JSON.parse(fs.readFileSync('knowledge/catalog.json','utf8'));
const treasureIds=tier=>Object.keys(catalog.treasureLevel.items).filter(id=>catalog.treasureLevel.items[id].tier===tier).map(Number);
const camel=name=>name.replace(/^data-/,'').replace(/-(\w)/g,(_,c)=>c.toUpperCase());
function setup({open=false,mutate}={}){
 const k=structuredClone(catalog),store=new Map(),listeners={};
 for(const g of ['backpackTreasureLevel','treasureLevel'])k.verification[g]=open;
 const make=()=>({textContent:'',hidden:false,disabled:false,checked:false,value:'',dataset:{},oninput:null,classList:{toggle(){}}});
 // Editors rebuild their own innerHTML; register the controls the handlers look up by data attribute.
 const names=['data-edit-value','data-edit-apply','data-edit-mode','data-edit-target','data-treasure-level-preview','data-set-level-preview'];
 const register=html=>{
  for(const m of html.matchAll(/<(input|select|button|span)\b([^>]*)>/g)){
   const tag=m[2],e=make();
   e.disabled=/\sdisabled(\s|$)/.test(' '+tag);e.checked=/\schecked(\s|$)/.test(' '+tag);e.value=(/\svalue="([^"]*)"/.exec(tag)||[])[1]||'';
   if(m[1]==='span'){const rest=html.slice(m.index+m[0].length);e.textContent=rest.slice(0,rest.indexOf('</span>'));}
   if(m[1]==='select'){const rest=html.slice(m.index+m[0].length),options=[...rest.slice(0,rest.indexOf('</select>')).matchAll(/<option\b([^>]*)>/g)],chosen=options.find(o=>/\sselected(\s|$)/.test(o[1]))||options[0];e.value=(/value="([^"]*)"/.exec(chosen?.[1]||'')||[])[1]||'';}
   for(const name of names){const hit=new RegExp('(?:^|\\s)'+name+'(?:="([^"]*)")?(?=\\s|$)').exec(tag);if(hit){e.dataset[camel(name)]=hit[1]??'';store.set(name==='data-edit-value'||name==='data-edit-apply'||name==='data-edit-mode'||name==='data-edit-target'?name+'='+hit[1]:name,e);}}
  }
 };
 const nodes=new Map(),$=id=>{if(!nodes.has(id)){const e=make();let html='';Object.defineProperty(e,'innerHTML',{get:()=>html,set:v=>{html=String(v);if(/Editor$/.test(id))register(html);}});nodes.set(id,e);}return nodes.get(id);};
 const ctx={document:{addEventListener:(n,fn)=>(listeners[n]??=[]).push(fn),querySelector:s=>{const m=/\[(data-[a-z-]+)(?:="([^"]*)")?\]/.exec(s);return store.get(m[2]!==undefined?m[1]+'='+m[2]:m[1]);}},$,knowledgePages:{inventory:0,settlement:0,atlas:0,catalog:0},K:k,fmt:String,htmlValue:String,esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),num:input=>{if(input.value.trim()==='')throw Error('數量不能空白。');const n=Number(input.value);if(!Number.isSafeInteger(n))throw Error('請輸入安全範圍內的整數。');return n;},toasts:[],toast(message,bad){ctx.toasts.push([message,!!bad]);},showTab(){}};
 vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);ctx.C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='甲';
 const put=(x,z,tpl,tier,over={})=>{const r=Array(60).fill(0);Object.assign(r,{0:7,1:tpl,2:1,3:tier,5:3,6:5,8:100,22:0},over);r.forEach((v,y)=>data[x][y][z]=v);};
 put(1,7,treasureIds(1)[0],1);put(2,9,treasureIds(2)[0],2);put(3,9,treasureIds(3)[0],3,{7:1});data[1][21][2]=3;put(4,7,treasureIds(1)[1],1,{6:99});
 if(mutate)mutate(data,put);
 ctx.model=ctx.C.parse(JSON.stringify({c2array:true,size:[221,60,22],data}));ctx.perform=fn=>{fn();ctx.widgets.renderInventory();};
 vm.runInNewContext(fs.readFileSync('src/knowledge-ui.js','utf8')+';globalThis.widgets={renderInventory,renderEditing};',ctx);
 ctx.widgets.renderInventory();
 const select=id=>{store.get('data-edit-target=equipment').value=id;listeners.change.forEach(fn=>fn({target:{dataset:{editTarget:'equipment'},value:id}}));};
 const type=v=>{const input=store.get('data-edit-value=equipment');input.value=String(v);input.oninput?.();};
 const click=()=>{const b=store.get('data-edit-apply=equipment');if(b.disabled)return false;listeners.click.forEach(fn=>fn({target:{closest:()=>b}}));return true;};
 return {ctx,C:ctx.C,m:ctx.model,store,select,type,click,editor:()=>$('equipmentEditor').innerHTML,get:id=>store.get(id)};
}
test('unproven treasure groups render inspectable but disabled, with the reason and no advanced mode',()=>{
 const t=setup();
 for(const id of ['7:1','9:2','9:3']){t.select(id);assert.match(t.editor(),/寶物僅一般模式/);assert.match(t.editor(),/寶物等級尚待首次獨立證明，目前停用/);assert.equal(t.get('data-edit-apply=equipment').disabled,true);assert.equal(t.get('data-edit-mode=equipment').disabled,true);assert.doesNotMatch(t.editor(),/進階驗證上限/);assert.equal(t.click(),false);}
 assert.equal(t.m.changes.size,0);assert.equal(t.m.history.length,0);
});
test('treasure facts: tier, quality, owner and cap are shown per plane',()=>{
 const t=setup({open:true});
 t.select('7:1');assert.match(t.editor(),/目前 5 · 一般上限 20/);assert.match(t.editor(),/等階 T1 · 品質 Q3 · 歸屬 無/);
 t.select('9:3');assert.match(t.editor(),/等階 T3 · 品質 Q3 · 歸屬 #1/);
 t.select('9:2');assert.match(t.editor(),/一般上限 20/);
});
test('an eligible treasure previews the exact change, rejects bad numbers and applies only y6',()=>{
 const t=setup({open:true});
 t.select('7:1');const before=t.C.serialize(t.m);assert.equal(t.get('data-edit-apply=equipment').disabled,false);
 t.type('8');assert.match(t.get('data-treasure-level-preview').textContent,/寶物等級 5 → 8.*不扣魂魄/);assert.equal(t.get('data-edit-apply=equipment').disabled,false);
 for(const bad of ['','21','0','1.5','-1']){t.type(bad);assert.equal(t.get('data-edit-apply=equipment').disabled,true,bad);assert.match(t.get('data-treasure-level-preview').textContent,/1–20/);assert.equal(t.click(),false);}
 assert.equal(t.C.serialize(t.m),before);
 t.type('8');assert.equal(t.click(),true);
 assert.equal(t.m.changes.size,1);assert.equal(t.C.get(t.m,{x:1,y:6,z:7}),8);
 assert.equal(t.ctx.toasts.filter(x=>x[1]).length,0);
});
test('worn and stored treasures change level without touching owner or pointer; undo restores',()=>{
 const t=setup({open:true});
 for(const id of ['9:2','9:3']){t.select(id);t.type('12');assert.equal(t.click(),true);}
 assert.equal(t.m.changes.size,2);assert.equal(t.C.get(t.m,{x:3,y:7,z:9}),1);assert.equal(t.C.get(t.m,{x:1,y:21,z:2}),3);
 t.C.undo(t.m);assert.equal(t.m.changes.size,1);t.C.undo(t.m);assert.equal(t.m.changes.size,0);
});
test('ineligible treasures show the rejection reason and cannot be applied',()=>{
 const t=setup({open:true});
 t.select('7:4');assert.match(t.editor(),/寶物等級：只支援原版等級，超限停用/);assert.equal(t.get('data-edit-apply=equipment').disabled,true);assert.equal(t.click(),false);
 const bad=setup({open:true,mutate:data=>{data[2][2][9]=2;}});bad.select('9:2');assert.match(bad.editor(),/寶物等級：數量、等階或特殊狀態不符/);assert.equal(bad.m.changes.size,0);
});
