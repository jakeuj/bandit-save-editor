'use strict';
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {test, expect} = require('./fixtures.cjs');
const {skillCapsFixture} = require('../helpers/save-fixture.cjs');
const {loadRaw, selectCharacter, download, noOverflow} = require('./actions.cjs');
const released = require('../../knowledge/catalog.json').verification.randomCharacterSkillCaps === true;

async function previewCaps(page, caps = [38, 20, 10, 10, 10, 10, 10, 10, 10]) {
  for (let i = 0; i < 9; i++) await page.locator('#skillCap' + (i + 1)).fill(String(caps[i]));
  await page.locator('#skillCapsPreviewBtn').click();
}
async function experience(page, id, amount, select = true) {
  if (select) await selectCharacter(page, id);
  await page.locator('#growthKind').selectOption('skill');
  await page.locator('#growthTarget').selectOption('1');
  await page.locator('#growthAmount').fill(String(amount));
  await page.locator('#growthApplyBtn').click();
}
async function reloadCaps(page, output, cap = '38') {
  await page.locator('#fileInput').setInputFiles(output);
  await expect(page.locator('#fileName')).toHaveText(path.basename(output));
  await selectCharacter(page, 2500);
  await expect(page.locator('#skillCap1')).toHaveValue(cap);
  await expect(page.locator('#pendingCount')).toHaveText('0');
}
async function simpleFlow(page, site, f) {
  await loadRaw(page, site, f.raw); await selectCharacter(page, 2500); await previewCaps(page);
  await expect(page.locator('#skillCapsPreview tbody tr')).toHaveCount(9);
  if (!released) {
    await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();
    await expect(page.locator('#skillCapsStatus')).toContainText('隔離驗證');
    return null;
  }
  await page.locator('#skillCapsApplyBtn').click();
  await expect(page.locator('#pendingCount')).toHaveText('1');
  return download(page, site, f.expected([[2500, 22, 2, 38]]));
}

for (const width of [1280, 390]) {
  test(`HTTP ${width}px: skill caps full-size preview, guards, interleaved restore, exact download and reload`, async ({page, site}) => {
    await page.setViewportSize({width, height: 844});
    const f = skillCapsFixture();
    await page.goto(site.url); await loadRaw(page, site, f.raw);
    await page.locator('[data-tab="characters"]').click();
    expect(await page.locator('#characterSelect option').count()).toBe(50);
    for (const [id, reason] of [[1, '範本'], [2, '監'], [3, '紀錄'], [4, '共同生成']]) {
      await selectCharacter(page, id);
      await expect(page.locator('#skillCapsStatus')).toContainText(reason);
      await expect(page.locator('#skillCapsPreviewBtn')).toBeDisabled();
    }
    await selectCharacter(page, 2500);
    await expect(page.locator('#characterSelect option')).toHaveCount(1);
    for (const cap of [26, 27]) {
      await previewCaps(page, [cap, 20, 10, 10, 10, 10, 10, 10, 10]);
      await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();
      await expect(page.locator('#skillCapsPreview')).toContainText(cap === 26 ? '低於' : '餘額');
    }
    await previewCaps(page, Array(9).fill(28));
    await expect(page.locator('#skillCapsPreview')).toContainText('共同生成');
    await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();
    await expect(page.locator('#pendingCount')).toHaveText('0');
    await previewCaps(page);
    await expect(page.locator('#skillCapsPreview tbody tr')).toHaveCount(9);
    await expect(page.locator('#skillCapsPreview')).toContainText('0.5');
    await expect(page.locator('#skillCapsRestoreNote')).toContainText('27');
    await page.locator('#skillCap1').fill('37');
    await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();
    await expect(page.locator('#skillCapsPreview')).toContainText('重新預覽');
    await previewCaps(page);
    await noOverflow(page);
    if (process.env.BANDIT_BROWSER_VISUAL) await page.screenshot({path: path.join(process.env.BANDIT_BROWSER_ARTIFACTS, `skill-caps-${width}.png`), fullPage: true});
    if (!released) {
      await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();
      await expect(page.locator('#skillCapsStatus')).toContainText('隔離驗證');
      return; // Explicit closed-gate UI evidence only; not a successful feature release.
    }
    await expect(page.locator('#skillCapsApplyBtn')).toBeEnabled();
    // A real model mutation invalidates the previously displayed preview.
    await experience(page, 2500, 1, false);
    await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();
    await previewCaps(page); await page.locator('#skillCapsApplyBtn').click();
    await expect(page.locator('#pendingCount')).toHaveText('2');
    await page.locator('[data-tab="batch"]').click();
    await page.locator('#batchKind').selectOption('skillExperience');
    await page.locator('#batchCharacterSearch').fill('#2500');
    await page.locator('#batchCharacter').selectOption('2500');
    await page.locator('#batchAmount').fill('2');
    await page.locator('#batchPreview').click();
    await expect(page.locator('#batchRows tr')).toHaveCount(9);
    await page.locator('#batchApply').click();
    await expect(page.locator('#pendingCount')).toHaveText('10');
    await experience(page, 5, 1);
    await selectCharacter(page, 2500);
    await previewCaps(page, [37, 20, 10, 10, 10, 10, 10, 10, 10]);
    await page.locator('#skillCapsApplyBtn').click();
    await expect(page.locator('#pendingCount')).toHaveText('11');
    await page.locator('#reviewBtn').click();
    await expect(page.locator('#reviewRows')).toContainText('27');
    await page.locator('[data-restore="2500,40,2"]').click();
    await expect(page.locator('#pendingCount')).toHaveText('1');
    await expect(page.locator('[data-restore="5,40,2"]')).toBeVisible();
    await page.locator('[data-close="reviewDialog"]').click();
    await page.locator('#undoBtn').click();
    await expect(page.locator('#pendingCount')).toHaveText('11');
    await page.locator('#reviewBtn').click();
    await page.locator('#resetBtn').click();
    await expect(page.locator('#pendingCount')).toHaveText('0');
    await page.locator('#undoBtn').click();
    await expect(page.locator('#pendingCount')).toHaveText('11');
    const patches = [[2500, 22, 2, 37], [5, 40, 2, 1], ...Array.from({length: 9}, (_, i) => [2500, 40 + i, 2, i ? 2 : 3])];
    const output = await download(page, site, f.expected(patches));
    await reloadCaps(page, output, '37');
    await expect(page.locator('#skillRows tr').first()).toContainText('27 / 37');
    await expect(page.locator('#skillRows tr').first().locator('td').nth(2)).toHaveText('3');
    await noOverflow(page);
  });
}

