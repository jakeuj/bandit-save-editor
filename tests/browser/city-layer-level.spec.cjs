'use strict';
// City layers. Runs on disposable candidate builds (gate opened or closed, proof gate removed) so the same spec keeps
// covering both states; it is browser behaviour only, not the isolated game smoke that opens the repository gate.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,download,noOverflow}=require('./actions.cjs');
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:['cityLayerLevel']});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:['cityLayerLevel']}});try{await use(site);}finally{await site.close();}}});
// 許昌 cleared 74 layers with idle layer 74 and the first-visit point: total 75. 洛陽 was never entered.
function fixture(){const {data}=saveFixture({characters:1});data[1][11][0]=74;data[1][21][0]=74;data[1][44][0]=1;data[8][1][0]=75;return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};}
async function open(page){await page.locator('[data-tab="settlement"]').click();await expect(page.locator('#cityLayer')).toHaveValue('74');}
for(const width of [1280,390])opened(`city layers ${width}px: lower with idle clamp, exact bytes, reload, reject over the maximum`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await expect(page.locator('#cityInfo')).toContainText('山寨總聲望 75');await expect(page.locator('#cityInfo')).toContainText('已進入 1 / 27');
 await expect(page.locator('#cityPick option')).toHaveCount(1);
 await page.locator('#cityLayer').fill('50');
 await expect(page.locator('#cityPreview')).toContainText('74 → 50 層');await expect(page.locator('#cityPreview')).toContainText('75 → 51');await expect(page.locator('#cityPreview')).toContainText('掛機層數 74 → 50');await noOverflow(page);
 await page.locator('#cityApply').click();await expect(page.locator('#pendingCount')).toHaveText('3');
 const output=await download(page,site,f.expected([[1,11,0,50],[1,21,0,50],[8,1,0,51]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await page.locator('[data-tab="settlement"]').click();await expect(page.locator('#cityLayer')).toHaveValue('50');await expect(page.locator('#cityInfo')).toContainText('山寨總聲望 51');
 await page.locator('#cityMax').click();await expect(page.locator('#cityPreview')).toContainText('50 → 149 層');await expect(page.locator('#cityPreview')).not.toContainText('掛機層數');
 await page.locator('#cityLayer').fill('150');
 await expect(page.locator('#cityPreview')).toContainText('0–149 的整數');await expect(page.locator('#cityApply')).toBeDisabled();await expect(page.locator('#pendingCount')).toHaveText('0');
});
closed('closed city gate previews but keeps Apply disabled',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await page.locator('#cityLayer').fill('100');await expect(page.locator('#cityPreview')).toContainText('尚待隔離遊戲驗證');await expect(page.locator('#cityApply')).toBeDisabled();
});
