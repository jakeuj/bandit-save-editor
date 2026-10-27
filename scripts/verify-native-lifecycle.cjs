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
  const before = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);if(a.At(1,${15 + slot},2)!==${id})throw Error('Expected equipped follow-up item');const v=record(${id},9);call('卸下装备',${slot},${id},1,false,false,7);return v;})()`);
  await pause(500);
  const bag = await evaluate(state, `(()=>{${prefix}if(a.At(1,${15 + slot},2)!==0)throw Error('Unequip failed');for(let id=1;id<a.GetWidth();id++)if(a.At(id,0,7)===${before[0]}&&a.At(id,1,7)===${before[1]}&&a.At(id,6,7)===${before[6]})return id;throw Error('Unequipped record missing');})()`);
  await evaluate(state, `(()=>{${prefix}call('穿戴装备',${slot},${bag},1,false,false,7);return true;})()`);
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
  await evaluate(state, `(()=>{${prefix}const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance();call('穿戴装备',wp.At(${template},6,0),${id},${character},false,false,7);return true;})()`);
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

// Over-cap pill bonuses (pillAptitudeBonusAdvanced). 角色资质计算 must equal the editor's predicted total (A+B/10, no cap) and
// 属性计算 1–3 must stay finite; 服用普通丹药 must refuse another pill while the total is above 角色资质上限, leaving B and the
// pill count alone, while a control aptitude still inside the cap consumes one. Rebirth then clears B as usual.
async function pillOverLimit(state, s) {
  const {character: c, over, control, others = [], rebirth = true} = s.pillOverLimit, names = ['力量', '敏捷', '智力'];
  const reads = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);const names=${JSON.stringify(names)};const read=(c,aptitude)=>({total:call('角色资质计算',c,aptitude),cap:call('角色资质上限',c,names[aptitude-1]),attribute:call('属性计算',c,aptitude),bonus:a.At(c,12+aptitude,2)});
    const take=(c,aptitude,pillId)=>{const before={count:a.At(pillId,6,0),bonus:a.At(c,12+aptitude,2)};call('服用普通丹药',pillId,c,1);return {before,after:{count:a.At(pillId,6,0),bonus:a.At(c,12+aptitude,2)}};};
    return {over:${JSON.stringify(over)}.map(o=>({...read(${c},o.aptitude),pill:take(${c},o.aptitude,o.pillId)})),control:take(${c},${control.aptitude},${control.pillId}),others:${JSON.stringify(others)}.map(o=>read(o.character,o.aptitude))};})()`);
  for (const [i, o] of [...over.map(o => ({...o, character: c})), ...others].entries()) {
    const got = i < over.length ? reads.over[i] : reads.others[i - over.length];
    assert.equal(got.bonus, o.bonus, `Stored bonus ${o.character}/${o.aptitude}`);
    assert.equal(got.total, o.total, `角色资质计算 ${o.character}/${o.aptitude}`);
    assert.ok(got.total > got.cap, `Total is not above 角色资质上限 for ${o.character}/${o.aptitude}`);
    assert.ok(Number.isFinite(got.attribute), `属性计算 not finite for ${o.character}/${o.aptitude}`);
  }
  for (const p of reads.over) assert.deepEqual(p.pill.after, p.pill.before, 'A pill was taken above the cap');
  assert.equal(reads.control.after.count, reads.control.before.count - 1, 'Control pill not consumed');
  assert.ok(reads.control.after.bonus > reads.control.before.bonus, 'Control pill bonus unchanged');
  let cleared = null;
  if (rebirth) {
    await evaluate(state, `(()=>{${prefix}call('角色重生',${c},0,0);return true;})()`);
    await pause(500);
    cleared = await evaluate(state, `(()=>{${prefix}return [13,14,15].map(y=>a.At(${c},y,2));})()`);
    assert.deepEqual(cleared, [0, 0, 0], 'Rebirth did not clear over-cap pill bonuses');
  }
  for (const y of [3, 4, 13, 14, 15, 50, 56]) state.cells.push([c, y, 2]);
  for (const o of others) state.cells.push([o.character, 12 + o.aptitude, 2]);
  return {...reads, cleared};
}

