'use strict';
const {navigate} = require('./actions.cjs');
const path=require('node:path'),{pathToFileURL}=require('node:url'),{test,expect}=require('./fixtures.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,download,noOverflow}=require('./actions.cjs');
const catalog=require('../../knowledge/catalog.json'),P原=catalog.setEquipmentLevel.origins[2].affixIds;
// Same Q3 set item in both planes; expected bytes follow the spec formulas (main +30ΔQ, kept subs +10ΔQ, removed tails zeroed).
function fixture(){const {data}=saveFixture({characters:2}),row=Array(60).fill(0);Object.assign(row,{0:5,1:28,2:1,3:1,5:3,6:3,8:155,9:P原[0],10:P原[1],15:60,16:60,23:3,24:1,26:1.7,27:2});for(const z of [7,9])row.forEach((v,y)=>data[20][y][z]=v);return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};}
const up9=[[20,5,9,4],[20,8,9,185],[20,15,9,70],[20,16,9,70],[20,11,9,P原[5]],[20,17,9,55]],down7=[[20,5,7,2],[20,8,7,125],[20,15,7,50],[20,10,7,0],[20,16,7,0]];
async function select(page,plane){await navigate(page, 'inventory');await page.locator('#inventoryPlane').selectOption(String(plane));await page.locator('#setQualityItem').selectOption(plane+':20');}
async function upgrade(page){await select(page,9);await expect(page.locator('#setQualityInfo')).toContainText('升品 已驗證');await page.locator('#setQualityTarget').selectOption('4');await page.locator('#setQualityAffix3').selectOption(String(P原[5]));await page.locator('#setQualityCoefficient3').fill('55');await expect(page.locator('#setQualityPreview')).toContainText('主係數 155 → 185');await page.locator('#setQualityApply').click();}
async function downgrade(page){await select(page,7);await page.locator('#setQualityTarget').selectOption('2');await expect(page.locator('#setQualityApply')).toBeDisabled();await page.locator('#setQualityRemoval').check();await page.locator('#setQualityApply').click();}
async function reload(page,output){await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');}
for(const width of [1280,390])test(`set quality ${width}px: upgrade, confirmed downgrade, undo, exact bytes and reload`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);
 await upgrade(page);await downgrade(page);await expect(page.locator('#pendingCount')).not.toHaveText('0');
 await page.locator('#undoBtn').click();await downgrade(page);await noOverflow(page);
 const output=await download(page,site,f.expected([...up9,...down7]));await reload(page,output);
 await select(page,9);await expect(page.locator('#setQualityInfo')).toContainText('目前品質 4');await select(page,7);await expect(page.locator('#setQualityInfo')).toContainText('目前品質 2');await expect(page.locator('#pendingCount')).toHaveText('0');
});
test('set quality file: standalone apply and download',async({page,site})=>{const f=fixture();await page.goto(pathToFileURL(path.join(site.dir,'index.html')).href);await loadRaw(page,site,f.raw);await upgrade(page);const output=await download(page,site,f.expected(up9));await reload(page,output);await select(page,9);await expect(page.locator('#setQualityInfo')).toContainText('目前品質 4');});
test('set quality PWA: offline apply and download',async({page,context,site})=>{const f=fixture();await page.goto(site.url);await expect(page.locator('#pwaStatus')).toHaveText('可離線使用');await page.reload();await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);await context.setOffline(true);await page.reload();await loadRaw(page,site,f.raw);await downgrade(page);await download(page,site,f.expected(down7));await context.setOffline(false);});
