'use strict';
const assert = require('node:assert/strict');

// Action bodies and page-expression template text are preserved from the original entry.
module.exports = function createEquipmentActions({evaluate, prefix, pause}) {
// Over-limit backpack rows: one is stored into z9, a native level-up below the cap still works (control), both native
// upgrades leave the over-limit level, money and souls untouched, and it comes back out; the other is worn straight from
// the backpack with finite equipment effects and unequipped. Moved rows must keep every field except the owner.
async function backpackOverLimit(state, s) {
  const {stored, worn} = s.backpackOverLimit, find = `const find=(z,v)=>{for(let x=1;x<a.GetWidth();x++){let ok=true;for(let y=0;y<50;y++)if(y!==7&&a.At(x,y,z)!==v[y]){ok=false;break;}if(ok)return x;}throw Error('Moved record missing in z'+z);};`;
  const store = await evaluate(state, `(()=>{${prefix}${find}r.SetTimeScale(0);const before=record(${stored.id},7);call('装备库存入',${stored.id},true,0,7,0);const id=find(9,before);return {before,id,moved:record(id,9),source:record(${stored.id},7)};})()`);
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
  const takeout = await evaluate(state, `(()=>{${prefix}${find}const before=record(${store.id},9);call('装备库取出',${store.id},true,0,7,0);const id=find(7,before);return {id,record:record(id,7)};})()`);
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

// Armory rows edited by the modifier (armoryEquipment): 仓库取出 to the backpack and 仓库存入 back keep all 50 fields; with
// 武库换装 mode one row is worn straight from z22 (effects finite, ≥ the native 装备主属性 at the edited level and quality)
// and unequipped back into z22 unchanged. Every row ends in z22 so the restart reads the edited armory back.
async function armoryEdited(state, s) {
  const {rows, worn} = s.armoryEdited, find = `const find=(z,v)=>{for(let x=1;x<a.GetWidth();x++){let ok=true;for(let y=0;y<50;y++)if(y!==7&&a.At(x,y,z)!==v[y]){ok=false;break;}if(ok)return x;}throw Error('Moved record missing in z'+z);};`;
  const move = (fn, id, from, to) => evaluate(state, `(()=>{${prefix}${find}r.SetTimeScale(0);const before=record(${id},${from});call('${fn}',${id},true,0);const x=find(${to},before);return {before,id:x,moved:record(x,${to}),source:record(${id},${from})};})()`);
  const moves = [], ids = {};
  for (const id of rows) {
    const takeout = await move('仓库取出', id, 22, 7), restore = await move('仓库存入', takeout.id, 7, 22);
    for (const [name, m] of [['takeout', takeout], ['restore', restore]]) {
      assert.deepEqual(m.moved, takeout.before, name + ' changed edited armory row ' + id);
      assert.ok(m.source.every(v => v === 0), name + ' did not clear the source row of ' + id);
    }
    moves.push({id, takeout, restore});ids[id] = restore.id;
  }
  const put = await evaluate(state, `(()=>{${prefix}const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),before=record(${ids[worn.id]},22),slot=wp.At(before[1],6,0),mode=a.At(37,1,0);
    a.Set(37,1,0,1);call('穿戴装备',slot,${ids[worn.id]},${worn.character},false,false,22);return {slot,before,mode};})()`);
  await pause(500);
  const wear = await evaluate(state, `(()=>{${prefix}const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),id=a.At(${worn.character},15+${put.slot},2),v=record(id,9);
    const effects=[];for(let s=0;s<3;s++){const attr=wp.At(v[1],8+s,0);if(attr>0)effects.push({attr,actual:call('装备属性计算',${worn.character},attr,0,0,0,0,0,0,0),main:call('装备主属性',v[6],v[3],attr,v[8],wp.At(v[1],11+s,0),'主属性',0,v[5])});}
    return {id,record:v,effects,source:record(${ids[worn.id]},22)};})()`);
  for (let y = 0; y < 50; y++) if (y !== 7) assert.equal(wear.record[y], put.before[y], 'Wearing from z22 changed field ' + y);
  assert.equal(wear.record[7], worn.character);
  assert.ok(wear.source.every(v => v === 0), 'Wearing did not clear the z22 row');
  assert.ok(wear.effects.length > 0, 'Worn armory row has no main attribute');
  for (const e of wear.effects) assert.ok(Number.isFinite(e.actual) && Number.isFinite(e.main) && e.actual >= e.main, 'Non-finite or missing equipment effect ' + e.attr);
  await evaluate(state, `(()=>{${prefix}call('卸下装备',${put.slot},${wear.id},${worn.character},false,false,22);return true;})()`);
  await pause(500);
  const back = await evaluate(state, `(()=>{${prefix}${find}const id=find(22,${JSON.stringify(put.before)});a.Set(37,1,0,${put.mode});return {id,record:record(id,22),pointer:a.At(${worn.character},${15 + put.slot},2)};})()`);
  assert.deepEqual(back.record, put.before, 'Unequipping into z22 changed the edited row');
  assert.notEqual(back.pointer, wear.id, 'Character still points at the unequipped row');
  ids[worn.id] = back.id;
  for (const id of Object.values(ids)) for (let y = 0; y < 50; y++) state.cells.push([id, y, 22]);
  state.cells.push([worn.character, 15 + put.slot, 2], [37, 1, 0]);
  return {moves, put, wear, back, ids};
}

// Backup gear set after #30 备用装备 is unlocked: 科技解锁判断(30) gates only the two 换装 buttons that 刷新底部菜单 creates for the
// 角色 page; 角色换装 itself reads no tech. One native swap moves the worn z9 rows (z2 y16–21) into z23 y1–6, brings the
// stored ones back and sets the z23 y0 set number; its own 刷新底部菜单 call then shows both buttons. The character may
// start with nothing worn (all gear stored). Optional item {id, level, from}: a stored row the modifier edited
// (backupSetEquipment) comes back worn with the edited level, and after 刷新单角色全属性 装备属性计算 reaches its 装备主属性,
// which differs from the one at the original level. item may be a list; an inner pill (backupSetInnerPillLevel) that comes
// back in slot 5 also gets the worn 内丹破镜值 of the edited level. Optional aptitudes [{aptitude, total}]: 角色资质计算
// equals the editor's predicted total both before and after the swap (backupSetAptitude), so neither set moves A.
async function outfitSwap(state, s) {
  const {character, set, item, aptitudes = []} = s.outfitSwap, items = item ? [].concat(item) : [];
  const read = `const read=()=>({set:a.At(${character},0,23),stored:[1,2,3,4,5,6].map(y=>a.At(${character},y,23)),worn:[16,17,18,19,20,21].map(y=>a.At(${character},y,2)),aptitudes:[1,2,3].map(t=>call('角色资质计算',${character},t))});`;
  const out = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);${read}const before=read(),unlock=call('科技解锁判断',30);call('角色换装',${character},${set},0,0,0,0,0,0);return {before,unlock,after:read()};})()`);
  await pause(500);
  out.buttons = await evaluate(state, `(()=>{${prefix}return r.GetObjectClassByName('换装按钮').GetInstances().map(i=>i.GetInstanceVariableValue(7)).sort();})()`);
  const {before, unlock, after, buttons} = out;
  assert.equal(unlock, 1, '科技解锁判断(30) does not see the unlock');
  assert.ok(before.set !== set && (before.worn.some(Boolean) || before.stored.some(Boolean)), 'Character already on that set or holds no gear');
  assert.deepEqual([after.set, after.worn, after.stored], [set, before.stored, before.worn], '角色换装 did not swap the gear sets');
  assert.deepEqual(buttons, [0, 1], '刷新底部菜单 did not show both 换装 buttons');
  out.items = [];
  for (const item of items) {
    const got = await evaluate(state, `(()=>{${prefix}const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),v=record(${item.id},9),effects=[];
      for(let s=0;s<3;s++){const attr=wp.At(v[1],8+s,0);if(attr>0)effects.push({attr,actual:call('装备属性计算',${character},attr,0,0,0,0,0,0,0),main:call('装备主属性',v[6],v[3],attr,v[8],wp.At(v[1],11+s,0),'主属性',0,v[5]),original:call('装备主属性',${item.from},v[3],attr,v[8],wp.At(v[1],11+s,0),'主属性',0,v[5])});}
      return {id:${item.id},record:v,effects,pill:a.At(${character},20,2)===${item.id}?call('内丹破镜值',v[5],v[6],v[3]):null};})()`);
    const {record, effects, pill} = got;
    assert.ok(after.worn.includes(item.id), 'Edited row is not worn after the swap');
    assert.deepEqual([record[6], record[7]], [item.level, character], 'Edited row lost its level or owner');
    assert.ok(effects.length > 0, 'Edited row has no main attribute');
    for (const e of effects) assert.ok(Number.isFinite(e.actual) && Number.isFinite(e.main) && e.actual >= e.main && e.main !== e.original, 'Effect does not follow the edited level ' + e.attr);
    if (pill !== null) assert.equal(pill, Math.round(200 * record[5] ** 2 * (0.15 * record[3] ** 2 + 0.3) * (1 + 0.025 * record[6])) / 100, '内丹破镜值 of the swapped-back pill');
    out.items.push(got);
  }
  if (items.length === 1) out.item = out.items[0];
  for (const {aptitude, total} of aptitudes) assert.deepEqual([before.aptitudes[aptitude - 1], after.aptitudes[aptitude - 1]], [total, total], `角色资质计算 ${aptitude} before/after the swap`);
  for (let y = 0; y <= 6; y++) state.cells.push([character, y, 23]);
  for (let y = 16; y <= 21; y++) state.cells.push([character, y, 2]);
  return out;
}

return {backpackOverLimit, armory, armoryEdited, outfitSwap};
};
