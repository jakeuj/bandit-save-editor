'use strict';
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {test, expect} = require('./fixtures.cjs');
const {talentLevelsFixture} = require('../helpers/save-fixture.cjs');
const {loadRaw, selectCharacter, download, noOverflow} = require('./actions.cjs');
const released = require('../../knowledge/catalog.json').verification.randomCharacterTalents === true;

async function previewLevels(page, levels = ['2', '1', '1']) {
  for (let i = 0; i < 3; i++) await page.locator('#talentLevel' + (i + 1)).selectOption(levels[i]);
  await page.locator('#talentLevelsPreviewBtn').click();
}
async function reloadLevels(page, output, level = '2') {
  await page.locator('#fileInput').setInputFiles(output);
  await expect(page.locator('#fileName')).toHaveText(path.basename(output));
  await selectCharacter(page, 2500);
  await expect(page.locator('#talentLevel1')).toHaveValue(level);
  await expect(page.locator('#pendingCount')).toHaveText('0');
}
async function simpleFlow(page, site, f) {
  await loadRaw(page, site, f.raw); await selectCharacter(page, 2500); await previewLevels(page);
  await expect(page.locator('#talentLevelsPreview')).toContainText('1 → 2');
  if (!released) {
    await expect(page.locator('#talentLevelsApplyBtn')).toBeDisabled();
    await expect(page.locator('#talentLevelsStatus')).toContainText('隔離驗證');
    return null;
  }
  await page.locator('#talentLevelsApplyBtn').click();
  await expect(page.locator('#pendingCount')).toHaveText('1');
  return download(page, site, f.expected([[2500, 21, 12, 2]]));
}

for (const width of [1280, 390]) {
  test(`HTTP ${width}px: talent levels guards, aptitude preview, shared restore, exact download and reload`, async ({page, site}) => {
    await page.setViewportSize({width, height: 844});
    const f = talentLevelsFixture();
    await page.goto(site.url); await loadRaw(page, site, f.raw);
    for (const [id, reason] of [[1, '範本'], [2, '監'], [3, '結丹']]) {
      await selectCharacter(page, id);
      await expect(page.locator('#talentLevelsStatus')).toContainText(reason);
      await expect(page.locator('#talentLevelsPreviewBtn')).toBeDisabled();
    }
    await selectCharacter(page, 4);
    await expect(page.locator('#talentLevelsStatus')).toContainText('無可調整值');
    await expect(page.locator('#talentLevelsPreviewBtn')).toBeDisabled();
    await selectCharacter(page, 2500);
    await expect(page.locator('#talentLevel1 option')).toHaveCount(2);
    await previewLevels(page);
    // 力量強化 Lv1 → Lv2 moves aptitude source A by 0.5 and its pill cap with it.
    await expect(page.locator('#talentLevelsPreview')).toContainText('力量');
    await expect(page.locator('#talentLevelsPreview')).toContainText('3.5');
    await page.locator('#talentLevel2').selectOption('2');
    await expect(page.locator('#talentLevelsApplyBtn')).toBeDisabled();
    await expect(page.locator('#talentLevelsPreview')).toContainText('重新預覽');
    await previewLevels(page);
    await noOverflow(page);
    if (process.env.BANDIT_BROWSER_VISUAL) await page.screenshot({path: path.join(process.env.BANDIT_BROWSER_ARTIFACTS, `talent-levels-${width}.png`), fullPage: true});
    if (!released) {
      await expect(page.locator('#talentLevelsApplyBtn')).toBeDisabled();
      await expect(page.locator('#talentLevelsStatus')).toContainText('隔離驗證');
      return; // Closed-gate UI evidence only; not a successful feature release.
    }
    await page.locator('#talentLevelsApplyBtn').click();
    await expect(page.locator('#pendingCount')).toHaveText('1');
    // Base aptitudes join the same 12-column group; restoring one cell restores both edits.
    await page.locator('#baseAptitude0').fill('31');
    await page.locator('#baseAptitudePreviewBtn').click();
    await page.locator('#baseAptitudeApplyBtn').click();
    await expect(page.locator('#pendingCount')).toHaveText('2');
    await page.locator('#reviewBtn').click();
    await page.locator('[data-restore="2500,21,12"]').click();
    await expect(page.locator('#pendingCount')).toHaveText('0');
    await page.locator('[data-close="reviewDialog"]').click();
    await page.locator('#undoBtn').click();
    await expect(page.locator('#pendingCount')).toHaveText('2');
    await page.locator('#undoBtn').click();
    await expect(page.locator('#pendingCount')).toHaveText('1');
    const output = await download(page, site, f.expected([[2500, 21, 12, 2]]));
    await reloadLevels(page, output);
    await noOverflow(page);
  });
}

test('file: talent levels preview, verified apply and exact downloaded-save reload', async ({page, site}) => {
  const f = talentLevelsFixture();
  await page.goto(pathToFileURL(path.join(site.dir, 'index.html')).href);
  await expect(page.locator('#pwaStatus')).toBeHidden();
  const output = await simpleFlow(page, site, f);
  if (output) await reloadLevels(page, output);
});

test('PWA: talent levels offline root and index.html retain preview and verified download', async ({page, context, site}) => {
  const f = talentLevelsFixture();
  await page.goto(site.url); await expect(page.locator('#pwaStatus')).toHaveText('可離線使用');
  await page.reload(); await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  try {
    await page.reload();
    const output = await simpleFlow(page, site, f);
    await page.goto(site.url + 'index.html');
    if (output) await reloadLevels(page, output); else await simpleFlow(page, site, f);
  } finally { await context.setOffline(false); }
});
