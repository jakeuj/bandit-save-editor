'use strict';
// Inner pill levels in the equipment-level panel. Runs on disposable candidate builds (gates opened or closed, proof gate
// removed); browser behaviour only, not the isolated game smoke that opens the repository gates.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,download,noOverflow}=require('./actions.cjs');
const catalog=require('../../knowledge/catalog.json'),inner=catalog.catalogs.items.filter(i=>i.kind==='内丹'&&catalog.batch2Data.items[i.id].tier===1);
const open=['backpackInnerPillLevel','innerPillLevel'];
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:open});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:open}});try{await use(site);}finally{await site.close();}}});
// Row 20: backpack pill Q3 Lv5; row 21: z9 pill Q2 Lv1 worn by character 1 (z2 y20).
function fixture(){
 const {data}=saveFixture({characters:2}),row=(template,q,level,owner)=>Object.assign(Array(60).fill(0),{1:template,2:1,3:1,5:q,6:level,7:owner,8:100,24:1});
 row(inner[0].id,3,5,0).forEach((v,y)=>data[20][y][7]=v);data[20][0][7]=20;
 row(inner[1].id,2,1,1).forEach((v,y)=>data[21][y][9]=v);data[21][0][9]=21;data[1][20][2]=21;
 return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};
}
async function select(page,plane,id){await page.locator('[data-tab="inventory"]').click();await page.locator('#inventoryPlane').selectOption(String(plane));await page.locator('[data-edit-target="equipment"]').selectOption(plane+':'+id);}
async function edit(page,plane,id,value){await select(page,plane,id);await expect(page.locator('[data-edit-mode="equipment"]')).toBeDisabled();await page.locator('[data-edit-value="equipment"]').fill(String(value));await expect(page.locator('[data-inner-pill-level-preview]')).toContainText('→ '+value);await page.locator('[data-edit-apply="equipment"]').click();}

closed('closed inner pill gates show the pill but keep Apply disabled',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);
 for(const [plane,id] of [[7,20],[9,21]]){await select(page,plane,id);await expect(page.locator('#equipmentEditor')).toContainText('內丹僅一般模式');await expect(page.locator('#equipmentEditor')).toContainText('內丹等級尚待隔離遊戲冒煙，目前停用');await expect(page.locator('[data-edit-apply="equipment"]')).toBeDisabled();}
 await expect(page.locator('#pendingCount')).toHaveText('0');
});
for(const width of [1280,390])opened(`inner pill levels ${width}px: both planes, range, undo, exact bytes and reload`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);
 await select(page,7,20);await expect(page.locator('#equipmentEditor')).toContainText('一般上限 20');await expect(page.locator('#equipmentEditor')).toContainText('等階 T1 · 品質 Q3');
 await page.locator('[data-edit-value="equipment"]').fill('21');await expect(page.locator('[data-edit-apply="equipment"]')).toBeDisabled();await expect(page.locator('[data-inner-pill-level-preview]')).toContainText('1–20');
 await select(page,9,21);await expect(page.locator('#equipmentEditor')).toContainText('品質 Q2 · 穿戴中');await expect(page.locator('#equipmentEditor')).toContainText('一般上限 15');
 await edit(page,7,20,20);await edit(page,9,21,15);await expect(page.locator('#pendingCount')).toHaveText('2');
 await page.locator('#undoBtn').click();await expect(page.locator('#pendingCount')).toHaveText('1');await edit(page,9,21,12);await noOverflow(page);
 const output=await download(page,site,f.expected([[20,6,7,20],[21,6,9,12]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await select(page,7,20);await expect(page.locator('[data-edit-value="equipment"]')).toHaveValue('20');await select(page,9,21);await expect(page.locator('[data-edit-value="equipment"]')).toHaveValue('12');await expect(page.locator('#pendingCount')).toHaveText('0');
});
