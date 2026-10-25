'use strict';
const {navigate} = require('./actions.cjs');
// Affix coefficient over the native range: the affix panel's over-limit row sends 10–1000 to the named entry.
// Runs on disposable candidate builds (gate opened or closed, proof gate removed); browser behaviour only.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,download,noOverflow}=require('./actions.cjs');
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:['equipmentAffixCoefficientAdvanced']});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:['equipmentAffixCoefficientAdvanced']}});try{await use(site);}finally{await site.close();}}});
// One unworn ordinary quality-2 勇武頭巾 at row 20 in z9 and z7 (range 10–80), slot 1 already washed.
function fixture(){const {data}=saveFixture({characters:2}),row=Array(60).fill(0);Object.assign(row,{0:20,1:16,2:1,3:1,5:2,6:3,8:125,9:12,15:20,24:1,28:1});for(const z of [7,9])row.forEach((v,y)=>data[20][y][z]=v);return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};}
async function select(page,plane){await navigate(page, 'inventory');await page.locator('#inventoryPlane').selectOption(String(plane));await page.locator('#affixItem').selectOption(`${plane}:20`);}
async function apply(page,value){await page.locator('#affixOverValue').fill(String(value));await page.locator('#affixOverApply').click();}
for(const width of [1280,390])opened(`affix over-limit ${width}px: 1000.01 refused, 1000 applied, exact bytes, reload and lower again`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);
 await select(page,9);await expect(page.locator('#affixOverInfo')).toContainText('超限範圍 10–1000（原版上限 80）');await expect(page.locator('#affixOverApply')).toBeDisabled();await noOverflow(page);
 await page.locator('#affixOverValue').fill('1000.01');await expect(page.locator('#affixOverInfo')).toContainText('10–1000，最多兩位小數');await expect(page.locator('#affixOverApply')).toBeDisabled();
 await apply(page,1000);await expect(page.locator('#pendingCount')).toHaveText('1');
 await select(page,7);await apply(page,250.5);await expect(page.locator('#pendingCount')).toHaveText('2');
 const output=await download(page,site,f.expected([[20,15,9,1000],[20,15,7,250.5]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await select(page,9);await expect(page.locator('#affixOverInfo')).toContainText('目前 1000');await expect(page.locator('#affixInfo')).toContainText('已超限');await expect(page.locator('#pendingCount')).toHaveText('0');
 await apply(page,50);await expect(page.locator('#pendingCount')).toHaveText('1');await expect(page.locator('#affixInfo')).toContainText('目前 50');
});
closed('affix over-limit stays disabled while the flag is closed',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await select(page,9);
 await expect(page.locator('#affixOverInfo')).toContainText('尚未完成隔離遊戲冒煙');await page.locator('#affixOverValue').fill('500');
 await expect(page.locator('#affixOverApply')).toBeDisabled();await expect(page.locator('#pendingCount')).toHaveText('0');
});
