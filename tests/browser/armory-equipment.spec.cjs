'use strict';
const {navigate} = require('./actions.cjs');
// Armory (z22): the 武庫 position lists armory rows and the backpack editors write them behind armoryEquipment.
// Runs on disposable candidate builds (gate opened or closed); browser behaviour only.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,download,noOverflow}=require('./actions.cjs');
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:['armoryEquipment']});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:['armoryEquipment']}});try{await use(site);}finally{await site.close();}}});
// One ordinary quality-2 item at row 20 (normal cap 15) in a 23-layer save, in z22 and as the same z7 row.
function fixture(){const {data}=saveFixture({characters:2,layers:23}),row=Array(60).fill(0);Object.assign(row,{0:20,1:16,2:1,3:1,5:2,6:3,8:125,9:12,15:20,24:1});for(const z of [7,22])row.forEach((v,y)=>data[20][y][z]=v);return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};}
async function select(page){await navigate(page, 'inventory');await page.locator('#inventoryPlane').selectOption('22');await page.locator('[data-edit-target="equipment"]').selectOption('22:20');}
async function apply(page,value){await select(page);await page.locator('[data-edit-value="equipment"]').fill(String(value));await page.locator('[data-edit-apply="equipment"]').click();}
for(const width of [1280,390])opened(`armory level ${width}px: 武庫 position, exact bytes, reload and lower again`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);
 await select(page);await expect(page.locator('[data-edit-target="equipment"] option:checked')).toContainText('武庫 #20');await expect(page.locator('#inventoryRows')).toContainText('武庫');
 await apply(page,15);await expect(page.locator('#pendingCount')).toHaveText('1');await noOverflow(page);
 const output=await download(page,site,f.expected([[20,6,22,15]]));await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await select(page);await expect(page.locator('[data-edit-value="equipment"]')).toHaveValue('15');await expect(page.locator('#pendingCount')).toHaveText('0');
 await apply(page,5);await expect(page.locator('#pendingCount')).toHaveText('1');await select(page);await expect(page.locator('[data-edit-value="equipment"]')).toHaveValue('5');
});
closed('armory editing stays disabled while the flag is closed',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await select(page);
 await page.locator('[data-edit-value="equipment"]').fill('10');await expect(page.locator('[data-edit-apply="equipment"]')).toBeDisabled();await expect(page.locator('#pendingCount')).toHaveText('0');
});
