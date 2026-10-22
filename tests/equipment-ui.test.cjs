const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Execute the actual widget event handlers against a small DOM adapter, not duplicated UI logic.
function setup(initialGate=true){
 const elements=new Map(),listeners={};let ctx;
 const attr=(text,name)=>new RegExp('(?:^|\\s)'+name+'="([^"«]*)"').exec(text)?.[1];
 function make(){let html='',value='';return {textContent:'',hidden:false,disabled:false,checked:false,dataset:{},classList:{toggle(){}},get value(){return value;},set value(v){value=String(v);},get innerHTML(){return html;},set innerHTML(s){html=String(s);const options=[...html.matchAll(/<option\b([^>]*)>/g)];if(options.length)value=attr(options.find(m=>/\bselected\b/.test(m[1]))?.[1]||options[0][1],'value')||'';
  for(const m of html.matchAll(/<(input|select|label|p|div)\b([^>]*)>/g)){const id=attr(m[2],'id'),edit=attr(m[2],'data-edit-value');if(!id&&!edit)continue;const e=make();e.hidden=/\bhidden\b/.test(m[2]);e.disabled=/\bdisabled\b/.test(m[2]);e.checked=/\bchecked\b/.test(m[2]);e.value=attr(m[2],'value')||'';elements.set(id||'edit-'+edit,e);if(m[1]==='select'){const rest=html.slice(m.index+m[0].length);e.innerHTML=rest.slice(0,rest.indexOf('</select>'));}}
 }};}
 const $=id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);};const k=JSON.parse(fs.readFileSync('knowledge/catalog.json'));for(const group in k.verification)k.verification[group]=true;k.verification.equipmentAffixInitialSelection=initialGate;
 ctx={document:{addEventListener:(n,fn)=>(listeners[n]??=[]).push(fn),querySelector:s=>elements.get('edit-'+s.match(/="(.*?)"/)?.[1])},$: $,knowledgePages:{inventory:0,settlement:0,atlas:0,catalog:0},K:k,fmt:String,htmlValue:String,esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),toast(){},showTab(){}};
 vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);ctx.C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='甲';
 for(const z of [7,9])for(const [y,v]of [[0,99],[1,16],[2,1],[3,1],[5,2],[6,3],[8,125],[9,12],[15,20],[24,1]])data[1][y][z]=v;
 ctx.model=ctx.C.parse(JSON.stringify({c2array:true,size:[221,60,22],data}));ctx.perform=fn=>{fn();ctx.widgets.renderInventory();};
 vm.runInNewContext(fs.readFileSync('src/knowledge-ui.js','utf8')+';globalThis.widgets={renderInventory,renderEditing,renderAffixes};',ctx);
 ctx.widgets.renderInventory();return {ctx,$,C:ctx.C,m:ctx.model,listeners};
}
test('first-selection checkbox enables one atomic lock and is cleared after apply',()=>{
 const {ctx,$,C,m}=setup();assert.match($('affixItem').innerHTML,/7:1/);assert.match($('affixItem').innerHTML,/9:1/);assert.equal($('affixFirst').checked,false);assert.equal($('affixReplace').disabled,true);assert.match($('affixPreview').innerHTML,/首次選槽/);
 $('affixFirst').checked=true;$('affixFirst').onchange();assert.equal($('affixReplace').disabled,false);$('affixReplace').onclick();assert.equal(C.get(m,{x:1,y:28,z:7}),1);assert.equal(C.get(m,{x:1,y:28,z:9}),0);assert.equal($('affixFirstLabel').hidden,true);assert.equal($('affixFirst').checked,false);assert.equal(m.changes.size,1);
});
test('changing plane/target and position filter never retains first-selection confirmation',()=>{
 const {ctx,$,m}=setup();$('affixFirst').checked=true;$('affixItem').value='9:1';$('affixItem').onchange();assert.equal($('affixFirst').checked,false);assert.equal($('affixReplace').disabled,true);assert.equal(m.changes.size,0);
 $('inventoryPlane').value='7';$('inventoryPlane').onchange();assert.match($('affixItem').innerHTML,/背包 #1/);assert.doesNotMatch($('affixItem').innerHTML,/9:1/);assert.doesNotMatch($('equipmentEditor').innerHTML,/value="9:1"/);assert.match($('equipmentEditor').innerHTML,/背包僅一般模式/);
});
test('missing selection UI proof keeps candidate and apply disabled even after checkbox',()=>{
 const {$,m}=setup(false);assert.match($('affixTarget').innerHTML,/首次選槽尚待原生遊戲 UI 驗證/);$('affixFirst').checked=true;$('affixFirst').onchange();assert.equal($('affixReplace').disabled,true);assert.equal(m.changes.size,0);
});

test('quality UI requires explicit new slot and clears removal confirmation on target/input changes',()=>{
 const {ctx,$,C,m}=setup();$('qualityTarget').value='3';$('qualityTarget').onchange();assert.equal($('qualityApply').disabled,true);
 $('qualityAffix2').value='13';$('qualityAffix2').onchange();assert.equal($('qualityApply').disabled,false);$('qualityApply').onclick();assert.equal(C.get(m,{x:1,y:5,z:7}),3);assert.equal(C.get(m,{x:1,y:10,z:7}),13);
 $('qualityTarget').value='2';$('qualityTarget').onchange();assert.equal($('qualityRemovalLabel').hidden,false);assert.equal($('qualityApply').disabled,true);$('qualityRemoval').checked=true;$('qualityRemoval').onchange();assert.equal($('qualityApply').disabled,false);
 $('qualityTarget').value='1';$('qualityTarget').onchange();assert.equal($('qualityRemoval').checked,false);$('qualityRemoval').checked=true;$('qualityRemoval').onchange();$('qualityApply').onclick();assert.equal(C.get(m,{x:1,y:5,z:7}),1);assert.equal(C.get(m,{x:1,y:9,z:7}),0);assert.equal(C.get(m,{x:1,y:10,z:7}),0);assert.equal(C.get(m,{x:1,y:5,z:9}),2);
 $('inventoryPlane').value='9';$('inventoryPlane').onchange();assert.doesNotMatch($('qualityItem').innerHTML,/7:1/);
});

test('selecting a stored set shows its readonly reason and disables level editing',()=>{
 const {ctx,$,m,listeners}=setup();m.original.data[1][1][9]=28;
 const change=value=>listeners.change.forEach(fn=>fn({target:{dataset:{editTarget:'equipment'},value}}));
 change('9:1');
 assert.match($('equipmentEditor').innerHTML,/套裝等級尚未隔離驗證/);
 assert.match($('equipmentEditor').innerHTML,/data-edit-value="equipment"[^>]*disabled/);
 assert.match($('equipmentEditor').innerHTML,/data-edit-apply="equipment"[^>]*disabled/);
 assert.equal(m.changes.size,0);
 change('7:1');
 assert.doesNotMatch($('equipmentEditor').innerHTML,/data-edit-apply="equipment"[^>]*disabled/);
 assert.equal(m.changes.size,0);
});
