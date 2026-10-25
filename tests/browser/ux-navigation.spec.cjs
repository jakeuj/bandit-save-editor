'use strict';
const path = require('node:path');
const {test, expect} = require('./fixtures.cjs');
const {saveFixture, renderSave} = require('../helpers/save-fixture.cjs');
const {loadRaw, navigate, noOverflow, download} = require('./actions.cjs');

for (const width of [320, 390, 760, 1280]) {
  test(`UX ${width}px: first screen, navigation, footer and keyboard focus`, async ({page, site}) => {
    await page.setViewportSize({width, height: 844});
    await page.goto(site.url);
    await expect(page.locator('#editorFooter')).toBeHidden();
    await expect(page.locator('#backupBtn')).toBeHidden();
    await expect(page.locator('#emptyOpenBtn')).toBeInViewport({ratio: 1});
    await noOverflow(page);
    if (width <= 760) {
      await page.locator('#navigationBtn').focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#navigationDialog')).toBeVisible();
      await expect(page.locator('[data-mobile-tab]')).toHaveCount(10);
      await expect(page.locator('[data-mobile-tab="resources"]')).toHaveAttribute('aria-current', 'page');
      await page.keyboard.press('Escape');
      await expect(page.locator('#navigationBtn')).toBeFocused();
      await navigate(page, 'professions');
      await expect(page.locator('#tab-professions h2')).toBeFocused();
      await expect(page.locator('#mobileCurrent')).toHaveText('職業圖鑑');
      await expect(page.locator('#editorFooter')).toBeHidden();
      await navigate(page, 'inventory');
      await expect(page.locator('#dropZone h2')).toBeFocused();
      await expect(page.locator('#dropZone')).toBeVisible();
    }
    if (process.env.BANDIT_BROWSER_VISUAL) await page.screenshot({path: path.join(process.env.BANDIT_BROWSER_ARTIFACTS, `ux-home-${width}.png`)});
    const f = saveFixture({characters: 2});
    await loadRaw(page, site, f.raw);
    await expect(page.locator('#editorFooter')).toBeVisible();
    await expect(page.locator('#backupBtn')).toBeVisible();
    const bar = await page.locator('#editorFooter').boundingBox();
    if (width <= 760) expect(bar.height).toBeLessThan(120);
    for (const button of ['undoBtn', 'reviewBtn', 'downloadBtn']) {
      const bounds = await page.locator('#' + button).boundingBox();
      expect(bounds.y).toBeGreaterThanOrEqual(bar.y);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
      if (width <= 760) expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    await noOverflow(page);
  });
}

for (const width of [390, 1280]) {
  test(`UX ${width}px: character folding preserves drafts, preview and expansion through transactions`, async ({page, site}) => {
    await page.setViewportSize({width, height: 844});
    await page.goto(site.url);
    const f = saveFixture({characters: 2});
    await loadRaw(page, site, f.raw);
    await navigate(page, 'characters');
    await expect(page.locator('[data-character-section][open]')).toHaveCount(0);
    await expect(page.locator('#baseAptitudeSummary')).toContainText('30／30／30');
    await expect(page.locator('#pillSummary')).toContainText('未持有此類資質的丹藥');
    if (process.env.BANDIT_BROWSER_VISUAL) await page.screenshot({path: path.join(process.env.BANDIT_BROWSER_ARTIFACTS, `ux-character-collapsed-${width}.png`), fullPage: true});
    await page.locator('[data-character-jump="baseAptitudeSection"]').click();
    await expect(page.locator('#baseAptitudeSection > summary')).toBeFocused();
    const input = page.locator('#baseAptitude0');
    await input.fill('40');
    await page.locator('#baseAptitudePreviewBtn').click();
    await expect(page.locator('#baseAptitudeApplyBtn')).toBeEnabled();
    const preview = await page.locator('#baseAptitudePreview').textContent();
    await input.evaluate(el => { el.dataset.draftIdentity = 'retained'; });
    await page.locator('#baseAptitudeSection > summary').click();
    await page.locator('#baseAptitudeSection > summary').click();
    await expect(input).toHaveValue('40');
    await expect(input).toHaveAttribute('data-draft-identity', 'retained');
    await expect(page.locator('#baseAptitudePreview')).toHaveText(preview);
    await expect(page.locator('#pendingCount')).toHaveText('0');
    await page.locator('#baseAptitudeApplyBtn').click();
    await expect(page.locator('#baseAptitudeSection')).toHaveAttribute('open', '');
    await expect(page.locator('#pendingCount')).toHaveText('1');
    const output = await download(page, site, f.expected([[1, 10, 2, 40]]));
    await page.locator('#undoBtn').click();
    await expect(page.locator('#baseAptitudeSection')).toHaveAttribute('open', '');
    await expect(page.locator('#pendingCount')).toHaveText('0');
    await page.locator('#characterSelect').selectOption('2');
    await expect(page.locator('#baseAptitudeSection')).toHaveAttribute('open', '');
    await expect(page.locator('#baseAptitude0')).toHaveValue('30');
    await navigate(page, 'resources');
    await navigate(page, 'characters');
    await expect(page.locator('#baseAptitudeSection')).toHaveAttribute('open', '');
    await noOverflow(page);
    if (process.env.BANDIT_BROWSER_VISUAL) await page.screenshot({path: path.join(process.env.BANDIT_BROWSER_ARTIFACTS, `ux-character-${width}.png`), fullPage: true});
    await page.locator('#fileInput').setInputFiles(output);
    await navigate(page, 'characters');
    await expect(page.locator('[data-character-section][open]')).toHaveCount(0);
    await page.locator('#characterSelect').selectOption('1');
    await expect(page.locator('#baseAptitudeSummary')).toContainText('40／30／30');
  });
}

test('UX equipment: empty location differs from unsupported or corrupt existing items', async ({page, site}) => {
  await page.goto(site.url);
  const f = saveFixture();
  await loadRaw(page, site, f.raw);
  await navigate(page, 'inventory');
  await expect(page.locator('#equipmentEditor')).toContainText('此位置沒有可選物品');
  await expect(page.locator('#equipmentEditor select')).toHaveCount(0);
  await expect(page.locator('#affixEditor select')).toHaveCount(0);
  const row = Array(60).fill(0);
  Object.assign(row, {0: 20, 1: 16, 2: 1, 3: 1, 5: 2, 6: 3, 8: 125, 9: 12, 15: 20, 24: 1});
  row.forEach((value, y) => { f.data[20][y][9] = value; });
  await loadRaw(page, site, renderSave(f.data), 'items.dat');
  await navigate(page, 'inventory');
  await expect(page.locator('[data-edit-apply="equipment"]')).toBeEnabled();
  await page.locator('#inventoryPlane').selectOption('7');
  await expect(page.locator('#equipmentEditor')).toContainText('此位置沒有可選物品');
  await page.locator('#equipmentEditor [data-all-positions]').click();
  await expect(page.locator('#inventoryPlane')).toHaveValue('');
  await expect(page.locator('[data-edit-apply="equipment"]')).toBeEnabled();
  // A real item with a forbidden state remains selectable and explains the refusal.
  f.data[20][5][9] = 0;
  await loadRaw(page, site, renderSave(f.data), 'over.dat');
  await navigate(page, 'inventory');
  await expect(page.locator('[data-edit-target="equipment"] option')).toHaveCount(1);
  await expect(page.locator('[data-edit-apply="equipment"]')).toBeDisabled();
  await expect(page.locator('#equipmentEditor')).not.toContainText('此位置沒有可選物品');
  f.data[20][5][9] = 2;
  f.data[20][1][9] = require('../../knowledge/catalog.json').catalogs.items.find(item => item.category !== '裝備').id;
  await loadRaw(page, site, renderSave(f.data), 'unsupported.dat');
  await navigate(page, 'inventory');
  await expect(page.locator('[data-edit-target="equipment"] option')).toHaveCount(1);
  await expect(page.locator('[data-edit-apply="equipment"]')).toBeDisabled();
  await expect(page.locator('#equipmentEditor')).not.toContainText('此位置沒有可選物品');
  // Unknown templates are not silently dropped from the picker or mislabeled as empty.
  f.data[20][1][9] = 999999;
  await loadRaw(page, site, renderSave(f.data), 'unknown.dat');
  await navigate(page, 'inventory');
  await expect(page.locator('[data-edit-target="equipment"] option')).toHaveCount(1);
  await expect(page.locator('[data-edit-apply="equipment"]')).toBeDisabled();
  await expect(page.locator('#equipmentEditor')).not.toContainText('此位置沒有可選物品');
});
