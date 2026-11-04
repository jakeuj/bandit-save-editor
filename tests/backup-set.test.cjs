'use strict';
const {readEditorSource, embedKnowledge} = require('../scripts/editor-source.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// V1.0.17.0 backup set (z23): 角色换装 swaps the z9 rows in z2 y16–21 with z23 y1–6, so a stored row keeps owner=character
// while no z2 slot points at it. Row 1 is an ordinary Q2 item, row 2 a treasure, row 3 an inner pill, all owned by character 1.
// backupSetEquipment (v2.39) opens the equipment editors on stored rows; backupSetInnerPillLevel and backupSetAptitude (v2.40)
// open the stored inner pill level and aptitude edits that check the stored rows like worn ones.
function setup({layers=24,stored=true,open=false,innerPill=false,aptitude=false}={}){
 const K=JSON.parse(fs.readFileSync('knowledge/catalog.json'));
 for(const g of ['equipmentAffixCoefficient','pillAptitudeBonus','treasureLevel'])K.verification[g]=true;
 K.verification.pillAptitudeBonusDecimal=false;K.verification.backupSetEquipment=open;K.verification.backupSetInnerPillLevel=innerPill;K.verification.backupSetAptitude=aptitude;
 const ctx={setTimeout};vm.runInNewContext(embedKnowledge(readEditorSource('core'), K),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(layers).fill(0)));data[0][0][1]='szmnqea';
 data[1][0][2]=1;data[1][1][2]='測試甲';data[1][2][2]=1;
 const template=K.batch2Data.characters[1];for(let i=0;i<3;i++){data[1][10+i][2]=template.base[i];data[1][1+i][12]=template.talents[i];data[1][21+i][12]=template.talentLevels[i];}
 const item=K.catalogs.items.find(i=>i.id===1),treasure=Number(Object.keys(K.treasureLevel.items).find(i=>K.treasureLevel.items[i].tier===1));
 for(const [y,v] of Object.entries({0:1,1:1,2:1,3:1,5:2,6:1,7:1,8:115,9:K.batch2Data.items[1].affixIds[0],15:20}))data[1][y][9]=v;
 for(const [y,v] of Object.entries({0:2,1:treasure,2:1,3:1,5:1,6:1,7:1,8:80}))data[2][y][9]=v;
 const pill=K.catalogs.items.find(i=>i.kind==='内丹');for(const [y,v] of Object.entries({0:3,1:pill.id,2:1,3:K.batch2Data.items[pill.id].tier,5:2,6:4,7:1,8:100}))data[3][y][9]=v;
 const pills=[1,2,3].map(a=>Number(Object.keys(K.batch2Data.pills).find(id=>K.batch2Data.pills[id].aptitude===a&&K.batch2Data.pills[id].cap>=40)));pills.forEach(id=>data[id][6][0]=10);
 // A 23-layer save has nowhere to store the set, so the same rows are plain orphan owners there.
 if(stored){if(layers>23){data[1][0][23]=2;data[1][item.slot][23]=1;data[1][6][23]=2;data[1][5][23]=3;}}
 else{data[1][15+item.slot][2]=1;data[1][21][2]=2;data[1][20][2]=3;}
 const text='\ufeff'+JSON.stringify({c2array:true,size:[221,60,layers],data});
 return {C,K,m:C.parse(text),text,data,item,pills};
}

test('the extractor names z23 and every z23 cell is read only, also through custom coordinates',()=>{
 assert.match(fs.readFileSync('scripts/extract-game.cjs','utf8'),/'武庫', '備用套裝'(?:,|\])/);
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

test('backup-set flags default closed in the extractor and are registered in the equipmentWorkflow family',()=>{
 const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),S=require('../scripts/verification-suite.cjs'),R=require('../scripts/verification-requirements.cjs');
 for(const group of ['backupSetEquipment','backupSetInnerPillLevel','backupSetAptitude']){
  assert.equal(typeof k.verification[group],'boolean');
  assert.match(fs.readFileSync('scripts/extract-game.cjs','utf8'),new RegExp(group+':false'));
  assert.equal(S.familyOf(group),'equipmentWorkflow');assert.equal(R.sectionOf(group),'equipmentWorkflow');
  if(k.verification[group]){assert.equal(proof.groups[group],true);assert.equal(proof.lightweight[group].passed,true);assert.equal(proof.lightweight[group].gameVersion,k.gameVersion);}
 }
});

test('open gate: stored items edit like worn ones, writing only their own token; undo and restore return the original bytes',()=>{
 const {C,m,text}=setup({open:true});
 const level=C.editingInfo(m,'equipment',1,9);assert.deepEqual([level.current,level.normalMax,level.verified],[1,15,true]);
 assert.equal(C.equipmentQualityInfo(m,{itemId:1,plane:9}).quality,2);
 C.setEquipmentLevel(m,{itemId:1,level:12});
 assert.deepEqual([...m.changes.values()].map(c=>[c.x,c.y,c.z,c.value,c.group]),[[1,6,9,12,"editing:equipment:9:1"]]);
 const out=C.serialize(m);assert.equal(out.length,text.length+1);assert.equal(C.get(C.parse(out),{x:1,y:6,z:9}),12);
 C.undo(m);assert.equal(C.serialize(m),text);
 C.setEquipmentLevel(m,{itemId:2,level:4});assert.equal(C.get(m,{x:2,y:6,z:9}),4);
 C.restoreAll(m);assert.equal(C.serialize(m),text);
 for(const y of [0,1,5,6])assert.throws(()=>C.set(m,{x:1,y,z:23},0),/唯讀/);
});

