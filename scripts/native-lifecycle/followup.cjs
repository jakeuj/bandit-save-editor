'use strict';
const assert = require('node:assert/strict');

// Action bodies and page-expression template text are preserved from the original entry.
module.exports = function createFollowupActions({evaluate, prefix, pause, selectFacility}) {
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

return {followup};
};
