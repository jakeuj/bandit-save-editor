'use strict';
// Backpack relic elements. Runs on disposable candidate builds (gate opened or closed, proof gate removed) so the same spec
// keeps covering both states; it is browser behaviour only, not the isolated game smoke that opens the repository gate.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,download,noOverflow}=require('./actions.cjs');
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:['relicAttributes']});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:['relicAttributes']}});try{await use(site);}finally{await site.close();}}});
// A natural roll: 妖狐靈火 (bases 55/95/30/75/45), level 2, quality 1, backpack row 1.
function fixture(){const {data}=saveFixture({characters:2});[1,1,2,1,1,1.2,1.6,0.4,1.6,0.9,1.1,0,0,1].forEach((v,y)=>data[1][y][18]=v);return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};}
const inputs=page=>[0,1,2,3,4].map(i=>page.locator('#relicValue'+i));
async function open(page){await page.locator('[data-tab="inventory"]').click();await expect(page.locator('#relicItem')).toHaveValue('1');}
for(const width of [1280,390])opened(`relic elements ${width}px: preset fills a natural roll, exact bytes, reload, reject unnatural`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await expect(page.locator('#relicInfo')).toContainText('總靈氣原版範圍 5.6–7.7');await expect(page.locator('#relicInfo')).toContainText('目前數值可由原版生成');
 await page.locator('#relicPreset').selectOption('all');
 for(const [i,v]of [1.4,2.4,0.8,1.9,1.2].entries())await expect(inputs(page)[i]).toHaveValue(String(v));
 await expect(page.locator('#relicPreview')).toContainText('平均靈氣 1.1 → 1.5');await noOverflow(page);
 await page.locator('#relicApply').click();await expect(page.locator('#pendingCount')).toHaveText('6');
 const output=await download(page,site,f.expected([[1,5,18,1.4],[1,6,18,2.4],[1,7,18,0.8],[1,8,18,1.9],[1,9,18,1.2],[1,10,18,1.5]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await open(page);await expect(inputs(page)[1]).toHaveValue('2.4');await expect(page.locator('#relicInfo')).toContainText('目前平均 1.5');await expect(page.locator('#relicInfo')).toContainText('目前數值可由原版生成');
 for(const input of inputs(page))await input.fill('1.3');
 await expect(page.locator('#relicPreview')).toContainText('無法由原版生成');await expect(page.locator('#relicApply')).toBeDisabled();await expect(page.locator('#pendingCount')).toHaveText('0');
});
closed('closed relic gate previews but keeps Apply disabled',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await page.locator('#relicPreset').selectOption('1');await expect(page.locator('#relicPreview')).toContainText('尚待隔離遊戲驗證');await expect(page.locator('#relicApply')).toBeDisabled();
});
