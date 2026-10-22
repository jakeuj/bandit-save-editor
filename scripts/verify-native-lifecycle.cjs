#!/usr/bin/env node
'use strict';
// Native follow-up actions after editing, for disposable states created by verify-game. The follow-up copy covers
// equip cycle, profession transfer and research/training start-stop; the batch-two copy covers pills and rebirth.
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

async function pillsAndRebirth(state, s) {
  const pills = await evaluate(state, `(()=>{${prefix}return ${JSON.stringify(s.pills)}.map(({aptitude,pillId})=>{const count=a.At(pillId,6,0),bonus=a.At(1,12+aptitude,2);call('服用普通丹药',pillId,1,1);return {aptitude,pillId,count:[count,a.At(pillId,6,0)],bonus:[bonus,a.At(1,12+aptitude,2)]};});})()`);
  for (const p of pills) {
    assert.ok(p.bonus[1] >= p.bonus[0], 'Pill lowered the aptitude bonus');
    // The conservative editor maximum may already sit at the native cap; other aptitudes must consume one pill.
    if (p.aptitude !== 1) { assert.equal(p.count[1], p.count[0] - 1, 'Pill not consumed'); assert.ok(p.bonus[1] > p.bonus[0], 'Pill bonus unchanged'); }
    else assert.ok(p.count[1] === p.count[0] - 1 || p.count[1] === p.count[0]);
  }
  await evaluate(state, `(()=>{${prefix}call('角色重生',1,0,0);return true;})()`);
  await pause(500);
  const rebirth = await evaluate(state, `(()=>{${prefix}return [13,14,15].map(y=>a.At(1,y,2));})()`);
  assert.deepEqual(rebirth, [0, 0, 0], 'Rebirth did not clear pill bonuses');
  for (const p of pills) state.cells.push([p.pillId, 6, 0]);
  for (const y of [3, 4, 13, 14, 15, 50, 56]) state.cells.push([1, y, 2]);
  return {pills, rebirth};
}

async function main() {
  const statePath = opt('--state'), state = JSON.parse(fs.readFileSync(statePath)), scenario = JSON.parse(fs.readFileSync(opt('--scenario')));
  const rel = path.relative(path.resolve(__dirname, '..'), state.dir), child = path.relative(state.dir, state.game);
  if (!rel || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep)) || !child || path.isAbsolute(child) || child.startsWith('..')) throw Error('External disposable state required');
  if (!scenario.followup && !scenario.pills) throw Error('Scenario has no native follow-up actions');
  await waitMain(state);
  const result = {};
  if (scenario.followup) result.followup = await followup(state, scenario);
  if (scenario.pills) result.pills = await pillsAndRebirth(state, scenario);
  state.expected = await evaluate(state, `(()=>{${prefix}return ${JSON.stringify(state.cells)}.map(([x,y,z])=>a.At(x,y,z));})()`);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  fs.writeFileSync(path.join(state.dir, 'native-lifecycle.json'), JSON.stringify(result, null, 2));
  console.log('PASS: native ' + Object.keys(result).join(' and ') + ' follow-up actions');
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = {followup, pillsAndRebirth};
