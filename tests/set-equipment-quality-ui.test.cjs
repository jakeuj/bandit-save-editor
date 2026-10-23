'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {saveFixture,renderSave}=require('./helpers/save-fixture.cjs');
const O=require('../scripts/set-equipment-quality-effects-oracle.cjs');
const catalog=require('../knowledge/catalog.json'),templateId=28,originId=2;
const L=catalog.setEquipmentLevel,t=L.items[templateId],P原=L.origins[originId].affixIds,P套=catalog.setEquipmentQuality.pools[templateId].affixIds;
const setOnly=P套.filter(a=>!P原.includes(a));
const UP={7:'backpackSetEquipmentQualityUpgrade',9:'setEquipmentQualityUpgrade'},DOWN={7:'backpackSetEquipmentQualityDowngrade',9:'setEquipmentQualityDowngrade'};
const coreSource=fs.readFileSync(require.resolve('../src/core.js'),'utf8'),uiSource=fs.readFileSync(require.resolve('../src/knowledge-ui.js'),'utf8');
// Same adapter as equipment-ui.test.cjs: runs the real widget handlers against a minimal DOM.
function record({plane,quality=3,level=3,flags={}}){
 const r=Array(60).fill(0);Object.assign(r,{0:5,1:templateId,2:1,3:t.tier,5:quality,6:level,7:0,8:95+30*(quality-1),23:3,24:1,26:1.7,27:originId});
 for(let s=1;s<quality;s++){r[8+s]=P原[s-1];r[14+s]=40+10*(quality-1);r[27+s]=flags[s]||0;}
 return r;
}
function setup({open=[],quality=3,level=3,flags={},plane=9}={}){
 const elements=new Map(),listeners={},toasts=[];
 const attr=(text,name)=>new RegExp('(?:^|\\s)'+name+'="([^"«]*)"').exec(text)?.[1];
 function make(){let html='',value='';return {textContent:'',hidden:false,disabled:false,checked:false,dataset:{},classList:{toggle(){}},get value(){return value;},set value(v){value=String(v);},get innerHTML(){return html;},set innerHTML(s){html=String(s);const options=[...html.matchAll(/<option\b([^>]*)>/g)];if(options.length)value=attr(options.find(m=>/\bselected\b/.test(m[1]))?.[1]||options[0][1],'value')||'';
  for(const m of html.matchAll(/<(input|select|label|p|div|button)\b([^>]*)>/g)){const id=attr(m[2],'id'),edit=attr(m[2],'data-edit-value');if(!id&&!edit)continue;const e=make();e.hidden=/\bhidden\b/.test(m[2]);e.disabled=/\bdisabled\b/.test(m[2]);e.checked=/\bchecked\b/.test(m[2]);e.value=attr(m[2],'value')||'';elements.set(id||'edit-'+edit,e);if(m[1]==='select'){const rest=html.slice(m.index+m[0].length);e.innerHTML=rest.slice(0,rest.indexOf('</select>'));}}
 }};}
 const $=id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);};
 const k=structuredClone(catalog);for(const g of ['backpackSetEquipmentLevel','setEquipmentLevel'])k.verification[g]=true;for(const g of open)k.verification[g]=true;
 const ctx={document:{addEventListener:(n,fn)=>(listeners[n]??=[]).push(fn),querySelector:s=>elements.get('edit-'+s.match(/="(.*?)"/)?.[1])},$,knowledgePages:{inventory:0,settlement:0,atlas:0,catalog:0},K:k,fmt:String,htmlValue:String,esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),toast:(message,error)=>toasts.push({message,error}),showTab(){}};
 vm.runInNewContext(coreSource.replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);ctx.C=ctx.SaveCore;
 const {data}=saveFixture({characters:2}),row=record({plane,quality,level,flags});
 row.forEach((v,y)=>data[20][y][plane]=v);
 // An ordinary equipment row keeps the existing quality card populated, so we can see the two cards stay independent.
 for(const [y,v]of [[0,9],[1,16],[2,1],[3,1],[5,2],[6,3],[8,125],[9,12],[15,20],[24,1]])data[21][y][plane]=v;
 const text=renderSave(data);ctx.model=ctx.C.parse(text);ctx.perform=fn=>{fn();ctx.widgets.renderInventory();};
 vm.runInNewContext(uiSource+';globalThis.widgets={renderInventory};',ctx);
 ctx.widgets.renderInventory();return {ctx,$,C:ctx.C,m:ctx.model,text,row,toasts};
}
const pick=(h,slot,id,coef)=>{h.$('setQualityAffix'+slot).value=String(id);if(coef!==undefined)h.$('setQualityCoefficient'+slot).value=String(coef);h.$('setQualityAffix'+slot).onchange();};
const target=(h,q)=>{h.$('setQualityTarget').value=String(q);h.$('setQualityTarget').onchange();};

