'use strict';
// Candidate flags exercise UI paths before native validation; these disposable builds are never release artifacts.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs');
const {saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,selectCharacter,download,noOverflow}=require('./actions.cjs');
const flags=['randomCharacterSkillCapsInitial','randomCharacterSkillCapsAdvanced'];
const released=flags.every(flag=>require('../../knowledge/catalog.json').verification[flag]===true);
const opened=base.extend({site:async({},use)=>{const site=await createSite(released?{}:{candidate:flags});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:flags}});try{await use(site);}finally{await site.close();}}});
const initial=[15,23,4,28,1,4,10,37,1];
function fixture(){
 const {data}=saveFixture({size:2501,characters:2});
 for(let id=1;id<=2;id++){
  initial.forEach((v,i)=>data[id][22+i][2]=v);
  for(let i=0;i<3;i++){data[id][1+i][12]=i+1;data[id][21+i][12]=1;}
 }
 return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};
}
async function preview(page,values){for(let i=0;i<9;i++)await page.locator('#skillCap'+(i+1)).fill(String(values[i]));await page.locator('#skillCapsPreviewBtn').click();}
for(const width of [1280,390])opened(`skill caps modes ${width}px: initial source, advanced preview, exact download and reload`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await selectCharacter(page,1);
 await expect(page.locator('#skillCapsAdvanced')).not.toBeChecked();await expect(page.locator('#skillCapsStatus')).toContainText('初始角色');
 await preview(page,[16,...initial.slice(1)]);await expect(page.locator('#skillCapsPreview')).toContainText('初始角色');await expect(page.locator('#skillCapsApplyBtn')).toBeEnabled();
 await page.locator('#skillCapsAdvanced').check();await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();
 await preview(page,Array(9).fill(101));await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();await expect(page.locator('#skillCapsPreview')).toContainText('1–100');
 await preview(page,Array(9).fill(100));await expect(page.locator('#skillCapsPreview tbody tr')).toHaveCount(9);await expect(page.locator('#skillCapsPreview')).toContainText('九項獨立設定');
 await page.locator('#skillCapsApplyBtn').click();await expect(page.locator('#pendingCount')).toHaveText('9');await expect(page.locator('#skillCapsAdvanced')).toBeChecked();await noOverflow(page);
 const output=await download(page,site,f.expected(initial.map((_,i)=>[1,22+i,2,100])));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');await selectCharacter(page,1);
 await expect(page.locator('#skillCapsAdvanced')).not.toBeChecked();await expect(page.locator('#skillCapsPreviewBtn')).toBeDisabled();
 await page.locator('#skillCapsAdvanced').check();await expect(page.locator('#skillCap9')).toHaveValue('100');await expect(page.locator('#pendingCount')).toHaveText('0');
 await selectCharacter(page,2);await expect(page.locator('#skillCapsAdvanced')).not.toBeChecked();
});
closed('skill caps new modes: closed gates permit preview and prevent writes',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await selectCharacter(page,1);
 await preview(page,[16,...initial.slice(1)]);await expect(page.locator('#skillCapsPreview tbody tr')).toHaveCount(9);await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();
 await page.locator('#skillCapsAdvanced').check();await preview(page,Array(9).fill(100));await expect(page.locator('#skillCapsApplyBtn')).toBeDisabled();await expect(page.locator('#skillCapsStatus')).toContainText('可預覽，套用停用');await expect(page.locator('#pendingCount')).toHaveText('0');
});