// Over-limit backpack rows: one is stored into z9, a native level-up below the cap still works (control), both native
// upgrades leave the over-limit level, money and souls untouched, and it comes back out; the other is worn straight from
// the backpack with finite equipment effects and unequipped. Moved rows must keep every field except the owner.
async function backpackOverLimit(state, s) {
  const {stored, worn} = s.backpackOverLimit, find = `const find=(z,v)=>{for(let x=1;x<a.GetWidth();x++){let ok=true;for(let y=0;y<50;y++)if(y!==7&&a.At(x,y,z)!==v[y]){ok=false;break;}if(ok)return x;}throw Error('Moved record missing in z'+z);};`;
  const store = await evaluate(state, `(()=>{${prefix}${find}r.SetTimeScale(0);const before=record(${stored.id},7);call('装备库存入',${stored.id},true,0,7);const id=find(9,before);return {before,id,moved:record(id,9),source:record(${stored.id},7)};})()`);
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
  const takeout = await evaluate(state, `(()=>{${prefix}${find}const before=record(${store.id},9);call('装备库取出',${store.id},true,0,7);const id=find(7,before);return {id,record:record(id,7)};})()`);
  await pause(500);
  for (const [name, row] of [['store', store.moved], ['takeout', takeout.record]]) assert.deepEqual(row, store.before, name + ' changed the over-limit row');
  assert.ok(store.source.every(v => v === 0), 'Stored backpack row was not cleared');

  const put = await evaluate(state, `(()=>{${prefix}const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),before=record(${worn.id},7),slot=wp.At(before[1],6,0);
    call('穿戴装备',slot,${worn.id},${worn.character},false,false,7);return {slot,before};})()`);
  await pause(500);
  const wear = await evaluate(state, `(()=>{${prefix}const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),slot=${put.slot},before=${JSON.stringify(put.before)},id=a.At(${worn.character},15+slot,2),v=record(id,9);
    const effects=[];for(let s=0;s<3;s++){const attr=wp.At(v[1],8+s,0);if(attr>0)effects.push({attr,actual:call('装备属性计算',${worn.character},attr,0,0,0,0,0,0,0),main:call('装备主属性',v[6],v[3],attr,v[8],wp.At(v[1],11+s,0),'主属性',0,v[5])});}
    return {slot,before,id,record:v,effects};})()`);
  for (let y = 0; y < 50; y++) if (y !== 7) assert.equal(wear.record[y], wear.before[y], 'Wear changed field ' + y);
  assert.equal(wear.record[7], worn.character);
  for (const e of wear.effects) assert.ok(Number.isFinite(e.actual) && Number.isFinite(e.main) && e.actual >= e.main, 'Non-finite or missing equipment effect ' + e.attr);
  await evaluate(state, `(()=>{${prefix}call('卸下装备',${wear.slot},${wear.id},${worn.character},false,false,7);return true;})()`);
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
// V1.0.13.0 armory (z22): 仓库存入／仓库取出 copy y0–49 between the backpack and z22, and with 武库换装 mode on ([37,1,0]=1)
// 穿戴装备／卸下装备 take 库序号 22 to wear straight from and unequip back into z22. Edited rows must keep every field except
// the owner; both end in z22 so the restart reads the new layer back.
async function armory(state, s) {
  const {stored, worn} = s.armory, find = `const find=(z,v)=>{for(let x=1;x<a.GetWidth();x++){let ok=true;for(let y=0;y<50;y++)if(y!==7&&a.At(x,y,z)!==v[y]){ok=false;break;}if(ok)return x;}throw Error('Moved record missing in z'+z);};`;
  const move = (fn, id, from, to) => evaluate(state, `(()=>{${prefix}${find}r.SetTimeScale(0);const before=record(${id},${from}),count=call('仓库数量',0);call('${fn}',${id},true,0);const x=find(${to},before);return {before,id:x,moved:record(x,${to}),source:record(${id},${from}),count:[count,call('仓库数量',0)]};})()`);
  const store = await move('仓库存入', stored.id, 7, 22);
  const takeout = await move('仓库取出', store.id, 22, 7);
  const restore = await move('仓库存入', takeout.id, 7, 22);
  for (const [name, m] of [['store', store], ['takeout', takeout], ['restore', restore]]) {
    assert.deepEqual(m.moved, m.before, name + ' changed the edited row');
    assert.ok(m.source.every(v => v === 0), name + ' did not clear the source row');
  }
  assert.deepEqual([store.count[1] - store.count[0], takeout.count[1] - takeout.count[0], restore.count[1] - restore.count[0]], [1, -1, 1], '仓库数量 did not follow the moves');
  const shelf = await move('仓库存入', worn.id, 7, 22);
  assert.deepEqual(shelf.moved, shelf.before, 'Storing the worn row changed it');
  const put = await evaluate(state, `(()=>{${prefix}const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),before=record(${shelf.id},22),slot=wp.At(before[1],6,0),mode=a.At(37,1,0);
    a.Set(37,1,0,1);call('穿戴装备',slot,${shelf.id},${worn.character},false,false,22);return {slot,before,mode};})()`);
  await pause(500);
  const wear = await evaluate(state, `(()=>{${prefix}const id=a.At(${worn.character},15+${put.slot},2);return {id,record:record(id,9),source:record(${shelf.id},22)};})()`);
  for (let y = 0; y < 50; y++) if (y !== 7) assert.equal(wear.record[y], put.before[y], 'Wearing from z22 changed field ' + y);
  assert.equal(wear.record[7], worn.character);
  assert.ok(wear.source.every(v => v === 0), 'Wearing did not clear the z22 row');
  await evaluate(state, `(()=>{${prefix}call('卸下装备',${put.slot},${wear.id},${worn.character},false,false,22);return true;})()`);
  await pause(500);
  const back = await evaluate(state, `(()=>{${prefix}${find}const id=find(22,${JSON.stringify(put.before)});return {id,record:record(id,22),pointer:a.At(${worn.character},${15 + put.slot},2),mode:a.At(37,1,0)};})()`);
  assert.deepEqual(back.record, put.before, 'Unequipping into z22 changed the edited row');
  assert.notEqual(back.pointer, wear.id, 'Character still points at the unequipped row');
  for (const v of [{id: restore.id, z: 22}, {id: back.id, z: 22}, {id: stored.id, z: 7}, {id: worn.id, z: 7}, {id: wear.id, z: 9}]) for (let y = 0; y < 50; y++) state.cells.push([v.id, y, v.z]);
  state.cells.push([worn.character, 15 + put.slot, 2], [37, 1, 0]);
  return {store, takeout, restore, shelf, wear, back, mode: put.mode};
}

const relicFind =`const same=(v,w)=>v.every((x,y)=>y===12||w[y]===x);const find=v=>{for(let x=1;x<a.GetWidth();x++)if(a.At(x,1,18)!==0&&same(v,record(x,18)))return x;throw Error('Relic missing in z18');};`;
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

// verify-game freezes time on reaching 主界面, before 生成主地图建筑 (it waits between buildings) has spawned the cores and
// 刷新地块灵气 has run; let a few seconds of game time pass first.
async function settleMap(state) {
  await evaluate(state, `(()=>{${prefix}r.SetTimeScale(1);return true;})()`);
  await pause(5000);
  return evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);return r.GetObjectClassByName('建筑核心').GetInstances().length;})()`);
}
// A base save without a 置物台: build one natively on the free camp tile with the most tiles in range, finish it the way
// 采集核心碰撞 does (work y4 to 0, then 建筑建造成功) and place a backpack relic on it with 摆放灵物. The stand and the
// placement are native; only the builders' walk is skipped.
const standTiles = `const start=global('主地图编号起始').GetValue(),grounds=r.GetObjectClassByName('地面').GetInstances(),v=(i,n)=>i.GetInstanceVariableValue(n);const camp=grounds.filter(g=>v(g,8)==='山寨'&&v(g,18));`;
async function relicStandPrepare(state, s) {
  const {relic} = s.relicStandPrepare;
  await settleMap(state);
  const built = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);${standTiles}
    if(!(a.At(${relic},1,18)>0))throw Error('No backpack relic at row ${relic}');
    const used=new Set(r.GetObjectClassByName('地图建筑').GetInstances().map(i=>v(i,4)+','+v(i,5)));
    const free=camp.filter(g=>!v(g,0)&&!v(g,13)&&!v(g,16)&&!used.has(v(g,3)+','+v(g,4))&&!(a.At(v(g,3)-start+150,v(g,4)-start,6)>0));
    if(!free.length)throw Error('No free camp tile');
    const score=g=>camp.filter(t=>call('地块范围判定',v(g,3),v(g,4),v(t,3),v(t,4),0,0,0)===1).length,tile=free.map(g=>[score(g),v(g,3),v(g,4)]).sort((p,q)=>q[0]-p[0])[0];
    const before=new Set();for(let x=1;x<a.GetWidth();x++)if(a.At(x,1,1)>0)before.add(x);
    const ok=call('建筑满足检测',67,0,0,0),limit=call('建筑数量上限',67);
    call('生成单体建筑',67,0,0,3,'主地图',true,tile[1],tile[2],false,false,false,0,false,false);
    let b=0;for(let x=1;x<a.GetWidth();x++)if(!before.has(x)&&a.At(x,1,1)===67)b=x;if(!b)throw Error('置物台 row missing');
    return {building:b,tile,ok,limit,work:a.At(b,4,1)};})()`);
  await pause(500);
  const done = await evaluate(state, `(()=>{${prefix}const b=${built.building};if(typeof a.Set!=='function')throw Error('Array Set missing');a.Set(b,4,1,0);call('建筑建造成功',b);return {work:a.At(b,4,1),level:a.At(b,5,1),row:Array.from({length:11},(_,y)=>a.At(b,y,1))};})()`);
  assert.deepEqual([done.work, done.level, done.row[0], done.row[1]], [0, 0, built.building, 67], 'Stand not finished');
  const before = await evaluate(state, `(()=>{${prefix}return record(${relic},18);})()`);
  const placed = await placeRelic(state, relic, built.building); checkPlaced(placed, before, built.building);
  state.relicStand = {building: built.building, slot: placed.slot};
  for (let y = 0; y < 11; y++) state.cells.push([built.building, y, 1]);
  for (let y = 0; y < 50; y++) state.cells.push([placed.slot, y, 19], [relic, y, 18]);
  return {built, done, before, placed};
}
// An edited placed relic after loading: every camp tile in the stand's range carries round(10·a·(1+0.15L))/10 per element and
// for the mean, as the editor predicted, tiles outside carry nothing, a fresh 刷新地块灵气 agrees, and take-off and
// re-placement keep the edited y5–10. state.relic is left for relicTakeOff after the next restart.
async function placedRelicAura(state, s) {
  const {building, slot, values, average, aura} = s.placedRelicAura;
  await settleMap(state);
  const read = `${standTiles}const core=r.GetObjectClassByName('建筑核心').GetInstances().find(i=>v(i,3)===${building});if(!core)throw Error('Stand core missing');
    const tiles=()=>camp.map(g=>({x:v(g,3),y:v(g,4),inRange:call('地块范围判定',v(core,1),v(core,2),v(g,3),v(g,4),0,0,0)===1,aura:[0,1,2,3,4,5].map(i=>Number(call('地块灵气',v(g,3),v(g,4),i)))}));`;
  const out = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);${read}
    const out={link:[a.At(${building},9,1),a.At(${slot},12,19),a.At(${building},1,1)],stored:Array.from({length:6},(_,i)=>a.At(${slot},5+i,19)),level:a.At(${building},5,1),loaded:tiles()};
    call('刷新地块灵气');out.refreshed=tiles();return out;})()`);
  assert.deepEqual(out.link, [slot, building, 67], 'Stand and relic do not point at each other');
  assert.deepEqual(out.stored, [...values, average], 'Edited placed relic not loaded');
  const want = [aura.total, ...aura.elements], check = list => {
    const inRange = list.filter(t => t.inRange);
    assert.ok(inRange.length > 0, 'No camp tile in the stand range');
    for (const t of list) assert.deepEqual(t.aura, t.inRange ? want : [0, 0, 0, 0, 0, 0], `Tile aura at ${t.x},${t.y}`);
    return inRange.length;
  };
  out.tiles = check(out.loaded); check(out.refreshed);
  const record = await evaluate(state, `(()=>{${prefix}return record(${slot},19);})()`);
  const off = await takeOffRelic(state, building, record); checkTakenOff(off, record);
  const again = await placeRelic(state, off.id, building); checkPlaced(again, record.map((x, y) => y === 12 ? 0 : x), building);
  const after = await evaluate(state, `(()=>{${prefix}${read}return tiles();})()`); check(after);
  state.relic = {building, record: again.placed.map((x, y) => y === 12 ? 0 : x)};
  for (const [x, z] of [[off.id, 18], [again.slot, 19]]) for (let y = 0; y < 50; y++) state.cells.push([x, y, z]);
  state.cells.push([building, 9, 1]);
  return {link: out.link, stored: out.stored, level: out.level, tiles: out.tiles, off: {id: off.id, slot: off.slot}, again: {slot: again.slot}};
}

// Edited backpack relics used up natively. 套装合成 turns a worn ordinary item (选择库序号 9) into the recipe set in place:
// y27 keeps the old y1, y24=1, y23 takes the relic quality y4 and y26 its mean y10, other fields stay; 内丹精炼 makes a new
// z7 inner pill of quality clamp(floor((relic y4 + material quality)/2),1,6) at the material tier and reads no element.
// Both clear the relic row and charge copper (the second also 5 materials). The selection page's filters (ordinary item of
// the same y7/y10, relic template 合成灵物编号, material kind, unlocked recipe) are asserted here, since the call skips the page.
// Copper and material counts are compared in place only: per-second events can move them before verify-game freezes time.
async function relicCrafting(state, s) {
  const {synthesis, refine} = s.relicCrafting, tables = `const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),cl=r.GetObjectClassByName('cl').GetInstances()[0].GetSdkInstance();`;
  const out = {};
  if (synthesis) {
    const {relic, equipment, recipe} = synthesis;
    const before = await evaluate(state, `(()=>{${prefix}${tables}r.SetTimeScale(0);const eq=record(${equipment},9),rel=record(${relic},18),slot=wp.At(${recipe},6,0),owner=eq[7];
      return {eq,rel,slot,owner,pointer:a.At(owner,15+slot,2),ordinary:wp.At(eq[1],4,0),sameKind:wp.At(eq[1],7,0)===wp.At(${recipe},7,0)&&wp.At(eq[1],10,0)===wp.At(${recipe},10,0),
        spirit:call('合成灵物编号',${recipe}),unlocked:a.At(${recipe},19,0),cost:call('合成费用',wp.At(${recipe},3,0)),copper:a.At(1,2,0)};})()`);
    assert.deepEqual([before.ordinary, before.sameKind, before.rel[1], before.unlocked, before.pointer], ['普通', true, before.spirit, 1, equipment], 'Synthesis preconditions');
    assert.ok(before.owner > 0 && before.copper >= before.cost, 'Synthesis owner or copper');
    await evaluate(state, `(()=>{${prefix}global('合成配方装备序号').SetValue(${equipment});global('合成配方灵物序号').SetValue(${relic});global('选择库序号').SetValue(9);call('套装合成',${recipe});return true;})()`);
    await pause(500);
    const after = await evaluate(state, `(()=>{${prefix}return {eq:record(${equipment},9),rel:record(${relic},18),pointer:a.At(${before.owner},15+${before.slot},2),copper:a.At(1,2,0),globals:[global('合成配方装备序号').GetValue(),global('合成配方灵物序号').GetValue()]};})()`);
    const want = before.eq.map((v, y) => ({1: recipe, 23: before.rel[4], 24: 1, 26: before.rel[10], 27: before.eq[1]})[y] ?? v);
    assert.deepEqual(after.eq, want, 'Synthesized item fields');
    assert.ok(after.rel.every(v => v === 0), 'Synthesis left the relic row');
    assert.deepEqual([after.pointer, before.copper - after.copper, ...after.globals], [equipment, before.cost, 0, 0], 'Synthesis pointer, cost or selection');
    for (let y = 0; y < 50; y++) state.cells.push([equipment, y, 9], [relic, y, 18]);
    state.cells.push([before.owner, 15 + before.slot, 2]);
    out.synthesis = {before: {equipment: before.eq, relic: before.rel}, after: after.eq, owner: before.owner, cost: before.cost};
  }
  if (refine) {
    const {relic, pill, material} = refine;
    const before = await evaluate(state, `(()=>{${prefix}${tables}r.SetTimeScale(0);const rel=record(${relic},18),seen=[];for(let x=1;x<a.GetWidth();x++)if(a.At(x,1,7)>0)seen.push(x);
      return {rel,seen,spirit:call('合成灵物编号',${pill}),unlocked:a.At(${pill},19,0),kind:[cl.At(${material},3,0),cl.At(${material},5,0),wp.At(${pill},7,0)],quality:cl.At(${material},6,0),tier:cl.At(${material},2,0),
        need:call('精炼材料数量',${pill}),count:a.At(${material},6,0),cost:call('精炼费用',cl.At(${material},2,0)),copper:a.At(1,2,0),room:call('物品数量',0)<call('背包容量上限')};})()`);
    assert.deepEqual([before.rel[1], before.unlocked, before.kind[0], before.kind[1], before.room], [before.spirit, 1, before.kind[2], '丹药', true], 'Refine preconditions');
    assert.ok(before.count >= before.need && before.copper >= before.cost, 'Refine materials or copper');
    await evaluate(state, `(()=>{${prefix}global('精炼内丹灵物序号').SetValue(${relic});global('精炼内丹材料编号').SetValue(${material});call('内丹精炼',${pill});return true;})()`);
    await pause(500);
    const after = await evaluate(state, `(()=>{${prefix}const seen=new Set(${JSON.stringify(before.seen)}),rows=[];for(let x=1;x<a.GetWidth();x++)if(!seen.has(x)&&a.At(x,1,7)>0)rows.push(x);
      return {rows,record:rows.length?record(rows[0],7):null,rel:record(${relic},18),count:a.At(${material},6,0),copper:a.At(1,2,0),globals:[global('精炼内丹灵物序号').GetValue(),global('精炼内丹材料编号').GetValue()]};})()`);
    const q = Math.min(6, Math.max(1, Math.floor((before.rel[4] + before.quality) / 2)));
    assert.equal(after.rows.length, 1, 'Refine must add exactly one z7 row');
    const p = after.record;
    assert.deepEqual([p[0], p[1], p[2], p[3], p[5], p[6], p[7]], [after.rows[0], pill, 1, before.tier, q, 1, 0], 'Refined inner pill');
    assert.ok(p[8] >= 80 + 30 * (q - 1) && p[8] <= 80 + 30 * q, 'Refined main coefficient ' + p[8]);
    assert.ok(after.rel.every(v => v === 0), 'Refine left the relic row');
    assert.deepEqual([before.count - after.count, before.copper - after.copper, ...after.globals], [before.need, before.cost, 0, 0], 'Refine materials, cost or selection');
    for (let y = 0; y < 50; y++) state.cells.push([after.rows[0], y, 7], [relic, y, 18]);
    out.refine = {relic: before.rel, quality: q, materialQuality: before.quality, tier: before.tier, cost: before.cost, need: before.need, row: after.rows[0], pill: p};
  }
  return out;
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

// Prepares unabsorbed inner pills on a base save: 获得物品 with the requested quality and level (main coefficient from the
// native 装备主属性系数), optionally worn with 穿戴装备. Returns the z7／z9 rows so the editor scenario can name them.
async function innerPillPrepare(state, s) {
  const rows = [];
  for (const {template, quality, level, wear} of s.innerPillPrepare.pills) {
    const id = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),seen=new Set();for(let x=1;x<a.GetWidth();x++)if(a.At(x,1,7)>0)seen.add(x);
      call('获得物品',true,${template},${quality},${level},wp.At(${template},3,0),call('装备主属性系数',${quality},''),1,false,0,'特定装备',false,false);for(let x=1;x<a.GetWidth();x++)if(!seen.has(x)&&a.At(x,1,7)===${template})return x;throw Error('Obtained inner pill missing in z7');})()`);
    await pause(500);
    let row = {template, plane: 7, id, record: await evaluate(state, `(()=>{${prefix}return record(${id},7);})()`)};
    if (wear) {
      await evaluate(state, `(()=>{${prefix}call('穿戴装备',5,${id},${wear},false,false,7);return true;})()`);
      await pause(500);
      const worn = await evaluate(state, `(()=>{${prefix}const id=a.At(${wear},20,2);return {id,record:record(id,9)};})()`);
      assert.equal(worn.record[1], template, 'Inner pill was not worn'); assert.equal(worn.record[7], wear, 'Worn inner pill owner');
      row = {template, plane: 9, id: worn.id, character: wear, record: worn.record};
    }
    assert.deepEqual([row.record[2], row.record[5], row.record[6]], [1, quality, level], 'Obtained inner pill');
    for (let y = 0; y < 50; y++) state.cells.push([row.id, y, row.plane]);
    if (wear) state.cells.push([wear, 20, 2]);
    rows.push(row);
  }
  return rows;
}

