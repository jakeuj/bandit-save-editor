'use strict';
// Relics placed on a 置物台. Runs on disposable candidate builds (gate opened or closed, proof gate removed) so the same spec
// keeps covering both states; it is browser behaviour only, not the isolated game smoke that opens the repository gate.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,download,noOverflow}=require('./actions.cjs');
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:['placedRelicAttributes']});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:['placedRelicAttributes']}});try{await use(site);}finally{await site.close();}}});
// 置物台 #5 at Lv 2 holds z19 row 2, the same natural 妖狐靈火 roll as the backpack spec; no backpack relic.
function fixture(){const {data}=saveFixture({characters:2});
 [[0,5],[1,67],[2,10020],[3,10004],[5,2],[9,2]].forEach(([y,v])=>data[5][y][1]=v);
 [7,1,2,1,1,1.2,1.6,0.4,1.6,0.9,1.1,0,5,0].forEach((v,y)=>data[2][y][19]=v);
 return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};}
const inputs=page=>[0,1,2,3,4].map(i=>page.locator('#relicValue'+i));
async function open(page){await page.locator('[data-tab="inventory"]').click();await expect(page.locator('#relicItem')).toHaveValue('p2');}
for(const width of [1280,390])opened(`placed relic ${width}px: preset, tile aura preview, exact bytes, reload, reject unnatural`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await expect(page.locator('#relicInfo')).toContainText('置物台 #5（Lv 2）');await expect(page.locator('#relicInfo')).toContainText('總靈氣原版範圍 5.6–7.7');
 await page.locator('#relicPreset').selectOption('all');
 for(const [i,v]of [1.4,2.4,0.8,1.9,1.2].entries())await expect(inputs(page)[i]).toHaveValue(String(v));
 await expect(page.locator('#relicPreview')).toContainText('平均靈氣 1.1 → 1.5');await expect(page.locator('#relicPreview')).toContainText('木 2.1 → 3.1');await expect(page.locator('#relicPreview')).toContainText('環境靈氣 1.4 → 2');await noOverflow(page);
 await page.locator('#relicApply').click();await expect(page.locator('#pendingCount')).toHaveText('6');
 const output=await download(page,site,f.expected([[2,5,19,1.4],[2,6,19,2.4],[2,7,19,0.8],[2,8,19,1.9],[2,9,19,1.2],[2,10,19,1.5]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await open(page);await expect(inputs(page)[1]).toHaveValue('2.4');await expect(page.locator('#relicInfo')).toContainText('目前數值可由原版生成');
 for(const input of inputs(page))await input.fill('1.3');
 await expect(page.locator('#relicPreview')).toContainText('無法由原版生成');await expect(page.locator('#relicApply')).toBeDisabled();await expect(page.locator('#pendingCount')).toHaveText('0');
});
closed('closed placed relic gate previews but keeps Apply disabled',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await page.locator('#relicPreset').selectOption('1');await expect(page.locator('#relicPreview')).toContainText('尚待隔離遊戲驗證');await expect(page.locator('#relicApply')).toBeDisabled();
});
