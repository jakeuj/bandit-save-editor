'use strict';

// Independent renderer: expected bytes never come from SaveCore or its change map.
function renderSave(data, patches = []) {
  const replacements = new Map(patches.map(([x, y, z, value]) => [`${x},${y},${z}`, value]));
  const rows = data.map((row, x) => '[' + row.map((cell, y) => '[' + cell.map((value, z) =>
    ' ' + JSON.stringify(replacements.has(`${x},${y},${z}`) ? replacements.get(`${x},${y},${z}`) : value) + ' '
  ).join(',') + ']').join(',') + ']');
  return '\ufeff{ "unrelated":987654321098765432109876543210,"exponent":1e+03,\n"c2array":true,"size":[' +
    data.length + ',60,22],"data":[' + rows.join(',') + ']}\n';
}

function saveFixture({size = 221, characters = 0, exclusions = false} = {}) {
  const data = Array.from({length: size}, () => Array.from({length: 60}, () => Array(22).fill(0)));
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

module.exports = {renderSave, saveFixture};