// Edited inner pill levels after a restart. Every row must load at the edited level; a worn pill's 内丹破镜值 follows
// round(200·q²·(0.15·T²+0.3)·(1+0.025·L))/100; a backpack pill keeps its level when worn (装备库存入 copies y0–49); the
// native 升级装备 continues from a lowered level and stops at the cap; 渡劫结束 copies the edited level into z17.
async function innerPillLevel(state, s) {
  const {rows, wear, upgrade, capped, ascend} = s.innerPillLevel, out = {};
  out.rows = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);return ${JSON.stringify(rows)}.map(v=>({...v,record:record(v.id,v.plane)}));})()`);
  for (const v of out.rows) assert.equal(v.record[6], v.level, `Edited level not loaded for ${v.plane}:${v.id}`);
  out.worn = await evaluate(state, `(()=>{${prefix}return ${JSON.stringify(rows.filter(v => v.character))}.map(v=>{const p=record(v.id,9),wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),attr=wp.At(p[1],8,0);
    return {...v,pointer:a.At(v.character,20,2),breakthrough:call('内丹破镜值',p[5],p[6],p[3]),attr,main:call('装备主属性',p[6],p[3],attr,p[8],wp.At(p[1],11,0),'主属性',0,p[5]),total:call('装备属性计算',v.character,attr,0,0,0,0,0,0,0)};});})()`);
  for (const v of out.worn) {
    const p = out.rows.find(r => r.id === v.id && r.plane === 9).record;
    assert.equal(v.pointer, v.id, 'Worn pointer');
    assert.equal(v.breakthrough, Math.round(200 * p[5] ** 2 * (0.15 * p[3] ** 2 + 0.3) * (1 + 0.025 * p[6])) / 100, '内丹破镜值');
    assert.ok(v.total >= v.main, 'Worn pill main attribute missing from 装备属性计算');
  }
  if (wear) {
    await evaluate(state, `(()=>{${prefix}call('穿戴装备',5,${wear.id},${wear.character},false,false,7);return true;})()`);
    await pause(500);
    out.wear = await evaluate(state, `(()=>{${prefix}const id=a.At(${wear.character},20,2);return {id,record:record(id,9),bag:record(${wear.id},7)};})()`);
    assert.equal(out.wear.record[6], wear.level, 'Worn backpack pill level'); assert.equal(out.wear.record[7], wear.character);
    assert.ok(out.wear.bag.every(v => v === 0), 'Backpack row not moved');
    for (let y = 0; y < 50; y++) state.cells.push([out.wear.id, y, 9], [wear.id, y, 7]);
    state.cells.push([wear.character, 20, 2]);
  }
  out.upgrade = await evaluate(state, `(()=>{${prefix}const id=${upgrade.id},p=record(id,9),souls=a.At(3,2,0),cost=call('升级装备魂魄',p[6],p[3],0,'内丹');call('升级装备',id,${upgrade.character});return {before:p[6],after:a.At(id,6,9),souls,cost,soulsAfter:a.At(3,2,0)};})()`);
  assert.deepEqual([out.upgrade.after, out.upgrade.soulsAfter], [out.upgrade.before + 1, out.upgrade.souls - out.upgrade.cost], 'Native upgrade from the edited level');
  out.capped = await evaluate(state, `(()=>{${prefix}const id=${capped.id},souls=a.At(3,2,0),before=a.At(id,6,9);call('升级装备',id,${capped.character});return {before,after:a.At(id,6,9),cap:call('装备等级上限',a.At(id,5,9)),souls,soulsAfter:a.At(3,2,0)};})()`);
  assert.deepEqual([out.capped.after, out.capped.soulsAfter], [out.capped.before, out.capped.souls], 'Native upgrade passed the cap');
  assert.equal(out.capped.before, out.capped.cap, 'Capped pill not at its cap');
  state.cells.push([3, 2, 0], [upgrade.id, 6, 9], [capped.id, 6, 9]);
  if (ascend) {
    const c = ascend.character, source = await evaluate(state, `(()=>{${prefix}return record(a.At(${c},20,2),9);})()`);
    await evaluate(state, `(()=>{${prefix}const m=r.GetEventSheetManager(),v=name=>{const f=[...m.GetAllGlobalVariables(),...m.GetAllLocalVariables()].filter(v=>v.GetName()===name);if(f.length!==1)throw Error('Ambiguous variable '+name);return f[0];};v('渡劫角色序号').SetValue(${c});v('渡劫结丹品质').SetValue(${ascend.quality});call('渡劫结束',false);return true;})()`);
    await pause(500);
    out.ascend = await evaluate(state, `(()=>{${prefix}const c=${c},k=a.At(c,50,2),row=a.At(c,2*k,16);return {count:k,quality:a.At(c,2*k-1,16),row,stored:record(row,17),slot:a.At(c,20,2),source:record(${capped.id},9)};})()`);
    assert.equal(out.ascend.slot, 0, 'Ascension did not take the worn pill');
    assert.deepEqual([out.ascend.stored[1], out.ascend.stored[6], out.ascend.stored[7]], [source[1], source[6], c], 'Stored pill template, level or owner');
    for (let y = 0; y < 9; y++) if (y !== 7) assert.equal(out.ascend.stored[y], source[y], 'Stored pill field ' + y);
    assert.ok(out.ascend.source.every(v => v === 0), 'Worn pill row was not cleared');
    for (let y = 0; y < 50; y++) state.cells.push([out.ascend.row, y, 17], [capped.id, y, 9]);
    for (let y = 1; y <= 16; y++) state.cells.push([c, y, 16]);
    state.cells.push([c, 20, 2], [c, 50, 2], [c, 3, 2]);
  }
  return out;
}

// Edited ascended inner pill levels after a restart. Every z16-referenced z17 row loads at its level; the only reader,
// 内丹属性计算, must equal the native 装备主属性 at that level (each stored template has its own single main attribute), and
// 角色资质上限倍率 must not move.
async function ascendedInnerPillLevel(state, s) {
  const {character, rows, multiplier} = s.ascendedInnerPillLevel;
  const native = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);const c=${character},wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance();
    return {multiplier:call('角色资质上限倍率',c,0,0),rows:${JSON.stringify(rows)}.map(v=>{const row=a.At(c,2*v.round,16),p=record(row,17),attr=wp.At(p[1],8,0),main=L=>call('装备主属性',L,p[3],attr,p[8],wp.At(p[1],11,0),'主属性',0,p[5]);
      return {...v,stored:row,record:p,attr,cap:call('装备等级上限',p[5]),reader:call('内丹属性计算',c,attr,0,0,0,0,0,0,0),main:main(p[6]),atOne:main(1)};})};})()`);
  for (const v of native.rows) {
    assert.equal(v.stored, v.row, `Round ${v.round} row`);
    assert.deepEqual([v.record[6], v.record[7]], [v.level, character], `Edited level or owner not loaded for round ${v.round}`);
    assert.ok(v.level <= v.cap, 'Level above 装备等级上限');
    assert.equal(v.reader, v.main, `内丹属性计算 for round ${v.round}`);
    if (v.level > 1) assert.ok(v.main > v.atOne, 'Main attribute did not follow the level');
    for (let y = 0; y < 50; y++) state.cells.push([v.row, y, 17]);
  }
  assert.equal(native.multiplier, multiplier, 'Native cap multiplier moved');
  for (let y = 1; y <= 16; y++) state.cells.push([character, y, 16]);
  state.cells.push([character, 50, 2]);
  return native;
}

