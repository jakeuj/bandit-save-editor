'use strict';
const {navigate} = require('./actions.cjs');
// Basic technologies. Runs on disposable candidate builds (gate opened or closed, proof gate removed) so the same spec keeps
// covering both states; it is browser behaviour only, not the isolated game smoke that opens the repository gate.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,download,noOverflow}=require('./actions.cjs');
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:['basicTechnologyLevel']});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:['basicTechnologyLevel']}});try{await use(site);}finally{await site.close();}}});
// Same locked set as the smoke base; 礦坑 keeps 1234 research points from a cancelled research.
function fixture(){const {data}=saveFixture({characters:1});for(let t=1;t<=28;t++)data[t][4][0]=[13,14,15,17,18,24,25,26,27].includes(t)?0:1;data[15][12][0]=1234;return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};}
async function open(page){await navigate(page, 'settlement');await expect(page.locator('#basicTechInfo')).toContainText('已掌握 19 / 28');}
for(const width of [1280,390])opened(`basic technologies ${width}px: unlock with a prerequisite, exact bytes, reload`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await expect(page.locator('#basicTechPick option')).toHaveCount(9);
 await page.locator('#basicTechPick').selectOption('26');
 await expect(page.locator('#basicTechPreview')).toContainText('#15 礦坑 → #26 司職任免');await expect(page.locator('#basicTechPreview')).toContainText('含 1 項前置');await expect(page.locator('#basicTechPreview')).toContainText('研究點數歸零');await noOverflow(page);
 await page.locator('#basicTechApply').click();await expect(page.locator('#pendingCount')).toHaveText('3');
 const output=await download(page,site,f.expected([[15,4,0,1],[15,12,0,0],[26,4,0,1]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await navigate(page, 'settlement');await expect(page.locator('#basicTechInfo')).toContainText('已掌握 21 / 28');await expect(page.locator('#basicTechPick option')).toHaveCount(7);
 await page.locator('#basicTechPick').selectOption('14');await expect(page.locator('#basicTechPreview')).toContainText('解鎖 #14 林場');await expect(page.locator('#basicTechPreview')).not.toContainText('前置');
});
closed('closed basic technology gate previews but keeps Apply disabled',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await expect(page.locator('#basicTechPreview')).toContainText('尚待隔離遊戲驗證');await expect(page.locator('#basicTechApply')).toBeDisabled();
});
