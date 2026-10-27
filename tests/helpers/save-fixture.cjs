'use strict';

// Independent renderer: expected bytes never come from SaveCore or its change map.
function renderSave(data, patches = []) {
  const replacements = new Map(patches.map(([x, y, z, value]) => [`${x},${y},${z}`, value]));
  const rows = data.map((row, x) => '[' + row.map((cell, y) => '[' + cell.map((value, z) =>
    ' ' + JSON.stringify(replacements.has(`${x},${y},${z}`) ? replacements.get(`${x},${y},${z}`) : value) + ' '
  ).join(',') + ']').join(',') + ']');
  return '\ufeff{ "unrelated":987654321098765432109876543210,"exponent":1e+03,\n"c2array":true,"size":[' +
    data.length + ',60,' + data[0][0].length + '],"data":[' + rows.join(',') + ']}\n';
}

function saveFixture({size = 221, characters = 0, exclusions = false, layers = 22} = {}) {
  const data = Array.from({length: size}, () => Array.from({length: 60}, () => Array(layers).fill(0)));
  data[0][0][1] = 'szmnqea';
  data[1][1][0] = '合成測試山寨';
  for (let id = 1; id <= characters; id++) {
    for (const [y, value] of [[0, id], [1, `合成角色${id}`], [3, 1], [10, 30], [11, 30], [12, 30], [49, 1]]) data[id][y][2] = value;
    data[id][1][4] = 1;
    for (let skill = 1; skill <= 9; skill++) {
      data[id][21 + skill][2] = 50;
      data[id][30 + skill][2] = 1;
    }
  }
  if (exclusions) {
    data[1][2][2] = 1;
    data[2][55][2] = 2;
  }
  return {data, raw: renderSave(data), expected: patches => renderSave(data, patches)};
}

function skillCapsFixture({size = 2501, characters = 2500, exclusions = true, nearCapId = characters} = {}) {
  const {data} = saveFixture({size, characters});
  for (let id = 1; id <= characters; id++) {
    [28, 20, 10, 10, 10, 10, 10, 10, 10].forEach((cap, i) => { data[id][22 + i][2] = cap; });
    for (let i = 0; i < 3; i++) { data[id][1 + i][12] = i + 1; data[id][21 + i][12] = 1; }
  }
  if (nearCapId) { data[nearCapId][31][2] = 27; data[nearCapId][40][2] = 0.5; }
  if (exclusions) {
    data[1][2][2] = 1;
    data[2][55][2] = 2;
    data[3][50][2] = 1;
    // Individually bounded values with no shared primary/secondary witness.
    for (let i = 0; i < 9; i++) data[4][22 + i][2] = 28;
  }
  return {data, raw: renderSave(data), expected: patches => renderSave(data, patches)};
}

// Q1 characters with an aptitude, a single- and a two-attribute talent at the bottom of the [1,2] level pool.
function talentLevelsFixture({size = 2501, characters = 2500} = {}) {
  const {data} = saveFixture({size, characters});
  for (let id = 1; id <= characters; id++) [[1, 1], [4, 1], [52, 1]].forEach(([talent, level], i) => { data[id][1 + i][12] = talent; data[id][21 + i][12] = level; });
  data[1][2][2] = 1;
  data[2][55][2] = 2;
  data[3][50][2] = 1;
  // Q6 has a single level, so nothing can be previewed.
  data[4][49][2] = 6; for (let i = 0; i < 3; i++) data[4][21 + i][12] = 5;
  return {data, raw: renderSave(data), expected: patches => renderSave(data, patches)};
}

module.exports = {renderSave, saveFixture, skillCapsFixture, talentLevelsFixture};