// Edited basic techs after a restart: 科技解锁判断 and 建筑等级解锁判断 (level 0, the build menu) see the new unlocks, the cap
// stays at 1, an unlocked tech refuses further research, and a tech whose prerequisite was edited starts and stops natively.
async function basicTechnology(state, s) {
  const {unlocked, locked, buildings, research} = s.basicTechnology;
  const out = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);let academy=0;for(let x=1;x<a.GetWidth();x++)if(a.At(x,0,1)===x&&a.At(x,1,1)===5){academy=x;break;}if(!academy)throw Error('No 书院');
    const gate=id=>({id,level:a.At(id,4,0),points:a.At(id,12,0),flag:a.At(id,13,0),unlock:call('科技解锁判断',id),cap:call('科技等级上限',id,0)});
    const out={academy,unlocked:${JSON.stringify(unlocked)}.map(gate),locked:${JSON.stringify(locked)}.map(gate),buildings:${JSON.stringify(buildings)}.map(([b,expected])=>({b,expected,unlock:call('建筑等级解锁判断',b,0,false)}))};
    ${selectFacility(1, 'academy')}
    const copper=a.At(1,2,0);call('科技研究',${unlocked[0]},a.At(academy,5,1));out.refused=[a.At(${unlocked[0]},4,0),a.At(${unlocked[0]},13,0),a.At(f,3,21),a.At(1,2,0)-copper];
    call('科技研究',${research},a.At(academy,5,1));out.started=[a.At(${research},13,0),a.At(f,3,21),a.At(${research},4,0)];call('取消设施进程',X,Y,false,0);out.stopped=[a.At(${research},13,0),a.At(f,3,21),a.At(1,2,0)-copper];out.f=f;return out;})()`);
  for (const t of out.unlocked) assert.deepEqual([t.level, t.points, t.flag, t.unlock, t.cap], [1, 0, 0, 1, 1], `Unlocked tech ${t.id}`);
  for (const t of out.locked) assert.deepEqual([t.level, t.unlock], [0, 0], `Locked tech ${t.id}`);
  for (const b of out.buildings) assert.equal(b.unlock, b.expected, `建筑等级解锁判断 for building ${b.b}`);
  assert.deepEqual(out.refused, [1, 0, 0, 0], 'An unlocked basic tech started research');
  assert.deepEqual(out.started, [1, research, 0], 'Research behind an edited prerequisite did not start');
  assert.deepEqual(out.stopped, [0, 0, 0], 'Cancel did not clear the research or refund the copper');
  for (const id of [...unlocked, ...locked, research]) state.cells.push([id, 4, 0], [id, 12, 0], [id, 13, 0]);
  state.cells.push([out.f, 3, 21], [1, 2, 0]);
  return out;
}

// Recruitment technology #33 over 299 (recruitTechnologyAdvanced) after a restart: 加成属性效果(24) returns the edited L, and
// 科技等级上限 still stops research at 299. A native 主动寻访 charges its fee and resets the countdown to 600−L; a few seconds of
// game time then run the per-second countdown. It runs only while 游戏暂停 is off; SetBoolVar stores 0/1, so the check is
// on truthiness, not on false. At L=599 every tick resets it to 1 and
// refreshes the candidates (the marker in [11,1,0] is cleared), so a second 主动寻访 is refused without a charge; lower L
// counts down and the second search goes through. The refresh can reset the [tier,43] pity count, so only the fee is compared;
// the countdown and copper change with time and stay out of state.cells.
async function recruitTechnology(state, s) {
  const {level, tier = 1, seconds = 3.5} = s.recruitTechnology, interval = 600 - level;
  const read = `const read=()=>({level:a.At(33,4,0),bonus:call('加成属性效果',24),countdown:a.At(1,17,0),money:a.At(1,2,0),marker:a.At(11,1,0)});`;
  const first = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);${read}const before=read(),cap=call('科技等级上限',33,4),fee=call('主动寻访费用',${tier}),paused=global('游戏暂停').GetValue();
    call('主动寻访',${tier});const searched=read();a.Set(11,1,0,7);r.SetTimeScale(1);return {before,cap,fee,paused,searched,originalMarker:before.marker};})()`);
  await pause(seconds * 1000);
  const second = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);${read}const ticked=read(),pausedAfter=global('游戏暂停').GetValue();call('主动寻访',${tier});const after=read();if(ticked.marker===7)a.Set(11,1,0,${first.before.marker});return {ticked,after,pausedAfter};})()`);
  const {before, cap, fee, paused, searched} = first, {ticked, after, pausedAfter} = second;
  assert.ok(!paused && !pausedAfter, '游戏暂停 is on; the countdown would not run');
  assert.deepEqual([before.level, before.bonus], [level, level], '加成属性效果(24) does not return the edited level');
  assert.equal(cap, 299, '科技等级上限 for #33');
  assert.ok(before.countdown > 1, 'Countdown already at the refresh point before the first search');
  assert.deepEqual([searched.countdown, before.money - searched.money], [interval, fee], 'Native 主动寻访 did not reset the countdown to 600−L');
  if (interval === 1) {
    assert.deepEqual([ticked.countdown, ticked.marker], [1, 0], 'The per-second tick did not reset and refresh at L=599');
    assert.deepEqual([after.countdown, after.money], [ticked.countdown, ticked.money], '主动寻访 went through with the countdown at 1');
  } else {
    assert.ok(ticked.countdown < interval && ticked.countdown >= interval - Math.ceil(seconds) - 1 && ticked.marker === 7, 'The countdown did not run down from 600−L');
    assert.deepEqual([after.countdown, ticked.money - after.money], [interval, fee], 'Control 主动寻访 was refused');
  }
  state.cells.push([33, 4, 0]);
  return {before, cap, fee, searched, ticked, after};
}

// Prepares washed ordinary equipment for the affix over-limit smoke (the base save has only Q1 ordinary items, which have no
// affix slots): 获得物品 (特定装备) obtains each template at the given quality and level in z7, an optional 穿戴装备 moves it
// to z9 on a character (the native swap returns the old item to z7), and one native 词条洗练 on the slot selects it.
async function affixPrepare(state, s) {
  const rows = [];
  for (const {template, quality, level = 1, slot, wear} of s.affixPrepare.items) {
    let id = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),seen=new Set();for(let x=1;x<a.GetWidth();x++)if(a.At(x,1,7)>0)seen.add(x);
      call('获得物品',true,${template},${quality},${level},wp.At(${template},3,0),call('装备主属性系数',${quality},''),1,false,0,'特定装备',false,false);for(let x=1;x<a.GetWidth();x++)if(!seen.has(x)&&a.At(x,1,7)===${template})return x;throw Error('Obtained item missing in z7');})()`);
    await pause(500);
    let plane = 7, part = 0;
    if (wear) {
      await evaluate(state, `(()=>{${prefix}const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance();call('穿戴装备',wp.At(${template},6,0),${id},${wear},false,false,7);return true;})()`);
      await pause(500);
      ({id, part} = await evaluate(state, `(()=>{${prefix}const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),part=wp.At(${template},6,0),id=a.At(${wear},15+part,2);if(a.At(id,1,9)!==${template}||a.At(id,7,9)!==${wear})throw Error('Obtained item was not worn');return {id,part};})()`));
      plane = 9;
    }
    const wash = await evaluate(state, `(()=>{${prefix}const souls=a.At(3,2,0),cost=call('词条洗练魂魄',a.At(${id},3,${plane}),call('装备已洗词条数',${id},${plane},0));call('词条洗练',${id},${slot},${plane});return {cost,spent:souls-a.At(3,2,0),record:record(${id},${plane})};})()`);
    const r = wash.record;
    assert.deepEqual([r[1], r[2], r[5], r[6]], [template, 1, quality, level], 'Obtained item');
    assert.equal(wash.spent, wash.cost, 'Native wash cost');
    for (let k = 1; k <= 6; k++) assert.equal(r[27 + k], k === slot ? 1 : 0, 'Wash flag ' + k);
    for (let k = 1; k < quality; k++) assert.ok(r[8 + k] > 0 && r[14 + k] >= 10 * (quality - 1) && r[14 + k] <= 60 + 10 * quality, 'Native affix ' + k);
    for (let y = 0; y < 50; y++) state.cells.push([id, y, plane]);
    if (wear) state.cells.push([wear, 15 + part, 2]);
    rows.push({template, plane, id, slot, part, character: wear || 0, record: r});
  }
  return rows;
}

