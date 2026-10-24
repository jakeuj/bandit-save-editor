const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Building levels z1 [x,5,1]: raise only, up to min(4, floor((advanced tech jz[t,34] + 1) / 60)). Rows under construction
// (y4>0), upgrading (y10=1) or occupied (y7>0) are refused; 建造局 has no upgrade tech. The walls (row 0) share the
// wall:enhancement group; a training cap or advanced tech that only fits under a raised 校場／書院 joins that building's group.
function setup(gates={},edit=()=>{}){
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json'));for(const group of Object.keys(k.verification))k.verification[group]=true;Object.assign(k.verification,gates);
 const ctx={setTimeout};vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';
 // Walls (row 0): level 1, enhancement 60, HP 100. Rows 1–8: 聚義堂 1, 書院 1, 校場 0, 營房 under construction, 招募處
 // upgrading, 渡劫台 occupied by character 3, 建造局 0, 置物台 0 with a relic. (A level-0 校場 keeps the editor's earlier
 // training cap of 0, so the fixture starts it at 1.)
 data[0][1][1]=21;data[0][5][1]=1;data[0][11][1]=100;data[19][1][0]=60;
 [[1,1,1],[2,5,1],[3,6,1],[4,2,0],[5,3,1],[6,66,2],[7,4,0],[8,67,0]].forEach(([x,t,l])=>{data[x][0][1]=x;data[x][1][1]=t;data[x][5][1]=l;});
 data[4][4][1]=512.5;data[5][4][1]=10;data[5][10][1]=1;data[6][7][1]=3;data[8][9][1]=4;
 // Advanced techs: 主堂 150 (cap 2), 研究 239 (cap 4), 操練 119 (cap 2), 修煉 299, 城牆 119 (cap 2), 靈物 0 (cap 0).
 Object.entries({31:150,32:299,33:299,40:239,41:119,42:299,43:119,44:0}).forEach(([t,l])=>{data[t][4][0]=l;});
 data[1][5][0]=5;
 edit(data);
 const text='﻿'+JSON.stringify({c2array:true,size:[221,60,22],data}).replace('{','{\r\n"large":987654321098765432109876543210,');return {C,m:C.parse(text),text,data};
}
const level=(C,m,x)=>C.get(m,{x,y:5,z:1});
test('catalog carries each building upgrade tech; 建造局 has none; gate defaults closed in the extractor',()=>{
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json'));
 assert.match(fs.readFileSync('scripts/extract-game.cjs','utf8'),/buildingLevel:false/);
 assert.equal(k.verification.buildingLevel!==undefined,true);
 const tech=Object.fromEntries(k.catalogs.buildings.filter(b=>'upgradeTechnology' in b).map(b=>[b.id,b.upgradeTechnology]));
 assert.deepEqual(tech,{1:31,2:32,3:33,5:40,6:41,7:34,8:35,9:36,10:37,11:38,12:39,21:43,66:42,67:44});
});
test('closed gate previews but refuses to write',()=>{
 const {C,m,text}=setup({buildingLevel:false});
 const p=C.previewBuildingLevel(m,{x:1,level:2});assert.equal(p.verified,false);assert.equal(p.changes.length,1);
 assert.throws(()=>C.setBuildingLevel(m,{x:1,level:2}),/尚未完成/);assert.equal(C.serialize(m),text);
});
test('info lists built rows with caps and refusal reasons; 建造局 is not listed',()=>{
 const {C,m}=setup();const info=C.buildingLevelsInfo(m);
 assert.deepEqual([...info.rows.map(r=>r.x)],[0,1,2,3,4,5,6,8]);assert.equal(info.maxLevel,4);
 const r=x=>info.rows.find(r=>r.x===x);
 assert.deepEqual([r(0).name,r(0).cap,r(1).cap,r(2).cap,r(3).cap],['城牆',2,2,4,2]);
 assert.equal(r(0).reason,undefined);assert.equal(r(2).reason,undefined);
 assert.match(r(4).reason,/施工中/);assert.match(r(5).reason,/升階中/);assert.match(r(6).reason,/角色佔用/);assert.match(r(8).reason,/靈物技術需達 Lv 60/);
});
test('raising writes only y5 with exact token replacement; undo restores the bytes',()=>{
 const {C,m,text}=setup();
 const p=C.setBuildingLevel(m,{x:1,level:2});
 assert.deepEqual([p.level.before,p.level.after,p.group],[1,2,'building:1']);assert.equal(m.changes.size,1);assert.equal(level(C,m,1),2);
 assert.equal(C.serialize(m),setup({},d=>{d[1][5][1]=2;}).text);
 C.setBuildingLevel(m,{x:2,level:4});assert.equal(C.serialize(m),setup({},d=>{d[1][5][1]=2;d[2][5][1]=4;}).text);
 C.undo(m);C.undo(m);assert.equal(C.serialize(m),text);
});
test('lowering, same level, past the tech cap or 4, and bad inputs are refused',()=>{
 const {C,m,text}=setup();
 for(const lv of [0,1,3,5,1.5,'2',null])assert.throws(()=>C.previewBuildingLevel(m,{x:1,level:lv}),/只能升高，須為 2–2/);
 assert.throws(()=>C.previewBuildingLevel(m,{x:7,level:1}),/建造局與裝飾不在範圍/);
 for(const x of [9,220,-1,'1',1.5])assert.throws(()=>C.previewBuildingLevel(m,{x,level:2}),/不在範圍/);
 for(const x of [4,5,6,8])assert.throws(()=>C.previewBuildingLevel(m,{x,level:1}));
 const top=setup({},d=>{d[2][5][1]=4;});assert.match(top.C.buildingLevelsInfo(top.m).rows.find(r=>r.x===2).reason,/最高等級/);
 assert.equal(C.serialize(m),text);
});
test('non-native rows become read-only without blocking the others',()=>{
 const s=setup({},d=>{d[1][5][1]=5;d[2][10][1]=2;d[3][7][1]=-1;d[8][4][1]='x';d[44][4][0]=0.5;});
 const r=x=>s.C.buildingLevelsInfo(s.m).rows.find(r=>r.x===x).reason;
 assert.match(r(1),/0–4 整數/);assert.match(r(2),/施工資料/);assert.match(r(3),/佔用角色欄位/);assert.match(r(8),/施工資料/);
 assert.equal(r(0),undefined);
 const t=setup({},d=>{d[44][4][0]=0.5;});assert.match(t.C.buildingLevelsInfo(t.m).rows.find(r=>r.x===8).reason,/靈物技術等級/);
});
test('the walls share the enhancement group: restoring either restores both',()=>{
 const {C,m,text}=setup();
 assert.equal(C.wallEnhancementInfo(m).cap,120);
 const p=C.setBuildingLevel(m,{x:0,level:2});assert.equal(p.group,'wall:enhancement');assert.equal(C.wallEnhancementInfo(m).cap,180);
 C.setWallEnhancementLevel(m,{level:170});
 C.restore(m,{x:0,y:5,z:1});assert.equal(C.serialize(m),text);
 C.setBuildingLevel(m,{x:0,level:2});C.setWallEnhancementLevel(m,{level:170});C.restore(m,{x:19,y:1,z:0});assert.equal(C.serialize(m),text);
});
test('an advanced tech or training cap above the original cap joins the raised building group',()=>{
 const {C,m,text}=setup();
 assert.equal(C.editingInfo(m,'technology',33).normalMax,119);
 C.setBuildingLevel(m,{x:2,level:3});assert.equal(C.editingInfo(m,'technology',33).normalMax,239);
 C.setAdvancedTechnologyLevel(m,{technologyId:33,level:200});C.setAdvancedTechnologyLevel(m,{technologyId:34,level:100});
 const group=c=>m.changes.get(`${c.x},${c.y},${c.z}`).group;
 assert.deepEqual([group({x:33,y:4,z:0}),group({x:34,y:4,z:0})],['building:2','editing:technology:34']);
 C.restore(m,{x:33,y:4,z:0});assert.deepEqual([level(C,m,2),C.get(m,{x:33,y:4,z:0}),C.get(m,{x:34,y:4,z:0})],[1,299,100]);
 // 校場 1→2 raises the training cap 15→20; 18 needs it, 12 does not.
 C.setBuildingLevel(m,{x:3,level:2});C.setProfessionTrainingCap(m,{professionId:1,cap:18});
 assert.equal(group({x:1,y:5,z:0}),'building:3');
 C.setProfessionTrainingCap(m,{professionId:1,cap:12});assert.equal(group({x:1,y:5,z:0}),'editing:training:1');
 C.setProfessionTrainingCap(m,{professionId:1,cap:19});C.restore(m,{x:3,y:5,z:1});
 assert.deepEqual([level(C,m,3),C.get(m,{x:1,y:5,z:0})],[1,5]);
 C.restore(m,{x:34,y:4,z:0});assert.equal(C.serialize(m),text);
});
test('custom fields cannot bypass the named entry',()=>{
 const {C,m,text}=setup();
 for(const c of [{x:1,y:5,z:1},{x:1,y:4,z:1},{x:1,y:10,z:1},{x:6,y:7,z:1},{x:0,y:5,z:1},{x:0,y:11,z:1}]){const f=C.resolveField(m,c);assert.equal(f.editable,false);assert.equal(f.known,true);assert.throws(()=>C.set(m,c,2));}
 assert.match(C.resolveField(m,{x:1,y:5,z:1}).reason,/建築等級具名操作/);assert.match(C.resolveField(m,{x:0,y:11,z:1}).reason,/城牆強化/);
 assert.equal(C.resolveField(m,{x:1,y:5,z:1}).label,'建築等級');
 assert.notEqual(C.resolveField(m,{x:9,y:5,z:1}).label,'建築等級');
 assert.equal(C.serialize(m),text);
});
