#!/usr/bin/env node
'use strict';
// Native follow-up actions after editing, for disposable states created by verify-game. The follow-up copy covers
// equip cycle, profession transfer and research/training start-stop; the batch-two copy covers pills and rebirth.
// `ascend` alone prepares an ascended base save; with `pills` the same block only tells rebirth to check the cleanup.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {evaluate, waitMain} = require('./verify-game.cjs');
const args = process.argv.slice(2), opt = k => args[args.indexOf(k) + 1];
const prefix = `const r=self.__banditValidationRuntime,a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();const call=(name,...args)=>{const f=r.GetEventSheetManager().GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};const record=(id,z)=>Array.from({length:50},(_,y)=>a.At(id,y,z));const global=name=>{const v=r.GetEventSheetManager().GetAllGlobalVariables().find(v=>v.GetName()===name);if(!v)throw Error('Missing global '+name);return v;};`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Select a map facility of the given template inside a building, the way the facility page selects its tile.
const selectFacility = (template, building) => `const start=global('主地图编号起始').GetValue();const sprite=r.GetObjectClassByName('地图建筑').GetInstances().find(i=>{const x=i.GetInstanceVariableValue(4),y=i.GetInstanceVariableValue(5),f=a.At(x-start+150,y-start,6);return f>0&&a.At(f,0,21)===f&&a.At(f,1,21)===${template}&&a.At(f,2,21)===${building};});if(!sprite)throw Error('No idle facility ${template} in building ${building}');const X=sprite.GetInstanceVariableValue(4),Y=sprite.GetInstanceVariableValue(5),f=a.At(X-start+150,Y-start,6);if(a.At(f,3,21)!==0)throw Error('Facility ${template} is busy');global('选中地块X').SetValue(X);global('选中地块Y').SetValue(Y);`;

