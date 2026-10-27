const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Basic technologies [t,4,0] (kj 1–29; #29 武庫 since V1.0.13.0) are 0/1 unlocks. Raising writes 1, clears the research points y12 as 采集核心碰撞
// does, and unlocks the missing prerequisite chain (kj column 7); techs under research are refused and lowering is not offered.
// The fixture mirrors the smoke base: 13, 14, 15, 17, 18, 24–27 and 29 locked.
const lockedIds=[13,14,15,17,18,24,25,26,27,29];
function setup(gates={},edit=()=>{}){
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json'));for(const group of Object.keys(k.verification))k.verification[group]=true;Object.assign(k.verification,gates);
 const ctx={setTimeout};vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';
 for(let t=1;t<=29;t++)data[t][4][0]=lockedIds.includes(t)?0:1;
 data[15][12][0]=1234.5;data[31][4][0]=1;
 edit(data);
 const text='﻿'+JSON.stringify({c2array:true,size:[221,60,22],data}).replace('{','{\r\n"large":987654321098765432109876543210,');return {C,m:C.parse(text),text,data};
}
const level=(C,m,t)=>C.get(m,{x:t,y:4,z:0});
test('catalog carries the 29 basic prerequisites; gate defaults closed in the extractor',()=>{
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json'));
 assert.match(fs.readFileSync('scripts/extract-game.cjs','utf8'),/basicTechnologyLevel:false/);
 const basic=k.catalogs.technologies.filter(t=>'prerequisite' in t);
 assert.deepEqual(basic.map(t=>t.id),Array.from({length:29},(_,i)=>i+1));
 assert.deepEqual([1,2,8,14,20,26,29].map(id=>basic.find(t=>t.id===id).prerequisite),[0,1,5,16,21,15,19]);
 assert.ok(basic.every(t=>t.tableLimit===1&&!t.advanced));
});
test('closed gate previews but refuses to write',()=>{
 const {C,m,text}=setup({basicTechnologyLevel:false});
 const p=C.previewBasicTechnology(m,{technologyId:14});assert.equal(p.verified,false);assert.equal(p.changes.length,1);
 assert.throws(()=>C.setBasicTechnology(m,{technologyId:14}),/尚未完成/);assert.equal(C.serialize(m),text);
});
test('info lists all 29 with level, points and research state',()=>{
 const {C,m}=setup();const info=C.basicTechnologiesInfo(m);
 assert.deepEqual([info.technologies.length,info.unlocked,info.verified],[29,19,true]);
 assert.deepEqual([...info.technologies.filter(t=>t.level===0).map(t=>t.id)],lockedIds);
 const t15=info.technologies.find(t=>t.id===15);assert.deepEqual([t15.name,t15.prerequisite,t15.points,t15.researching],['礦坑',16,1234.5,false]);
});
test('a tech whose prerequisite is unlocked writes only its level; exact token replacement and undo',()=>{
 const {C,m,text}=setup();
 const p=C.setBasicTechnology(m,{technologyId:14});
 assert.deepEqual([...p.chain.map(t=>t.id)],[14]);assert.equal(m.changes.size,1);assert.equal(level(C,m,14),1);
 const out=C.serialize(m);assert.equal(out,setup({},d=>{d[14][4][0]=1;}).text);
 C.undo(m);assert.equal(C.serialize(m),text);
 // 29 武庫 needs 19 主動尋訪 (unlocked).
 const armory=C.setBasicTechnology(m,{technologyId:29});
 assert.deepEqual([armory.technology.name,[...armory.chain.map(t=>t.id)]],['武庫',[29]]);assert.equal(C.serialize(m),setup({},d=>{d[29][4][0]=1;}).text);
 C.undo(m);assert.equal(C.serialize(m),text);
});
test('missing prerequisites unlock in the same step and the research points clear',()=>{
 const {C,m,text}=setup();
 // 26 司職任免 needs 15 礦坑 (locked, 1234.5 points), which needs 16 農莊 (unlocked).
 const p=C.previewBasicTechnology(m,{technologyId:26});
 assert.deepEqual([...p.chain.map(t=>t.id)],[15,26]);
 assert.deepEqual([...p.changes.map(c=>[c.coordinate.x,c.coordinate.y,c.before,c.after])],[[15,4,0,1],[15,12,1234.5,0],[26,4,0,1]]);
 C.setBasicTechnology(m,{technologyId:26});
 assert.deepEqual([level(C,m,15),C.get(m,{x:15,y:12,z:0}),level(C,m,26)],[1,0,1]);
 assert.ok([...m.changes.values()].every(c=>c.group==='technology:basic'));
 assert.equal(C.serialize(m),setup({},d=>{d[15][4][0]=1;d[15][12][0]=0;d[26][4][0]=1;}).text);
 // 25 修煉技術 → 18 置物台 → 17 渡劫台 → 12 校場 (unlocked).
 assert.deepEqual([...C.previewBasicTechnology(m,{technologyId:25}).chain.map(t=>t.id)],[17,18,25]);
 C.undo(m);assert.equal(C.serialize(m),text);
});
test('restoring any basic tech change restores the whole chain together',()=>{
 const {C,m,text}=setup();
 C.setBasicTechnology(m,{technologyId:26});C.setBasicTechnology(m,{technologyId:14});assert.equal(m.changes.size,4);
 C.restore(m,{x:15,y:4,z:0});assert.equal(C.serialize(m),text);
});
test('unlocked techs are a no-op; invalid ids and lowering are not offered',()=>{
 const {C,m,text}=setup();
 for(const technologyId of [1,2,8,28]){assert.equal(C.previewBasicTechnology(m,{technologyId}).unchanged,true);C.setBasicTechnology(m,{technologyId});}
 assert.equal(C.serialize(m),text);
 for(const technologyId of [0,30,31,44,'14',1.5,null])assert.throws(()=>C.previewBasicTechnology(m,{technologyId}),/只支援基礎科技/);
 assert.equal(typeof C.lowerBasicTechnology,'undefined');
});
test('a tech or prerequisite under research is refused',()=>{
 const flagged=setup({},d=>{d[15][13][0]=1;});
 assert.throws(()=>flagged.C.previewBasicTechnology(flagged.m,{technologyId:26}),/礦坑正在研究/);
 assert.equal(flagged.C.basicTechnologiesInfo(flagged.m).technologies.find(t=>t.id===15).researching,true);
 // A 書院 (building template 5) facility whose process points at 14.
 const busy=setup({},d=>{d[3][0][1]=3;d[3][1][1]=5;d[4][0][21]=4;d[4][2][21]=3;d[4][3][21]=14;});
 assert.throws(()=>busy.C.previewBasicTechnology(busy.m,{technologyId:14}),/林場正在研究/);
 // The same process in another building does not count.
 const other=setup({},d=>{d[3][0][1]=3;d[3][1][1]=6;d[4][0][21]=4;d[4][2][21]=3;d[4][3][21]=14;});
 assert.equal(other.C.previewBasicTechnology(other.m,{technologyId:14}).changes.length,1);
});
test('non-native levels, points and flags are refused',()=>{
 const bad=(edit,re)=>{const s=setup({},edit);assert.throws(()=>s.C.basicTechnologiesInfo(s.m),re);};
 bad(d=>{d[7][4][0]=301;},/調整難度的科技等級不是 0 或 1/);
 bad(d=>{d[7][4][0]=0.5;},/科技等級不是 0 或 1/);
 bad(d=>{d[7][12][0]=-1;},/研究點數/);
 bad(d=>{d[7][12][0]='x';},/研究點數/);
 bad(d=>{d[7][13][0]=2;},/研究狀態/);
});
test('custom fields cannot bypass the named entry; advanced techs keep their own editor',()=>{
 const {C,m,text}=setup();
 for(const c of [{x:14,y:4,z:0},{x:14,y:12,z:0},{x:14,y:13,z:0}]){const f=C.resolveField(m,c);assert.equal(f.editable,false);assert.equal(f.known,true);assert.match(f.reason,/基礎科技解鎖/);assert.throws(()=>C.set(m,c,1));}
 assert.equal(C.resolveField(m,{x:14,y:12,z:0}).label,'科技研究點數');
 assert.doesNotMatch(C.resolveField(m,{x:31,y:4,z:0}).reason,/基礎科技/);
 assert.throws(()=>C.setAdvancedTechnologyLevel(m,{technologyId:14,level:1}),/進階科技/);
 assert.equal(C.serialize(m),text);
});