test('shipped catalog: set card previews but every Apply stays disabled with the reason',()=>{
 const h=setup({plane:9});
 assert.match(h.$('setQualityItem').innerHTML,/9:20/);assert.doesNotMatch(h.$('setQualityItem').innerHTML,/9:21/);
 assert.match(h.$('setQualityInfo').textContent,/升品 待驗證/);assert.match(h.$('setQualityInfo').textContent,/降品 待驗證/);
 target(h,4);pick(h,3,P原[5],41);
 assert.match(h.$('setQualityStatus').textContent,/setEquipmentQualityUpgrade/);assert.match(h.$('setQualityStatus').textContent,/尚待獨立遊戲驗證，套用停用/);
 assert.equal(h.$('setQualityApply').disabled,true);h.$('setQualityApply').onclick();assert.equal(h.m.changes.size,0);
 target(h,2);h.$('setQualityRemoval').checked=true;h.$('setQualityRemoval').onchange();
 assert.match(h.$('setQualityStatus').textContent,/setEquipmentQualityDowngrade/);assert.equal(h.$('setQualityApply').disabled,true);
 assert.equal(h.m.changes.size,0);
});
test('shown planes, pools, per-slot sources, effects and cap are rendered from core',()=>{
 const h=setup({plane:7,flags:{2:1}});
 target(h,5);assert.equal(h.$('setQualityStatus').textContent,'');
 assert.match(h.$('setQualityPools').innerHTML,/P原（\d+）/);assert.match(h.$('setQualityPools').innerHTML,/P套（\d+）/);assert.match(h.$('setQualityPools').innerHTML,/槽 2 .*（已選）/);
 assert.match(h.$('setQualityAdditions').innerHTML,/新增詞條槽 3（P原）/);assert.match(h.$('setQualityAdditions').innerHTML,/新增詞條槽 4（P原）/);
 pick(h,3,P原[5],43.55);pick(h,4,P原[6],43.55);
 assert.match(h.$('setQualityStatus').textContent,/背包 · 升品 · 群組 backpackSetEquipmentQualityUpgrade/);
 const html=h.$('setQualityPreview').innerHTML;
 assert.match(html,/主係數 155 → 215/);assert.match(html,/上限 20 → 30/);assert.match(html,/<td>3・新增<\/td><td>P原<\/td>/);assert.match(html,/<th>裝備屬性<\/th>/);assert.match(html,/套裝積分、件數與額外套裝效果不隨品質改變/);
 assert.equal(h.m.changes.size,0);
});
test('isolated gates open: upgrade applies exactly the planned tokens; downgrade stays disabled until its own gate opens',()=>{
 const h=setup({open:[UP[9]]});
 target(h,4);assert.equal(h.$('setQualityApply').disabled,true);pick(h,3,P原[5],45.5);assert.equal(h.$('setQualityApply').disabled,false);
 h.$('setQualityApply').onclick();
 const f=h.row,expected=renderSave(saveFixtureRows(h),[[20,5,9,4],[20,8,9,f[8]+30],[20,15,9,f[15]+10],[20,16,9,f[16]+10],[20,11,9,P原[5]],[20,17,9,45.5]]);
 assert.equal(h.C.serialize(h.m),expected);assert.equal(h.C.get(h.m,{x:20,y:5,z:9}),4);
 // Reflects after render: the card now reads Q4 and the downgrade gate is still closed.
 assert.match(h.$('setQualityInfo').textContent,/目前品質 4/);target(h,3);
 assert.match(h.$('setQualityStatus').textContent,/setEquipmentQualityDowngrade · 尚待獨立遊戲驗證/);assert.equal(h.$('setQualityApply').disabled,true);
});
function saveFixtureRows(h){const {data}=saveFixture({characters:2});h.row.forEach((v,y)=>data[20][y][9]=v);for(const [y,v]of [[0,9],[1,16],[2,1],[3,1],[5,2],[6,3],[8,125],[9,12],[15,20],[24,1]])data[21][y][9]=v;return data;}

