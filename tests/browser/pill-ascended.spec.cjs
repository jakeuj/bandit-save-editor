'use strict';
// Ascended pills: the pill editor reads the 結丹 record (y50, z16 pairs, z17 y15) for the cap multiplier and writes only B.
const path=require('node:path'),{test,expect}=require('./fixtures.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,selectCharacter,download,noOverflow}=require('./actions.cjs');
// Character 1 (raw 30/30/30) ascended twice: q3 → 0.8 in z17 row 100, q5 → 1.68 in row 101, so M = 3.98 and C = 11.94.
function fixture(){
 const {data}=saveFixture({characters:2});
 data[1][50][2]=2;[[3,100,0.8,52],[5,101,1.68,53]].forEach(([q,row,coefficient,template],i)=>{
  data[1][2*i+1][16]=q;data[1][2*i+2][16]=row;const r=data[row];
  [[0,row],[1,template],[3,1],[5,q],[6,1],[7,1],[8,100],[9,107],[10,108],[11,109],[15,coefficient],[16,coefficient],[17,coefficient]].forEach(([y,v])=>r[y][17]=v);
 });
 data[64][6][0]=5;
 return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};
}
async function open(page){await selectCharacter(page,1);await page.locator('#pillAptitude').selectOption('1');await page.locator('#pillType').selectOption('64');}
for(const width of [1280,390])test(`ascended pill cap ${width}px: multiplier shown, endpoint applied, exact bytes, reload`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await open(page);
 await expect(page.locator('#pillInfo')).toContainText('角色上限 11.94（結丹 2 次，倍率 3.98）');await expect(page.locator('#pillInfo')).toContainText('可填 0–89.4');
 await noOverflow(page);
 await page.locator('#pillValue').fill('89.5');await page.locator('#pillApply').click();await expect(page.locator('#pendingCount')).toHaveText('0');
 await page.locator('#pillValue').fill('89.4');await page.locator('#pillApply').click();await expect(page.locator('#pendingCount')).toHaveText('1');
 const output=await download(page,site,f.expected([[1,13,2,89.4]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await open(page);await expect(page.locator('#pillInfo')).toContainText('目前累積 89.4（總資質 11.94）');await expect(page.locator('#pendingCount')).toHaveText('0');
});
