'use strict';
const {navigate} = require('./actions.cjs');
const path=require('node:path'),{test,expect}=require('./fixtures.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,download,noOverflow}=require('./actions.cjs');
// One ordinary quality-2 backpack item at row 20 (normal cap 15); the same row in z9 stays untouched.
function fixture(){const {data}=saveFixture({characters:2}),row=Array(60).fill(0);Object.assign(row,{0:20,1:16,2:1,3:1,5:2,6:3,8:125,9:12,15:20,24:1});for(const z of [7,9])row.forEach((v,y)=>data[20][y][z]=v);return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};}
async function select(page){await navigate(page, 'inventory');await page.locator('#inventoryPlane').selectOption('7');await page.locator('[data-edit-target="equipment"]').selectOption('7:20');}
async function apply(page,value,advanced){await select(page);const mode=page.locator('[data-edit-mode="equipment"]');await expect(mode).toBeEnabled();if(advanced)await mode.check();else await mode.uncheck();await page.locator('[data-edit-value="equipment"]').fill(String(value));await page.locator('[data-edit-apply="equipment"]').click();}
for(const width of [1280,390])test(`backpack over-limit level ${width}px: advanced apply, exact bytes, reload and lower again`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);
 await select(page);await expect(page.locator('#equipmentEditor')).toContainText('進階驗證上限 1,000');await expect(page.locator('#equipmentEditor')).not.toContainText('背包僅一般模式');
 await apply(page,1000,true);await expect(page.locator('#pendingCount')).toHaveText('1');await noOverflow(page);
 const output=await download(page,site,f.expected([[20,6,7,1000]]));await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await select(page);await expect(page.locator('[data-edit-value="equipment"]')).toHaveValue('1000');await expect(page.locator('#pendingCount')).toHaveText('0');
 await apply(page,15,false);await expect(page.locator('#pendingCount')).toHaveText('1');await select(page);await expect(page.locator('[data-edit-value="equipment"]')).toHaveValue('15');
});
