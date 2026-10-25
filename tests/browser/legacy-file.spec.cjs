'use strict';
const {navigate} = require('./actions.cjs');
// Direct file:// acceptance for features shipped before per-feature file cases existed: resources, names, the three
// experience kinds, custom-field settings, compare/CSV, v2.2–v2.5 equipment and pills, and v2.6 batch. Uses the
// shipped build and its current verification flags; expected bytes come from the independent renderer.
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {test, expect} = require('./fixtures.cjs');
const {saveFixture, renderSave} = require('../helpers/save-fixture.cjs');
const {loadRaw, selectCharacter, download} = require('./actions.cjs');

// Two characters; profession 1 caps at 30; one held strength pill (#59); an unrecognised numeric field; and an ordinary
// quality-2 勇武頭巾 at row 20, washed in slot 1 in the stored plane (z9) and unwashed in the backpack (z7).
function fixture() {
  const {data} = saveFixture({characters: 2});
  data[1][2][0] = 500;
  data[1][5][0] = 30;
  data[59][6][0] = 1;
  data[150][30][0] = 7;
  const row = Array(60).fill(0);
  Object.assign(row, {0: 20, 1: 16, 2: 1, 3: 1, 5: 2, 6: 3, 8: 125, 9: 12, 15: 20, 24: 1});
  for (const z of [7, 9]) row.forEach((v, y) => { data[20][y][z] = v; });
  data[20][28][9] = 1;
  // 校場 Lv 2 (training cap ≤ 20) and 書院 Lv 1 (advanced tech ≤ 119) for the v2.1 normal-mode caps.
  data[1][0][1] = 1; data[1][1][1] = 6; data[1][5][1] = 2;
  data[2][0][1] = 2; data[2][1][1] = 5; data[2][5][1] = 1;
  return {raw: renderSave(data), expected: patches => renderSave(data, patches)};
}
async function open(page, site) {
  await page.goto(pathToFileURL(path.join(site.dir, 'index.html')).href);
  await expect(page.locator('#pwaStatus')).toBeHidden();
}
async function reload(page, output) {
  await page.locator('#fileInput').setInputFiles(output);
  await expect(page.locator('#fileName')).toHaveText(path.basename(output));
  await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#pendingCount')).toHaveText('0');
}
async function saveDownload(page, site, button) {
  const pending = page.waitForEvent('download');
  await page.locator(button).click();
  const file = await pending;
  expect(await file.failure()).toBeNull();
  const output = path.join(site.dir, file.suggestedFilename());
  await file.saveAs(output);
  return output;
}
async function grow(page, kind, target, amount) {
  await page.locator('#growthKind').selectOption(kind);
  if (target) await page.locator('#growthTarget').selectOption(String(target));
  await page.locator('#growthAmount').fill(String(amount));
  await page.locator('#growthApplyBtn').click();
}
async function restoreInReview(page, key) {
  await page.locator('#reviewBtn').click();
  await page.locator(`[data-restore="${key}"]`).click();
  await page.locator('[data-close="reviewDialog"]').click();
}
async function plane(page, z) {
  await navigate(page, 'inventory');
  await page.locator('#inventoryPlane').selectOption(String(z));
}

