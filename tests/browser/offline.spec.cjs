'use strict';
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {test, expect} = require('./fixtures.cjs');
const {saveFixture} = require('../helpers/save-fixture.cjs');
const {loadRaw, selectCharacter, previewBase, download} = require('./actions.cjs');

async function editAndDownload(page, site, f) {
  await loadRaw(page, site, f.raw);
  await selectCharacter(page, 2500);
  await previewBase(page, [40, 35, 30]);
  await page.locator('#baseAptitudeApplyBtn').click();
  await expect(page.locator('#pendingCount')).toHaveText('2');
  return download(page, site, f.expected([[2500, 10, 2, 40], [2500, 11, 2, 35]]));
}
async function reloadDownload(page, output) {
  await page.locator('#fileInput').setInputFiles(output);
  await expect(page.locator('#fileName')).toHaveText(path.basename(output));
  await selectCharacter(page, 2500);
  await expect(page.locator('#baseAptitude0')).toHaveValue('40');
  await expect(page.locator('#baseAptitude1')).toHaveValue('35');
}

test('file: standalone HTML reads, previews, downloads and reloads the complete synthetic save', async ({page, site}) => {
  const f = saveFixture({size: 2501, characters: 2500});
  await page.goto(pathToFileURL(path.join(site.dir, 'index.html')).href);
  await expect(page.locator('#pwaStatus')).toBeHidden();
  const output = await editAndDownload(page, site, f);
  await reloadDownload(page, output);
});

test('PWA: offline root and index.html retain real file input and exact download behavior', async ({page, context, site}) => {
  const f = saveFixture({size: 2501, characters: 2500});
  await page.goto(site.url);
  await expect(page.locator('#pwaStatus')).toHaveText('可離線使用');
  // A navigation obtains control; production deliberately does not clients.claim().
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator('#pwaStatus')).toHaveText('可離線使用');
    const output = await editAndDownload(page, site, f);
    await page.goto(site.url + 'index.html');
    await reloadDownload(page, output);
    const cached = await page.evaluate(async () => {
      const urls = [];
      for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
      return urls;
    });
    expect(cached.length).toBeGreaterThan(0);
    expect(cached.every(url => !url.endsWith('.dat'))).toBe(true);
  } finally { await context.setOffline(false); }
});

test('PWA: verified next build waits for edited pages, then activates after all same-origin pages close', async ({page, context, site}) => {
  const f = saveFixture({size: 450, characters: 3});
  await page.goto(site.url);
  await expect(page.locator('#pwaStatus')).toHaveText('可離線使用');
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await loadRaw(page, site, f.raw);
  await selectCharacter(page, 3); await previewBase(page, [40, 35, 30]);
  await page.locator('#baseAptitudeApplyBtn').click();
  await expect(page.locator('#pendingCount')).toHaveText('2');
  const before = await page.evaluate(() => ({time: performance.timeOrigin, marker: document.documentElement.dataset.testRelease || null}));
  await site.upgrade();
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await expect(page.locator('#pwaStatus')).toContainText('新版已備妥');
  await expect(page.locator('#pendingCount')).toHaveText('2');
  await expect(page.locator('#baseAptitude0')).toHaveValue('40');
  expect(await page.evaluate(() => ({time: performance.timeOrigin, marker: document.documentElement.dataset.testRelease || null}))).toEqual(before);
  await download(page, site, f.expected([[3, 10, 2, 40], [3, 11, 2, 35]]));
  await expect(page.locator('#pendingLabel')).toHaveText('已匯出');
  await page.close();
  const next = await context.newPage();
  await next.goto(site.url);
  await expect(next.locator('html')).toHaveAttribute('data-test-release', 'next');
  await expect(next.locator('#pwaStatus')).toHaveText('可離線使用');
  expect(await next.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(false);
});
