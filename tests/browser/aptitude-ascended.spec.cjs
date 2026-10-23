'use strict';
// Ascended base aptitudes and talent levels: both editors read the 結丹 record for the cap multiplier like the pill editor.
const path=require('node:path'),{test,expect}=require('./fixtures.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,selectCharacter,download,noOverflow}=require('./actions.cjs');
// Character 1 (Q1, raw 30/30/30, talents 1 Lv2 / 4 / 12 Lv1, 力量 B 100) ascended twice: M = 3.98, 力量 A 4 → C 15.92.
function fixture(){
 const {data}=saveFixture({characters:2});
 data[1][50][2]=2;data[1][13][2]=100;
 [[1,1,2],[2,4,1],[3,12,1]].forEach(([slot,id,level])=>{data[1][slot][12]=id;data[1][20+slot][12]=level;});
 [[3,100,0.8,52],[5,101,1.68,53]].forEach(([q,row,coefficient,template],i)=>{
  data[1][2*i+1][16]=q;data[1][2*i+2][16]=row;const r=data[row];
  [[0,row],[1,template],[3,1],[5,q],[6,1],[7,1],[8,100],[9,107],[10,108],[11,109],[15,coefficient],[16,coefficient],[17,coefficient]].forEach(([y,v])=>r[y][17]=v);
 });
 return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};
}
for(const width of [1280,390])test(`ascended base aptitudes and talents ${width}px: multiplier shown, caps, exact bytes, reload`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await selectCharacter(page,1);
 await expect(page.locator('#baseAptitudeStatus')).toContainText('結丹 2 次，倍率 3.98');await expect(page.locator('#talentLevelsStatus')).toContainText('結丹 2 次，倍率 3.98');
 await noOverflow(page);
 // 力量 raw 31 → A 4.1, C 16.32; then talent 1 Lv1 → A 3.6, C 14.33, still above the total 13.6.
 await page.locator('#baseAptitude0').fill('31');await page.locator('#baseAptitudePreviewBtn').click();
 await expect(page.locator('#baseAptitudePreview')).toContainText('15.92 → 16.32');await page.locator('#baseAptitudeApplyBtn').click();
 await expect(page.locator('#pendingCount')).toHaveText('1');
 await page.locator('#talentLevel1').selectOption('1');await page.locator('#talentLevelsPreviewBtn').click();
 await expect(page.locator('#talentLevelsPreview')).toContainText('16.32 → 14.33');await page.locator('#talentLevelsApplyBtn').click();
 await expect(page.locator('#pendingCount')).toHaveText('2');
 const output=await download(page,site,f.expected([[1,10,2,31],[1,21,12,1]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 await selectCharacter(page,1);await expect(page.locator('#baseAptitude0')).toHaveValue('31');await expect(page.locator('#talentLevel1')).toHaveValue('1');await expect(page.locator('#pendingCount')).toHaveText('0');
});
