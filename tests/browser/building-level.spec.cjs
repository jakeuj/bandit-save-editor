'use strict';
const {navigate} = require('./actions.cjs');
// Building levels. Runs on disposable candidate builds (gate opened or closed, proof gate removed) so the same spec keeps
// covering both states; it is browser behaviour only, not the isolated game smoke that opens the repository gate.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,download,noOverflow}=require('./actions.cjs');
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:['buildingLevel']});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:['buildingLevel']}});try{await use(site);}finally{await site.close();}}});
// 聚義堂 Lv 1 with 主堂技術 150 (cap 2), 書院 Lv 1 with 研究技術 239 (cap 4), 營房 under construction.
function fixture(){const {data}=saveFixture({characters:1});
 [[1,1,1],[2,5,1],[3,2,0]].forEach(([x,t,l])=>{data[x][0][1]=x;data[x][1][1]=t;data[x][5][1]=l;});data[3][4][1]=300;data[31][4][0]=150;data[40][4][0]=239;
 return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};}
async function open(page){await navigate(page, 'settlement');await expect(page.locator('#buildingInfo')).toContainText('3 座建築 · 2 座可升階');}
for(const width of [1280,390])opened(`building levels ${width}px: raise 書院 to the tech cap, exact bytes, reload`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await expect(page.locator('#buildingPick option')).toHaveCount(3);
 await page.locator('#buildingPick').selectOption('3');await expect(page.locator('#buildingPreview')).toContainText('施工中');await expect(page.locator('#buildingApply')).toBeDisabled();
 await page.locator('#buildingPick').selectOption('2');await page.locator('#buildingMax').click();
 await expect(page.locator('#buildingPreview')).toContainText('書院 #2 Lv 1（中級） → 4（大師）');await noOverflow(page);
 await page.locator('#buildingApply').click();await expect(page.locator('#pendingCount')).toHaveText('1');
 const output=await download(page,site,f.expected([[2,5,1,4]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await navigate(page, 'settlement');await expect(page.locator('#buildingInfo')).toContainText('3 座建築 · 1 座可升階');
 await page.locator('#buildingPick').selectOption('2');await expect(page.locator('#buildingPreview')).toContainText('已是最高等級');
});
closed('closed building level gate previews but keeps Apply disabled',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await expect(page.locator('#buildingPreview')).toContainText('尚待隔離遊戲驗證');await expect(page.locator('#buildingApply')).toBeDisabled();
});
