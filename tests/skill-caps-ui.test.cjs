'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {saveFixture,renderSave}=require('./helpers/save-fixture.cjs');
const root=path.resolve(__dirname,'..'),caps=[28,20,10,10,10,10,10,10,10];

// The production UI and core run unchanged. Only this VM's candidate gate is set
// for success-branch unit tests; it is never a native proof or release artifact.
async function setup({gate=false,mutate}={}){
 const elements=new Map(),listeners=new Map(),downloads=[],blobs=new Map();
 const attr=(source,name)=>new RegExp('(?:^|\\s)'+name+'="([^"«]*)"').exec(source)?.[1];
 function element(){let html='',value='',text='';return {
  hidden:false,disabled:false,checked:false,dataset:{},classList:{toggle(){},add(){},remove(){}},
  setAttribute(){},removeAttribute(){},addEventListener(){},querySelectorAll:()=>[],
  click(){if(this.download)downloads.push({name:this.download,blob:blobs.get(this.href)});else return this.onclick?.();},
  close(){this.open=false;},showModal(){this.open=true;},
  get value(){return value;},set value(v){value=String(v);},
  get textContent(){return text;},set textContent(v){text=String(v);html='';},
  get innerHTML(){return html;},set innerHTML(v){html=String(v);text='';
   const options=[...html.matchAll(/<option\b([^>]*)>/g)];
   if(options.length)value=attr(options.find(m=>/\bselected\b/.test(m[1]))?.[1]||options[0][1],'value')||'';
   for(const match of html.matchAll(/<(input|select|button|label|p|div|span)\b([^>]*)>/g)){
    const id=attr(match[2],'id');if(!id)continue;const child=element();
    child.hidden=/\bhidden\b/.test(match[2]);child.disabled=/\bdisabled\b/.test(match[2]);child.checked=/\bchecked\b/.test(match[2]);child.value=attr(match[2],'value')||'';elements.set(id,child);
    if(match[1]==='select'){const rest=html.slice(match.index+match[0].length);child.innerHTML=rest.slice(0,rest.indexOf('</select>'));}
   }
  }
 };}
 const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 // Static controls use the same defaults as the HTML. Dynamic inputs are parsed
 // from the production widgets above; no event handler logic is duplicated.
 element().innerHTML=fs.readFileSync(path.join(root,'index.html'),'utf8').split('<script id="save-core">')[0];
 const context={Blob,TextDecoder,AbortController,performance,
  setTimeout(fn,ms){if(ms<=30)queueMicrotask(fn);return 1;},clearTimeout(){},confirm:()=>true,
  URL:{createObjectURL(blob){const url='blob:'+blobs.size;blobs.set(url,blob);return url;},revokeObjectURL(url){blobs.delete(url);}},
  localStorage:{getItem:()=>null,setItem(){}},window:{addEventListener(){}},
  document:{getElementById:$,querySelectorAll:()=>[],querySelector:()=>null,createElement:element,addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);}}
 };
 const knowledge=JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'),'utf8'));
 knowledge.verification.randomCharacterSkillCaps=gate;
 vm.runInNewContext(fs.readFileSync(path.join(root,'src/core.js'),'utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(knowledge)),context);
 const source=fs.readFileSync(path.join(root,'src/ui.js'),'utf8')
  .replace('/*__KNOWLEDGE_UI__*/',()=>fs.readFileSync(path.join(root,'src/knowledge-ui.js'),'utf8'))
  .replace('/*__BATCH_UI__*/',()=>fs.readFileSync(path.join(root,'src/batch-ui.js'),'utf8'))
  .replace('/*__RELIC_UI__*/',()=>fs.readFileSync(path.join(root,'src/relic-ui.js'),'utf8'))
  .replace("showTab('resources');renderFooter();","globalThis.uiTest={get model(){return model;}};showTab('resources');renderFooter();");
 vm.runInNewContext(source,context);
 const fixture=saveFixture({characters:2}),data=fixture.data;
 for(let id=1;id<=2;id++){
  for(let i=0;i<9;i++)data[id][22+i][2]=caps[i];
  for(let i=0;i<3;i++){data[id][1+i][12]=i+1;data[id][21+i][12]=1;}
 }
 mutate?.(data);const raw=renderSave(data);
 const load=async(text=raw,name='synthetic.dat')=>{const bytes=Buffer.from(text);await $('fileInput').onchange({target:{files:[{name,size:bytes.length,arrayBuffer:async()=>bytes}]}});};
 const dispatch=(name,dataset,extra={})=>{const target={dataset,...extra,closest:selector=>selector==='button'?{dataset}:null};for(const listener of listeners.get(name)||[])listener({target});};
 const select=id=>{dispatch('click',{tab:'characters'});$('characterSearch').value='#'+id;$('characterSearch').oninput();$('characterSelect').value=id;$('characterSelect').onchange();};
 const preview=(values=caps)=>{values.forEach((value,i)=>{$('skillCap'+(i+1)).value=value;$('skillCap'+(i+1)).oninput();});$('skillCapsPreviewBtn').onclick();};
 const experience=(id,skill,amount)=>{select(id);$('growthKind').value='skill';$('growthKind').onchange();$('growthTarget').value=skill;$('growthTarget').onchange();$('growthAmount').value=amount;$('growthApplyBtn').onclick();};
 const batch=async(id,amount)=>{dispatch('click',{tab:'batch'});$('batchKind').value='skillExperience';$('batchKind').onchange();$('batchCharacterSearch').value='#'+id;$('batchCharacterSearch').oninput();$('batchCharacter').value=id;$('batchCharacter').onchange();$('batchAmount').value=amount;$('batchAmount').oninput();await $('batchPreview').onclick();assert.equal($('batchApply').disabled,false);await $('batchApply').onclick();};
 await load();select(1);
 return {$,C:context.SaveCore,get model(){return context.uiTest.model;},data,raw,load,select,preview,experience,batch,downloads,dispatch,expected:patches=>renderSave(data,patches)};
}

test('skill cap UI exposes safe preview while the independent gate prevents all writes',async()=>{
 const h=await setup();h.preview([29,...caps.slice(1)]);
 assert.match(h.$('skillCapsStatus').textContent,/可預覽，套用停用/);
 assert.equal((h.$('skillCapsPreview').innerHTML.match(/<tr/g)||[]).length,10);
 assert.match(h.$('skillCapsPreview').innerHTML,/共同|可行招募/);
 assert.match(h.$('skillCapsPreview').innerHTML,/等級.*經驗餘額/);
 assert.match(h.$('skillCapsEditor').innerHTML,/27 欄/);
 assert.equal(h.$('skillCapsApplyBtn').disabled,true);
 h.$('skillCapsApplyBtn').onclick();
 assert.equal(h.C.serialize(h.model),h.raw);assert.equal(h.model.history.length,0);
 assert.match(h.$('toast').textContent,/隔離驗證/);
});

test('skill cap UI explains named, imprisoned, staged and incompatible talent exclusions',async()=>{
 for(const [y,z,value,reason]of [[2,2,1,/範本回填/],[55,2,2,/在監/],[50,2,1,/結丹/],[1,16,1,/重生|結丹紀錄/],[1,12,0,/共同生成/]]){
  const h=await setup({mutate:data=>data[1][y][z]=value});
  assert.equal(h.$('skillCapsPreviewBtn').disabled,true);assert.equal(h.$('skillCap1').disabled,true);assert.match(h.$('skillCapsStatus').textContent,reason);
  assert.equal(h.model.changes.size,0);
 }
});

test('candidate UI requires nine safe values and blocks joint, level and remainder conflicts',async()=>{
 const h=await setup({gate:true,mutate:data=>{data[1][31][2]=27;data[1][40][2]=0.5;}});
 for(const [values,reason]of [[Array(9).fill(20),/共同生成/],[[26,...caps.slice(1)],/低於目前等級/],[[27,...caps.slice(1)],/不自動清零/],[[28.5,...caps.slice(1)],/安全整數/],[['',...caps.slice(1)],/不能空白/]]){
  h.preview(values);assert.equal(h.$('skillCapsApplyBtn').disabled,true);assert.match(h.$('skillCapsPreview').innerHTML||h.$('skillCapsPreview').textContent,reason);assert.equal(h.model.history.length,0);
 }
 h.preview();assert.match(h.$('skillCapsPreview').innerHTML,/均無變更/);assert.equal(h.$('skillCapsApplyBtn').disabled,true);
 h.preview([29,...caps.slice(1)]);assert.equal(h.$('skillCapsApplyBtn').disabled,false);h.$('skillCapsApplyBtn').onclick();
 assert.equal(h.C.serialize(h.model),h.expected([[1,22,2,29]]));assert.equal(h.C.get(h.model,{x:1,y:31,z:2}),27);assert.equal(h.C.get(h.model,{x:1,y:40,z:2}),0.5);
});

test('candidate UI invalidates inputs, targets, model changes, restores and replacement files',async()=>{
 const h=await setup({gate:true});
 h.preview([29,...caps.slice(1)]);h.$('skillCap1').value='30';h.$('skillCap1').oninput();assert.equal(h.$('skillCapsApplyBtn').disabled,true);assert.match(h.$('skillCapsPreview').textContent,/重新預覽/);
 h.preview([29,...caps.slice(1)]);h.$('skillCap1').value='30';h.$('skillCapsApplyBtn').onclick();assert.equal(h.model.changes.size,0);assert.match(h.$('toast').textContent,/重新預覽/);
 h.preview([29,...caps.slice(1)]);h.select(2);assert.equal(h.$('skillCapsApplyBtn').disabled,true);h.select(1);
 h.preview([29,...caps.slice(1)]);h.C.transaction(h.model,()=>h.C.set(h.model,{x:1,y:2,z:0},1));h.$('skillCapsApplyBtn').onclick();assert.equal(h.C.get(h.model,{x:1,y:22,z:2}),28);assert.match(h.$('toast').textContent,/重新預覽/);
 h.preview([29,...caps.slice(1)]);h.$('undoBtn').onclick();assert.equal(h.$('skillCapsApplyBtn').disabled,true);
 h.preview([29,...caps.slice(1)]);h.$('skillCapsApplyBtn').onclick();h.preview([30,...caps.slice(1)]);h.dispatch('click',{restore:'1,22,2'});assert.equal(h.$('skillCapsApplyBtn').disabled,true);
 h.preview([29,...caps.slice(1)]);await h.load(h.raw,'replacement.dat');h.select(1);assert.equal(h.$('skillCapsApplyBtn').disabled,true);assert.equal(h.model.changes.size,0);
});

test('candidate UI interleaves cap, single and batch experience with cumulative restore, undo and Blob bytes',async()=>{
 const h=await setup({gate:true});
 h.experience(1,1,1);h.preview([29,...caps.slice(1)]);h.$('skillCapsApplyBtn').onclick();
 h.experience(2,1,7);await h.batch(1,2);assert.equal(h.$('batchSkillRestoreNote').hidden,false);
 h.select(1);h.preview([30,...caps.slice(1)]);h.$('skillCapsApplyBtn').onclick();
 const patches=[[1,22,2,30],[1,40,2,3],...Array.from({length:8},(_,i)=>[1,41+i,2,2]),[2,40,2,7]];
 const expected=h.expected(patches);assert.equal(h.C.serialize(h.model),expected);
 h.$('reviewBtn').onclick();assert.match(h.$('reviewRows').innerHTML,/27 欄/);
 h.dispatch('click',{restore:'1,48,2'});assert.equal(h.C.serialize(h.model),h.expected([[2,40,2,7]]));
 h.$('undoBtn').onclick();assert.equal(h.C.serialize(h.model),expected);
 h.$('undoBtn').onclick();assert.equal(h.C.serialize(h.model),h.expected(patches.map(p=>p[0]===1&&p[1]===22?[1,22,2,29]:p)));
 h.$('undoBtn').onclick();assert.equal(h.C.serialize(h.model),h.expected([[1,22,2,29],[1,40,2,1],[2,40,2,7]]));
 h.$('resetBtn').onclick();assert.equal(h.C.serialize(h.model),h.raw);
 h.$('undoBtn').onclick();assert.equal(h.C.serialize(h.model),h.expected([[1,22,2,29],[1,40,2,1],[2,40,2,7]]));
 h.$('reviewBtn').onclick();await h.$('reviewDownloadBtn').onclick();
 const output=h.downloads.at(-1);assert.equal(output.name,'synthetic.modified.dat');assert.equal(output.blob.type,'application/octet-stream');
 const bytes=Buffer.from(await output.blob.arrayBuffer());assert.deepEqual(bytes,Buffer.from(h.expected([[1,22,2,29],[1,40,2,1],[2,40,2,7]])));
 assert.equal(bytes.subarray(0,3).toString('hex'),'efbbbf');assert.ok(bytes.includes(Buffer.from('987654321098765432109876543210')));assert.ok(bytes.includes(Buffer.from('1e+03')));
 await h.load(bytes.toString('utf8'),'downloaded.dat');h.select(1);assert.equal(h.$('skillCap1').value,'29');assert.equal(h.model.changes.size,0);
});
