'use strict';
// Extract only reviewed recruitment bounds; source payload and event trees stay outside the repo.
module.exports = function recruitmentRules(game) {
  const nodes = new Map();
  const walk = v => { if (!Array.isArray(v)) return; if ([0, 4].includes(v[0]) && Array.isArray(v[7])) nodes.set(v[4], v); for (const c of v) walk(c); };
  walk(game.project[6]);
  const randomBounds = sid => {
    const event = nodes.get(sid);
    if (!event) throw Error('缺少招募規則事件：' + sid);
    return event[7].filter(a => a[0] === -1 && game.refs[a[1]]?.endsWith('.SetVar')).map(a => {
      const p = a.at(-1)?.at(-1), body = game.expressions[p?.[1]?.[0]]?.toString();
      const m = body?.match(/f\d+\((\d+), (\d+)\)/);
      if (!m) throw Error('招募亂數公式已改變：' + sid);
      return m.slice(1).map(Number);
    });
  };
  const totalSids = [353435574752032, 879483110980295, 945993007174840, 450284555421069, 489035254017381, 953598826873759];
  const weightSids = [144692352947544, 226111227717877, 594381087796989, 407776400732220];
  const totals = totalSids.map(sid => randomBounds(sid)[0]), weights = weightSids.map(randomBounds);
  if (JSON.stringify(totals) !== '[[90,120],[120,150],[150,180],[180,210],[210,240],[240,300]]' || JSON.stringify(weights) !== '[[[70,90],[50,70],[50,70]],[[50,70],[70,90],[50,70]],[[50,70],[50,70],[70,90]],[[50,80],[50,80],[50,80]]]') throw Error('招募生成範圍已改變，需重新核對');
  const distribution = nodes.get(716009552600469)?.[7]?.map(a => game.expressions[a.at(-1)?.at(-1)?.[1]?.[0]]?.toString());
  if (distribution?.length !== 3 || distribution.some(s => !s?.includes('Math.round((v0.GetValue() * (v1.GetValue() / ((v2.GetValue() + v3.GetValue()) + v4.GetValue()))))'))) throw Error('資質分配公式已改變');
  return {version: 1, totals, weights, upperWeightExclusive: true, scale: 10, policy: 'same-quality-any-native-orientation', sourceSids: [...totalSids, ...weightSids, 716009552600469, 501010543923483, 876351181502276, 110565347746026, 358500068340403, 778369382997146]};
};
