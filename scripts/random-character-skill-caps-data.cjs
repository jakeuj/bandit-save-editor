'use strict';
const fs = require('node:fs');
const path = require('node:path');
// Reviewed static rules only. A matching digest is not a native verification result.
const sourceSids = [390673545485827,907064845535449,890068128550912,360229107749216,858555530911324,884525457994003,940056460112238,180031394399295,748584357810010,176292127127652];
const reviewedDigest = '752f9932ac9f233524c7af09a8e91e3c88f09a555090bdcb2692f43e72c42cc3';
// V1.0.10.2 and V1.0.11.2: the reviewed skill rules agree after resolving bound-reference renumbering.
const reviewedDigests = new Set(['1754eb477c345e31ef8251bc2f405b6299e0b780355bff57fbc526fa312e52d0', reviewedDigest]);
function reviewedRules(digest, growth, rows) {
  if (!reviewedDigests.has(digest)) throw Error('技藝上限來源事件／SID已改變，需重新核對');
  const talents = {};
  rows.forEach((row, index) => {
    const [id] = row;
    if (id === 0) return;
    if (!Number.isSafeInteger(id) || id !== index || typeof row[4] !== 'string' || typeof row[6] !== 'string' || row.slice(13,22).length !== 9 || row.slice(13,22).some(v => ![0,1].includes(v))) throw Error('天賦選取資料尚未核對');
    talents[id] = {category:row[4], orientation:row[6], excludedPrimary:row.slice(13,22).flatMap((v,i) => v === 1 ? [i+1] : [])};
  });
  return {version:1, policy:'fixed-aptitudes-and-talents',
    ranges:Array.from({length:6}, (_,i) => { const q=i+1; return {base:[1+3*q,11+3*q],primary:[8+10*q,28+10*q],secondary:[1+8*q,19+8*q]}; }),
    totals:growth.totals, weights:growth.weights, upperWeightExclusive:true,
    orientations:['力量','敏捷','智力','生产'], talentLevels:[[1,2],[1,2,3],[2,3,4],[3,4,5],[4,5],[5]],
    talents, sourceSids, sourceDigest:digest};
}
function extract(game, digestEvents) {
  const growth = require('./random-character-growth-data.cjs')(game);
  const digest = digestEvents(game,sourceSids);
  const rows = JSON.parse(fs.readFileSync(path.join(game.root,'tf.json'),'utf8')).data.map(row => row.map(c => c[0]));
  return reviewedRules(digest,growth,rows);
}
// A source or selection-rule change invalidates this group independently of v2.7.
const canPreserve = (old, next) => ['fingerprints','batch2Fingerprints','randomCharacterSkillCaps'].every(k => JSON.stringify(old[k]) === JSON.stringify(next[k]));
module.exports = {extract,reviewedRules,reviewedDigest,sourceSids,canPreserve};
