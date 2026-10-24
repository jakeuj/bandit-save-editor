'use strict';
// City rows for cityLayerLevel. zddt.json (the map table; row x is the save z0 row of that map) is outside the 15 tracked
// sources, so its own hash travels with the rows and a missing file yields null for the extractor to keep the old block.
// 城市层数上限 is never assigned at runtime; 开始城市波次 needs layer+1 below it, so a city tops out at cap-1 (149).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function layerCap(game) {
  let cap = null, sid = null;
  const visit = (v, fn) => { if (!Array.isArray(v)) return; fn(v); for (const c of v) visit(c, fn); };
  visit(game.project[6], v => { if (v[0] === 1 && v[1] === '城市层数上限' && typeof v[6] === 'number') { cap = v[3]; sid = v[6]; } });
  if (!Number.isSafeInteger(cap) || cap < 2) throw Error('找不到城市層數上限');
  // Any Set/Add/Sub on the variable would make the cap dynamic.
  visit(game.project[6], v => { if (Array.isArray(v) && v[0] === -1 && /Acts\.(Set|Add|Subtract)Var$/.test(game.refs[v[1]] || '') && Array.isArray(v.at(-1)) && v.at(-1).some(p => Array.isArray(p) && p[0] === 11 && p[1] === sid)) throw Error('城市層數上限在執行時被修改，請重新核對'); });
  return cap;
}

function extract(game, glossary = {}) {
  const file = path.join(game.root, 'zddt.json');
  if (!fs.existsSync(file)) return null;
  const bytes = fs.readFileSync(file), rows = JSON.parse(bytes).data.map(r => r.map(c => c[0]));
  const cities = rows.map((r, x) => ({x, name: r[1], type: r[2]})).filter(r => r.type === '城市').map(({x, name}) => ({x, name: glossary[name] || name}));
  if (!cities.length || cities.some(c => !Number.isSafeInteger(c.x) || c.x < 1 || typeof c.name !== 'string')) throw Error('城市資料表格式不符');
  const cap = layerCap(game);
  return {source: {file: 'zddt.json', sha256: crypto.createHash('sha256').update(bytes).digest('hex')}, layerCap: cap, maxLayer: cap - 1, cities};
}

module.exports = {extract, layerCap};
