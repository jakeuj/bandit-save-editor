'use strict';
const {navigate} = require('./actions.cjs');
// Candidate UI for treasure levels. Runs on a disposable candidate build (flags opened, proof gate removed): this proves
// the browser behaviour only. It is not first-proof evidence and never opens a group in the repository.
const path=require('node:path'),{pathToFileURL}=require('node:url'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,download,noOverflow}=require('./actions.cjs');
const catalog=require('../../knowledge/catalog.json'),templates=Object.keys(catalog.treasureLevel.items).filter(id=>catalog.treasureLevel.items[id].tier===1).map(Number);
const open=['backpackTreasureLevel','treasureLevel'];
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:open});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:open}});try{await use(site);}finally{await site.close();}}});
function fixture({invalid=false}={}){
 const {data}=saveFixture({characters:2}),row=Array(60).fill(0);
 Object.assign(row,{0:5,1:templates[0],2:1,3:1,5:3,6:5,8:100,22:0});
 for(const z of [7,9])row.forEach((v,y)=>data[20][y][z]=v);
 if(invalid){const bad=row.slice();bad[1]=templates[1];bad[6]=99;bad.forEach((v,y)=>data[21][y][7]=v);}
 return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};
}
async function select(page,plane,id=20){await navigate(page, 'inventory');await page.locator('#inventoryPlane').selectOption(String(plane));await page.locator('[data-edit-target="equipment"]').selectOption(plane+':'+id);}
async function edit(page,plane,value){await select(page,plane);await expect(page.locator('[data-edit-mode="equipment"]')).toBeDisabled();await page.locator('[data-edit-value="equipment"]').fill(String(value));await expect(page.locator('[data-treasure-level-preview]')).toContainText('→ '+value);await page.locator('[data-edit-apply="equipment"]').click();}

closed('treasure levels without a first proof are inspectable but disabled and write nothing',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);
 for(const plane of [7,9]){await select(page,plane);await expect(page.locator('#equipmentEditor')).toContainText('寶物僅一般模式');await expect(page.locator('#equipmentEditor')).toContainText('寶物等級尚待首次獨立證明，目前停用');await expect(page.locator('[data-edit-apply="equipment"]')).toBeDisabled();await expect(page.locator('[data-edit-mode="equipment"]')).toBeDisabled();}
 await expect(page.locator('#pendingCount')).toHaveText('0');
});
for(const width of [1280,390])opened(`treasure levels ${width}px: separate planes, preview, undo, exact bytes and reload`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture({invalid:true});await page.goto(site.url);await loadRaw(page,site,f.raw);
 await select(page,7);await expect(page.locator('#equipmentEditor')).toContainText('一般上限 20');await expect(page.locator('#equipmentEditor')).toContainText('等階 T1 · 品質 Q3 · 歸屬 無');
 await page.locator('[data-edit-value="equipment"]').fill('21');await expect(page.locator('[data-edit-apply="equipment"]')).toBeDisabled();await expect(page.locator('[data-treasure-level-preview]')).toContainText('1–20');
 await edit(page,7,4);await edit(page,9,2);await expect(page.locator('#pendingCount')).toHaveText('2');
 await page.locator('#undoBtn').click();await expect(page.locator('#pendingCount')).toHaveText('1');await edit(page,9,2);await noOverflow(page);
 // A treasure the editor cannot prove safe shows why and offers no write.
 await select(page,7,21);await expect(page.locator('#equipmentEditor')).toContainText('寶物等級：只支援原版等級，超限停用');await expect(page.locator('[data-edit-apply="equipment"]')).toBeDisabled();
 const output=await download(page,site,f.expected([[20,6,7,4],[20,6,9,2]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await select(page,7);await expect(page.locator('[data-edit-value="equipment"]')).toHaveValue('4');await select(page,9);await expect(page.locator('[data-edit-value="equipment"]')).toHaveValue('2');await expect(page.locator('#pendingCount')).toHaveText('0');
});
opened('treasure levels file: standalone download and restore',async({page,site})=>{
 const f=fixture();await page.goto(pathToFileURL(path.join(site.dir,'index.html')).href);await loadRaw(page,site,f.raw);
 await edit(page,7,4);await page.locator('#reviewBtn').click();await page.locator('[data-restore="20,6,7"]').click();await expect(page.locator('#pendingCount')).toHaveText('0');await page.keyboard.press('Escape');
 await edit(page,9,4);const output=await download(page,site,f.expected([[20,6,9,4]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await select(page,9);await expect(page.locator('[data-edit-value="equipment"]')).toHaveValue('4');
});
opened('treasure levels PWA: offline export and pending update handoff',async({page,context,site})=>{
 const f=fixture();await page.goto(site.url);await expect(page.locator('#pwaStatus')).toHaveText('可離線使用');await page.reload();
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await context.setOffline(true);await page.reload();await loadRaw(page,site,f.raw);await edit(page,7,4);await download(page,site,f.expected([[20,6,7,4]]));await context.setOffline(false);
 await edit(page,9,2);await site.upgrade();await page.evaluate(async()=>(await navigator.serviceWorker.getRegistration()).update());
 await expect(page.locator('#pwaStatus')).toContainText('新版已備妥');await expect(page.locator('[data-edit-value="equipment"]')).toHaveValue('2');
 await download(page,site,f.expected([[20,6,7,4],[20,6,9,2]]));await page.close();
 const next=await context.newPage();await next.goto(site.url);await expect(next.locator('html')).toHaveAttribute('data-test-release','next');await loadRaw(next,site,f.raw);await edit(next,9,4);await download(next,site,f.expected([[20,6,9,4]]));
});
