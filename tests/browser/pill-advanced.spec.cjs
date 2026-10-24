'use strict';
// Over-cap pills: the pill editor's 超限模式 writes an integer B up to 1000 without a held pill, for characters without a
// 結丹 record. Runs on disposable candidate builds (gate opened or closed, proof gate removed); browser behaviour only.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,selectCharacter,download,noOverflow}=require('./actions.cjs');
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:['pillAptitudeBonusAdvanced']});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:['pillAptitudeBonusAdvanced']}});try{await use(site);}finally{await site.close();}}});
// Character 1 (raw 30/30/30, A=3, C=4.5) holds no pill; character 2 is ascended once and stays out of over-cap mode.
function fixture(){
 const {data}=saveFixture({characters:2});
 data[2][50][2]=1;data[2][1][16]=3;data[2][2][16]=100;
 [[0,100],[1,52],[3,1],[5,3],[6,1],[7,2],[8,100],[9,107],[10,108],[11,109],[15,0.8],[16,0.8],[17,0.8]].forEach(([y,v])=>data[100][y][17]=v);
 return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};
}
async function open(page,id=1){await selectCharacter(page,id);await page.locator('#pillAptitude').selectOption('2');await page.locator('#pillAdvanced').check();}
for(const width of [1280,390])opened(`over-cap pill ${width}px: no pill needed, 1001 refused, 1000 applied, exact bytes, reload`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await expect(page.locator('#pillType')).toBeHidden();
 await expect(page.locator('#pillInfo')).toContainText('角色上限 4.5（一般可填到 15）');await expect(page.locator('#pillInfo')).toContainText('可填 0–1000');
 await expect(page.locator('#pillApply')).toBeEnabled();await noOverflow(page);
 await page.locator('#pillValue').fill('1001');await page.locator('#pillApply').click();await expect(page.locator('#pendingCount')).toHaveText('0');
 await page.locator('#pillValue').fill('1000');await page.locator('#pillApply').click();await expect(page.locator('#pendingCount')).toHaveText('1');
 await expect(page.locator('#pillInfo')).toContainText('目前累積 1000（總資質 103）');await expect(page.locator('#pillInfo')).toContainText('已超過角色上限');
 const output=await download(page,site,f.expected([[1,14,2,1000]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await open(page);await expect(page.locator('#pillInfo')).toContainText('目前累積 1000（總資質 103）');await expect(page.locator('#pendingCount')).toHaveText('0');
});
opened('over-cap pill rejects an ascended character',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page,2);
 await expect(page.locator('#pillInfo')).toContainText('無結丹');await expect(page.locator('#pillApply')).toBeDisabled();
});
closed('over-cap pill stays disabled while the flag is closed',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await expect(page.locator('#pillInfo')).toContainText('尚待隔離驗證');await expect(page.locator('#pillApply')).toBeDisabled();
});
