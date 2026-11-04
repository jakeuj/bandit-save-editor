'use strict';
const assert = require('node:assert/strict');

// Action bodies and page-expression template text are preserved from the original entry.
module.exports = function createAffixActions({evaluate, prefix, pause}) {
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

return {affixPrepare, affixOverLimit, sixthAffix};
};
