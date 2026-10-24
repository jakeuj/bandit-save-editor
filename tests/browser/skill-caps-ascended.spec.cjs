'use strict';
// Ascended skill caps. Runs on disposable candidate builds (flag opened or closed, proof gate removed) so the same spec covers
// the UI before and after the smoke record opens the flag.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,selectCharacter,download,noOverflow}=require('./actions.cjs');
const flag='randomCharacterSkillCapsAscended';
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:[flag]});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:[flag]}});try{await use(site);}finally{await site.close();}}});
// Character 1 (Q1, raw 30/30/30, talents 1–3 Lv1, caps 28/20/10×7) ascended twice through z17 rows 100/101.
function fixture(){
 const {data}=saveFixture({characters:2});
 [28,20,10,10,10,10,10,10,10].forEach((cap,i)=>{data[1][22+i][2]=cap;});
 for(let i=0;i<3;i++){data[1][1+i][12]=i+1;data[1][21+i][12]=1;}
 data[1][50][2]=2;
 [[3,100,0.8,52],[5,101,1.68,53]].forEach(([q,row,coefficient,template],i)=>{
  data[1][2*i+1][16]=q;data[1][2*i+2][16]=row;const r=data[row];
  [[0,row],[1,template],[3,1],[5,q],[6,1],[7,1],[8,100],[9,107],[10,108],[11,109],[15,coefficient],[16,coefficient],[17,coefficient]].forEach(([y,v])=>r[y][17]=v);
 });
 return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};
}
const target=[38,27,14,4,10,10,10,10,10];
for(const width of [1280,390])opened(`ascended skill caps ${width}px: record shown, raise and lower, exact bytes, reload`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await selectCharacter(page,1);
 await expect(page.locator('#skillCapsStatus')).toContainText('結丹 2 次');await noOverflow(page);
 for(let i=0;i<9;i++)await page.locator('#skillCap'+(i+1)).fill(String(target[i]));
 await page.locator('#skillCapsPreviewBtn').click();await expect(page.locator('#skillCapsPreview tbody tr')).toHaveCount(9);
 await page.locator('#skillCapsApplyBtn').click();await expect(page.locator('#pendingCount')).toHaveText('4');
 const output=await download(page,site,f.expected([[1,22,2,38],[1,23,2,27],[1,24,2,14],[1,25,2,4]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await selectCharacter(page,1);await expect(page.locator('#skillCap1')).toHaveValue('38');await expect(page.locator('#skillCap4')).toHaveValue('4');await expect(page.locator('#pendingCount')).toHaveText('0');
});
closed('ascended skill caps stay read only while the flag is closed',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await selectCharacter(page,1);
 await expect(page.locator('#skillCapsStatus')).toContainText('無結丹');await expect(page.locator('#skillCapsPreviewBtn')).toBeDisabled();
});