test('equipment gate alone keeps inner pills, aptitude edits and mismatched set pointers refused',()=>{
 const {C,m,pills,data,item}=setup({open:true});
 assert.throws(()=>C.innerPillLevelInfo(m,{itemId:3,plane:9}),/備用套裝中/);
 assert.throws(()=>C.pillInfo(m,1,1,pills[0]),/卸下備用套裝/);
 // z23 y1–6 mirror z2 y16–21 slot for slot; a row stored under another slot is not a native state.
 data[1][item.slot][23]=0;data[1][item.slot===1?2:1][23]=1;
 const moved=C.parse('\ufeff'+JSON.stringify({c2array:true,size:[221,60,24],data}));
 assert.throws(()=>C.editingInfo(moved,'equipment',1,9),/部位不一致/);
});

test('an edited stored item keeps its value through a simulated 角色换装 back to the worn slots',()=>{
 const {C,m}=setup({open:true});
 C.setEquipmentLevel(m,{itemId:1,level:12});
 const swapped=JSON.parse(C.serialize(m).replace(/^\ufeff/,'')),d=swapped.data;
 for(let s=1;s<=6;s++){const worn=d[1][15+s][2];d[1][15+s][2]=d[1][s][23];d[1][s][23]=worn;}d[1][0][23]=0;
 const back=C.parse('\ufeff'+JSON.stringify(swapped));
 assert.equal(C.editingInfo(back,'equipment',1,9).current,12);
 assert.equal(C.treasureLevelInfo(back,{itemId:2,plane:9}).current,1);
 assert.equal(C.innerPillLevelInfo(back,{itemId:3,plane:9}).worn,true);
});

test('inner pill gate: a stored pill edits like a worn one, writing only y6; undo returns the original bytes',()=>{
 const {C,m,text}=setup({open:true,innerPill:true});
 const info=C.innerPillLevelInfo(m,{itemId:3,plane:9});
 assert.deepEqual([info.current,info.normalMax,info.verified,info.worn,info.stored,info.group],[4,15,true,false,true,'innerPillLevel']);
 C.setInnerPillLevel(m,{itemId:3,level:9});
 assert.deepEqual([...m.changes.values()].map(c=>[c.x,c.y,c.z,c.value,c.group]),[[3,6,9,9,'inner-pill:9:3']]);
 assert.throws(()=>C.setInnerPillLevel(m,{itemId:3,level:16}),/1–15/);
 C.undo(m);assert.equal(C.serialize(m),text);
 // The pill gate does not need the equipment gate, and a pill stored under another slot is refused.
 const alone=setup({innerPill:true});assert.equal(alone.C.innerPillLevelInfo(alone.m,{itemId:3,plane:9}).stored,true);
 alone.data[1][5][23]=0;alone.data[1][4][23]=3;
 const moved=alone.C.parse('\ufeff'+JSON.stringify({c2array:true,size:[221,60,24],data:alone.data}));
 assert.throws(()=>alone.C.innerPillLevelInfo(moved,{itemId:3,plane:9}),/內丹等級：備用套裝指標與裝備部位不一致/);
});

test('aptitude gate: stored rows are checked like worn ones, so either set gives the same answer',()=>{
 // The ordinary path validates stored rows through editingInfo, which also needs backupSetEquipment (both close together).
 const stored=setup({open:true,aptitude:true}),worn=setup({stored:false,open:true,aptitude:true});
 // Ascended-path checks (pillAptitudeBonusAscended) accept treasures and inner pills without 104–106.
 const a=stored.C.pillInfo(stored.m,1,1,stored.pills[0]),b=worn.C.pillInfo(worn.m,1,1,worn.pills[0]);
 assert.deepEqual([a.base,a.cap,a.max],[b.base,b.cap,b.max]);
 stored.C.setPillAptitudeBonus(stored.m,{characterId:1,aptitude:1,pillId:stored.pills[0],bonus:3});
 assert.deepEqual([...stored.m.changes.values()].map(c=>[c.x,c.y,c.z,c.value]),[[1,13,2,3]]);
 // The ordinary path refuses a treasure or inner pill whether it is worn or stored.
 const message=f=>{try{f();}catch(e){return e.message;}return '';};
 assert.equal(message(()=>stored.C.pillAdvancedInfo(stored.m,{characterId:1,aptitude:1})),message(()=>worn.C.pillAdvancedInfo(worn.m,{characterId:1,aptitude:1})));
 assert.notEqual(message(()=>stored.C.pillAdvancedInfo(stored.m,{characterId:1,aptitude:1})),'');
});

test('aptitude gate refuses an aptitude affix in the stored set and a row both worn and stored',()=>{
 const affix=setup({aptitude:true});affix.data[1][10][9]=104;
 const m1=affix.C.parse('\ufeff'+JSON.stringify({c2array:true,size:[221,60,24],data:affix.data}));
 assert.throws(()=>affix.C.pillInfo(m1,1,1,affix.pills[0]),/資質加成尚未涵蓋/);
 const both=setup({aptitude:true});both.data[1][20][2]=3;
 const m2=both.C.parse('\ufeff'+JSON.stringify({c2array:true,size:[221,60,24],data:both.data}));
 assert.throws(()=>both.C.pillInfo(m2,1,1,both.pills[0]),/同一件裝備/);
});