test('file legacy: resources, names and three experience kinds with linked restore, undo, export and reload', async ({page, site}) => {
  const f = fixture();
  await open(page, site);
  await loadRaw(page, site, f.raw);
  await navigate(page, 'resources');
  await page.locator('#resourceCards [data-field="1,2,0"]').fill('800');
  await page.locator('#resourceCards [data-field="1,2,0"]').press('Tab');
  await expect(page.locator('#pendingCount')).toHaveText('1');

  await navigate(page, 'settlement');
  await page.locator('#settlementName').fill('新寨');
  await page.locator('#renameSettlementBtn').click();
  await selectCharacter(page, 1);
  await page.locator('#characterName').fill('甲"乙');
  await page.locator('#renameCharacterBtn').click();
  await expect(page.locator('#pendingCount')).toHaveText('3');

  await grow(page, 'character', null, 6500);
  await grow(page, 'profession', 1, 6500.5);
  await grow(page, 'skill', 9, 10000);
  await grow(page, 'skill', 9, 11500);
  await expect(page.locator('#growthInfo')).toContainText('Lv 3 / 50 · 經驗 500');
  await expect(page.locator('#pendingCount')).toHaveText('8');
  // Both grants of the same skill restore together; undo brings back the whole linked group.
  await restoreInReview(page, '1,39,2');
  await expect(page.locator('#pendingCount')).toHaveText('6');
  await page.locator('#undoBtn').click();
  await expect(page.locator('#pendingCount')).toHaveText('8');

  const output = await download(page, site, f.expected([
    [1, 2, 0, 800], [1, 1, 0, '新寨'], [1, 1, 2, '甲"乙'],
    [1, 3, 2, 3], [1, 4, 2, 500], [1, 1, 4, 3], [1, 39, 2, 3], [1, 48, 2, 500]
  ]));
  await reload(page, output);
  await navigate(page, 'settlement');
  await expect(page.locator('#settlementName')).toHaveValue('新寨');
  await selectCharacter(page, 1);
  await expect(page.locator('#characterName')).toHaveValue('甲"乙');
  await page.locator('#growthKind').selectOption('profession');
  await expect(page.locator('#growthInfo')).toContainText('Lv 3 / 30');
  await page.locator('#growthKind').selectOption('character');
  await expect(page.locator('#growthInfo')).toContainText('Lv 3 / 30 · 經驗 500');
});

test('file legacy: custom field pin, settings export/import, compare and CSV export', async ({page, site}) => {
  const f = fixture();
  await open(page, site);
  await loadRaw(page, site, f.raw);
  await navigate(page, 'advanced');
  await page.locator('#coordX').fill('150');
  await page.locator('#coordY').fill('30');
  await page.locator('#coordZ').fill('0');
  await page.locator('#lookupBtn').click();
  await expect(page.locator('#coordInfo')).toContainText('未辨識');
  await page.locator('#customName').fill('合成自訂欄位');
  await page.locator('#pinBtn').click();
  const config = JSON.parse(await fs.readFile(await saveDownload(page, site, '#exportConfigBtn'), 'utf8'));
  expect(config).toEqual({version: 1, game: 'szmnqea', fields: [{name: '合成自訂欄位', x: 150, y: 30, z: 0}]});
  const configFile = path.join(site.dir, 'fields.json');
  await fs.writeFile(configFile, JSON.stringify(config));

  // A fresh file:// page without remembered fields gets the field back only through import.
  await page.evaluate(() => localStorage.clear());
  await open(page, site);
  await loadRaw(page, site, f.raw);
  await expect(page.locator('#customSection')).toBeHidden();
  await page.locator('#configInput').setInputFiles(configFile);
  await navigate(page, 'resources');
  await expect(page.locator('#customSection')).toBeVisible();
  await page.locator('#customCards [data-field="150,30,0"]').fill('9');
  await page.locator('#customCards [data-field="150,30,0"]').press('Tab');
  await expect(page.locator('#pendingCount')).toHaveText('1');
  const output = await download(page, site, f.expected([[150, 30, 0, 9]]));

  await navigate(page, 'compare');
  await page.locator('#compareInput').setInputFiles(output);
  await expect(page.locator('#diffCount')).toHaveText('1');
  await expect(page.locator('#diffRows')).toContainText('[150, 30, 0]');
  const csv = await fs.readFile(await saveDownload(page, site, '#diffCsvBtn'), 'utf8');
  const lines = csv.replace(/^﻿/, '').split('\r\n');
  expect(csv.startsWith('﻿')).toBe(true);
  expect(lines).toHaveLength(2);
  expect(lines[1]).toBe('"未辨識欄位","150","30","0","7","9","2"');
});

