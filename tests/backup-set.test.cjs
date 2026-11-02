'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// V1.0.17.0 backup set (z23): 角色换装 swaps the z9 rows in z2 y16–21 with z23 y1–6, so a stored row keeps owner=character
// while no z2 slot points at it. Row 1 is an ordinary Q2 item, row 2 a treasure, both owned by character 1.
function setup({layers=24,stored=true}={}){
 const K=JSON.parse(fs.readFileSync('knowledge/catalog.json'));
 for(const g of ['equipmentAffixCoefficient','pillAptitudeBonus','treasureLevel'])K.verification[g]=true;
 K.verification.pillAptitudeBonusDecimal=false;
 const ctx={setTimeout};vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(K)),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(layers).fill(0)));data[0][0][1]='szmnqea';
 data[1][0][2]=1;data[1][1][2]='測試甲';data[1][2][2]=1;
 const template=K.batch2Data.characters[1];for(let i=0;i<3;i++){data[1][10+i][2]=template.base[i];data[1][1+i][12]=template.talents[i];data[1][21+i][12]=template.talentLevels[i];}
 const item=K.catalogs.items.find(i=>i.id===1),treasure=Number(Object.keys(K.treasureLevel.items).find(i=>K.treasureLevel.items[i].tier===1));
 for(const [y,v] of Object.entries({0:1,1:1,2:1,3:1,5:2,6:1,7:1,8:115,9:K.batch2Data.items[1].affixIds[0],15:20}))data[1][y][9]=v;
 for(const [y,v] of Object.entries({0:2,1:treasure,2:1,3:1,5:1,6:1,7:1,8:80}))data[2][y][9]=v;
 const pills=[1,2,3].map(a=>Number(Object.keys(K.batch2Data.pills).find(id=>K.batch2Data.pills[id].aptitude===a&&K.batch2Data.pills[id].cap>=40)));pills.forEach(id=>data[id][6][0]=10);
 // A 23-layer save has nowhere to store the set, so the same rows are plain orphan owners there.
 if(stored){if(layers>23){data[1][0][23]=2;data[1][item.slot][23]=1;data[1][6][23]=2;}}
 else{data[1][15+item.slot][2]=1;data[1][21][2]=2;}
 const text='\ufeff'+JSON.stringify({c2array:true,size:[221,60,layers],data});
 return {C,K,m:C.parse(text),text,pills};
}

test('the extractor names z23 and every z23 cell is read only, also through custom coordinates',()=>{
 assert.match(fs.readFileSync('scripts/extract-game.cjs','utf8'),/'武庫', '備用套裝'\]/);
 const {C,m}=setup();
 for(const y of [0,1,6]){
  const f=C.resolveField(m,{x:1,y,z:23});assert.equal(f.known,true);assert.equal(f.editable,false);assert.equal(f.category,'備用套裝');
  assert.throws(()=>C.set(m,{x:1,y,z:23},0),/唯讀/);
 }
 assert.equal(C.resolveField(m,{x:1,y:0,z:23}).label,'目前套裝序號');
 assert.equal(m.changes.size,0);
});

test('items stored in the backup set are refused with the switch-back reason; worn copies stay editable',()=>{
 const stored=setup();
 assert.throws(()=>stored.C.editingInfo(stored.m,'equipment',1,9),/備用套裝中/);
 assert.throws(()=>stored.C.affixInfo(stored.m,1,1,9),/備用套裝中/);
 assert.throws(()=>stored.C.editingInfo(stored.m,'equipment',2,9),/備用套裝中/);
 const worn=setup({stored:false});
 assert.equal(worn.C.editingInfo(worn.m,'equipment',1,9).id,1);
 assert.equal(worn.C.editingInfo(worn.m,'equipment',2,9).current,1);
});

test('aptitude edits refuse a character holding backup-set items; a 23-layer save keeps the old messages',()=>{
 const stored=setup();
 assert.throws(()=>stored.C.pillInfo(stored.m,1,1,stored.pills[0]),/卸下備用套裝/);
 const old=setup({layers:23});
 assert.throws(()=>old.C.editingInfo(old.m,'equipment',1,9),/穿戴雙向指標不一致/);
 assert.throws(()=>old.C.pillInfo(old.m,1,1,old.pills[0]),e=>!/備用套裝/.test(e.message));
});
