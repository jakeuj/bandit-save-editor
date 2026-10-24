const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Placed relics: z19 y5–9 and the y10 mean change together while the relic sits on a 置物台 linked both ways.
function setup(gates={},row={},stand={}){
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json'));for(const group of Object.keys(k.verification))k.verification[group]=true;Object.assign(k.verification,gates);
 const ctx={setTimeout};vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';
 // 置物台 #5 at Lv 2 holds z19 row 2: 妖狐靈火 level 2, quality 1, a natural roll; y0 keeps the backpack row it came from.
 const building={0:5,1:67,2:10020,3:10004,5:2,9:2,...stand};for(const [y,v]of Object.entries(building))data[5][y][1]=v;
 const values={0:7,1:1,2:2,3:1,4:1,5:1.2,6:1.6,7:0.4,8:1.6,9:0.9,10:1.1,12:5,...row};for(const [y,v]of Object.entries(values))data[2][y][19]=v;
 // A backpack relic stays on its own path.
 [1,3,4,1,3,1.9,4.3,1.7,2.8,3.8,2.9].forEach((v,y)=>data[1][y][18]=v);
 const text='﻿'+JSON.stringify({c2array:true,size:[221,60,22],data}).replace('{','{\r\n"large":987654321098765432109876543210,');return {C,k,m:C.parse(text),text};
}
const row=(C,m,x=2)=>Array.from({length:14},(_,y)=>C.get(m,{x,y,z:19}));
test('the gate defaults closed and previews without writing',()=>{
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json'));assert.equal(typeof k.verification.placedRelicAttributes,'boolean');
 assert.match(fs.readFileSync('scripts/extract-game.cjs','utf8'),/placedRelicAttributes:false/);
 const {C,m,text}=setup({placedRelicAttributes:false}),info=C.placedRelicAttributesInfo(m,{itemId:2});
 assert.equal(info.verified,false);assert.equal(C.previewPlacedRelicAttributes(m,{itemId:2,values:info.proportional}).verified,false);
 assert.throws(()=>C.setPlacedRelicAttributes(m,{itemId:2,values:info.proportional}),/尚未完成/);assert.equal(C.serialize(m),text);
 // The backpack gate does not open placed rows, nor the reverse.
 const s=setup({relicAttributes:false});assert.ok(s.C.setPlacedRelicAttributes(s.m,{itemId:2,values:info.proportional}).changes.length);
 assert.throws(()=>s.C.setRelicAttributes(s.m,{itemId:1,values:s.C.relicAttributesInfo(s.m,{itemId:1}).proportional}),/尚未完成/);
});
test('lists placed rows and reads the stand, the natural range and the tile aura',()=>{
 const {C,m}=setup(),info=C.placedRelicAttributesInfo(m,{itemId:2});
 assert.deepEqual([...C.listPlacedRelics(m).map(r=>[r.id,r.building])].map(x=>[...x]),[[2,5]]);assert.deepEqual([...C.listRelics(m).map(r=>r.id)],[1]);
 assert.deepEqual([info.name,info.level,info.quality,info.total.min,info.total.max,info.natural,info.building.id,info.building.level],['妖狐靈火',2,1,5.6,7.7,true,5,2]);
 // 刷新地块灵气 (expressions 3890–3895): round(10·a·(1+0.15L))/10 per element and for the y10 mean.
 assert.deepEqual([...info.aura.elements],[1.6,2.1,0.5,2.1,1.2]);assert.equal(info.aura.total,1.4);assert.equal(info.aura.factor,1.3);
});
test('writes only z19 y5–10, keeps the links and raw tokens, previews the new aura and undoes as one step',()=>{
 const {C,m,text}=setup(),info=C.placedRelicAttributesInfo(m,{itemId:2}),before=row(C,m);
 const p=C.setPlacedRelicAttributes(m,{itemId:2,values:info.proportional});
 assert.deepEqual(row(C,m).slice(5,11),[...info.proportional,p.average.after]);assert.deepEqual(row(C,m).filter((_,y)=>y<5||y>10),before.filter((_,y)=>y<5||y>10));
 assert.ok([...m.changes.values()].every(c=>c.z===19&&c.x===2&&c.y>=5&&c.y<=10&&c.group==='relic:placed:2'));
 assert.deepEqual([...p.aura.after.elements],[...info.proportional].map(a=>Math.round((10*a)*(1+(2*0.15)))/10));assert.equal(p.aura.after.total,Math.round((10*p.average.after)*1.3)/10);
 assert.equal(C.get(m,{x:5,y:9,z:1}),2);
 const out=C.serialize(m),src=JSON.parse(text.replace(/^﻿/,'')),got=JSON.parse(out.replace(/^﻿/,''));assert.ok(out.startsWith('﻿{\r\n"large":987654321098765432109876543210,'));
 for(let y=5;y<=10;y++)src.data[2][y][19]=row(C,m)[y];assert.deepEqual(got,src);
 assert.equal(C.placedRelicAttributesInfo(C.parse(out),{itemId:2}).natural,true);
 C.undo(m);assert.equal(C.serialize(m),text);
 C.setPlacedRelicAttributes(m,{itemId:2,values:info.focused[0]});C.setRelicAttributes(m,{itemId:1,values:C.relicAttributesInfo(m,{itemId:1}).proportional});
 C.restore(m,{x:2,y:5,z:19});assert.ok([...m.changes.values()].every(c=>c.z===18),'restore drops the whole placed relic group');C.restoreAll(m);assert.equal(C.serialize(m),text);
});
test('re-entering current values is a no-op and partial edits touch only changed cells',()=>{
 const {C,m,text}=setup();
 assert.equal(C.setPlacedRelicAttributes(m,{itemId:2,values:[1.2,1.6,0.4,1.6,0.9]}).unchanged,true);assert.equal(m.history.length,0);assert.equal(C.serialize(m),text);
 const p=C.setPlacedRelicAttributes(m,{itemId:2,values:[1.2,1.7,0.4,1.6,0.9]});assert.deepEqual([...p.changes.map(c=>c.coordinate.y)],[6,10]);
});
test('rejects unnatural vectors and malformed input without writing',()=>{
 const {C,m,text}=setup();
 for(const values of [[1.3,1.3,1.3,1.3,1.3],[9,9,9,9,9],[1.2,1.6,0.4,1.6],[1.2,1.6,0.4,1.6,0.95],[1.2,1.6,-0.4,1.6,0.9],[1.2,'1.6',0.4,1.6,0.9]])assert.throws(()=>C.setPlacedRelicAttributes(m,{itemId:2,values}));
 for(const itemId of [0,1,221,1.5])assert.throws(()=>C.placedRelicAttributesInfo(m,{itemId}));
 assert.equal(C.serialize(m),text);
});
test('rows off a linked 置物台 stay read-only',()=>{
 for(const [row,stand,pattern]of [
  [{12:0},{},/建築不存在/],[{12:5.5},{},/建築不存在/],[{12:300},{},/建築不存在/],[{},{0:4},/建築不存在/],
  [{},{1:8},/不在置物台/],[{},{9:3},/互相對應/],[{},{9:0},/互相對應/],[{},{5:5},/0–4/],[{},{5:1.5},/0–4/],
  [{1:0},{},/沒有擺放中/],[{1:99},{},/基底/],[{4:7},{},/品質或等級/],[{0:0},{},/列號/],[{7:'x'},{},/有效數值/],[{10:null},{},/有效數值/]]){
  const {C,m,text}=setup({},row,stand);assert.throws(()=>C.placedRelicAttributesInfo(m,{itemId:2}),pattern,JSON.stringify([row,stand]));assert.equal(C.serialize(m),text);
 }
});
test('custom coordinates cannot write z19 or the stand link',()=>{
 const {C,m,text}=setup();
 for(let y=0;y<=13;y++){assert.equal(C.resolveField(m,{x:2,y,z:19}).editable,false);assert.throws(()=>C.set(m,{x:2,y,z:19},2),/唯讀/);}
 assert.throws(()=>C.set(m,{x:5,y:9,z:1},3),/唯讀/);assert.equal(C.serialize(m),text);
});
test('the shipped flag has a lightweight smoke record and stays out of the composite migration proof',()=>{
 const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),P=require('../scripts/migration-proof.cjs');
 assert.equal(k.verification.placedRelicAttributes,true);assert.equal(proof.groups.placedRelicAttributes,true);
 const rec=proof.lightweight.placedRelicAttributes;assert.equal(rec.passed,true);assert.equal(rec.gameVersion,k.gameVersion);
 assert.equal(P.composite(proof,'placedRelicAttributes'),false);
});