test('file legacy: v2.1 stored equipment level, training cap and advanced technology with reset, undo and reload', async ({page, site}) => {
  const f = fixture();
  await open(page, site);
  await loadRaw(page, site, f.raw);
  await plane(page, 9);
  await page.locator('[data-edit-target="equipment"]').selectOption('9:20');
  await page.locator('[data-edit-value="equipment"]').fill('12');
  await page.locator('[data-edit-apply="equipment"]').click();
  await navigate(page, 'settlement');
  await page.locator('[data-edit-target="training"]').selectOption('1');
  await expect(page.locator('#trainingEditor')).toContainText('一般上限 20');
  await page.locator('[data-edit-value="training"]').fill('15');
  await page.locator('[data-edit-apply="training"]').click();
  await page.locator('[data-edit-target="technology"]').selectOption('31');
  await expect(page.locator('#technologyEditor')).toContainText('一般上限 119');
  await page.locator('[data-edit-value="technology"]').fill('3');
  await page.locator('[data-edit-apply="technology"]').click();
  await expect(page.locator('#pendingCount')).toHaveText('3');
  // 還原全部 is itself one undoable step.
  await page.locator('#reviewBtn').click();
  await page.locator('#resetBtn').click();
  await expect(page.locator('#pendingCount')).toHaveText('0');
  await page.locator('#undoBtn').click();
  await expect(page.locator('#pendingCount')).toHaveText('3');

  const output = await download(page, site, f.expected([[20, 6, 9, 12], [1, 5, 0, 15], [31, 4, 0, 3]]));
  await reload(page, output);
  await plane(page, 9);
  await page.locator('[data-edit-target="equipment"]').selectOption('9:20');
  await expect(page.locator('[data-edit-value="equipment"]')).toHaveValue('12');
  await navigate(page, 'settlement');
  await page.locator('[data-edit-target="training"]').selectOption('1');
  await expect(page.locator('#trainingEditor')).toContainText('目前 15');
  await page.locator('[data-edit-target="technology"]').selectOption('31');
  await expect(page.locator('#technologyEditor')).toContainText('目前 3');
});

test('file legacy: v2.2–v2.4 affix coefficient, precise affix, backpack first selection, level and pill', async ({page, site}) => {
  const f = fixture();
  await open(page, site);
  await loadRaw(page, site, f.raw);
  await plane(page, 9);
  await page.locator('#affixItem').selectOption('9:20');
  await page.locator('#affixSearch').fill('');
  await page.locator('#affixTarget').selectOption('13');
  await page.locator('#affixValue').fill('30');
  await page.locator('#affixReplace').click();
  await expect(page.locator('#pendingCount')).toHaveText('2');
  await page.locator('#affixValue').fill('55.55');
  await page.locator('#affixApply').click();
  await expect(page.locator('#pendingCount')).toHaveText('2');

  await plane(page, 7);
  await page.locator('#affixItem').selectOption('7:20');
  await page.locator('#affixTarget').selectOption('12');
  await page.locator('#affixValue').fill('25');
  await expect(page.locator('#affixReplace')).toBeDisabled();
  await page.locator('#affixFirst').check();
  await page.locator('#affixReplace').click();
  await expect(page.locator('#pendingCount')).toHaveText('4');
  await page.locator('[data-edit-target="equipment"]').selectOption('7:20');
  await page.locator('[data-edit-value="equipment"]').fill('10');
  await page.locator('[data-edit-apply="equipment"]').click();
  await expect(page.locator('#pendingCount')).toHaveText('5');
  await page.locator('#undoBtn').click();
  await expect(page.locator('#pendingCount')).toHaveText('4');
  await page.locator('[data-edit-value="equipment"]').fill('10');
  await page.locator('[data-edit-apply="equipment"]').click();

  await selectCharacter(page, 1);
  await page.locator('#pillAptitude').selectOption('1');
  await page.locator('#pillType').selectOption('59');
  await page.locator('#pillValue').fill('3');
  await page.locator('#pillApply').click();
  await expect(page.locator('#pendingCount')).toHaveText('6');

  const output = await download(page, site, f.expected([
    [20, 9, 9, 13], [20, 15, 9, 55.55], [20, 28, 7, 1], [20, 15, 7, 25], [20, 6, 7, 10], [1, 13, 2, 3]
  ]));
  await reload(page, output);
  await plane(page, 9);
  await page.locator('#affixItem').selectOption('9:20');
  await expect(page.locator('#affixValue')).toHaveValue('55.55');
  await plane(page, 7);
  await page.locator('#affixItem').selectOption('7:20');
  await expect(page.locator('#affixFirstLabel')).toBeHidden();
  await expect(page.locator('#affixValue')).toHaveValue('25');
  await page.locator('[data-edit-target="equipment"]').selectOption('7:20');
  await expect(page.locator('[data-edit-value="equipment"]')).toHaveValue('10');
  await selectCharacter(page, 1);
  await page.locator('#pillType').selectOption('59');
  await expect(page.locator('#pillValue')).toHaveValue('3');
});

