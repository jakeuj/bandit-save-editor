#!/usr/bin/env node
'use strict';
// Representative scenarios that re-verify every write group on a new game build. verify-game --setup replays each one
// on a disposable copy of the base save; operations are validated here with the same editor core and baseline.
const fs = require('node:fs');
const path = require('node:path');
const {loadCore, editSave, defaultCells} = require('./verify-game.cjs');
const {qualityScenario} = require('./prepare-quality-cases.cjs');
const root = path.resolve(__dirname, '..');
const SOULS = 100000000;

function ordinaryTemplates(k) {
  return Object.entries(k.equipmentQuality.items).map(([id, t]) => ({id: Number(id), ...t, slot: k.catalogs.items.find(item => item.id === Number(id)).slot, affixIds: k.batch2Data.items[id].affixIds}));
}
function template(templates, {tier, poolType, maxSlot = 6}) {
  const found = templates.find(t => t.tier === tier && (!poolType || t.poolType === poolType) && t.slot <= maxSlot);
  if (!found) throw Error(`找不到等階 ${tier}${poolType ? '、' + poolType : ''} 的一般裝備範本`);
  return found;
}
const coefficientRange = quality => [10 * (quality - 1), 60 + 10 * quality];
// One ordinary equipment record; slot coefficients start inside the range so every edit is a real change.
function equipment(t, {quality, level = 1, owner = 0, selected = 0, marker = 0}) {
  const r = Array(60).fill(0), [low] = coefficientRange(quality);
  r[0] = 400; r[1] = t.id; r[2] = 1; r[3] = t.tier; r[5] = quality; r[6] = level; r[7] = owner; r[8] = 80 + 30 * (quality - 1) + 15; r[23] = 1; r[24] = marker;
  for (let slot = 1; slot < quality; slot++) { r[8 + slot] = t.affixIds[slot - 1]; r[14 + slot] = low + 30; }
  if (selected) r[27 + selected] = 1;
  return r;
}

// Builds one disposable copy: synthetic baseline first, then each operation validated and previewed on the edited save.
function copy(C, k, saveText, size, {name, family, oracleArgs = [], lifecycle = true, prepare, act}) {
  const baseline = [], observe = defaultCells.map(cell => [...cell]), items = [], operations = [], extra = {};
  for (let x = 1; x < size[0]; x++) { for (const z of [7, 9]) for (let y = 0; y < 60; y++) baseline.push([x, y, z, 0]); if (x < 50) for (let y = 16; y <= 21; y++) baseline.push([x, y, 2, 0]); }
  baseline.push([3, 2, 0, SOULS]);
  const put = (x, y, z, value, watch = true) => { baseline.push([x, y, z, value]); if (watch) observe.push([x, y, z]); };
  const place = (id, z, record) => record.forEach((value, y) => put(id, y, z, value));
  const equip = (id, slot) => { put(1, 15 + slot, 2, id); };
  const ctx = {k, put, place, equip, items, observe, extra};
  prepare?.(ctx);
  const model = editSave(C, saveText, {baseline});
  const apply = (method, options, item) => {
    if (item) {
      const plane = options.plane ?? 9, before = Array.from({length: 60}, (_, y) => C.get(model, {x: options.itemId, y, z: plane}));
      let preview = {effects: []};
      if (method === 'setEquipmentAffix') preview = C.previewEquipmentAffixReplacement(model, options);
      else if (method === 'setEquipmentAffixCoefficient') {
        const info = C.equipmentAffixReplacementInfo(model, {itemId: options.itemId, slot: options.slot, plane});
        preview = C.previewEquipmentAffixReplacement(model, {itemId: options.itemId, slot: options.slot, attributeId: info.attributeId, coefficient: options.coefficient, plane});
      }
      items.push({...item, id: options.itemId, options: {...options, plane}, before, preview});
    }
    C[method](model, options);
    operations.push({method, options});
  };
  act?.(model, {...ctx, apply});
  const scenario = {baseline, operations, observe, items, ...extra};
  if (C.serialize(editSave(C, saveText, scenario)) !== C.serialize(model)) throw Error('情境重播結果不同：' + name);
  return {name, family, oracleArgs, lifecycle, cases: operations.length, scenario};
}