test('downgrade needs the removal confirmation; target/input changes and Reset clear it',()=>{
 const h=setup({open:[DOWN[9]],quality:4});
 target(h,2);assert.equal(h.$('setQualityRemovalLabel').hidden,false);assert.equal(h.$('setQualityApply').disabled,true);
 h.$('setQualityRemoval').checked=true;h.$('setQualityRemoval').onchange();assert.equal(h.$('setQualityApply').disabled,false);
 target(h,3);assert.equal(h.$('setQualityRemoval').checked,false);assert.equal(h.$('setQualityApply').disabled,true);
 h.$('setQualityRemoval').checked=true;h.$('setQualityRemoval').onchange();assert.equal(h.$('setQualityApply').disabled,false);
 h.$('setQualityReset').onclick();assert.equal(h.$('setQualityRemoval').checked,false);assert.equal(h.$('setQualityRemovalLabel').hidden,true);assert.equal(h.$('setQualityApply').disabled,true);assert.equal(h.m.changes.size,0);
 target(h,2);h.$('setQualityRemoval').checked=true;h.$('setQualityRemoval').onchange();h.$('setQualityApply').onclick();
 const g=h.C.get;assert.equal(g(h.m,{x:20,y:5,z:9}),2);assert.equal(g(h.m,{x:20,y:11,z:9}),0);assert.equal(g(h.m,{x:20,y:10,z:9}),0);assert.equal(g(h.m,{x:20,y:9,z:9}),P原[0]);
 assert.equal(h.m.history.length,1);h.C.undo(h.m);assert.equal(h.C.serialize(h.m),h.text);
});
test('core rejection messages are shown and keep Apply disabled',()=>{
 const open=[UP[9],DOWN[9]];
 let h=setup({open});target(h,4);pick(h,3,P原[0],45);
 assert.match(h.$('setQualityPreview').textContent,/不能新增與其他槽重複/);assert.equal(h.$('setQualityApply').disabled,true);
 if(setOnly.length){pick(h,3,setOnly[0],45);assert.match(h.$('setQualityPreview').textContent,/只能使用原裝備詞條/);assert.equal(h.$('setQualityApply').disabled,true);}
 pick(h,3,P原[5],999);assert.match(h.$('setQualityPreview').textContent,/超出目標品質範圍/);assert.equal(h.$('setQualityApply').disabled,true);
 h.$('setQualityApply').onclick();assert.equal(h.m.changes.size,0);
 h=setup({open,level:12});target(h,1);assert.match(h.$('setQualityPreview').textContent,/等級超過目標品質上限/);assert.equal(h.$('setQualityApply').disabled,true);
 h=setup({open,flags:{2:1}});target(h,2);assert.match(h.$('setQualityPreview').textContent,/已選洗練槽會被移除/);assert.equal(h.$('setQualityApply').disabled,true);
 h=setup({open});target(h,4);h.$('setQualityAffix3').value='';h.$('setQualityAffix3').onchange();assert.match(h.$('setQualityPreview').textContent,/請明選新增槽 3/);assert.equal(h.$('setQualityApply').disabled,true);
});
test('set card does not touch the ordinary quality and set level cards',()=>{
 const h=setup({open:[UP[9]]});
 assert.match(h.$('qualityItem').innerHTML,/9:21/);assert.match(h.$('qualityItem').innerHTML,/9:20/);
 const before=h.$('qualityInfo').textContent;
 target(h,4);pick(h,3,P原[5],45);h.$('setQualityApply').onclick();
 assert.equal(h.C.get(h.m,{x:21,y:5,z:9}),2);assert.match(h.$('equipmentEditor').innerHTML,/套裝等級/);
 assert.equal(typeof before,'string');
});