async function followup(state, s) {
  const {equipment: {id, slot}, character, profession, technology, academy, drillGround} = s.followup;
  const before = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);if(a.At(1,${15 + slot},2)!==${id})throw Error('Expected equipped follow-up item');const v=record(${id},9);call('卸下装备',${slot},${id},1,false,false);return v;})()`);
  await pause(500);
  const bag = await evaluate(state, `(()=>{${prefix}if(a.At(1,${15 + slot},2)!==0)throw Error('Unequip failed');for(let id=1;id<a.GetWidth();id++)if(a.At(id,0,7)===${before[0]}&&a.At(id,1,7)===${before[1]}&&a.At(id,6,7)===${before[6]})return id;throw Error('Unequipped record missing');})()`);
  await evaluate(state, `(()=>{${prefix}call('穿戴装备',${slot},${bag},1,false,false);return true;})()`);
  await pause(500);
  const worn = await evaluate(state, `(()=>{${prefix}const id=a.At(1,${15 + slot},2);return {id,record:record(id,9)};})()`);
  for (let y = 0; y < 50; y++) if (y !== 7) assert.equal(worn.record[y], before[y], 'Equip cycle field ' + y);
  assert.equal(worn.record[7], 1);

  // The scenario leaves the character one point short of the prerequisite level, so a single natural experience call
  // must level it; the amount argument is ignored and each call grants about ten work intervals.
  const career = await evaluate(state, `(()=>{${prefix}const c=${character},from=a.At(c,6,2),cap=a.At(${profession},5,0),start=[a.At(c,from,4),a.At(c,from,5)];call('获得职业经验',c,0,'工作',from,0,0);
    const prerequisite=a.At(c,from,4);if(prerequisite!==start[0]+1)throw Error('Natural experience did not level up: '+JSON.stringify([start,[prerequisite,a.At(c,from,5)]]));
    const eligible=call('转职条件判断',c,${profession},0,0);if(eligible!==1)throw Error('Transfer not eligible at prerequisite level '+prerequisite);
    call('转职',c,${profession},true);const job=a.At(c,6,2),before=[a.At(c,${profession},4),a.At(c,${profession},5)];call('获得职业经验',c,0,'工作',${profession},0,0);
    return {character:c,from,start,prerequisite,job,before,after:[a.At(c,${profession},4),a.At(c,${profession},5)],capBefore:cap,capAfter:a.At(${profession},5,0)};})()`);
  assert.equal(career.job, profession, 'Transfer did not change the current profession');
  assert.ok(career.after[0] > career.before[0] || career.after[1] > career.before[1], 'No natural experience after transfer');
  assert.equal(career.capAfter, career.capBefore, 'Training cap changed by natural growth');

  const research = await evaluate(state, `(()=>{${prefix}${selectFacility(1, academy)}call('科技研究',${technology},a.At(${academy},5,1));const started=[a.At(${technology},13,0),a.At(f,3,21)];call('取消设施进程',X,Y,false,0);return {f,started,stopped:[a.At(${technology},13,0),a.At(f,3,21)]};})()`);
  assert.deepEqual(research.started, [1, technology], 'Research did not start');
  assert.deepEqual(research.stopped, [0, 0], 'Research did not stop');
  const training = await evaluate(state, `(()=>{${prefix}${selectFacility(11, drillGround)}call('职业操练',${profession},a.At(${drillGround},5,1));const started=[a.At(${profession},15,0),a.At(f,3,21)];call('取消设施进程',X,Y,false,0);return {f,started,stopped:[a.At(${profession},15,0),a.At(f,3,21)]};})()`);
  assert.deepEqual(training.started, [1, profession], 'Training did not start');
  assert.deepEqual(training.stopped, [0, 0], 'Training did not stop');

  for (let y = 0; y < 50; y++) state.cells.push([worn.id, y, 9]);
  state.cells.push([1, 15 + slot, 2], [character, 6, 2], [character, career.from, 4], [character, career.from, 5], [character, profession, 4], [character, profession, 5], [profession, 5, 0], [profession, 15, 0], [technology, 13, 0], [research.f, 3, 21], [training.f, 3, 21]);
  return {before, worn, career, research, training};
}

// Prepares an ascended character on a base save without one: each round obtains a fresh inner pill with 获得物品, wears it
// with 穿戴装备 and runs the 渡劫结束 success branch with the 渡劫 variables set (渡劫结丹品质 is a static local) (the 渡劫台 timer and progress UI are skipped).
// An optional treasure is worn afterwards. Returns the native multiplier, caps and totals for the editor to compare.
const ascensionCoefficient = (q, k) => Math.round(100 * (Math.pow(1.2, k - 1) * (0.4 + ((k + q) - 2) * 0.2))) / 100;
async function obtainAndWear(state, character, template) {
  const id = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),seen=new Set();for(let x=1;x<a.GetWidth();x++)if(a.At(x,1,7)>0)seen.add(x);
    call('获得物品',true,${template},1,1,wp.At(${template},3,0),100,1,false,0,'特定装备',false,false);for(let x=1;x<a.GetWidth();x++)if(!seen.has(x)&&a.At(x,1,7)===${template})return x;throw Error('Obtained item missing in z7');})()`);
  await pause(500);
  await evaluate(state, `(()=>{${prefix}const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance();call('穿戴装备',wp.At(${template},6,0),${id},${character},false,false);return true;})()`);
  await pause(500);
  const worn = await evaluate(state, `(()=>{${prefix}const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),slot=wp.At(${template},6,0),id=a.At(${character},15+slot,2);return {slot,id,record:record(id,9)};})()`);
  assert.equal(worn.record[1], template, 'Obtained item was not worn');
  assert.equal(worn.record[7], character, 'Worn item owner');
  return worn;
}
async function ascend(state, s) {
  const {character, rounds, treasure} = s.ascend, done = [];
  for (const [i, {template, quality}] of rounds.entries()) {
    const worn = await obtainAndWear(state, character, template);
    assert.equal(worn.slot, 5, 'Inner pill slot');
    await evaluate(state, `(()=>{${prefix}const m=r.GetEventSheetManager(),v=name=>{const f=[...m.GetAllGlobalVariables(),...m.GetAllLocalVariables()].filter(v=>v.GetName()===name);if(f.length!==1)throw Error('Ambiguous variable '+name);return f[0];};v('渡劫角色序号').SetValue(${character});v('渡劫结丹品质').SetValue(${quality});call('渡劫结束',false);return true;})()`);
    await pause(500);
    const after = await evaluate(state, `(()=>{${prefix}const c=${character},k=a.At(c,50,2),row=a.At(c,2*k,16);return {count:k,quality:a.At(c,2*k-1,16),row,stored:record(row,17),slot:a.At(c,20,2),source:record(${worn.id},9)};})()`);
    const k = i + 1, coefficient = ascensionCoefficient(quality, k);
    assert.deepEqual([after.count, after.quality, after.slot], [k, quality, 0], 'Ascension record');
    assert.equal(after.stored[1], template); assert.equal(after.stored[7], character);
    assert.deepEqual(after.stored.slice(9, 12), [107, 108, 109]); assert.deepEqual(after.stored.slice(15, 18), [coefficient, coefficient, coefficient]);
    assert.ok(after.source.every(v => v === 0), 'Worn inner pill row was not moved');
    done.push({template, quality, worn, ...after});
  }
  const extra = treasure ? await obtainAndWear(state, character, treasure) : null;
  const native = await evaluate(state, `(()=>{${prefix}const c=${character};return {multiplier:call('角色资质上限倍率',c,0,0),caps:['力量','敏捷','智力'].map(t=>call('角色资质上限',c,t)),totals:[1,2,3].map(t=>call('角色资质计算',c,t))};})()`);
  assert.equal(native.multiplier, 1.5 + done.reduce((sum, d) => sum + ascensionCoefficient(d.quality, d.count), 0), 'Native cap multiplier');
  for (const d of done) for (let y = 0; y < 50; y++) state.cells.push([d.row, y, 17]);
  for (let y = 1; y <= 16; y++) state.cells.push([character, y, 16]);
  state.cells.push([character, 50, 2], [character, 20, 2], [character, 21, 2]);
  if (extra) for (let y = 0; y < 50; y++) state.cells.push([extra.id, y, 9]);
  return {rounds: done, treasure: extra, native};
}

