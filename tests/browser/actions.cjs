'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {expect} = require('@playwright/test');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function loadRaw(page, site, raw, name = 'synthetic.dat') {
  const file = path.join(site.dir, name);
  await fs.writeFile(file, raw);
  await page.locator('#fileInput').setInputFiles(file);
  await expect(page.locator('#fileName')).toHaveText(name);
  await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy', 'true');
  return file;
}
async function navigate(page, name) {
  if (await page.locator('#navigationBtn').isVisible()) {
    await page.locator('#navigationBtn').click();
    await page.locator(`[data-mobile-tab="${name}"]`).click();
    await expect(page.locator('#navigationDialog')).not.toBeVisible();
  } else await page.locator(`[data-tab="${name}"]`).click();
}
// Legacy feature regressions exercise the editors after explicitly opening them.
async function openCharacterEditors(page) {
  for (const section of await page.locator('[data-character-section]').all()) {
    if (await section.getAttribute('open') === null) await section.locator('summary').first().click();
  }
}
async function selectCharacter(page, id) {
  await navigate(page, 'characters');
  await page.locator('#characterSearch').fill('#' + id);
  await page.locator('#characterSelect').selectOption(String(id));
  await expect(page.locator('#characterSelect')).toHaveValue(String(id));
  await openCharacterEditors(page);
}
async function previewBase(page, values) {
  if (await page.locator('#baseAptitudeSection').getAttribute('open') === null) await page.locator('#baseAptitudeSection > summary').click();
  for (let i = 0; i < values.length; i++) await page.locator('#baseAptitude' + i).fill(String(values[i]));
  await page.locator('#baseAptitudePreviewBtn').click();
}
async function download(page, site, expected, button = '#downloadBtn') {
  const pending = page.waitForEvent('download');
  await page.locator(button).click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(/\.modified\.dat$/);
  expect(await file.failure()).toBeNull();
  const output = path.join(site.dir, file.suggestedFilename());
  await file.saveAs(output);
  const bytes = await fs.readFile(output);
  expect(sha(bytes), 'Actual downloaded bytes must match the independent fixture').toBe(sha(Buffer.from(expected)));
  expect(bytes.subarray(0, 3).toString('hex')).toBe('efbbbf');
  expect(bytes.includes(Buffer.from('987654321098765432109876543210'))).toBe(true);
  expect(bytes.includes(Buffer.from('1e+03'))).toBe(true);
  return output;
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Page must fit the viewport').toBe(true);
}
module.exports = {navigate, openCharacterEditors, loadRaw, selectCharacter, previewBase, download, noOverflow};