test('file legacy: v2.5 quality upgrade with explicit slot, confirmed downgrade, group restore and reload', async ({page, site}) => {
  const f = fixture();
  await open(page, site);
  await loadRaw(page, site, f.raw);
  await plane(page, 9);
  await page.locator('#qualityItem').selectOption('9:20');
  await page.locator('#qualityTarget').selectOption('3');
  await expect(page.locator('#qualityApply')).toBeDisabled();
  await page.locator('#qualityAffix2').selectOption('13');
  await page.locator('#qualityCoefficient2').fill('35.5');
  await page.locator('#qualityApply').click();
  await expect(page.locator('#pendingCount')).toHaveText('5');

  await plane(page, 7);
  await page.locator('#qualityItem').selectOption('7:20');
  await page.locator('#qualityTarget').selectOption('1');
  await expect(page.locator('#qualityRemovalLabel')).toBeVisible();
  await expect(page.locator('#qualityApply')).toBeDisabled();
  await page.locator('#qualityRemoval').check();
  await page.locator('#qualityApply').click();
  await expect(page.locator('#pendingCount')).toHaveText('9');
  await restoreInReview(page, '20,5,7');
  await expect(page.locator('#pendingCount')).toHaveText('5');
  await page.locator('#undoBtn').click();
  await expect(page.locator('#pendingCount')).toHaveText('9');

  const output = await download(page, site, f.expected([
    [20, 5, 9, 3], [20, 8, 9, 155], [20, 10, 9, 13], [20, 15, 9, 30], [20, 16, 9, 35.5],
    [20, 5, 7, 1], [20, 8, 7, 95], [20, 9, 7, 0], [20, 15, 7, 0]
  ]));
  await reload(page, output);
  await plane(page, 9);
  await page.locator('#qualityItem').selectOption('9:20');
  await expect(page.locator('#qualityInfo')).toContainText('品質 3');
  await plane(page, 7);
  await page.locator('#qualityItem').selectOption('7:20');
  await expect(page.locator('#qualityInfo')).toContainText('品質 1');
});

test('file legacy: v2.6 batch character experience applies once, undoes atomically and reloads', async ({page, site}) => {
  const f = fixture();
  await open(page, site);
  await loadRaw(page, site, f.raw);
  await navigate(page, 'batch');
  await page.locator('#batchSelectPage').click();
  await expect(page.locator('#batchCharacterCount')).toContainText('已勾選 2');
  await page.locator('#batchAmount').fill('1');
  await page.locator('#batchPreview').click();
  await page.locator('#batchApply').click();
  await expect(page.locator('#pendingCount')).toHaveText('2');
  await page.locator('#undoBtn').click();
  await expect(page.locator('#pendingCount')).toHaveText('0');
  await page.locator('#batchPreview').click();
  await page.locator('#batchApply').click();
  await expect(page.locator('#pendingCount')).toHaveText('2');
  const output = await download(page, site, f.expected([[1, 4, 2, 1], [2, 4, 2, 1]]));
  await reload(page, output);
  await selectCharacter(page, 2);
  await expect(page.locator('#growthInfo')).toContainText('經驗 1 / 1,000');
});
