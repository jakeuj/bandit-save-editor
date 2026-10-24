const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// City wall enhancement level [19,1,0]: 0 to (int(z1 #0 y5)+1)×60; lowering it caps the current HP z1 #0 y11 at the
// bonus-free maximum, raising it leaves HP alone like 城墙升级.
function setup(gates={},{level=60,building=0,life=318218,wall=21}={}){
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json'));for(const group of Object.keys(k.verification))k.verification[group]=true;Object.assign(k.verification,gates);
 const ctx={setTimeout};vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));
 // 载入城墙初始数据 lays out z1 row 0; the save marker later overwrites y0.
 [ 'szmnqea',wall,20005,20001,0,building,0,0,0,0,0,life].forEach((v,y)=>data[0][y][1]=v);data[19][1][0]=level;data[1][2][0]=915117675;
 const text='﻿'+JSON.stringify({c2array:true,size:[221,60,22],data}).replace('{','{\r\n"large":987654321098765432109876543210,');return {C,m:C.parse(text),text};
}
// 城墙最大生命 (expression 4415) with 加成属性效果(25) passed in.
const native=(L,B,bonus)=>Math.round((((80+Math.ceil(((3.34*Math.pow(Math.trunc(L+2),2.5))*Math.pow(1.02,Math.trunc(L+2)))))*Math.pow(1.2,Math.trunc(B)))*((100+bonus)/100)));
const wall=(C,m)=>[C.get(m,{x:19,y:1,z:0}),C.get(m,{x:0,y:11,z:1})];
test('gate defaults closed in the catalog and the extractor',()=>{
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json'));
 assert.equal(typeof k.verification.wallEnhancementLevel,'boolean');
 assert.match(fs.readFileSync('scripts/extract-game.cjs','utf8'),/wallEnhancementLevel:false/);
});
test('closed gate previews but refuses to write',()=>{
 const {C,m,text}=setup({wallEnhancementLevel:false});
 const p=C.previewWallEnhancementLevel(m,{level:30});assert.equal(p.verified,false);assert.equal(p.changes.length,2);
 assert.throws(()=>C.setWallEnhancementLevel(m,{level:30}),/尚未完成/);assert.equal(C.serialize(m),text);
});
test('info reads level, building cap, HP and the bonus-free maximum',()=>{
 const {C,m}=setup({},{level:61,building:1,life:100});
 const info=C.wallEnhancementInfo(m);
 assert.deepEqual([info.level,info.building,info.cap,info.life,info.baseLife],[61,1,120,100,native(61,1,0)]);
 assert.equal(C.wallEnhancementInfo(setup().m).baseLife,345174);
});
test('bonus-free maximum matches the native formula and never exceeds it with a bonus',()=>{
 for(const B of [0,1,3])for(const L of [0,1,2,17,59,60,61,119,240]){
  const {C,m}=setup({},{level:L,building:B,life:0});const base=C.wallEnhancementInfo(m).baseLife;
  assert.equal(base,native(L,B,0),`L=${L} B=${B}`);for(const bonus of [0.5,7,40,250])assert.ok(base<=native(L,B,bonus));
 }
});
test('raising keeps HP; exact token replacement and undo',()=>{
 const {C,m,text}=setup({},{level:20,life:5000});
 const p=C.setWallEnhancementLevel(m,{level:60});
 assert.deepEqual([p.level.before,p.level.after,p.life.before,p.life.after],[20,60,5000,5000]);assert.equal(p.changes.length,1);
 // Only the level token changes: the BOM, the large literal and every other cell stay byte-identical.
 const out=C.serialize(m);assert.equal(out,setup({},{level:60,life:5000}).text);assert.deepEqual(wall(C,C.parse(out)),[60,5000]);
 C.undo(m);assert.equal(C.serialize(m),text);
});
test('lowering caps HP above the new bonus-free maximum, keeps HP below it, and undo restores both',()=>{
 const {C,m,text}=setup();
 const p=C.setWallEnhancementLevel(m,{level:30});
 assert.deepEqual([p.level.after,p.life.before,p.life.after,p.baseLife],[30,318218,native(30,0,0),native(30,0,0)]);
 assert.deepEqual(wall(C,C.parse(C.serialize(m))),[30,native(30,0,0)]);
 assert.ok([...m.changes.values()].every(c=>c.group==='wall:enhancement'));
 C.undo(m);assert.equal(C.serialize(m),text);
 const low=setup({},{life:900});C.setWallEnhancementLevel(low.m,{level:30});assert.deepEqual(wall(C,low.m),[30,900]);
 assert.equal(low.m.changes.size,1);
 // Raising again does not restore the trimmed HP; the game regenerates it.
 C.setWallEnhancementLevel(m,{level:30});C.setWallEnhancementLevel(m,{level:60});assert.deepEqual(wall(C,m),[60,native(30,0,0)]);
});
test('same level is a no-op and over-cap or malformed input is rejected',()=>{
 const {C,m,text}=setup();
 assert.equal(C.previewWallEnhancementLevel(m,{level:60}).unchanged,true);C.setWallEnhancementLevel(m,{level:60});assert.equal(C.serialize(m),text);
 for(const level of [61,-1,1.5,'30',NaN,Infinity,null])assert.throws(()=>C.previewWallEnhancementLevel(m,{level}),/0–60 的整數/);
 assert.equal(C.previewWallEnhancementLevel(setup({},{building:2}).m,{level:180}).cap,180);
 assert.throws(()=>C.previewWallEnhancementLevel(setup({},{building:2}).m,{level:181}),/0–180/);
});
test('missing wall row or malformed values are refused',()=>{
 const {C}=setup();
 assert.throws(()=>C.wallEnhancementInfo(setup({},{wall:0}).m),/找不到城牆/);
 assert.throws(()=>C.wallEnhancementInfo(setup({},{building:0.5}).m),/建築等級/);
 assert.throws(()=>C.wallEnhancementInfo(setup({},{level:-1}).m),/強化等級/);
 assert.throws(()=>C.wallEnhancementInfo(setup({},{life:'x'}).m),/目前生命/);
});
test('custom fields cannot bypass the named entry',()=>{
 const {C,m,text}=setup();
 assert.equal(C.resolveField(m,{x:19,y:1,z:0}).editable,false);assert.equal(C.resolveField(m,{x:0,y:11,z:1}).editable,false);
 assert.throws(()=>C.setField(m,{x:19,y:1,z:0},30));assert.throws(()=>C.set(m,{x:19,y:1,z:0},30));assert.throws(()=>C.set(m,{x:0,y:11,z:1},1));
 assert.equal(C.serialize(m),text);
});
