const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
// City layers [c,11,0]: 0–149 for visited cities; [8,1,0] is rewritten as round(Σ cities int(y11)+[y44=1]) and lowering
// clamps a higher idle layer y21, mirroring 获得声望 and 生成战斗地图.
function setup(gates={},cities={1:{layer:74,visited:1,idle:74}},{total}={}){
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json'));for(const group of Object.keys(k.verification))k.verification[group]=true;Object.assign(k.verification,gates);
 const ctx={setTimeout};vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][2][0]=915117675;
 let sum=0;for(const [x,c] of Object.entries(cities)){data[x][11][0]=c.layer;data[x][44][0]=c.visited;data[x][21][0]=c.idle??0;data[x][38][0]=c.occupied??0;sum+=c.layer+c.visited;}
 // Wild maps keep their own layers; the total ignores them.
 data[28][11][0]=4;data[40][11][0]=9;data[8][1][0]=total??sum;
 const text='﻿'+JSON.stringify({c2array:true,size:[221,60,22],data}).replace('{','{\r\n"large":987654321098765432109876543210,');return {C,m:C.parse(text),text,data};
}
const read=(C,m,x)=>[C.get(m,{x,y:11,z:0}),C.get(m,{x,y:21,z:0}),C.get(m,{x:8,y:1,z:0})];
test('catalog carries the 27 zddt cities with their own hash; gate defaults closed',()=>{
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json'));
 assert.equal(k.verification.cityLayerLevel===false||k.verification.cityLayerLevel===true,true);
 assert.match(fs.readFileSync('scripts/extract-game.cjs','utf8'),/cityLayerLevel:false/);
 assert.deepEqual([k.cityLayers.layerCap,k.cityLayers.maxLayer,k.cityLayers.cities.length,k.cityLayers.source.file],[150,149,27,'zddt.json']);
 assert.match(k.cityLayers.source.sha256,/^[0-9a-f]{64}$/);
 assert.deepEqual(k.cityLayers.cities.map(c=>c.x),Array.from({length:27},(_,i)=>i+1));
 assert.deepEqual([k.cityLayers.cities[0].name,k.cityLayers.cities[7].name],['許昌','長安']);
 assert.equal(Object.keys(k.fingerprints).includes('zddt.json'),false);
});
test('closed gate previews but refuses to write',()=>{
 const {C,m,text}=setup({cityLayerLevel:false});
 const p=C.previewCityLayer(m,{x:1,layer:100});assert.equal(p.verified,false);assert.equal(p.changes.length,2);
 assert.throws(()=>C.setCityLayer(m,{x:1,layer:100}),/尚未完成/);assert.equal(C.serialize(m),text);
});
test('info sums every city layer plus the first-visit point and flags a stale cache',()=>{
 const cities={1:{layer:74,visited:1,idle:74},2:{layer:3,visited:1,idle:1,occupied:0},5:{layer:0,visited:1},9:{layer:0,visited:0}};
 const info=setup({},cities).C.cityLayersInfo(setup({},cities).m);
 assert.deepEqual([info.total,info.computed,info.consistent,info.maxLayer,info.cities.length],[80,80,true,149,27]);
 assert.deepEqual([...info.cities.filter(c=>c.visited).map(c=>c.x)],[1,2,5]);
 const stale=setup({},cities,{total:12});assert.deepEqual(((i)=>[i.total,i.computed,i.consistent])(stale.C.cityLayersInfo(stale.m)),[12,80,false]);
});
test('raising rewrites the total and keeps the idle layer; exact token replacement and undo',()=>{
 const {C,m,text}=setup();
 const p=C.setCityLayer(m,{x:1,layer:120});
 assert.deepEqual([p.layer.before,p.layer.after,p.idle.after,p.total.before,p.total.after],[74,120,74,75,121]);assert.equal(p.changes.length,2);
 const out=C.serialize(m);assert.equal(out,setup({},{1:{layer:120,visited:1,idle:74}}).text);assert.deepEqual(read(C,C.parse(out),1),[120,74,121]);
 C.undo(m);assert.equal(C.serialize(m),text);
});
test('lowering clamps a higher idle layer only',()=>{
 const {C,m,text}=setup();
 const p=C.setCityLayer(m,{x:1,layer:50});
 assert.deepEqual([p.layer.after,p.idle.before,p.idle.after,p.total.after],[50,74,50,51]);assert.deepEqual(read(C,m,1),[50,50,51]);
 assert.ok([...m.changes.values()].every(c=>c.group==='city:layers'));
 C.undo(m);assert.equal(C.serialize(m),text);
 const low=setup({},{1:{layer:74,visited:1,idle:10}});C.setCityLayer(low.m,{x:1,layer:50});assert.deepEqual(read(C,low.m,1),[50,10,51]);assert.equal(low.m.changes.size,2);
 // Raising again does not restore the trimmed idle layer; the player moves it with 加层.
 C.setCityLayer(m,{x:1,layer:50});C.setCityLayer(m,{x:1,layer:149});assert.deepEqual(read(C,m,1),[149,50,150]);
});
test('a stale cache is corrected by the next edit; edits on two cities accumulate and restore together',()=>{
 const cities={1:{layer:74,visited:1,idle:74},2:{layer:3,visited:1,idle:3}};
 const stale=setup({},cities,{total:5});
 const p=stale.C.previewCityLayer(stale.m,{x:2,layer:4});assert.deepEqual([p.total.before,p.total.after,p.consistent],[5,80,false]);
 assert.equal(stale.C.previewCityLayer(stale.m,{x:2,layer:3}).unchanged,true);
 const {C,m,text}=setup({},cities);
 C.setCityLayer(m,{x:1,layer:100});C.setCityLayer(m,{x:2,layer:0});assert.deepEqual([read(C,m,1),read(C,m,2)],[[100,74,102],[0,0,102]]);
 C.restore(m,{x:1,y:11,z:0});assert.equal(C.serialize(m),text);
});
test('same layer is a no-op and out-of-range or malformed input is rejected',()=>{
 const {C,m,text}=setup();
 assert.equal(C.previewCityLayer(m,{x:1,layer:74}).unchanged,true);C.setCityLayer(m,{x:1,layer:74});assert.equal(C.serialize(m),text);
 for(const layer of [150,-1,1.5,'30',NaN,Infinity,null])assert.throws(()=>C.previewCityLayer(m,{x:1,layer}),/0–149 的整數/);
 assert.equal(C.previewCityLayer(m,{x:1,layer:149}).total.after,150);
 for(const x of [0,28,37,40,'1'])assert.throws(()=>C.previewCityLayer(m,{x,layer:1}),/只能調整城市/);
});
test('unvisited cities, occupied cities below the maximum and malformed rows are refused',()=>{
 const {C,m}=setup({},{1:{layer:74,visited:1,idle:74},3:{layer:0,visited:0},4:{layer:149,visited:1,idle:149,occupied:1}});
 assert.throws(()=>C.previewCityLayer(m,{x:3,layer:5}),/尚未進入過/);
 assert.throws(()=>C.previewCityLayer(m,{x:4,layer:148}),/已佔領/);assert.equal(C.previewCityLayer(m,{x:4,layer:149}).unchanged,true);
 const bad=(cities,re,x=1)=>{const s=setup({},cities);assert.throws(()=>s.C.previewCityLayer(s.m,{x,layer:1}),re);};
 bad({1:{layer:74,visited:1,idle:74},2:{layer:1.5,visited:1}},/城市層數不是有效整數/);
 bad({1:{layer:74,visited:2,idle:74}},/首次進入旗標/);
 bad({1:{layer:74,visited:1,idle:-1}},/掛機層數/);
 bad({1:{layer:74,visited:1,idle:74,occupied:2}},/佔領旗標/);
 const s=setup();s.data[8][1][0]='x';const m2=s.C.parse('﻿'+JSON.stringify({c2array:true,size:[221,60,22],data:s.data}));assert.throws(()=>s.C.cityLayersInfo(m2),/山寨總聲望/);
});
test('custom fields cannot bypass the named entry',()=>{
 const {C,m,text}=setup();
 for(const c of [{x:1,y:11,z:0},{x:1,y:21,z:0},{x:1,y:38,z:0},{x:1,y:44,z:0},{x:8,y:1,z:0}]){assert.equal(C.resolveField(m,c).editable,false);assert.throws(()=>C.set(m,c,1));}
 assert.equal(C.resolveField(m,{x:1,y:11,z:0}).entity,'許昌');assert.equal(C.resolveField(m,{x:28,y:11,z:0}).known,false);
 assert.equal(C.serialize(m),text);
});
test('extractor reads zddt.json, hashes it and refuses a cap that changes at runtime',()=>{
 const D=require('../scripts/city-layer-data.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'bandit-city-'));
 try{
  const cell=v=>[v],rows=[[0,0,0],[1,'许昌','城市'],[2,'水墨林','野外'],[3,'洛阳','城市']].map(r=>r.map(cell));
  fs.writeFileSync(path.join(root,'zddt.json'),JSON.stringify({c2array:true,size:[4,3,1],data:rows}));
  const variable=[1,'城市层数上限',0,150,true,false,846250900717419,false,1102],game={root,refs:['C3.Plugins.System.Acts.SetVar','C3.Plugins.System.Cnds.CompareVar'],project:[]};
  game.project[6]=[['主事件',[variable,[0,null,false,null,1,0,[[-1,1,null,0,false,false,false,2,null,[[11,846250900717419],[8,0],[7,[1]]]]],[]]]]];
  const out=D.extract(game,{许昌:'許昌'});
  assert.deepEqual([out.layerCap,out.maxLayer,out.cities],[150,149,[{x:1,name:'許昌'},{x:3,name:'洛阳'}]]);assert.match(out.source.sha256,/^[0-9a-f]{64}$/);
  game.project[6][0][1][1][7]=[[-1,0,null,3,0,null,[[11,846250900717419],[7,[2]]]]];assert.throws(()=>D.extract(game),/執行時被修改/);
  fs.rmSync(path.join(root,'zddt.json'));assert.equal(D.extract(game),null);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
