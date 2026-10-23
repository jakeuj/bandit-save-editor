'use strict';
const {test,expect}=require('./fixtures.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,noOverflow}=require('./actions.cjs');
const catalog=require('../../knowledge/catalog.json'),P原=catalog.setEquipmentLevel.origins[2].affixIds;
// Shipped catalog keeps all four quality groups closed: the card previews but never enables Apply and never changes the save.
function fixture(){const {data}=saveFixture({characters:2}),row=Array(60).fill(0);Object.assign(row,{0:5,1:28,2:1,3:1,5:3,6:3,8:155,9:P原[0],10:P原[1],15:60,16:60,23:3,24:1,26:1.7,27:2});for(const z of [7,9])row.forEach((v,y)=>data[20][y][z]=v);return {raw:renderSave(data)};}
for(const width of [1280,390])test(`set quality candidate ${width}px: preview and disabled apply`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);
 await page.locator('[data-tab="inventory"]').click();await page.locator('#inventoryPlane').selectOption('9');
 await page.locator('#setQualityItem').selectOption('9:20');
 await expect(page.locator('#setQualityInfo')).toContainText('升品 待驗證');
 await page.locator('#setQualityTarget').selectOption('4');
 await page.locator('#setQualityAffix3').selectOption(String(P原[5]));
 await expect(page.locator('#setQualityStatus')).toContainText('尚待獨立遊戲驗證，套用停用');
 await expect(page.locator('#setQualityPreview')).toContainText('主係數 155 → 185');
 await expect(page.locator('#setQualityApply')).toBeDisabled();
 await page.locator('#setQualityTarget').selectOption('2');
 await expect(page.locator('#setQualityRemovalLabel')).toBeVisible();await expect(page.locator('#setQualityApply')).toBeDisabled();
 await page.locator('#setQualityReset').click();await expect(page.locator('#setQualityRemoval')).not.toBeChecked();
 await expect(page.locator('#pendingCount')).toHaveText('0');await noOverflow(page);
});
