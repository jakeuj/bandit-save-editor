'use strict';
// Candidate flags exercise UI paths before native validation; these disposable builds are never release artifacts.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs');
const {saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,selectCharacter,download,noOverflow}=require('./actions.cjs');
const flags=['randomCharacterSkillCapsInitial','randomCharacterSkillCapsAdvanced'];
const released=flags.every(flag=>require('../../knowledge/catalog.json').verification[flag]===true);
const opened=base.extend({site:async({},use)=>{const site=await createSite(released?{}:{candidate:flags});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:flags}});try{await use(site);}finally{await site.close();}}});
const initial=[15,23,4,28,1,4,10,37,1];
function fixture(mutate){
 const {data}=saveFixture({size:2501,characters:2});
 for(let id=1;id<=2;id++){
  initial.forEach((v,i)=>data[id][22+i][2]=v);
  for(let i=0;i<3;i++){data[id][1+i][12]=i+1;data[id][21+i][12]=1;}
 }
 mutate?.(data);
 return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};
}
async function preview(page,values){for(let i=0;i<9;i++)await page.locator('#skillCap'+(i+1)).fill(String(values[i]));await page.locator('#skillCapsPreviewBtn').click();}
for(const width of [1280,390])opened(`skill caps modes ${width}px: initial source, advanced preview, exact download and reload`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await selectCharacter(page,1);
 await expect(page.locator('#skillCapsAdvanced')).not.toBeChecked();await expect(page.locator('#skillCapsStatus')).toContainText('初始角色');
 await expect(page.locator('#skillCapsFill100Btn')).toBeHidden();
 await preview(page,[16,...initial.slice(1)]);await expect(page.locator('#skillCapsPreview')).toContainText('初始角色');await expect(page.locator('#skillCapsApplyBtn')).toBeEnabled();
 await page.locator('#skillCapsAdvanced').check();await expect(page.locator('#skillCap1')).toHaveValue('16');await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();
 await expect(page.locator('#skillCapsPreview tbody tr')).toHaveCount(0);
 await page.locator('#skillCap1').fill('90');await page.locator('#skillCap9').fill('');
 await page.locator('#skillCapsAdvanced').uncheck();await expect(page.locator('#skillCap1')).toHaveValue('90');await expect(page.locator('#skillCap9')).toHaveValue('');await expect(page.locator('#skillCapsFill100Btn')).toBeHidden();
 await page.locator('#skillCapsAdvanced').check();await expect(page.locator('#skillCap1')).toHaveValue('90');await expect(page.locator('#skillCap9')).toHaveValue('');
 await preview(page,Array(9).fill(101));await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();await expect(page.locator('#skillCapsPreview')).toContainText('1–100');
 await preview(page,Array(9).fill(99));await expect(page.locator('#skillCapsApplyBtn')).toBeEnabled();
 await page.locator('#skillCapsFill100Btn').click();for(let i=1;i<=9;i++)await expect(page.locator('#skillCap'+i)).toHaveValue('100');
 await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();await expect(page.locator('#skillCapsPreview tbody tr')).toHaveCount(0);await expect(page.locator('#pendingCount')).toHaveText('0');
 await page.locator('#skillCapsPreviewBtn').click();await expect(page.locator('#skillCapsPreview tbody tr')).toHaveCount(9);await expect(page.locator('#skillCapsPreview')).toContainText('九項獨立設定');
 await page.locator('#skillCapsApplyBtn').click();await expect(page.locator('#pendingCount')).toHaveText('9');await expect(page.locator('#skillCapsAdvanced')).toBeChecked();await noOverflow(page);
 const output=await download(page,site,f.expected(initial.map((_,i)=>[1,22+i,2,100])));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');await selectCharacter(page,1);
 await expect(page.locator('#skillCapsAdvanced')).not.toBeChecked();await expect(page.locator('#skillCapsPreviewBtn')).toBeDisabled();
 await page.locator('#skillCapsAdvanced').check();await expect(page.locator('#skillCap9')).toHaveValue('100');await expect(page.locator('#pendingCount')).toHaveText('0');
 await selectCharacter(page,2);await expect(page.locator('#skillCapsAdvanced')).not.toBeChecked();
});
for(const width of [1280,390])opened(`skill caps lowering ${width}px: per-input reasons, correction, exact download and reload in both modes`,async({page,site})=>{
 await page.setViewportSize({width,height:844});await page.goto(site.url);
 const f=fixture(data=>{data[1][31][2]=14;data[1][40][2]=0.5;data[1][32][2]=22;data[1][41][2]=2.25;data[1][33][2]=4;data[1][42][2]=0.5;data[1][34][2]=27;});
 for(const advanced of [false,true]){
  await loadRaw(page,site,f.raw,`lowering-${advanced?'advanced':'normal'}.dat`);await selectCharacter(page,1);
  if(advanced)await page.locator('#skillCapsAdvanced').check();
  await preview(page,[13,22,4,27,...initial.slice(4)]);
  await expect(page.locator('#skillCapsPreview li')).toHaveCount(2);await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();await expect(page.locator('#pendingCount')).toHaveText('0');
  await expect(page.locator('#skillCapReason1')).toHaveText('伐木目標上限 13 不得低於目前等級 14；請提高上限。');
  await expect(page.locator('#skillCapReason2')).toHaveText('採礦目標上限 22 等於目前等級 22，下調時仍有經驗餘額 2.25；不自動清零，請設為 23 以上。');
  await expect(page.locator('#skillCap1')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#skillCap1')).toHaveAttribute('aria-describedby','skillCapReason1');
  await expect(page.locator('#skillCapReason3')).toBeHidden();await expect(page.locator('#skillCapReason4')).toBeHidden();await noOverflow(page);
  if(process.env.BANDIT_BROWSER_VISUAL)await page.screenshot({path:path.join(process.env.BANDIT_BROWSER_ARTIFACTS,`skill-caps-lowering-${width}-${advanced?'advanced':'normal'}.png`),fullPage:true});
  await page.locator('#skillCap1').fill('15');await expect(page.locator('#skillCapReason2')).toBeHidden();await expect(page.locator('#skillCap1')).not.toHaveAttribute('aria-invalid','true');await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();
  await page.locator('#skillCap2').fill('23');await page.locator('#skillCapsPreviewBtn').click();await expect(page.locator('#skillCapsPreview li')).toHaveCount(0);await expect(page.locator('#skillCapsApplyBtn')).toBeEnabled();
  await page.locator('#skillCapsApplyBtn').click();await expect(page.locator('#pendingCount')).toHaveText('1');
  const output=await download(page,site,f.expected([[1,25,2,27]]));
  await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');await selectCharacter(page,1);
  await expect(page.locator('#skillCap4')).toHaveValue('27');await expect(page.locator('#skillCapReason1')).toBeHidden();await expect(page.locator('#pendingCount')).toHaveText('0');
 }
});
closed('skill caps new modes: closed gates permit preview and prevent writes',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await selectCharacter(page,1);
 await preview(page,[16,...initial.slice(1)]);await expect(page.locator('#skillCapsPreview tbody tr')).toHaveCount(9);await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();
 await page.locator('#skillCapsAdvanced').check();await page.locator('#skillCapsFill100Btn').click();await page.locator('#skillCapsPreviewBtn').click();await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();await expect(page.locator('#skillCapsStatus')).toContainText('可預覽，套用停用');await expect(page.locator('#pendingCount')).toHaveText('0');
});
