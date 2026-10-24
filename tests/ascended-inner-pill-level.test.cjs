'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {setup:baseSetup}=require('./helpers/batch-fixture.cjs');
// Ascended inner pill level: only z17 y6 of a z16-referenced row changes, 1 to 10+(y5−1)×5. Character 2 ascended twice:
// round 1 (ascension q3) stored row 400, a Q2 pill at Lv4 (cap 15); round 2 (q5) row 401, a Q1 pill at its cap 10. Row 402 is
// a rebirth leftover owned by character 2 that no z16 entry references.
const coefficient=(q,k)=>Math.round(100*(Math.pow(1.2,k-1)*(0.4+((k+q)-2)*0.2)))/100;
function setup({gate=true,patch=()=>{}}={}){
 const f=baseSetup(450,3),inner=f.k.catalogs.items.filter(i=>i.kind==='内丹'),tier=id=>f.k.batch2Data.items[id].tier;
 const pill=(row,template,pillQuality,level,ascension)=>{
  const r=f.a[row];[[0,7],[1,template.id],[2,1],[3,tier(template.id)],[5,pillQuality],[6,level],[7,2],[8,100],[24,1]].forEach(([y,v])=>r[y][17]=v);
  if(ascension)[107,108,109].forEach((v,j)=>{r[9+j][17]=v;r[15+j][17]=coefficient(...ascension);});
 };
 f.a[2][50][2]=2;
 [[3,400],[5,401]].forEach(([q,row],i)=>{f.a[2][2*i+1][16]=q;f.a[2][2*i+2][16]=row;});
 pill(400,inner[0],2,4,[3,1]);pill(401,inner[1],1,10,[5,2]);pill(402,inner[2],3,1,[4,1]);
 patch(f.a,f.k);
 f.C.KNOWLEDGE.verification.ascendedInnerPillLevel=gate;
 return {...f,inner,m:f.reparse(),raw:f.rawWith()};
}
const level=(C,m,round,value)=>C.setAscendedInnerPillLevel(m,{characterId:2,round,level:value});

test('gate defaults closed in the extractor and is registered in the batch2 family',()=>{
 const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),S=require('../scripts/verification-suite.cjs');
 assert.equal(typeof k.verification.ascendedInnerPillLevel,'boolean');
 assert.match(fs.readFileSync('scripts/extract-game.cjs','utf8'),/ascendedInnerPillLevel:false/);
 assert.equal(S.familyOf('ascendedInnerPillLevel'),'batch2');
 if(k.verification.ascendedInnerPillLevel){assert.equal(proof.groups.ascendedInnerPillLevel,true);assert.equal(proof.lightweight.ascendedInnerPillLevel.passed,true);assert.equal(proof.lightweight.ascendedInnerPillLevel.gameVersion,k.gameVersion);}
});

test('info lists each referenced pill with tier, quality and the cap from its own quality',()=>{
 const {C,m,inner,k}=setup(),info=C.ascendedInnerPillLevelInfo(m,{characterId:2});
 assert.equal(info.eligible,true);assert.equal(info.ascensions,2);assert.equal(info.records.length,2);
 // core runs in a vm realm; spread its arrays before deepEqual.
 assert.deepEqual([...info.records].map(r=>[r.round,r.row,r.templateId,r.quality,r.current,r.max,r.eligible]),[[1,400,inner[0].id,2,4,15,true],[2,401,inner[1].id,1,10,10,true]]);
 assert.equal(info.records[0].tier,k.batch2Data.items[inner[0].id].tier);
 assert.equal(C.ascendedInnerPillLevelInfo(m,{characterId:3}).eligible,false);
 assert.match(C.ascendedInnerPillLevelInfo(m,{characterId:3}).reasons[0],/尚未結丹/);
});

test('closed gate previews but refuses to write',()=>{
 const {C,m,raw}=setup({gate:false}),p=C.previewAscendedInnerPillLevel(m,{characterId:2,round:1,level:15});
 assert.equal(p.verified,false);assert.equal(p.canApply,false);assert.equal(p.changes.length,1);assert.equal(p.reasons.length,0);
 assert.throws(()=>level(C,m,1,15),/尚未完成/);assert.equal(C.serialize(m),raw);
});

test('raise and lower write only y6 with exact bytes; undo and restore revert; M is untouched',()=>{
 const {C,m,rawWith}=setup(),multiplier=()=>C.ascensionQualityInfo(m,{characterId:2}).multiplier;
 const before=multiplier();
 level(C,m,1,15);level(C,m,2,3);
 assert.equal(C.serialize(m),rawWith([[400,6,17,15],[401,6,17,3]]));
 assert.equal(multiplier(),before);
 level(C,m,1,1);assert.equal(C.get(m,{x:400,y:6,z:17}),1);
 C.undo(m);assert.equal(C.get(m,{x:400,y:6,z:17}),15);
 C.restore(m,{x:400,y:6,z:17});assert.equal(C.get(m,{x:400,y:6,z:17}),4);assert.equal(C.get(m,{x:401,y:6,z:17}),3);
 C.restore(m,{x:401,y:6,z:17});assert.equal(m.changes.size,0);
});