async function pillsAndRebirth(state, s) {
  const c = s.pillCharacter ?? 1;
  const pills = await evaluate(state, `(()=>{${prefix}return ${JSON.stringify(s.pills)}.map(({aptitude,pillId})=>{const count=a.At(pillId,6,0),bonus=a.At(${c},12+aptitude,2);call('服用普通丹药',pillId,${c},1);return {aptitude,pillId,count:[count,a.At(pillId,6,0)],bonus:[bonus,a.At(${c},12+aptitude,2)]};});})()`);
  for (const p of pills) {
    assert.ok(p.bonus[1] >= p.bonus[0], 'Pill lowered the aptitude bonus');
    // The conservative editor maximum may already sit at the native cap; other aptitudes must consume one pill.
    if (p.aptitude !== 1) { assert.equal(p.count[1], p.count[0] - 1, 'Pill not consumed'); assert.ok(p.bonus[1] > p.bonus[0], 'Pill bonus unchanged'); }
    else assert.ok(p.count[1] === p.count[0] - 1 || p.count[1] === p.count[0]);
  }
  await evaluate(state, `(()=>{${prefix}call('角色重生',${c},0,0);return true;})()`);
  await pause(500);
  const rebirth = await evaluate(state, `(()=>{${prefix}return [13,14,15].map(y=>a.At(${c},y,2));})()`);
  assert.deepEqual(rebirth, [0, 0, 0], 'Rebirth did not clear pill bonuses');
  // An ascended character also loses its ascension record. 删除角色内丹数据 never resets its column counter, so only the first
  // z17 row the character owns is cleared; later stored pills stay as unreferenced rows and are reported, not rejected.
  const cleared = s.ascend ? await evaluate(state, `(()=>{${prefix}const c=${c},owned=[];for(let x=1;x<a.GetWidth();x++)if(a.At(x,7,17)===c)owned.push(x);return {count:a.At(c,50,2),record:Array.from({length:16},(_,i)=>a.At(c,i+1,16)),owned};})()`) : null;
  if (cleared) { assert.equal(cleared.count, 0, 'Rebirth kept the ascension count'); assert.ok(cleared.record.every(v => v === 0), 'Rebirth kept z16'); }
  for (const p of pills) state.cells.push([p.pillId, 6, 0]);
  for (const y of [3, 4, 13, 14, 15, 50, 56]) state.cells.push([c, y, 2]);
  if (cleared) for (let y = 1; y <= 16; y++) state.cells.push([c, y, 16]);
  return {pills, rebirth, cleared};
}

