'use strict';
// Ascension quality. Runs on disposable candidate builds (gate opened or closed, proof gate removed) so the same spec keeps
// covering both states; it is browser behaviour only, not the isolated game smoke that opens the repository gate.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,selectCharacter,download,noOverflow}=require('./actions.cjs');
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:['ascensionQuality']});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:['ascensionQuality']}});try{await use(site);}finally{await site.close();}}});
// Character 1 (Q1, raw 30/30/30, talents 1 Lv2 / 4 / 12 Lv1, 力量 B 115) ascended twice: q3 0.8 and q5 1.68, M = 3.98,
// 力量 A 4, total 15.5, C 15.92.
function fixture(){
 const {data}=saveFixture({characters:2});
 data[1][50][2]=2;data[1][13][2]=115;
 [[1,1,2],[2,4,1],[3,12,1]].forEach(([slot,id,level])=>{data[1][slot][12]=id;data[1][20+slot][12]=level;});
 [[3,100,0.8,52],[5,101,1.68,53]].forEach(([q,row,coefficient,template],i)=>{
  data[1][2*i+1][16]=q;data[1][2*i+2][16]=row;const r=data[row];
  [[0,row],[1,template],[3,1],[5,q],[6,1],[7,1],[8,100],[9,107],[10,108],[11,109],[15,coefficient],[16,coefficient],[17,coefficient]].forEach(([y,v])=>r[y][17]=v);
 });
 return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};
}
for(const width of [1280,390])opened(`ascension quality ${width}px: raise, exact bytes, reload, block a lower cap`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await selectCharacter(page,1);
 await expect(page.locator('#ascensionQualityStatus')).toContainText('結丹 2 次 · 倍率 3.98');
 await expect(page.locator('#ascensionRound option')).toHaveCount(2);await expect(page.locator('#ascensionQuality')).toHaveValue('3');
 await page.locator('#ascensionQuality').selectOption('9');
 await expect(page.locator('#ascensionQualityPreview')).toContainText('品質 3 → 9');await expect(page.locator('#ascensionQualityPreview')).toContainText('係數 0.8 → 2');
 await expect(page.locator('#ascensionQualityPreview')).toContainText('倍率 3.98 → 5.18');await expect(page.locator('#ascensionQualityPreview')).toContainText('15.92 → 20.72');
 await noOverflow(page);
 await page.locator('#ascensionQualityApply').click();await expect(page.locator('#pendingCount')).toHaveText('4');
 const output=await download(page,site,f.expected([[1,1,16,9],[100,15,17,2],[100,16,17,2],[100,17,17,2]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await selectCharacter(page,1);await expect(page.locator('#ascensionQualityStatus')).toContainText('倍率 5.18');await expect(page.locator('#ascensionQuality')).toHaveValue('9');
 // q1 at k=1: 0.4, M 3.58, 力量 C 14.32 < 15.5.
 await page.locator('#ascensionQuality').selectOption('1');
 await expect(page.locator('#ascensionQualityPreview')).toContainText('超過新上限 14.32');await expect(page.locator('#ascensionQualityApply')).toBeDisabled();await expect(page.locator('#pendingCount')).toHaveText('0');
});
closed('closed ascension quality gate previews but keeps Apply disabled',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await selectCharacter(page,1);
 await expect(page.locator('#ascensionQualityStatus')).toContainText('尚待隔離遊戲驗證');
 await page.locator('#ascensionQuality').selectOption('9');await expect(page.locator('#ascensionQualityPreview')).toContainText('倍率 3.98 → 5.18');await expect(page.locator('#ascensionQualityApply')).toBeDisabled();
});