test('each pill restores on its own, apart from the aptitude group of ascension quality',()=>{
 const {C,m}=setup({patch:a=>{for(const [y,v] of [[10,31],[11,31],[12,31],[49,1]])a[2][y][2]=v;[[1,1,2],[2,4,1],[3,12,1]].forEach(([slot,id,lv])=>{a[2][slot][12]=id;a[2][20+slot][12]=lv;});}});
 C.KNOWLEDGE.verification.ascensionQuality=true;
 C.setAscensionQuality(m,{characterId:2,round:1,quality:9});level(C,m,1,12);
 C.restore(m,{x:400,y:6,z:17});
 assert.equal(C.get(m,{x:400,y:6,z:17}),4);assert.equal(C.get(m,{x:400,y:15,z:17}),coefficient(9,1));assert.equal(C.get(m,{x:2,y:1,z:16}),9);
});

test('same level writes nothing; round, range, type and extra options are rejected',()=>{
 const {C,m,raw}=setup();
 assert.equal(level(C,m,1,4).unchanged,true);assert.equal(m.changes.size,0);
 for(const v of [0,16,2.5,'5',null])assert.throws(()=>level(C,m,1,v),/1–15 的整數/);
 assert.throws(()=>level(C,m,2,11),/1–10 的整數/);
 for(const r of [0,3,1.5,'1'])assert.throws(()=>level(C,m,r,5),/結丹次序須為 1–2/);
 assert.throws(()=>C.setAscendedInnerPillLevel(m,{characterId:2,round:1,level:5,row:402}),/只接受/);
 assert.throws(()=>C.setAscendedInnerPillLevel(m,{characterId:9,round:1,level:5}),/有效/);
 assert.equal(C.serialize(m),raw);
});

test('named and imprisoned characters are allowed; the ascension record still gates',()=>{
 const named=setup({patch:a=>{a[2][2][2]=5;a[2][55][2]=1;}});
 assert.equal(named.C.ascensionQualityInfo(named.m,{characterId:2}).eligible,false);
 level(named.C,named.m,1,9);assert.equal(named.C.get(named.m,{x:400,y:6,z:17}),9);
 const cases=[
  [a=>{a[400][7][17]=3;},/owner/],
  [a=>{a[400][15][17]=1;},/結丹係數/],
  [a=>{a[2][50][2]=1;},/結丹紀錄仍有資料/],
  [a=>{a[2][4][16]=400;},/列號越界或重複/],
 ];
 for(const [patch,error] of cases){const {C,m,raw}=setup({patch});assert.throws(()=>level(C,m,1,5),error);assert.equal(C.serialize(m),raw);}
});

test('rebirth leftovers stay read-only and do not block referenced pills',()=>{
 const {C,m}=setup(),info=C.ascendedInnerPillLevelInfo(m,{characterId:2});
 assert.equal(info.records.some(r=>r.row===402),false);
 assert.equal(C.resolveField(m,{x:402,y:6,z:17}).editable,false);
 level(C,m,1,6);assert.equal(C.get(m,{x:400,y:6,z:17}),6);
});

test('metadata, quality and over-limit rows stay read-only; other rounds stay editable',()=>{
 const cases=[
  [a=>{a[400][3][17]=9;},/等階/],
  [a=>{a[400][2][17]=2;},/數量/],
  [a=>{a[400][4][17]=1;},/狀態/],
  [a=>{a[400][12][17]=5;},/詞條或特殊狀態/],
  [a=>{a[400][20][17]=1;},/詞條或特殊狀態/],
  [a=>{a[400][27][17]=1;},/詞條或特殊狀態/],
  [a=>{a[400][24][17]=2;},/詞條或特殊狀態/],
  [a=>{a[400][0][17]=0;},/識別或欄位型別/],
  [a=>{a[400][30][17]='x';},/識別或欄位型別/],
  [a=>{a[400][5][17]=7;},/品質 1–6/],
  [a=>{a[400][6][17]=16;},/超限停用/],
  [a=>{a[400][6][17]=0;},/超限停用/],
 ];
 for(const [patch,error] of cases){
  const {C,m,raw}=setup({patch}),info=C.ascendedInnerPillLevelInfo(m,{characterId:2});
  assert.equal(info.records[0].eligible,false);assert.match(info.records[0].reasons[0],error);
  assert.throws(()=>level(C,m,1,5),error);assert.equal(C.serialize(m),raw);
  level(C,m,2,5);assert.equal(C.get(m,{x:401,y:6,z:17}),5);
 }
 const locked=setup({patch:a=>{a[400][22][17]=1;a[400][24][17]=0;}});level(locked.C,locked.m,1,5);
});

test('custom coordinates and legacy entries still refuse z17 y6',()=>{
 const {C,m,raw}=setup();
 assert.equal(C.resolveField(m,{x:400,y:6,z:17}).editable,false);
 assert.throws(()=>C.setField(m,{x:400,y:6,z:17},5),/./);
 assert.throws(()=>C.setInnerPillLevel(m,{itemId:400,plane:17,level:5}),/庫別或編號/);
 assert.equal(C.serialize(m),raw);
});
