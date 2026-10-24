'use strict';
// Recruitment technology #33 over 299: the advanced technology panel sends 300–599 to the named over-limit entry.
// Runs on disposable candidate builds (gate opened or closed, proof gate removed); browser behaviour only.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,download,noOverflow}=require('./actions.cjs');
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:['recruitTechnologyAdvanced']});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:['recruitTechnologyAdvanced']}});try{await use(site);}finally{await site.close();}}});
function fixture(){
 const {data}=saveFixture({characters:1});
 for(let id=31;id<=44;id++)data[id][4][0]=1;
 data[1][17][0]=120;
 return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};
}
const value=page=>page.locator('[data-edit-value="technology"]'),apply=page=>page.locator('[data-edit-apply="technology"]');
async function open(page){
 await page.locator('[data-tab="settlement"]').click();
 await page.locator('[data-edit-target="technology"]').selectOption('33');
 await page.locator('[data-edit-mode="technology"]').check();
}
for(const width of [1280,390])opened(`recruit technology ${width}px: 600 refused, 599 applied, exact bytes, reload`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await expect(page.locator('[data-recruit-overlimit]')).toContainText('可填到 599');await expect(page.locator('[data-recruit-overlimit]')).toContainText('目前 599 秒');
 await expect(value(page)).toHaveAttribute('max','599');await expect(apply(page)).toBeEnabled();await noOverflow(page);
 await value(page).fill('600');await apply(page).click();await expect(page.locator('#pendingCount')).toHaveText('0');
 await value(page).fill('599');await apply(page).click();await expect(page.locator('#pendingCount')).toHaveText('1');
 await expect(page.locator('[data-recruit-overlimit]')).toContainText('目前 1 秒');
 const output=await download(page,site,f.expected([[33,4,0,599]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await open(page);await expect(page.locator('[data-recruit-overlimit]')).toContainText('目前 1 秒');await expect(page.locator('#pendingCount')).toHaveText('0');
});
closed('recruit technology over 299 stays disabled while the flag is closed',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await expect(page.locator('[data-recruit-overlimit]')).toContainText('尚待隔離遊戲冒煙');await expect(value(page)).toHaveAttribute('max','299');
 await value(page).fill('400');await apply(page).click();await expect(page.locator('#pendingCount')).toHaveText('0');
});