// Edited over-limit affix coefficients after a restart (equipmentAffixCoefficientAdvanced). Every row loads at the edited value.
// For a worn row, 装备属性计算 must move by the editor's predicted delta when the slot is set back to its original coefficient in
// place (and restored right after), so the linear 装备主属性 path takes the value unclamped. 卸下装备→穿戴装备 keeps the record
// (装备库存入／取出 copy all 50 fields). A native 词条洗练 of the rewash row rolls an in-range value, keeps the slot flag and the
// washed count, and charges 词条洗练魂魄.
async function affixOverLimit(state, s) {
  const {rows, rewash} = s.affixOverLimit;
  const loaded = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);return ${JSON.stringify(rows)}.map(v=>a.At(v.id,14+v.slot,v.plane));})()`);
  rows.forEach((v, i) => assert.equal(loaded[i], v.coefficient, `Row ${v.plane}:${v.id} slot ${v.slot} did not load the edited coefficient`));
  const effects = await evaluate(state, `(()=>{${prefix}return ${JSON.stringify(rows.filter(v => v.character))}.map(v=>{const f=()=>call('装备属性计算',v.character,v.attributeId,0,0,0,0,0,0,0);const now=f(),total=call('属性计算',v.character,v.attributeId);a.Set(v.id,14+v.slot,9,v.original);const was=f();a.Set(v.id,14+v.slot,9,v.coefficient);return {id:v.id,now,was,total,expected:v.delta,restored:a.At(v.id,14+v.slot,9)};})})()`);
  for (const e of effects) {
    assert.ok(Number.isFinite(e.now) && Number.isFinite(e.total), 'Native equipment effect is not finite');
    assert.ok(Math.abs(e.now - e.was - e.expected) < 1e-6, `装备属性计算 moved by ${e.now - e.was}, editor predicted ${e.expected}`);
    assert.equal(e.restored, rows.find(v => v.id === e.id && v.plane === 9).coefficient);
  }
  const cycles = [];
  for (const v of rows.filter(v => v.character)) {
    const before = await evaluate(state, `(()=>{${prefix}if(a.At(${v.character},${15 + v.part},2)!==${v.id})throw Error('Expected worn over-limit item');const b=record(${v.id},9);call('卸下装备',${v.part},${v.id},${v.character},false,false,7);return b;})()`);
    await pause(500);
    const bag = await evaluate(state, `(()=>{${prefix}if(a.At(${v.character},${15 + v.part},2)!==0)throw Error('Unequip failed');for(let id=1;id<a.GetWidth();id++)if(a.At(id,0,7)===${before[0]}&&a.At(id,1,7)===${before[1]}&&a.At(id,${14 + v.slot},7)===${v.coefficient})return {id,record:record(id,7)};throw Error('Unequipped record missing');})()`);
    await evaluate(state, `(()=>{${prefix}call('穿戴装备',${v.part},${bag.id},${v.character},false,false,7);return true;})()`);
    await pause(500);
    const worn = await evaluate(state, `(()=>{${prefix}const id=a.At(${v.character},${15 + v.part},2);return {id,record:record(id,9)};})()`);
    for (let y = 0; y < 50; y++) if (y !== 7) { assert.equal(bag.record[y], before[y], 'Unequip field ' + y); assert.equal(worn.record[y], before[y], 'Equip cycle field ' + y); }
    assert.equal(worn.record[7], v.character);
    for (let y = 0; y < 50; y++) state.cells.push([worn.id, y, 9]);
    state.cells.push([v.character, 15 + v.part, 2]);
    cycles.push({before, bag, worn});
  }
  for (const v of rows.filter(v => !v.character)) state.cells.push([v.id, 14 + v.slot, v.plane]);
  let washed = null;
  if (rewash) {
    const {id, plane, slot, quality} = rewash;
    washed = await evaluate(state, `(()=>{${prefix}const before=record(${id},${plane}),souls=a.At(3,2,0),count=call('装备已洗词条数',${id},${plane},0),cost=call('词条洗练魂魄',before[3],count);call('词条洗练',${id},${slot},${plane});const after=record(${id},${plane});return {before,after,count,countAfter:call('装备已洗词条数',${id},${plane},0),cost,spent:souls-a.At(3,2,0)};})()`);
    const c = washed.after[14 + slot];
    assert.ok(washed.before[14 + slot] > 60 + 10 * quality, 'Rewash row was not over the native range');
    assert.ok(c >= 10 * (quality - 1) && c <= 60 + 10 * quality && Math.abs(c * 100 - Math.round(c * 100)) < 1e-6, 'Rewash did not roll an in-range coefficient: ' + c);
    assert.ok(washed.after[8 + slot] > 0, 'Rewash cleared the affix');
    assert.deepEqual([washed.after[27 + slot], washed.count, washed.countAfter, washed.spent], [1, 1, 1, washed.cost], 'Rewash flag, washed count or cost');
    for (let y = 0; y < 50; y++) if (y !== 8 + slot && y !== 14 + slot) assert.equal(washed.after[y], washed.before[y], 'Rewash changed field ' + y);
    for (let y = 0; y < 50; y++) state.cells.push([id, y, plane]);
  }
  return {loaded, effects, cycles, washed};
}

// Edited sixth affix slots after a restart (equipmentSixthAffix). Every row loads y14／y20 with y33 still 0, so 装备已洗词条数
// keeps counting only the selected slot. For a worn row, 装备属性计算 (Repeat 6) moves by the editor's predicted delta when y14 is
// cleared in place and restored; 卸下装备→穿戴装备 keeps all 50 fields. A native 词条洗练 of the selected slot (the wash page
// lists five slots, so slot 6 is never offered) rerolls only that slot, charges 词条洗练魂魄 and leaves the sixth slot alone.
async function sixthAffix(state, s) {
  const {rows} = s.sixthAffix;
  const loaded = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);return ${JSON.stringify(rows)}.map(v=>({cells:[14,20,33].map(y=>a.At(v.id,y,v.plane)),count:call('装备已洗词条数',v.id,v.plane,0)}));})()`);
  rows.forEach((v, i) => {
    assert.deepEqual(loaded[i].cells, [v.attributeId, v.coefficient, 0], `Row ${v.plane}:${v.id} did not load the edited sixth slot`);
    assert.equal(loaded[i].count, 1, `Row ${v.plane}:${v.id} washed count is not 1`);
  });
  const effects = await evaluate(state, `(()=>{${prefix}return ${JSON.stringify(rows.filter(v => v.character))}.map(v=>{const f=()=>call('装备属性计算',v.character,v.attributeId,0,0,0,0,0,0,0);const now=f(),total=call('属性计算',v.character,v.attributeId);a.Set(v.id,14,9,0);const was=f();a.Set(v.id,14,9,v.attributeId);return {id:v.id,now,was,total,expected:v.delta,restored:a.At(v.id,14,9)};})})()`);
  for (const e of effects) {
    assert.ok(Number.isFinite(e.now) && Number.isFinite(e.total), 'Native equipment effect is not finite');
    assert.ok(Math.abs(e.now - e.was - e.expected) < 1e-6, `装备属性计算 moved by ${e.now - e.was}, editor predicted ${e.expected}`);
    assert.equal(e.restored, rows.find(v => v.id === e.id && v.plane === 9).attributeId);
  }
  const targets = rows.map(v => ({...v}));
  const cycles = [];
  for (const v of targets.filter(v => v.character)) {
    const before = await evaluate(state, `(()=>{${prefix}if(a.At(${v.character},${15 + v.part},2)!==${v.id})throw Error('Expected worn sixth-slot item');const b=record(${v.id},9);call('卸下装备',${v.part},${v.id},${v.character},false,false,7);return b;})()`);
    await pause(500);
    const bag = await evaluate(state, `(()=>{${prefix}if(a.At(${v.character},${15 + v.part},2)!==0)throw Error('Unequip failed');for(let id=1;id<a.GetWidth();id++)if(a.At(id,0,7)===${before[0]}&&a.At(id,1,7)===${before[1]}&&a.At(id,14,7)===${v.attributeId}&&a.At(id,20,7)===${v.coefficient})return {id,record:record(id,7)};throw Error('Unequipped record missing');})()`);
    await evaluate(state, `(()=>{${prefix}call('穿戴装备',${v.part},${bag.id},${v.character},false,false,7);return true;})()`);
    await pause(500);
    const worn = await evaluate(state, `(()=>{${prefix}const id=a.At(${v.character},${15 + v.part},2);return {id,record:record(id,9)};})()`);
    for (let y = 0; y < 50; y++) if (y !== 7) { assert.equal(bag.record[y], before[y], 'Unequip field ' + y); assert.equal(worn.record[y], before[y], 'Equip cycle field ' + y); }
    assert.equal(worn.record[7], v.character);
    state.cells.push([v.character, 15 + v.part, 2]);
    v.id = worn.id;
    cycles.push({before, bag, worn});
  }
  const washed = [];
  for (const v of targets) {
    const w = await evaluate(state, `(()=>{${prefix}const before=record(${v.id},${v.plane}),souls=a.At(3,2,0),count=call('装备已洗词条数',${v.id},${v.plane},0),cost=call('词条洗练魂魄',before[3],count);call('词条洗练',${v.id},${v.selected},${v.plane});const after=record(${v.id},${v.plane});return {before,after,count,countAfter:call('装备已洗词条数',${v.id},${v.plane},0),cost,spent:souls-a.At(3,2,0)};})()`);
    const c = w.after[14 + v.selected];
    assert.ok(c >= 50 && c <= 120 && Math.abs(c * 100 - Math.round(c * 100)) < 1e-6, 'Wash did not roll a Q6 coefficient: ' + c);
    assert.ok(w.after[8 + v.selected] > 0, 'Wash cleared the affix');
    assert.deepEqual([w.after[14], w.after[20], w.after[33]], [v.attributeId, v.coefficient, 0], 'Wash touched the sixth slot');
    assert.deepEqual([w.after[27 + v.selected], w.count, w.countAfter, w.spent], [1, 1, 1, w.cost], 'Wash flag, washed count or cost');
    for (let y = 0; y < 50; y++) if (y !== 8 + v.selected && y !== 14 + v.selected) assert.equal(w.after[y], w.before[y], 'Wash changed field ' + y);
    for (let y = 0; y < 50; y++) state.cells.push([v.id, y, v.plane]);
    washed.push({id: v.id, plane: v.plane, ...w});
  }
  return {loaded, effects, cycles, washed};
}

