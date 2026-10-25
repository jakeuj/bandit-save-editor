'use strict';
const {navigate} = require('./actions.cjs');
// Sixth affix slot: the affix panel's sixth-slot row sends an attribute and 50–120 to the named entry, and clears it again.
// Runs on disposable candidate builds (gate opened or closed, proof gate removed); browser behaviour only.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,download,noOverflow}=require('./actions.cjs');
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:['equipmentSixthAffix']});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:['equipmentSixthAffix']}});try{await use(site);}finally{await site.close();}}});
// One unworn ordinary quality-6 勇武頭巾 at row 20 in z9 and z7 with slots 1–5 filled (12,13,17,18,19) and slot 1 washed; 20 is free.
function fixture(){const {data}=saveFixture({characters:2}),row=Array(60).fill(0);Object.assign(row,{0:20,1:16,2:1,3:1,5:6,6:3,8:245,9:12,10:13,11:17,12:18,13:19,15:60,16:61,17:62,18:63,19:64,24:1,28:1});for(const z of [7,9])row.forEach((v,y)=>data[20][y][z]=v);return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};}
async function select(page,plane){await navigate(page, 'inventory');await page.locator('#inventoryPlane').selectOption(String(plane));await page.locator('#affixItem').selectOption(`${plane}:20`);}
async function apply(page,id,value){await page.locator('#sixthTarget').selectOption(String(id));await page.locator('#sixthValue').fill(String(value));await page.locator('#sixthApply').click();}
for(const width of [1280,390])opened(`sixth affix ${width}px: duplicate and 120.01 refused, 100 applied, exact bytes, reload and clear`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);
 await select(page,9);await expect(page.locator('#sixthInfo')).toContainText('目前空白 · 範圍 50–120');await expect(page.locator('#sixthApply')).toBeDisabled();await noOverflow(page);
 await expect(page.locator('#sixthTarget option[value="13"]')).toBeDisabled();
 await page.locator('#sixthTarget').selectOption('20');await page.locator('#sixthValue').fill('120.01');await expect(page.locator('#sixthPreview')).toContainText('50–120，最多兩位小數');await expect(page.locator('#sixthApply')).toBeDisabled();
 await apply(page,20,100);await expect(page.locator('#pendingCount')).toHaveText('2');
 await select(page,7);await apply(page,20,50.5);await expect(page.locator('#pendingCount')).toHaveText('4');
 const output=await download(page,site,f.expected([[20,14,9,20],[20,20,9,100],[20,14,7,20],[20,20,7,50.5]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await select(page,9);await expect(page.locator('#sixthInfo')).toContainText('係數 100');await expect(page.locator('#affixInfo')).toContainText('第六槽');await expect(page.locator('#pendingCount')).toHaveText('0');
 await page.locator('#sixthClear').click();await expect(page.locator('#pendingCount')).toHaveText('2');await expect(page.locator('#sixthInfo')).toContainText('目前空白');
});
closed('sixth affix stays disabled while the flag is closed',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await select(page,9);
 await expect(page.locator('#sixthInfo')).toContainText('尚未完成隔離遊戲冒煙');await page.locator('#sixthValue').fill('100');
 await expect(page.locator('#sixthApply')).toBeDisabled();await expect(page.locator('#sixthClear')).toBeDisabled();await expect(page.locator('#pendingCount')).toHaveText('0');
});