// Core effects entry (B3): read-only, per-attribute before/after matches the independent A8 oracle.
test('setEquipmentQualityCandidateEffects equals the independent oracle and writes nothing',()=>{
 for(const [from,to,added] of [[3,5,[P原[5],P原[6]]],[2,6,[P原[5],P原[6],P原[7],P原[8]]],[5,2,[]],[3,3,[]],[6,1,[]]]){
  const h=setup({open:[UP[9],DOWN[9]],quality:from,level:3});
  const slots=added.map((attributeId,i)=>({slot:from+i,attributeId,coefficient:10*(to-1)+7.5}));
  const rec=h.row,after=O.transition(rec,to,{added:slots,confirmRemoved:to<from});
  const got=h.C.setEquipmentQualityCandidateEffects(h.m,{itemId:20,plane:9,quality:to,addedAffixes:slots});
  const want=O.effectChange(rec,after,L);
  const byId=Object.fromEntries(got.effects.map(e=>[e.attributeId,e]));
  for(const [id,e] of Object.entries(want)){assert.equal(byId[id].before,e.before,'before '+id);assert.equal(byId[id].after,e.after,'after '+id);assert.equal(byId[id].removed,e.removed);}
  assert.deepEqual(Object.keys(byId).map(Number).sort((a,b)=>a-b).filter(id=>byId[id].before||byId[id].after),Object.keys(want).map(Number).sort((a,b)=>a-b).filter(id=>want[id].before||want[id].after));
  assert.equal(h.C.serialize(h.m),h.text);assert.equal(h.m.history.length,0);
 }
});
test('setEquipmentQualityCandidateEffects rejects what the preview rejects and the attack L×Q term is present',()=>{
 const h=setup({quality:3,level:12});
 assert.throws(()=>h.C.setEquipmentQualityCandidateEffects(h.m,{itemId:20,plane:9,quality:1}),/等級超過目標品質上限/);
 assert.throws(()=>h.C.setEquipmentQualityCandidateEffects(h.m,{itemId:20,plane:9,quality:4,addedAffixes:[]}),/新增尾槽/);
 assert.throws(()=>h.C.setEquipmentQualityCandidateEffects(h.m,{itemId:21,plane:9,quality:3}),/套裝品質候選/);
 const q=setup({quality:3,level:12}),ok=q.C.setEquipmentQualityCandidateEffects(q.m,{itemId:20,plane:9,quality:4,addedAffixes:[{slot:3,attributeId:P原[5],coefficient:45}]});
 const attack=ok.effects.find(e=>e.attributeId===4);assert.ok(attack.after>attack.before);
});
test('catalog gates stay closed and the shipped candidate names are the only new exports',()=>{
 const h=setup();for(const g of Object.values(UP).concat(Object.values(DOWN)))assert.notEqual(h.ctx.K.verification[g],true);
 assert.ok(['setEquipmentQualityCandidateInfo','previewSetEquipmentQualityCandidate','applySetEquipmentQualityCandidate','setEquipmentQualityCandidateEffects'].every(n=>typeof h.C[n]==='function'));
});
