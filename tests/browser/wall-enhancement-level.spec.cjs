'use strict';
const {navigate} = require('./actions.cjs');
// City wall enhancement level. Runs on disposable candidate builds (gate opened or closed, proof gate removed) so the same spec
// keeps covering both states; it is browser behaviour only, not the isolated game smoke that opens the repository gate.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,download,noOverflow}=require('./actions.cjs');
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:['wallEnhancementLevel']});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:['wallEnhancementLevel']}});try{await use(site);}finally{await site.close();}}});
// Level 60 at building level 0 (cap 60), HP 318218; the bonus-free maximum at level 30 is 36541.
function fixture(){const {data}=saveFixture({characters:1});[21,20005,20001,0,0,0,0,0,0,0,318218].forEach((v,i)=>data[0][i+1][1]=v);data[19][1][0]=60;return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};}
async function open(page){await navigate(page, 'settlement');await expect(page.locator('#wallLevel')).toHaveValue('60');}
for(const width of [1280,390])opened(`wall enhancement ${width}px: lower with HP cap, exact bytes, reload, reject over cap`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await expect(page.locator('#wallInfo')).toContainText('目前 Lv 60 / 上限 60');
 await page.locator('#wallLevel').fill('30');
 await expect(page.locator('#wallPreview')).toContainText('Lv 60 → 30');await expect(page.locator('#wallPreview')).toContainText('→ 36,541');await noOverflow(page);
 await page.locator('#wallApply').click();await expect(page.locator('#pendingCount')).toHaveText('2');
 const output=await download(page,site,f.expected([[19,1,0,30],[0,11,1,36541]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await navigate(page, 'settlement');await expect(page.locator('#wallLevel')).toHaveValue('30');await expect(page.locator('#wallInfo')).toContainText('目前生命 36,541');
 await page.locator('#wallLevel').fill('61');
 await expect(page.locator('#wallPreview')).toContainText('0–60 的整數');await expect(page.locator('#wallApply')).toBeDisabled();await expect(page.locator('#pendingCount')).toHaveText('0');
});
closed('closed wall gate previews but keeps Apply disabled',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await page.locator('#wallLevel').fill('30');await expect(page.locator('#wallPreview')).toContainText('尚待隔離遊戲驗證');await expect(page.locator('#wallApply')).toBeDisabled();
});
