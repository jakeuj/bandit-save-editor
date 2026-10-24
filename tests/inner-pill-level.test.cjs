'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {setup:baseSetup}=require('./helpers/batch-fixture.cjs');
// Unabsorbed inner pill level: only z7／z9 y6 changes, 1 to 10+(q−1)×5. Row 400 is a backpack pill (Q3), row 401 a pill worn
// by character 2 in slot 5 (z2 y20, Q2), row 402 an unworn z9 pill that only native slot replacement could leave behind.
function setup({gates=[true,true],patch=()=>{}}={}){
 const f=baseSetup(450,3),inner=f.k.catalogs.items.filter(i=>i.kind==='内丹'),tier=id=>f.k.batch2Data.items[id].tier;
 const pill=(x,z,template,q,level,owner)=>{const r=f.a[x];[[0,x],[1,template.id],[2,1],[3,tier(template.id)],[5,q],[6,level],[7,owner],[8,100],[24,1]].forEach(([y,v])=>r[y][z]=v);};
 pill(400,7,inner[0],3,4,0);pill(401,9,inner[10],2,1,2);f.a[2][20][2]=401;pill(402,9,inner[1],1,1,0);
 patch(f.a,f.k);
 f.C.KNOWLEDGE.verification.backpackInnerPillLevel=gates[0];f.C.KNOWLEDGE.verification.innerPillLevel=gates[1];
 return {...f,inner,m:f.reparse(),raw:f.rawWith()};
}
const level=(C,m,itemId,plane,value)=>C.setInnerPillLevel(m,{itemId,plane,level:value});

test('gates default closed in the extractor and are registered in the batch2 family',()=>{
 const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),S=require('../scripts/verification-suite.cjs');
 for(const g of ['backpackInnerPillLevel','innerPillLevel']){
  assert.equal(typeof k.verification[g],'boolean');
  assert.match(fs.readFileSync('scripts/extract-game.cjs','utf8'),new RegExp(g+':false'));
  assert.equal(S.familyOf(g),'batch2');
  if(k.verification[g]){assert.equal(proof.groups[g],true);assert.equal(proof.lightweight[g].passed,true);assert.equal(proof.lightweight[g].gameVersion,k.gameVersion);}
 }
});

test('info reports tier, quality, cap and the plane group',()=>{
 const {C,m,k}=setup(),bag=C.innerPillLevelInfo(m,{itemId:400,plane:7}),worn=C.innerPillLevelInfo(m,{itemId:401,plane:9});
 assert.deepEqual([bag.isInnerPill,bag.current,bag.normalMax,bag.quality,bag.group,bag.worn],[true,4,20,3,'backpackInnerPillLevel',false]);
 assert.deepEqual([worn.current,worn.normalMax,worn.owner,worn.group,worn.worn],[1,15,2,'innerPillLevel',true]);
 assert.equal(worn.tier,k.batch2Data.items[worn.record[1]].tier);
});

test('closed gates preview but refuse to write, each plane on its own flag',()=>{
 const {C,m,raw}=setup({gates:[false,true]}),p=C.previewInnerPillLevel(m,{itemId:400,plane:7,level:20});
 assert.equal(p.verified,false);assert.equal(p.canApply,false);assert.equal(p.changes.length,1);assert.equal(p.reasons.length,0);
 assert.throws(()=>level(C,m,400,7,20),/尚未完成/);assert.equal(C.serialize(m),raw);
 level(C,m,401,9,15);assert.equal(m.changes.size,1);
});

test('raise and lower write only y6 and keep exact bytes elsewhere; undo and restore revert',()=>{
 const {C,m,rawWith}=setup();
 level(C,m,400,7,20);level(C,m,401,9,15);
 assert.equal(C.serialize(m),rawWith([[400,6,7,20],[401,6,9,15]]));
 level(C,m,401,9,3);assert.equal(C.serialize(m),rawWith([[400,6,7,20],[401,6,9,3]]));
 C.undo(m);assert.equal(C.get(m,{x:401,y:6,z:9}),15);
 C.restore(m,{x:401,y:6,z:9});C.restore(m,{x:400,y:6,z:7});assert.equal(m.changes.size,0);
 level(C,m,400,7,1);assert.equal(C.get(m,{x:400,y:6,z:7}),1);
});

test('same level writes nothing; range, type and extra options are rejected',()=>{
 const {C,m,raw}=setup();
 const same=level(C,m,400,7,4);assert.equal(same.unchanged,true);assert.equal(m.changes.size,0);
 for(const v of [0,21,2.5,'5',null])assert.throws(()=>level(C,m,400,7,v),/1–20 的整數/);
 assert.throws(()=>C.setInnerPillLevel(m,{itemId:400,plane:7,level:5,advanced:true}),/只接受/);
 assert.throws(()=>level(C,m,400,8,5),/庫別或編號/);
 assert.equal(C.serialize(m),raw);
});

test('z9 accepts worn pills only and checks the slot-5 pointer both ways',()=>{
 const {C,m}=setup();
 assert.throws(()=>level(C,m,402,9,2),/只支援穿戴中/);
 const moved=setup({patch:a=>{a[2][20][2]=0;a[2][19][2]=401;}});
 assert.throws(()=>level(moved.C,moved.m,401,9,2),/穿戴雙向指標/);
 const owner=setup({patch:a=>{a[401][7][9]=3;}});
 assert.throws(()=>level(owner.C,owner.m,401,9,2),/穿戴雙向指標/);
 const stale=setup({patch:a=>{a[400][7][7]=2;}});
 level(stale.C,stale.m,400,7,6);assert.equal(stale.C.get(stale.m,{x:400,y:6,z:7}),6);
 const ghost=setup({patch:a=>{a[400][7][7]=9;}});
 assert.throws(()=>level(ghost.C,ghost.m,400,7,6),/歸屬不符/);
});

test('templates, metadata, quality and over-limit rows stay read-only',()=>{
 const cases=[
  [a=>{a[400][1][7]=556;},/不是已辨識的內丹/],
  [a=>{a[400][3][7]=9;},/等階/],
  [a=>{a[400][2][7]=2;},/數量/],
  [a=>{a[400][4][7]=1;},/狀態/],
  [a=>{a[400][9][7]=12;},/詞條或特殊狀態/],
  [a=>{a[400][27][7]=1;},/詞條或特殊狀態/],
  [a=>{a[400][22][7]=2;},/詞條或特殊狀態/],
  [a=>{a[400][5][7]=7;},/品質 1–6/],
  [a=>{a[400][6][7]=21;},/超限停用/],
 ];
 for(const [patch,error] of cases){const {C,m,raw}=setup({patch});assert.throws(()=>level(C,m,400,7,5),error);assert.equal(C.serialize(m),raw);}
 const locked=setup({patch:a=>{a[400][22][7]=1;a[400][24][7]=0;}});level(locked.C,locked.m,400,7,5);
});

test('legacy equipment entries, batch and custom coordinates still refuse inner pills',()=>{
 const {C,m,raw}=setup();
 assert.throws(()=>C.setEquipmentLevel(m,{itemId:400,plane:7,level:5}),/不包含寶物及內丹/);
 assert.equal(C.resolveField(m,{x:400,y:6,z:7}).editable,false);
 assert.throws(()=>C.setField(m,{x:401,y:6,z:9},5),/./);
 assert.equal(C.serialize(m),raw);
});