// Over-limit backpack rows: one is stored into z9, a native level-up below the cap still works (control), both native
// upgrades leave the over-limit level, money and souls untouched, and it comes back out; the other is worn straight from
// the backpack with finite equipment effects and unequipped. Moved rows must keep every field except the owner.
async function backpackOverLimit(state, s) {
  const {stored, worn} = s.backpackOverLimit, find = `const find=(z,v)=>{for(let x=1;x<a.GetWidth();x++){let ok=true;for(let y=0;y<50;y++)if(y!==7&&a.At(x,y,z)!==v[y]){ok=false;break;}if(ok)return x;}throw Error('Moved record missing in z'+z);};`;
  const store = await evaluate(state, `(()=>{${prefix}${find}r.SetTimeScale(0);const before=record(${stored.id},7);call('装备库存入',${stored.id},true,0);const id=find(9,before);return {before,id,moved:record(id,9),source:record(${stored.id},7)};})()`);
  await pause(500);
  const upgrade = await evaluate(state, `(()=>{${prefix}const id=${store.id},level=a.At(id,6,9),cap=call('装备等级上限',a.At(id,5,9));a.Set(1,2,0,1e12);a.Set(3,2,0,1e9);
    a.Set(id,6,9,cap-1);call('升级装备',id,0,0,true);const control={from:cap-1,to:a.At(id,6,9),copper:1e12-a.At(1,2,0)};a.Set(id,6,9,level);a.Set(1,2,0,1e12);a.Set(3,2,0,1e9);
    const before=record(id,9);call('升级装备',id,0,0,true);const single=record(id,9);call('升级最大装备',id,0,0,true);return {cap,control,before,single,maximum:record(id,9),copper:a.At(1,2,0),souls:a.At(3,2,0)};})()`);
  assert.equal(upgrade.control.to, upgrade.control.from + 1, 'Native upgrade control did not level up');
  assert.ok(upgrade.control.copper > 0, 'Native upgrade control cost nothing');
  assert.ok(upgrade.before[6] > upgrade.cap, 'Stored row is not over the native cap');
  assert.deepEqual(upgrade.single, upgrade.before, 'Native upgrade changed an over-limit row');
  assert.deepEqual(upgrade.maximum, upgrade.before, 'Native maximum upgrade changed an over-limit row');
  assert.deepEqual([upgrade.copper, upgrade.souls], [1e12, 1e9], 'Native upgrade charged an over-limit row');
  const takeout = await evaluate(state, `(()=>{${prefix}${find}const before=record(${store.id},9);call('装备库取出',${store.id},true,0);const id=find(7,before);return {id,record:record(id,7)};})()`);
  await pause(500);
  for (const [name, row] of [['store', store.moved], ['takeout', takeout.record]]) assert.deepEqual(row, store.before, name + ' changed the over-limit row');
  assert.ok(store.source.every(v => v === 0), 'Stored backpack row was not cleared');

  const put = await evaluate(state, `(()=>{${prefix}const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),before=record(${worn.id},7),slot=wp.At(before[1],6,0);
    call('穿戴装备',slot,${worn.id},${worn.character},false,false);return {slot,before};})()`);
  await pause(500);
  const wear = await evaluate(state, `(()=>{${prefix}const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),slot=${put.slot},before=${JSON.stringify(put.before)},id=a.At(${worn.character},15+slot,2),v=record(id,9);
    const effects=[];for(let s=0;s<3;s++){const attr=wp.At(v[1],8+s,0);if(attr>0)effects.push({attr,actual:call('装备属性计算',${worn.character},attr,0,0,0,0,0,0,0),main:call('装备主属性',v[6],v[3],attr,v[8],wp.At(v[1],11+s,0),'主属性',0,v[5])});}
    return {slot,before,id,record:v,effects};})()`);
  for (let y = 0; y < 50; y++) if (y !== 7) assert.equal(wear.record[y], wear.before[y], 'Wear changed field ' + y);
  assert.equal(wear.record[7], worn.character);
  for (const e of wear.effects) assert.ok(Number.isFinite(e.actual) && Number.isFinite(e.main) && e.actual >= e.main, 'Non-finite or missing equipment effect ' + e.attr);
  await evaluate(state, `(()=>{${prefix}call('卸下装备',${wear.slot},${wear.id},${worn.character},false,false);return true;})()`);
  await pause(500);
  const back = await evaluate(state, `(()=>{${prefix}${find}const id=find(7,${JSON.stringify(wear.before)});return {id,record:record(id,7),pointer:a.At(${worn.character},${15 + wear.slot},2)};})()`);
  assert.deepEqual(back.record, wear.before, 'Unequip changed the over-limit row');
  assert.notEqual(back.pointer, wear.id, 'Character still points at the unequipped row');

  for (const v of [{id: takeout.id, z: 7}, {id: back.id, z: 7}, {id: stored.id, z: 7}, {id: store.id, z: 9}, {id: wear.id, z: 9}]) for (let y = 0; y < 50; y++) state.cells.push([v.id, y, v.z]);
  state.cells.push([worn.character, 15 + wear.slot, 2], [1, 2, 0], [3, 2, 0]);
  return {store, upgrade, takeout, wear, back};
}

