const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const elements=new Map(),events={},windowEvents={},downloads=[],prompts=[];
 const element=()=>({value:'',innerHTML:'',textContent:'',dataset:{},classList:{toggle(){},add(){},remove(){}},setAttribute(){},removeAttribute(){},addEventListener(){},click(){downloads.push(this.download);},close(){this.open=false;},showModal(){this.open=true;}});
 const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const ctx={TextDecoder,Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},localStorage:{getItem:()=>null},setTimeout:(fn,ms)=>{if(ms===30)queueMicrotask(fn);return 0;},clearTimeout(){},confirm:message=>{prompts.push(message);return false;},document:{getElementById:$,querySelectorAll:()=>[],addEventListener:(n,f)=>events[n]=f,createElement:element},window:{addEventListener:(n,f)=>windowEvents[n]=f}};
 vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',fs.readFileSync('knowledge/catalog.json','utf8')),ctx);
 vm.runInNewContext(fs.readFileSync('src/ui.js','utf8').replace('/*__KNOWLEDGE_UI__*/','const editingState={};function renderKnowledgeTab(){}'),ctx);
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][1][0]='測試山寨';
 const bytes=Buffer.from(JSON.stringify({c2array:true,size:[221,60,22],data}));
 const load=name=>$('fileInput').onchange({target:{files:[{name,size:bytes.length,arrayBuffer:async()=>bytes}]}});
 const edit=value=>events.change({target:{dataset:{field:'1,2,0'},value:String(value)}});
 const unload=()=>{let prevented=false;windowEvents.beforeunload({preventDefault(){prevented=true;}});return prevented;};
 return {$,load,edit,unload,prompts,downloads};
}
for(const button of ['downloadBtn','reviewDownloadBtn'])test(`${button}: exported changes reload without confirmation; subsequent edits remain protected`,async()=>{
 const h=setup();await h.load('first.dat');h.edit(10);assert.equal(h.unload(),true);
 await h.load('blocked.dat');assert.equal(h.prompts.length,1);assert.equal(h.$('fileName').textContent,'first.dat');
 await h.$(button).onclick();assert.equal(h.downloads.at(-1),'first.modified.dat');assert.equal(h.unload(),false);
 await h.load('second.dat');assert.equal(h.prompts.length,1);assert.equal(h.$('fileName').textContent,'second.dat');
 h.edit(20);await h.$(button).onclick();h.edit(21);assert.equal(h.unload(),true);
 await h.load('blocked-again.dat');assert.equal(h.prompts.length,2);assert.equal(h.$('fileName').textContent,'second.dat');
});
test('original backup does not mark changes exported; full restore removes confirmation',async()=>{
 const h=setup();await h.load('first.dat');h.edit(10);h.$('backupBtn').onclick();await h.load('blocked.dat');assert.equal(h.prompts.length,1);
 h.$('resetBtn').onclick();await h.load('restored.dat');assert.equal(h.prompts.length,1);assert.equal(h.$('fileName').textContent,'restored.dat');
});
