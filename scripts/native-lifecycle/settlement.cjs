'use strict';
const assert = require('node:assert/strict');

// Action bodies and page-expression template text are preserved from the original entry.
module.exports = function createSettlementActions({evaluate, prefix, pause, selectFacility}) {
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

return {wallUpgrade, cityLayer, basicTechnology, recruitTechnology, buildingLevel};
};