// Edited backpack relics placed natively on a building, taken off and placed again. Moves copy all 50 fields through z19
// (y0 keeps the original row, so a relic can come back to another backpack row with a stale y0); only the placement pointer
// z19 y12 ↔ building z1 y9 changes. Any building works for the move; only a 置物台 (67) feeds 刷新地块灵气, not covered here.
const relicFind = `const same=(v,w)=>v.every((x,y)=>y===12||w[y]===x);const find=v=>{for(let x=1;x<a.GetWidth();x++)if(a.At(x,1,18)!==0&&same(v,record(x,18)))return x;throw Error('Relic missing in z18');};`;
async function placeRelic(state, id, building) {
  await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);if(a.At(${building},9,1)!==0)throw Error('Building already holds a relic');call('摆放灵物',${id},${building});return true;})()`);
  await pause(500);
  return evaluate(state, `(()=>{${prefix}const slot=a.At(${building},9,1);return {slot,placed:record(slot,19),source:record(${id},18)};})()`);
}
async function takeOffRelic(state, building, before) {
  const slot = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);const slot=a.At(${building},9,1);call('取下灵物',${building},true);return slot;})()`);
  await pause(500);
  return evaluate(state, `(()=>{${prefix}${relicFind}const id=find(${JSON.stringify(before)});return {slot:${slot},id,record:record(id,18),pointer:a.At(${building},9,1),cleared:record(${slot},19)};})()`);
}
function checkPlaced(p, before, building) {
  assert.ok(p.slot > 0, 'Placement did not set the building pointer');
  for (let y = 0; y < 50; y++) assert.equal(p.placed[y], y === 12 ? building : before[y], 'Placed relic field ' + y);
  assert.ok(p.source.every(v => v === 0), 'Placed relic left its backpack row');
}
function checkTakenOff(t, before) {
  for (let y = 0; y < 50; y++) assert.equal(t.record[y], y === 12 ? 0 : before[y], 'Returned relic field ' + y);
  assert.equal(t.pointer, 0, 'Building still points at the relic');
  assert.ok(t.cleared.every(v => v === 0), 'Placement row was not cleared');
}
async function relicPlacement(state, s) {
  const {id, building} = s.relics, before = await evaluate(state, `(()=>{${prefix}return record(${id},18);})()`);
  assert.equal(before[12], 0);
  const first = await placeRelic(state, id, building); checkPlaced(first, before, building);
  const off = await takeOffRelic(state, building, before); checkTakenOff(off, before);
  const again = await placeRelic(state, off.id, building); checkPlaced(again, before, building);
  state.relic = {building, record: before};
  for (const [x, z] of [[id, 18], [off.id, 18], [first.slot, 19], [again.slot, 19]]) for (let y = 0; y < 50; y++) state.cells.push([x, y, z]);
  state.cells.push([building, 9, 1]);
  return {before, first, off, again};
}
// After a restart the placed relic is taken off again and must return unchanged, ready for the editor to read back.
async function relicTakeOff(state) {
  const {building, record} = state.relic, off = await takeOffRelic(state, building, record); checkTakenOff(off, record);
  for (let y = 0; y < 50; y++) state.cells.push([off.id, y, 18]);
  return off;
}

