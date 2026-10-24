'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {saveFixture,renderSave}=require('./helpers/save-fixture.cjs');
const root=path.resolve(__dirname,'..');

// The production UI and core run unchanged. Only this VM's candidate gate is set
// for success-branch unit tests; it is never a native proof or release artifact.
// Character 1: Q2, 力量强化 Lv1 / 暴击强化 Lv2 / 力量系职业 Lv3. Character 2: Q6 (single-level pool).
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
 element().innerHTML=fs.readFileSync(path.join(root,'index.html'),'utf8').split('<script id="save-core">')[0];
 const context={Blob,TextDecoder,AbortController,performance,
  setTimeout(fn,ms){if(ms<=30)queueMicrotask(fn);return 1;},clearTimeout(){},confirm:()=>true,
  URL:{createObjectURL(blob){const url='blob:'+blobs.size;blobs.set(url,blob);return url;},revokeObjectURL(url){blobs.delete(url);}},
  localStorage:{getItem:()=>null,setItem(){}},window:{addEventListener(){}},
  document:{getElementById:$,querySelectorAll:()=>[],querySelector:()=>null,createElement:element,addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);}}
 };
 const knowledge=JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'),'utf8'));
 knowledge.verification.randomCharacterTalents=gate;
 vm.runInNewContext(fs.readFileSync(path.join(root,'src/core.js'),'utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(knowledge)),context);
 const source=fs.readFileSync(path.join(root,'src/ui.js'),'utf8')
  .replace('/*__KNOWLEDGE_UI__*/',()=>fs.readFileSync(path.join(root,'src/knowledge-ui.js'),'utf8'))
  .replace('/*__BATCH_UI__*/',()=>fs.readFileSync(path.join(root,'src/batch-ui.js'),'utf8'))
  .replace('/*__RELIC_UI__*/',()=>fs.readFileSync(path.join(root,'src/relic-ui.js'),'utf8'))
  .replace('/*__WALL_UI__*/',()=>fs.readFileSync(path.join(root,'src/wall-ui.js'),'utf8'))
  .replace('/*__CITY_UI__*/',()=>fs.readFileSync(path.join(root,'src/city-ui.js'),'utf8'))
  .replace("showTab('resources');renderFooter();","globalThis.uiTest={get model(){return model;}};showTab('resources');renderFooter();");
 vm.runInNewContext(source,context);
 const fixture=saveFixture({characters:2}),data=fixture.data;
 for(const [y,v]of [[10,50],[11,40],[12,40],[49,2]])data[1][y][2]=v;
 [[1,1],[4,2],[52,3]].forEach(([id,level],i)=>{data[1][1+i][12]=id;data[1][21+i][12]=level;});
 data[2][49][2]=6;for(let i=0;i<3;i++){data[2][1+i][12]=i+4;data[2][21+i][12]=5;}
 const pill=Number(Object.keys(knowledge.batch2Data.pills).find(id=>knowledge.batch2Data.pills[id].aptitude===1&&knowledge.batch2Data.pills[id].cap>=40));
 data[pill][6][0]=10;
 mutate?.(data);const raw=renderSave(data);
 const load=async(text=raw,name='synthetic.dat')=>{const bytes=Buffer.from(text);await $('fileInput').onchange({target:{files:[{name,size:bytes.length,arrayBuffer:async()=>bytes}]}});};
 const dispatch=(name,dataset,extra={})=>{const target={dataset,...extra,closest:selector=>selector==='button'?{dataset}:null};for(const listener of listeners.get(name)||[])listener({target});};
 const select=id=>{dispatch('click',{tab:'characters'});$('characterSearch').value='#'+id;$('characterSearch').oninput();$('characterSelect').value=id;$('characterSelect').onchange();};
 const preview=(levels=[1,2,3])=>{levels.forEach((level,i)=>{$('talentLevel'+(i+1)).value=level;$('talentLevel'+(i+1)).onchange();});$('talentLevelsPreviewBtn').onclick();};
 await load();select(1);
 return {$,C:context.SaveCore,get model(){return context.uiTest.model;},data,raw,pill,load,select,preview,downloads,dispatch,expected:patches=>renderSave(data,patches)};
}

test('talent UI shows ids, level pools and effects; the closed gate previews but never writes',async()=>{
 const h=await setup();
 assert.match(h.$('talentLevelsStatus').textContent,/品質 2 · 等級池 1、2、3.*可預覽，套用停用/);
 const editor=h.$('talentLevelsEditor').innerHTML;
 assert.match(editor,/#1 力量強化/);assert.match(editor,/#52 力量系職業/);assert.match(editor,/12 欄/);assert.match(editor,/不能更換或清空/);
 assert.equal((editor.match(/<option /g)||[]).length,9);assert.doesNotMatch(editor,/Lv 4/);
 assert.equal(h.$('talentLevel3').value,'3');
 h.preview([2,2,3]);
 assert.match(h.$('talentLevelsPreview').innerHTML,/1 → 2/);assert.match(h.$('talentLevelsPreview').innerHTML,/來源 A/);
 assert.match(h.$('talentLevelsPreview').innerHTML,/尚待相符來源/);assert.equal(h.$('talentLevelsApplyBtn').disabled,true);
 h.$('talentLevelsApplyBtn').onclick();
 assert.equal(h.C.serialize(h.model),h.raw);assert.equal(h.model.history.length,0);
 assert.match(h.$('toast').textContent,/隔離驗證/);
});

test('talent UI explains read-only characters and the single-level Q6 pool',async()=>{
 for(const [y,z,value,reason]of [[2,2,1,/範本 0/],[55,2,2,/在監/],[50,2,1,/結丹/],[1,16,1,/結丹紀錄/],[3,12,0,/空槽/],[21,12,4,/等級池/]]){
  const h=await setup({mutate:data=>data[1][y][z]=value});
  assert.equal(h.$('talentLevelsPreviewBtn').disabled,true);assert.match(h.$('talentLevelsStatus').textContent,reason);
  assert.equal(h.model.changes.size,0);
 }
 const h=await setup({gate:true});h.select(2);
 assert.match(h.$('talentLevelsStatus').textContent,/只有一個等級/);assert.equal(h.$('talentLevelsPreviewBtn').disabled,true);assert.equal(h.$('talentLevel1').disabled,true);
});

test('candidate UI applies only changed levels, shows effects and blocks a pill above the new cap',async()=>{
 const h=await setup({gate:true});
 h.preview();assert.match(h.$('talentLevelsPreview').innerHTML,/均無變更/);assert.equal(h.$('talentLevelsApplyBtn').disabled,true);
 h.preview([1,3,3]);
 assert.match(h.$('talentLevelsPreview').innerHTML,/暴擊幾率 7% → 暴擊幾率 9%/);assert.doesNotMatch(h.$('talentLevelsPreview').innerHTML,/來源 A/);
 assert.equal(h.$('talentLevelsApplyBtn').disabled,false);h.$('talentLevelsApplyBtn').onclick();
 assert.equal(h.C.serialize(h.model),h.expected([[1,22,12,3]]));assert.match(h.$('toast').textContent,/一起還原/);
 h.$('reviewBtn').onclick();assert.match(h.$('reviewRows').innerHTML,/12 欄/);
 // Raise 力量强化 first, fill the pill to the new cap, then lowering is blocked.
 h.select(1);h.preview([3,3,3]);h.$('talentLevelsApplyBtn').onclick();
 h.C.KNOWLEDGE.verification.pillAptitudeBonus=true;const max=h.C.pillInfo(h.model,1,1,h.pill).max;
 h.C.setPillAptitudeBonus(h.model,{characterId:1,aptitude:1,pillId:h.pill,bonus:max});h.select(1);
 h.preview([1,3,3]);assert.equal(h.$('talentLevelsApplyBtn').disabled,true);assert.match(h.$('talentLevelsPreview').innerHTML,/力量丹藥增量/);
 h.dispatch('click',{restore:'1,21,12'});assert.equal(h.C.serialize(h.model),h.raw);
});

test('candidate UI invalidates inputs, targets, model changes, undo, restores and replacement files',async()=>{
 const h=await setup({gate:true});
 h.preview([2,2,3]);h.$('talentLevel1').value='3';h.$('talentLevel1').onchange();assert.equal(h.$('talentLevelsApplyBtn').disabled,true);assert.match(h.$('talentLevelsPreview').textContent,/重新預覽/);
 h.preview([2,2,3]);h.$('talentLevel1').value='3';h.$('talentLevelsApplyBtn').onclick();assert.equal(h.model.changes.size,0);assert.match(h.$('toast').textContent,/重新預覽/);
 h.preview([2,2,3]);h.select(2);h.select(1);assert.equal(h.$('talentLevelsApplyBtn').disabled,true);
 h.preview([2,2,3]);h.C.transaction(h.model,()=>h.C.set(h.model,{x:1,y:2,z:0},1));h.$('talentLevelsApplyBtn').onclick();assert.equal(h.C.get(h.model,{x:1,y:21,z:12}),1);assert.match(h.$('toast').textContent,/重新預覽/);
 h.preview([2,2,3]);h.$('undoBtn').onclick();assert.equal(h.$('talentLevelsApplyBtn').disabled,true);
 h.preview([2,2,3]);h.$('talentLevelsApplyBtn').onclick();assert.equal(h.C.get(h.model,{x:1,y:21,z:12}),2);
 h.preview([3,2,3]);h.dispatch('click',{restore:'1,21,12'});assert.equal(h.$('talentLevelsApplyBtn').disabled,true);assert.equal(h.C.serialize(h.model),h.raw);
 h.preview([2,2,3]);await h.load(h.raw,'replacement.dat');h.select(1);assert.equal(h.$('talentLevelsApplyBtn').disabled,true);assert.equal(h.model.changes.size,0);
});

test('candidate UI downloads exact bytes that reload with the new levels',async()=>{
 const h=await setup({gate:true});
 h.preview([2,1,2]);h.$('talentLevelsApplyBtn').onclick();
 const expected=h.expected([[1,21,12,2],[1,22,12,1],[1,23,12,2]]);assert.equal(h.C.serialize(h.model),expected);
 h.$('reviewBtn').onclick();await h.$('reviewDownloadBtn').onclick();
 const output=h.downloads.at(-1),bytes=Buffer.from(await output.blob.arrayBuffer());
 assert.deepEqual(bytes,Buffer.from(expected));assert.equal(bytes.subarray(0,3).toString('hex'),'efbbbf');
 assert.ok(bytes.includes(Buffer.from('987654321098765432109876543210')));assert.ok(bytes.includes(Buffer.from('1e+03')));
 await h.load(bytes.toString('utf8'),'downloaded.dat');h.select(1);
 assert.deepEqual([1,2,3].map(i=>h.$('talentLevel'+i).value),['2','1','2']);assert.equal(h.model.changes.size,0);
});
