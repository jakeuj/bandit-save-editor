'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {test, expect} = require('./fixtures.cjs');
const {saveFixture, renderSave} = require('../helpers/save-fixture.cjs');
const {loadRaw, selectCharacter, download, noOverflow} = require('./actions.cjs');

// Exercise the shipped artifact with its real gates; no candidate build or SaveCore replacement.
const initial = [15, 23, 4, 28, 1, 4, 10, 37, 1];
function fixture() {
  const {data} = saveFixture({characters: 2, layers: 24});
  for (let id = 1; id <= 2; id++) {
    initial.forEach((cap, i) => { data[id][22 + i][2] = cap; });
    for (let i = 0; i < 3; i++) { data[id][1 + i][12] = i + 1; data[id][21 + i][12] = 1; }
  }
  data[1][31][2] = 14; data[1][40][2] = 0.5;
  data[1][32][2] = 22; data[1][41][2] = 2.25;
  data[1][33][2] = 4; data[1][42][2] = 0.5;
  data[1][34][2] = 27;
  return {raw: renderSave(data), expected: caps => renderSave(data, caps.map((cap, i) => [1, 22 + i, 2, cap]))};
}
async function preview(page, caps) {
  for (let i = 0; i < 9; i++) await page.locator('#skillCap' + (i + 1)).fill(String(caps[i]));
  await page.locator('#skillCapsPreviewBtn').click();
}
async function readDownload(page, output, caps) {
  await page.locator('#fileInput').setInputFiles(output);
  await expect(page.locator('#fileName')).toHaveText(path.basename(output));
  await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy', 'true');
  await selectCharacter(page, 1);
  await expect(page.locator('#skillCapsAdvanced')).not.toBeChecked();
  await page.locator('#skillCapsAdvanced').check();
  for (let i = 0; i < 9; i++) await expect(page.locator('#skillCap' + (i + 1))).toHaveValue(String(caps[i]));
  await expect(page.locator('#skillRows tr').first().locator('td').nth(1)).toHaveText('14 / ' + caps[0]);
  await expect(page.locator('#skillRows tr').first().locator('td').nth(2)).toHaveText('0.5');
  await expect(page.locator('#skillCapReason1')).toBeHidden();
  await expect(page.locator('#pendingCount')).toHaveText('0');
}
async function offlineFlow(page, site, reopen) {
  const gates = require('../../knowledge/catalog.json').verification;
  expect(gates.randomCharacterSkillCaps).toBe(true);
  expect(gates.randomCharacterSkillCapsAdvanced).toBe(true);
  const f = fixture();
  await loadRaw(page, site, f.raw, 'advanced-offline.dat');
  await selectCharacter(page, 1);
  await page.locator('#skillCap1').fill('90');
  await page.locator('#skillCap9').fill('');
  for (const advanced of [true, false, true]) {
    await page.locator('#skillCapsAdvanced').setChecked(advanced);
    await expect(page.locator('#skillCap1')).toHaveValue('90');
    await expect(page.locator('#skillCap9')).toHaveValue('');
    await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();
  }
  await preview(page, [13, 22, 4, 27, ...initial.slice(4)]);
  await expect(page.locator('#skillCapsPreview li')).toHaveCount(2);
  await expect(page.locator('#skillCapReason1')).toHaveText('伐木目標上限 13 不得低於目前等級 14；請提高上限。');
  await expect(page.locator('#skillCapReason2')).toHaveText('採礦目標上限 22 等於目前等級 22，下調時仍有經驗餘額 2.25；不自動清零，請設為 23 以上。');
  await expect(page.locator('#skillCap1')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#skillCap2')).toHaveAttribute('aria-describedby', 'skillCapReason2');
  await expect(page.locator('#skillCapReason3')).toBeHidden(); // Unchanged cap at L4 retains its existing E0.5.
  await expect(page.locator('#skillCapReason4')).toBeHidden(); // Legal lowering to L27 with E0.
  await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();
  await expect(page.locator('#pendingCount')).toHaveText('0');
  await noOverflow(page);

  await page.locator('#skillCap1').fill('101');
  await expect(page.locator('#skillCapReason2')).toBeHidden();
  await expect(page.locator('#skillCap1')).not.toHaveAttribute('aria-invalid', 'true');
  await page.locator('#skillCapsPreviewBtn').click();
  await expect(page.locator('#skillCapsPreview')).toContainText('1–100');
  await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();

  await page.locator('#skillCapsFill100Btn').click();
  for (let i = 1; i <= 9; i++) await expect(page.locator('#skillCap' + i)).toHaveValue('100');
  await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();
  await expect(page.locator('#skillCapsPreview tbody tr')).toHaveCount(0);
  await expect(page.locator('#pendingCount')).toHaveText('0');
  await page.locator('#skillCapsPreviewBtn').click();
  await expect(page.locator('#skillCapsPreview tbody tr')).toHaveCount(9);
  await expect(page.locator('#skillCapsPreview')).toContainText('九項獨立設定');
  await expect(page.locator('#skillCapsApplyBtn')).toBeEnabled();
  await page.locator('#skillCapsApplyBtn').click();
  await expect(page.locator('#pendingCount')).toHaveText('9');
  const all100 = Array(9).fill(100);
  const raised = await download(page, site, f.expected(all100));
  await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy', 'true');
  await reopen('index');
  await readDownload(page, raised, all100);

  const lowered = [...all100]; lowered[3] = 27;
  await preview(page, lowered);
  await expect(page.locator('#skillCapsPreview li')).toHaveCount(0);
  await expect(page.locator('#skillCapsApplyBtn')).toBeEnabled();
  await page.locator('#skillCapsApplyBtn').click();
  await expect(page.locator('#pendingCount')).toHaveText('1');
  const output = await download(page, site, f.expected(lowered));
  await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy', 'true');
  await reopen('root');
  await readDownload(page, output, lowered);
  await noOverflow(page);
}

for (const width of [1280, 390]) {
  test(`file: advanced skill caps offline ${width}px diagnostics, preview, exact downloads and reload`, async ({page, context, site}) => {
    await page.setViewportSize({width, height: 844});
    const dir = path.join(site.dir, 'standalone');
    await fs.mkdir(dir);
    await fs.copyFile(path.join(site.dir, 'index.html'), path.join(dir, 'index.html'));
    expect(await fs.readdir(dir)).toEqual(['index.html']);
    await context.setOffline(true);
    try {
      await page.goto(pathToFileURL(path.join(dir, 'index.html')).href);
      await expect(page.locator('#pwaStatus')).toBeHidden();
      await offlineFlow(page, site, async () => { await page.reload(); });
    } finally { await context.setOffline(false); }
  });

  test(`PWA: advanced skill caps offline ${width}px cached root/index, diagnostics, downloads and reload`, async ({page, context, site}) => {
    await page.setViewportSize({width, height: 844});
    await page.goto(site.url);
    await expect(page.locator('#pwaStatus')).toHaveText('可離線使用');
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    const reopen = async target => {
      const response = await page.goto(site.url + (target === 'index' ? 'index.html' : ''));
      expect(response.fromServiceWorker(), 'Offline navigation must be served by the verified app cache').toBe(true);
    };
    try {
      await reopen('root');
      await offlineFlow(page, site, reopen);
      const urls = await page.evaluate(async () => {
        const result = [];
        for (const key of await caches.keys()) for (const request of await (await caches.open(key)).keys()) result.push(request.url);
        return result.sort();
      });
      const publicAssets = ['index.html', 'manifest.webmanifest', 'assets/favicon.svg', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png', 'assets/apple-touch-icon.png'];
      expect(urls).toEqual(publicAssets.map(asset => new URL(asset, site.url).href).sort());
    } finally { await context.setOffline(false); }
  });
}