// An edited wall level after a restart: 城墙最大生命 (with 加成属性效果) must stay at or above the edited HP, one native 城墙升级
// charges 城墙强化货币 and adds one level without touching HP, and a few seconds of game time regenerate HP toward the maximum.
async function wallUpgrade(state, s) {
  const read = `const level=a.At(19,1,0),life=a.At(0,11,1),money=a.At(1,2,0),max=call('城墙最大生命'),cap=call('城墙强化上限'),cost=call('城墙强化货币');`;
  const before = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);${read}return {level,life,money,max,cap,cost};})()`);
  assert.equal(before.level, s.wall.level, 'Edited wall level not loaded');
  assert.ok(before.life <= before.max, 'Edited HP above the native maximum');
  assert.ok(before.level < before.cap && before.money >= before.cost, 'Native upgrade not affordable');
  const upgraded = await evaluate(state, `(()=>{${prefix}call('城墙升级');${read}return {level,life,money,max,cap,cost};})()`);
  assert.deepEqual([upgraded.level, upgraded.life, upgraded.money], [before.level + 1, before.life, before.money - before.cost], 'Native wall upgrade');
  assert.ok(upgraded.max > before.max, 'Native maximum did not grow');
  const paused = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(1);return ['游戏暂停','挑战城市开关','占领城市开关'].map(n=>global(n).GetValue());})()`);
  await pause(3500);
  const regen = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);return {life:a.At(0,11,1),max:call('城墙最大生命')};})()`);
  if (!paused.some(Boolean)) assert.ok(regen.life > upgraded.life && regen.life <= regen.max, 'HP did not regenerate toward the maximum');
  for (const c of [[19, 1, 0], [0, 11, 1], [0, 5, 1], [1, 2, 0]]) state.cells.push(c);
  return {before, upgraded, paused, regen};
}

// An edited city layer after a restart: the native 山寨总声望 recount must equal the edited [8,1,0] cache. Below the
// maximum one native 挑战胜利 adds a layer (the idle layer follows only when it was at the top) and 获得声望 rewrites
// the cache one higher; at the maximum 开始城市波次 must refuse to start another wave.
async function cityLayer(state, s) {
  const {x, layer, idle} = s.city;
  const read = `const layer=a.At(${x},11,0),idle=a.At(${x},21,0),visited=a.At(${x},44,0),total=a.At(8,1,0),recount=call('山寨总声望',0,1),map=global('当前地图编号').GetValue(),challenge=global('挑战城市开关').GetValue();`;
  const ret = '{layer,idle,visited,total,recount,map,challenge}';
  const before = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);${read}return ${ret};})()`);
  assert.deepEqual([before.layer, before.idle, before.visited], [layer, idle, 1], 'Edited city not loaded');
  assert.equal(before.recount, before.total, 'Native recount differs from the edited cache');
  let after;
  if (layer < 149) {
    assert.equal(before.map, x, 'Current map is not the edited city');
    after = await evaluate(state, `(()=>{${prefix}call('挑战胜利');${read}return ${ret};})()`);
    assert.deepEqual([after.layer, after.idle, after.total, after.recount], [layer + 1, idle === layer ? idle + 1 : idle, before.total + 1, before.total + 1], 'Native challenge win');
  } else {
    after = await evaluate(state, `(()=>{${prefix}call('开始城市波次',${x});${read}return ${ret};})()`);
    assert.deepEqual([after.layer, after.total, after.challenge], [layer, before.total, before.challenge], 'A wave started above the maximum');
  }
  for (const c of [[x, 11, 0], [x, 21, 0], [x, 44, 0], [8, 1, 0]]) state.cells.push(c);
  return {before, after};
}

