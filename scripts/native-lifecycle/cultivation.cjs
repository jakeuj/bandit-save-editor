'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');

// Action bodies and page-expression template text are preserved from the original entry.
module.exports = function createCultivationActions({evaluate, prefix, pause, scriptDir: __dirname}) {
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
  // slot 6 obtains and wears a treasure the same way (pointer y15+slot).
  for (const {template, quality, level, wear, slot = 5} of s.innerPillPrepare.pills) {
    const id = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);const wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance(),seen=new Set();for(let x=1;x<a.GetWidth();x++)if(a.At(x,1,7)>0)seen.add(x);
      call('获得物品',true,${template},${quality},${level},wp.At(${template},3,0),call('装备主属性系数',${quality},''),1,false,0,'特定装备',false,false);for(let x=1;x<a.GetWidth();x++)if(!seen.has(x)&&a.At(x,1,7)===${template})return x;throw Error('Obtained inner pill missing in z7');})()`);
    await pause(500);
    let row = {template, plane: 7, id, record: await evaluate(state, `(()=>{${prefix}return record(${id},7);})()`)};
    if (wear) {
      await evaluate(state, `(()=>{${prefix}call('穿戴装备',${slot},${id},${wear},false,false,7);return true;})()`);
      await pause(500);
      const worn = await evaluate(state, `(()=>{${prefix}const id=a.At(${wear},${15 + slot},2);return {id,record:record(id,9)};})()`);
      assert.equal(worn.record[1], template, 'Inner pill was not worn'); assert.equal(worn.record[7], wear, 'Worn inner pill owner');
      row = {template, plane: 9, id: worn.id, character: wear, record: worn.record};
    }
    assert.deepEqual([row.record[2], row.record[5], row.record[6]], [1, quality, level], 'Obtained inner pill');
    for (let y = 0; y < 50; y++) state.cells.push([row.id, y, row.plane]);
    if (wear) state.cells.push([wear, 15 + slot, 2]);
    rows.push(row);
  }
  return rows;
}

// Native 升级装备 from an edited level pays round(10·g^d−1) souls, g = catalog treasureLevel.cost.growth (1.04 since V1.0.14.0);
// d = (T−1)·30+4L for a treasure and (T·6/9−1)·30+4L for an inner pill (the Else branch).
async function soulUpgrade(state, s) {
  const growth = JSON.parse(fs.readFileSync(path.join(__dirname, '../knowledge/catalog.json'))).treasureLevel.cost.growth, out = [];
  for (const {id, character, type} of s.soulUpgrade) {
    const v = await evaluate(state, `(()=>{${prefix}r.SetTimeScale(0);const p=record(${id},9),souls=a.At(3,2,0),cost=call('升级装备魂魄',p[6],p[3],0,${JSON.stringify(type)});call('升级装备',${id},${character});return {id:${id},type:${JSON.stringify(type)},tier:p[3],before:p[6],after:a.At(${id},6,9),souls,cost,soulsAfter:a.At(3,2,0)};})()`);
    const d = type === '宝物' ? (v.tier - 1) * 30 + 4 * v.before : (v.tier * 6 / 9 - 1) * 30 + 4 * v.before;
    assert.equal(v.cost, Math.round(10 * growth ** d - 1), `${type} soul cost formula`);
    assert.deepEqual([v.after, v.soulsAfter], [v.before + 1, v.souls - v.cost], `${type} native upgrade from the edited level`);
    state.cells.push([id, 6, 9]);
    out.push(v);
  }
  state.cells.push([3, 2, 0]);
  return out;
}

// Native 天赋属性计算(角色,屬性,0,0) sums every slot holding the attribute; it must equal the editor's displayed talent
// effects, passed in as {attribute: value} from talentSlotEffects (V1.0.15.0 raised several tf coefficients).
async function talentEffects(state, s) {
  const out = [];
  for (const {character, expected} of s.talentEffects) {
    const v = await evaluate(state, `(()=>{${prefix}const tf=r.GetObjectClassByName('tf').GetInstances()[0].GetSdkInstance(),slots=[1,2,3].map(y=>({id:a.At(${character},y,12),level:a.At(${character},y+20,12)})),attributes=[...new Set(slots.flatMap(s=>[7,8,9].map(y=>tf.At(s.id,y,0))).filter(Boolean))];
      return {character:${character},slots,native:Object.fromEntries(attributes.map(id=>[id,call('天赋属性计算',${character},id,0,0)]))};})()`);
    assert.deepEqual(Object.keys(v.native).sort(), Object.keys(expected).sort(), `character ${character} talent attributes`);
    for (const [attributeId, value] of Object.entries(v.native)) assert.ok(Math.abs(value - expected[attributeId]) < 1e-9, `character ${character} talent attribute ${attributeId}: native ${value}, editor ${expected[attributeId]}`);
    out.push({...v, expected});
  }
  return out;
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

return {ascend, pillsAndRebirth, pillOverLimit, ascensionQuality, innerPillPrepare, soulUpgrade, talentEffects, innerPillLevel, ascendedInnerPillLevel};
};