test('file: skill caps preview, verified apply and exact downloaded-save reload', async ({page, site}) => {
  const f = skillCapsFixture();
  await page.goto(pathToFileURL(path.join(site.dir, 'index.html')).href);
  await expect(page.locator('#pwaStatus')).toBeHidden();
  const output = await simpleFlow(page, site, f);
  if (output) await reloadCaps(page, output);
});

test('PWA: skill caps offline root and index.html retain preview and verified download', async ({page, context, site}) => {
  const f = skillCapsFixture();
  await page.goto(site.url); await expect(page.locator('#pwaStatus')).toHaveText('可離線使用');
  await page.reload(); await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  try {
    await page.reload();
    const output = await simpleFlow(page, site, f);
    await page.goto(site.url + 'index.html');
    if (output) await reloadCaps(page, output); else await simpleFlow(page, site, f);
    const urls = await page.evaluate(async () => {
      const result = [];
      for (const key of await caches.keys()) for (const request of await (await caches.open(key)).keys()) result.push(request.url);
      return result;
    });
    expect(urls.length).toBeGreaterThan(0); expect(urls.some(url => url.endsWith('.dat'))).toBe(false);
  } finally { await context.setOffline(false); }
});

test('PWA: skill caps changes survive waiting until exported and all pages close', async ({page, context, site}) => {
  const f = skillCapsFixture();
  await page.goto(site.url); await expect(page.locator('#pwaStatus')).toHaveText('可離線使用');
  await page.reload(); await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await loadRaw(page, site, f.raw); await selectCharacter(page, 2500); await previewCaps(page);
  if (released) await page.locator('#skillCapsApplyBtn').click();
  else await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();
  const before = await page.evaluate(() => performance.timeOrigin);
  const second = await context.newPage(); await second.goto(site.url);
  await site.upgrade();
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await expect(page.locator('#pwaStatus')).toContainText('新版已備妥');
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(before);
  await expect(page.locator('#pendingCount')).toHaveText(released ? '1' : '0');
  let output;
  if (released) output = await download(page, site, f.expected([[2500, 22, 2, 38]]));
  await page.close();
  expect(await second.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(true);
  await second.close();
  const next = await context.newPage(); await next.goto(site.url);
  await expect(next.locator('html')).toHaveAttribute('data-test-release', 'next');
  await expect(next.locator('#pwaStatus')).toHaveText('可離線使用');
  expect(await next.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(false);
  if (output) await reloadCaps(next, output);
});