// An edited ascension quality after a restart: the native 角色资质上限倍率 and 角色资质上限 must equal the editor's M and
// caps, and every referenced stored pill must carry the coefficient of its round's quality.
async function ascensionQuality(state, s) {
  const {character, multiplier, caps, qualities} = s.ascensionQuality;
  const native = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);const c=${character},k=a.At(c,50,2),rounds=[];for(let i=1;i<=k;i++){const row=a.At(c,2*i,16);rounds.push({quality:a.At(c,2*i-1,16),row,coefficients:[15,16,17].map(y=>a.At(row,y,17))});}return {count:k,rounds,multiplier:call('角色资质上限倍率',c,0,0),caps:['力量','敏捷','智力'].map(t=>call('角色资质上限',c,t)),totals:[1,2,3].map(t=>call('角色资质计算',c,t))};})()`);
  assert.deepEqual(native.rounds.map(r => r.quality), qualities, 'Edited qualities not loaded');
  native.rounds.forEach((r, i) => assert.deepEqual(r.coefficients, Array(3).fill(ascensionCoefficient(r.quality, i + 1)), 'Stored pill coefficient'));
  assert.equal(native.multiplier, multiplier, 'Native cap multiplier');
  assert.deepEqual(native.caps, caps, 'Native aptitude caps');
  native.totals.forEach((t, i) => assert.ok(t <= native.caps[i], 'Total above the native cap'));
  for (let y = 1; y <= 16; y++) state.cells.push([character, y, 16]);
  for (const r of native.rounds) for (const y of [15, 16, 17]) state.cells.push([r.row, y, 17]);
  state.cells.push([character, 50, 2]);
  return native;
}

async function main() {
  const statePath = opt('--state'), state = JSON.parse(fs.readFileSync(statePath)), scenario = JSON.parse(fs.readFileSync(opt('--scenario')));
  const rel = path.relative(path.resolve(__dirname, '..'), state.dir), child = path.relative(state.dir, state.game);
  if (!rel || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep)) || !child || path.isAbsolute(child) || child.startsWith('..')) throw Error('External disposable state required');
  if (!scenario.ascend && !scenario.followup && !scenario.pills && !scenario.backpackOverLimit && !scenario.relics && !scenario.relicTakeOff && !scenario.wall && !scenario.city && !scenario.ascensionQuality) throw Error('Scenario has no native follow-up actions');
  await waitMain(state);
  const result = {};
  if (scenario.ascend && !scenario.pills) result.ascend = await ascend(state, scenario);
  if (scenario.followup) result.followup = await followup(state, scenario);
  if (scenario.pills) result.pills = await pillsAndRebirth(state, scenario);
  if (scenario.backpackOverLimit) result.backpackOverLimit = await backpackOverLimit(state, scenario);
  if (scenario.relics) result.relics = await relicPlacement(state, scenario);
  if (scenario.relicTakeOff) result.relicTakeOff = await relicTakeOff(state);
  if (scenario.wall) result.wall = await wallUpgrade(state, scenario);
  if (scenario.city) result.city = await cityLayer(state, scenario);
  if (scenario.ascensionQuality) result.ascensionQuality = await ascensionQuality(state, scenario);
  state.expected = await evaluate(state, `(()=>{${prefix}return ${JSON.stringify(state.cells)}.map(([x,y,z])=>a.At(x,y,z));})()`);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  fs.writeFileSync(path.join(state.dir, 'native-lifecycle.json'), JSON.stringify(result, null, 2));
  console.log('PASS: native ' + Object.keys(result).join(' and ') + ' follow-up actions');
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = {ascend, followup, pillsAndRebirth, backpackOverLimit, relicPlacement, relicTakeOff, wallUpgrade, cityLayer, ascensionQuality};