function buildings(saveData, templateId) {
  const found = [];
  for (let x = 1; x < saveData.length; x++) if (saveData[x][0][1] === x && saveData[x][1][1] === templateId) found.push({x, level: saveData[x][5][1], work: saveData[x][4][1], upgrading: saveData[x][10][1]});
  return found;
}
// Training and research need a completed academy and drill ground. A placed level-0 building with no remaining work
// is raised to level 1 in the disposable copy, the same state the native completion event writes.
function requireBuilding(saveData, templateId, label, put) {
  const all = buildings(saveData, templateId), completed = all.find(b => b.level >= 1);
  if (completed) return completed.x;
  const placed = all.find(b => b.level === 0 && b.work === 0 && b.upgrading === 0);
  if (!placed) throw Error(`基準存檔需要已放置的${label}`);
  put(placed.x, 5, 1, 1, false);
  return placed.x;
}

function buildScenarios({catalog, saveText}) {
  const k = JSON.parse(JSON.stringify(catalog)), C = loadCore(JSON.parse(JSON.stringify(catalog)));
  const save = JSON.parse(saveText.replace(/^\uFEFF/, '')), size = save.size, templates = ordinaryTemplates(k);
  const make = spec => copy(C, k, saveText, size, spec);
  const copies = [{name: 'growth', family: 'growth', oracleArgs: [], lifecycle: false, cases: 4, scenario: null}];

  // Boundary copies prove the normal and over-cap ranges; the follow-up copy keeps values below building limits so
  // native research and training can still start after editing, as in the original follow-up case.
  for (const mode of ['normal', 'overcap', 'followup']) copies.push(make({
    name: 'advanced-' + mode, family: 'advanced', oracleArgs: ['--item', '3'], lifecycle: mode === 'followup',
    prepare({place, equip, put, extra}) {
      const t = template(templates, {tier: 1, maxSlot: 4});
      place(3, 9, equipment(t, {quality: 2, level: 3, owner: 1})); equip(3, t.slot);
      const drillGround = requireBuilding(save.data, 6, '校場', put), academy = requireBuilding(save.data, 5, '書院', put);
      if (mode === 'followup') {
        // A second character one experience point short of the prerequisite level: one native call must level it.
        const character = save.data.findIndex((row, x) => x > 1 && x < 50 && row[0][2] === x);
        if (character < 0) throw Error('基準存檔需要第二名角色');
        for (const [y, value] of [[6, 1], [59, 0]]) put(character, y, 2, value);
        for (const [y, value] of [[1, 4], [3, 0]]) put(character, y, 4, value);
        put(character, 1, 5, C.experienceNeed.profession(4, 1) - 1); put(character, 3, 5, 0);
        extra.followup = {equipment: {id: 3, slot: t.slot}, character, profession: 3, technology: 31, drillGround, academy};
      }
    },
    act(model, {apply, observe}) {
      const advanced = mode === 'overcap';
      const pick = info => {
        const value = advanced ? info.advancedMax : mode === 'followup' ? Math.min(info.current + 1, info.normalMax) : info.current === info.normalMax ? info.normalMax - 1 : info.normalMax;
        if (value < info.min || value === info.current) throw Error(`${info.name} 沒有可驗證的${mode}目標值`);
        return value;
      };
      apply('setEquipmentLevel', {itemId: 3, level: pick(C.editingInfo(model, 'equipment', 3)), advanced});
      const training = C.editingInfo(model, 'training', 3);
      apply('setProfessionTrainingCap', {professionId: 3, cap: mode === 'followup' ? (training.current === 10 ? 9 : 10) : pick(training), advanced}); observe.push([3, 5, 0]);
      for (let id = 31; id <= (mode === 'followup' ? 31 : 44); id++) { apply('setAdvancedTechnologyLevel', {technologyId: id, level: pick(C.editingInfo(model, 'technology', id)), advanced}); observe.push([id, 4, 0]); }
    }
  }));

  const pills = [1, 2, 3].map(aptitude => Object.entries(k.batch2Data.pills).filter(([, p]) => p.aptitude === aptitude).sort((a, b) => b[1].cap - a[1].cap)[0]).map(([id], i) => ({aptitude: i + 1, pillId: Number(id)}));
  copies.push(make({
    name: 'batch2', family: 'batch2', oracleArgs: ['--character', '1'],
    prepare({place, equip, put, extra}) {
      let id = 0;
      for (const quality of [2, 6]) for (const tier of [1, 9]) for (const edge of [0, 1]) {
        id++; const t = template(templates, {tier}), first = id === 1;
        place(id, 9, equipment(t, {quality, owner: first ? 1 : 0, selected: 1})); if (first) equip(id, t.slot);
        extra[id] = {quality, tier, edge, equipSlot: t.slot};
      }
      for (const {pillId} of pills) put(pillId, 6, 0, 5, false);
      put(1, 13, 2, 0); put(1, 14, 2, 0); put(1, 15, 2, 1);
      for (let y = 1; y <= 16; y++) put(1, y, 16, 0, false);
    },
    act(model, {apply, extra}) {
      for (let id = 1; id <= 8; id++) {
        const {quality, tier, edge, equipSlot} = extra[id], [low, high] = coefficientRange(quality);
        // Two-decimal endpoints mirror the original 10.01 and 119.99 cases.
        const coefficient = edge ? high - (quality === 6 && tier === 9 ? 0.01 : 0) : low + (quality === 2 && tier === 1 ? 0.01 : 0);
        apply('setEquipmentAffixCoefficient', {itemId: id, slot: 1, coefficient}, {equipSlot});
        delete extra[id];
      }
      const targets = [info => info.max, () => 1, () => 0];
      for (const {aptitude, pillId} of pills) {
        const info = C.pillInfo(model, 1, aptitude, pillId), bonus = targets[aptitude - 1](info);
        if (bonus > info.max || bonus === info.current) throw Error('丹藥增量沒有可驗證的目標值：' + aptitude);
        apply('setPillAptitudeBonus', {characterId: 1, aptitude, pillId, bonus});
      }
      extra.pills = pills;
    }
  }));

  copies.push(make({
    name: 'affix-replacement', family: 'affixReplacement',
    prepare({place, equip, extra}) {
      let id = 0;
      for (const poolType of ['战斗', '生产', '通用']) for (const [quality, tier] of [[2, 1], [6, 9]]) for (const edge of [0, 1]) {
        id++; const t = template(templates, {tier, poolType}), first = id === 1;
        place(id, 9, equipment(t, {quality, owner: first ? 1 : 0, selected: 1})); if (first) equip(id, t.slot);
        extra[id] = {edge, equipSlot: t.slot};
      }
    },
    act(model, {apply, extra}) {
      for (let id = 1; id <= 12; id++) {
        const {edge, equipSlot} = extra[id], info = C.equipmentAffixReplacementInfo(model, {itemId: id, slot: 1});
        const candidate = info.candidates.find(c => c.verified && c.attributeId !== info.attributeId);
        if (!candidate) throw Error('找不到可替換的合法詞條：' + id);
        apply('setEquipmentAffix', {itemId: id, slot: 1, attributeId: candidate.attributeId, coefficient: edge ? info.max : info.min}, {equipSlot});
        delete extra[id];
      }
    }
  }));

  copies.push(make({
    name: 'equipment-workflow', family: 'equipmentWorkflow',
    prepare({place, extra}) {
      const t1 = template(templates, {tier: 1, maxSlot: 4}), t9 = template(templates, {tier: 9, maxSlot: 4});
      const bag = [
        ['coefficient', t1, {quality: 2, marker: 1, selected: 1}], ['coefficient', t9, {quality: 6, selected: 1}],
        ['replace', t1, {quality: 3, marker: 1, selected: 1}], ['replace', t9, {quality: 6, selected: 2}],
        ['select', t1, {quality: 2, marker: 1}], ['levelUp', t1, {quality: 1}], ['levelDown', t9, {quality: 6, level: 30}]
      ];
      bag.forEach(([kind, t, options], i) => { place(i + 1, 7, equipment(t, options)); extra['7:' + (i + 1)] = {kind, equipSlot: t.slot, edge: i % 2}; });
      place(1, 9, equipment(t9, {quality: 4})); extra['9:1'] = {kind: 'select', equipSlot: t9.slot, edge: 1};
    },
    act(model, {apply, extra}) {
      for (const key of Object.keys(extra).filter(key => /^\d+:\d+$/.test(key))) {
        const [plane, itemId] = key.split(':').map(Number), {kind, equipSlot, edge} = extra[key];
        delete extra[key];
        if (kind === 'levelUp' || kind === 'levelDown') {
          const info = C.editingInfo(model, 'equipment', itemId, plane);
          apply('setEquipmentLevel', {itemId, level: kind === 'levelUp' ? info.normalMax : 1, plane}, {equipSlot, levelCase: true});
          continue;
        }
        const value = y => C.get(model, {x: itemId, y, z: plane}), slot = kind === 'select' ? (plane === 9 ? 2 : 1) : [1, 2, 3, 4, 5, 6].find(s => value(27 + s) === 1);
        const info = C.equipmentAffixReplacementInfo(model, {itemId, slot, plane}), coefficient = edge ? info.max : info.min;
        if (kind === 'coefficient') apply('setEquipmentAffixCoefficient', {itemId, slot, coefficient, plane}, {equipSlot});
        else {
          // The backpack selection locks the slot without changing it; the z9 selection also replaces the affix.
          const pureLock = kind === 'select' && plane === 7;
          const attributeId = pureLock ? info.attributeId : info.candidates.find(c => c.verified && c.attributeId !== info.attributeId)?.attributeId;
          if (!attributeId) throw Error('找不到可替換的合法詞條：' + key);
          apply('setEquipmentAffix', {itemId, slot, attributeId, coefficient: pureLock ? value(14 + slot) : coefficient, plane, selectUnwashedSlot: kind === 'select'}, {equipSlot});
        }
      }
    }
  }));

  for (const plane of [7, 9]) for (const direction of ['Upgrade', 'Downgrade']) {
    const scenario = qualityScenario(C, k, plane, direction, {representative: true});
    editSave(C, saveText, scenario);
    copies.push({name: `quality-${plane}-${direction}`, family: 'equipmentQuality', oracleArgs: [], lifecycle: true, cases: scenario.items.length, scenario, groups: [(plane === 7 ? 'backpackEquipmentQuality' : 'equipmentQuality') + direction]});
  }
  // The initial release suite uses the full matrix. Later migrations select two representative qualities.
  copies.push(...require('./random-character-skill-caps-scenarios.cjs').buildSkillCapScenarios({catalog,saveText}));
  copies.push(...require('./random-character-growth-scenarios.cjs').buildGrowthScenarios({catalog,saveText,representative:true}));
  return copies;
}

if (require.main === module) {
  const args = process.argv.slice(2), opt = key => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
  if (!opt('--save') || !opt('--output')) throw Error('Usage: node scripts/migration-scenarios.cjs --save BASE.dat --output EXISTING_EXTERNAL_DIR [--catalog CATALOG.json]');
  const dir = fs.realpathSync(opt('--output')), rel = path.relative(root, dir);
  if (!rel || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep))) throw Error('External artifacts required');
  const catalog = JSON.parse(fs.readFileSync(opt('--catalog') || path.join(root, 'knowledge/catalog.json'), 'utf8'));
  for (const c of buildScenarios({catalog, saveText: fs.readFileSync(opt('--save'), 'utf8')})) {
    if (c.scenario) fs.writeFileSync(path.join(dir, c.name + '.json'), JSON.stringify(c.scenario));
    console.log(`${c.name}: ${c.cases} operations`);
  }
}
module.exports = {buildScenarios};
