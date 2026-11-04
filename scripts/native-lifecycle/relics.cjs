'use strict';
const assert = require('node:assert/strict');

// Action bodies and page-expression template text are preserved from the original entry.
module.exports = function createRelicActions({evaluate, prefix, pause}) {
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
    // V1.0.18.0 refinement requests the native maximum branch instead of rolling a coefficient range.
    assert.equal(p[8], 80 + 30 * q, 'Refined main coefficient must be the quality maximum');
    assert.ok(after.rel.every(v => v === 0), 'Refine left the relic row');
    assert.deepEqual([before.count - after.count, before.copper - after.copper, ...after.globals], [before.need, before.cost, 0, 0], 'Refine materials, cost or selection');
    for (let y = 0; y < 50; y++) state.cells.push([after.rows[0], y, 7], [relic, y, 18]);
    out.refine = {relic: before.rel, quality: q, materialQuality: before.quality, tier: before.tier, cost: before.cost, need: before.need, row: after.rows[0], pill: p};
  }
  return out;
}

return {relicPlacement, relicTakeOff, relicStandPrepare, placedRelicAura, relicCrafting};
};