// Edited building levels after a restart: the facility and research caps follow the new level, 建筑升阶 starts the next tier
// from it (work 建造工程量(t, L+1), materials deducted) and 取消升阶 returns both, and at the tech cap it refuses. The walls
// rise at once, so their edited level is checked at the cap (refused, nothing spent) and through the wider enhancement cap.
async function buildingLevel(state, s) {
  const {building, template, level, technology, wall} = s.buildingLevel;
  const row = `const row=x=>({level:a.At(x,5,1),work:a.At(x,4,1),upgrading:a.At(x,10,1)}),stock=[1,2].map(i=>a.At(call('建造材料编号',${template},${level + 1},i),6,0));`;
  const out = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);${row}
    const out={before:row(${building}),facilities:call('建筑设施上限',${building}),research:call('科技等级上限',${technology},a.At(${building},5,1)),work:call('建造工程量',${template},${level + 1}),cost:[1,2].map(i=>call('建造材料数量',${template},${level + 1},i)),stock};
    call('建筑升阶',${building});out.started=row(${building});out.spent=[1,2].map(i=>a.At(call('建造材料编号',${template},${level + 1},i),6,0));
    call('取消升阶',${building});out.cancelled=row(${building});out.refunded=[1,2].map(i=>a.At(call('建造材料编号',${template},${level + 1},i),6,0));
    const wallStock=[1,2].map(i=>a.At(call('建造材料编号',21,${wall + 1},i),6,0)),enhancement=a.At(19,1,0);out.wall={before:row(0),cap:call('城墙强化上限'),enhancement};
    call('建筑升阶',0);out.wall.refused=row(0);out.wall.stock=[1,2].map(i=>a.At(call('建造材料编号',21,${wall + 1},i),6,0)).map((v,i)=>v-wallStock[i]);
    call('城墙升级');out.wall.enhanced=a.At(19,1,0);return out;})()`);
  assert.deepEqual(out.before, {level, work: 0, upgrading: 0}, 'Edited building level not loaded');
  assert.equal(out.facilities, level + 2, '建筑设施上限 does not follow the edited level');
  assert.equal(out.research, Math.min((level + 1) * 60 - 1, 299), '科技等级上限 does not follow the edited level');
  assert.deepEqual(out.started, {level, work: out.work, upgrading: 1}, '建筑升阶 did not start the next tier from the edited level');
  assert.deepEqual(out.spent, out.stock.map((v, i) => v - out.cost[i]), '建筑升阶 did not take the next tier materials');
  assert.deepEqual([out.cancelled, out.refunded], [{level, work: 0, upgrading: 0}, out.stock], '取消升阶 did not restore the edited level and materials');
  assert.deepEqual(out.wall.before, {level: wall, work: 0, upgrading: 0}, 'Edited wall level not loaded');
  assert.equal(out.wall.cap, (wall + 1) * 60, '城墙强化上限 does not follow the edited wall level');
  assert.deepEqual([out.wall.refused, out.wall.stock], [out.wall.before, [0, 0]], 'Walls rose past the tech cap');
  assert.equal(out.wall.enhanced, out.wall.enhancement + 1, '城墙升级 refused under the wider cap');
  for (const c of [[building, 4, 1], [building, 5, 1], [building, 10, 1], [0, 5, 1], [19, 1, 0], [1, 2, 0]]) state.cells.push(c);
  return out;
}

async function main() {
  const statePath = opt('--state'), state = JSON.parse(fs.readFileSync(statePath)), scenario = JSON.parse(fs.readFileSync(opt('--scenario')));
  const rel = path.relative(path.resolve(__dirname, '..'), state.dir), child = path.relative(state.dir, state.game);
  if (!rel || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep)) || !child || path.isAbsolute(child) || child.startsWith('..')) throw Error('External disposable state required');
  if (!scenario.ascend && !scenario.followup && !scenario.pills && !scenario.pillOverLimit && !scenario.backpackOverLimit && !scenario.armory && !scenario.relics && !scenario.relicTakeOff && !scenario.relicStandPrepare && !scenario.placedRelicAura && !scenario.wall && !scenario.city && !scenario.ascensionQuality && !scenario.innerPillPrepare && !scenario.innerPillLevel && !scenario.ascendedInnerPillLevel && !scenario.basicTechnology && !scenario.buildingLevel && !scenario.relicCrafting && !scenario.recruitTechnology && !scenario.affixPrepare && !scenario.affixOverLimit && !scenario.sixthAffix) throw Error('Scenario has no native follow-up actions');
  await waitMain(state);
  const result = {};
  if (scenario.ascend && !scenario.pills) result.ascend = await ascend(state, scenario);
  if (scenario.followup) result.followup = await followup(state, scenario);
  if (scenario.pills) result.pills = await pillsAndRebirth(state, scenario);
  if (scenario.pillOverLimit) result.pillOverLimit = await pillOverLimit(state, scenario);
  if (scenario.backpackOverLimit) result.backpackOverLimit = await backpackOverLimit(state, scenario);
  if (scenario.armory) result.armory = await armory(state, scenario);
  if (scenario.relics) result.relics = await relicPlacement(state, scenario);
  if (scenario.relicStandPrepare) result.relicStandPrepare = await relicStandPrepare(state, scenario);
  if (scenario.placedRelicAura) result.placedRelicAura = await placedRelicAura(state, scenario);
  if (scenario.relicTakeOff) result.relicTakeOff = await relicTakeOff(state);
  if (scenario.wall) result.wall = await wallUpgrade(state, scenario);
  if (scenario.city) result.city = await cityLayer(state, scenario);
  if (scenario.ascensionQuality) result.ascensionQuality = await ascensionQuality(state, scenario);
  if (scenario.innerPillPrepare) result.innerPillPrepare = await innerPillPrepare(state, scenario);
  if (scenario.innerPillLevel) result.innerPillLevel = await innerPillLevel(state, scenario);
  if (scenario.ascendedInnerPillLevel) result.ascendedInnerPillLevel = await ascendedInnerPillLevel(state, scenario);
  if (scenario.basicTechnology) result.basicTechnology = await basicTechnology(state, scenario);
  if (scenario.recruitTechnology) result.recruitTechnology = await recruitTechnology(state, scenario);
  if (scenario.affixPrepare) result.affixPrepare = await affixPrepare(state, scenario);
  if (scenario.affixOverLimit) result.affixOverLimit = await affixOverLimit(state, scenario);
  if (scenario.sixthAffix) result.sixthAffix = await sixthAffix(state, scenario);
  if (scenario.buildingLevel) result.buildingLevel = await buildingLevel(state, scenario);
  if (scenario.relicCrafting) result.relicCrafting = await relicCrafting(state, scenario);
  state.expected = await evaluate(state, `(()=>{${prefix}return ${JSON.stringify(state.cells)}.map(([x,y,z])=>a.At(x,y,z));})()`);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  fs.writeFileSync(path.join(state.dir, 'native-lifecycle.json'), JSON.stringify(result, null, 2));
  console.log('PASS: native ' + Object.keys(result).join(' and ') + ' follow-up actions');
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = {ascend, followup, pillsAndRebirth, pillOverLimit, backpackOverLimit, armory, relicPlacement, relicTakeOff, relicStandPrepare, placedRelicAura, wallUpgrade, cityLayer, ascensionQuality, innerPillPrepare, innerPillLevel, ascendedInnerPillLevel, basicTechnology, buildingLevel, recruitTechnology, affixPrepare, affixOverLimit, sixthAffix, relicCrafting};
