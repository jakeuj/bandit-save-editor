'use strict';
const fs = require('node:fs');
const path = require('node:path');
// Reviewed static rules only. A matching digest is not a native verification result.
// Selection, recruitment copy, initial characters, template refill gate, effect functions and dismissal.
const sourceSids = [390673545485827,822838674776648,768713561163211,298590518650410,884525457994003,501010543923483,699833323210652,778369382997146,211049884056972,176292127127652];
// Reviewed on V1.0.11.2; V1.0.12.2 differs only by bound-reference numbering. Older builds were not re-reviewed whole.
const reviewedDigest = '7e99eb981e6ff90026f0741131f65639de718684ee7702ab8a74f39d6c14ce62';
const reviewedDigests = new Set(['f6710c95560744a06e8c7ada0511ef1a3b4c72336d034a4c5ef2f45c771e6e80', reviewedDigest]);
const talentLevels = [[1,2],[1,2,3],[2,3,4],[3,4,5],[4,5],[5]];
// 天赋属性 branches in source order; the first matching branch wins.
function formulaOf(attributeId, unit) {
  if (attributeId >= 1 && attributeId <= 3) return 'levelTenth';
  if ([12,51,34].includes(attributeId)) return 'coefficientPlusTwoLevels';
  if ([13,52,11].includes(attributeId)) return 'coefficientTimesLevel';
  if (attributeId === 10) return 'regeneration';
  if (unit === '倍率') return 'multiplier';
  if (attributeId >= 104 && attributeId <= 107) return 'levelTenth';
  return 'growth';
}
function reviewedRules(digest, tf, sx) {
  if (!reviewedDigests.has(digest)) throw Error('天賦來源事件／SID已改變，需重新核對');
  const attributes = {};
  tf.forEach((row, index) => {
    const [id] = row;
    if (id === 0) return;
    if (!Number.isSafeInteger(id) || id !== index || row.slice(7,10).some(a => !Number.isSafeInteger(a) || a < 0) || row.slice(10,13).some(c => typeof c !== 'number' || !Number.isFinite(c) || c < 0) || row.slice(7,10).some((a,i) => (a === 0) !== (row[10+i] === 0)) || row[7] === 0) throw Error('天賦效果資料尚未核對');
    for (const a of row.slice(7,10)) if (a) {
      const unit = sx[a]?.[4];
      if (sx[a]?.[0] !== a || typeof unit !== 'string') throw Error('天賦屬性型別尚未核對：' + a);
      attributes[a] = {unit, formula:formulaOf(a, unit)};
    }
  });
  return {version:1, policy:'level-only', talentLevels, attributes, sourceSids, sourceDigest:digest};
}
function extract(game, digestEvents) {
  const table = name => JSON.parse(fs.readFileSync(path.join(game.root, name + '.json'), 'utf8')).data.map(row => row.map(c => c[0]));
  return reviewedRules(digestEvents(game, sourceSids), table('tf'), table('sx'));
}
// Rules, talent effect data and sources bind this group independently of v2.7 and v2.8.
const canPreserve = (old, next) => ['fingerprints','batch2Fingerprints','randomCharacterTalents'].every(k => JSON.stringify(old[k]) === JSON.stringify(next[k])) && JSON.stringify(old.batch2Data?.talents) === JSON.stringify(next.batch2Data?.talents);
module.exports = {extract, reviewedRules, reviewedDigest, reviewedDigests, sourceSids, talentLevels, formulaOf, canPreserve};
