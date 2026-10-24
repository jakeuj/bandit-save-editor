'use strict';
// Ascended inner pill level in the ascension panel. Runs on disposable candidate builds (gate opened or closed, proof gate
// removed); browser behaviour only, not the isolated game smoke that opens the repository gate.
const path=require('node:path'),{test:base,expect}=require('./fixtures.cjs'),{createSite}=require('./site.cjs'),{saveFixture,renderSave}=require('../helpers/save-fixture.cjs'),{loadRaw,selectCharacter,download,noOverflow}=require('./actions.cjs');
const open=['ascendedInnerPillLevel','ascensionQuality'];
const opened=base.extend({site:async({},use)=>{const site=await createSite({candidate:open});try{await use(site);}finally{await site.close();}}});
const closed=base.extend({site:async({},use)=>{const site=await createSite({candidate:{close:['ascendedInnerPillLevel']}});try{await use(site);}finally{await site.close();}}});
// Character 1 as in ascension-quality.spec.cjs (q3 0.8, q5 1.68); row 100 holds a Q2 pill at Lv4 (cap 15), row 101 a Q1 pill
// at its cap 10. Character 2 is a named character (template 5) with one ascension storing row 102, a Q3 pill at Lv1 (cap 20).
function fixture(){
 const {data}=saveFixture({characters:2});
 data[1][50][2]=2;data[1][13][2]=115;
 [[1,1,2],[2,4,1],[3,12,1]].forEach(([slot,id,level])=>{data[1][slot][12]=id;data[1][20+slot][12]=level;});
 const pill=(owner,k,q,row,coefficient,template,pillQuality,level)=>{
  data[owner][2*k-1][16]=q;data[owner][2*k][16]=row;const r=data[row];
  [[0,7],[1,template],[2,1],[3,1],[5,pillQuality],[6,level],[7,owner],[8,100],[9,107],[10,108],[11,109],[15,coefficient],[16,coefficient],[17,coefficient],[24,1]].forEach(([y,v])=>r[y][17]=v);
 };
 pill(1,1,3,100,0.8,52,2,4);pill(1,2,5,101,1.68,53,1,10);
 data[2][2][2]=5;data[2][50][2]=1;pill(2,1,4,102,1,54,3,1);
 return {raw:renderSave(data),expected:patches=>renderSave(data,patches)};
}
async function edit(page,round,value){
 await page.locator('#ascensionRound').selectOption(String(round));await page.locator('#ascendedInnerPillLevel').fill(String(value));
 await expect(page.locator('#ascendedInnerPillPreview')).toContainText('→ '+value);await page.locator('#ascendedInnerPillApply').click();
}
for(const width of [1280,390])opened(`ascended inner pill level ${width}px: range, undo, exact bytes and reload`,async({page,site})=>{
 await page.setViewportSize({width,height:844});const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await selectCharacter(page,1);
 await expect(page.locator('#ascendedInnerPillStatus')).toContainText('品質 Q2 · 目前 4 · 上限 15');
 await page.locator('#ascendedInnerPillLevel').fill('16');await expect(page.locator('#ascendedInnerPillPreview')).toContainText('1–15');await expect(page.locator('#ascendedInnerPillApply')).toBeDisabled();
 await edit(page,1,15);await expect(page.locator('#pendingCount')).toHaveText('1');
 await page.locator('#ascensionRound').selectOption('2');await expect(page.locator('#ascendedInnerPillStatus')).toContainText('品質 Q1 · 目前 10 · 上限 10');
 await edit(page,2,3);await expect(page.locator('#pendingCount')).toHaveText('2');
 await page.locator('#undoBtn').click();await expect(page.locator('#pendingCount')).toHaveText('1');await edit(page,2,2);
 await expect(page.locator('#ascensionQualityStatus')).toContainText('倍率 3.98');await noOverflow(page);
 const output=await download(page,site,f.expected([[100,6,17,15],[101,6,17,2]]));
 await page.locator('#fileInput').setInputFiles(output);await expect(page.locator('#fileName')).toHaveText(path.basename(output));await expect(page.locator('#workspace')).not.toHaveAttribute('aria-busy','true');
 // The panel keeps the selected round across the reload.
 await selectCharacter(page,1);await expect(page.locator('#ascensionRound')).toHaveValue('2');await expect(page.locator('#ascendedInnerPillLevel')).toHaveValue('2');
 await page.locator('#ascensionRound').selectOption('1');await expect(page.locator('#ascendedInnerPillLevel')).toHaveValue('15');await expect(page.locator('#pendingCount')).toHaveText('0');
});
opened('named character: quality stays read-only, the ascended pill level applies',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await selectCharacter(page,2);
 await expect(page.locator('#ascensionQualityStatus')).toContainText('只支援範本 0');await expect(page.locator('#ascensionQuality')).toHaveCount(0);
 await expect(page.locator('#ascendedInnerPillStatus')).toContainText('品質 Q3 · 目前 1 · 上限 20');
 await edit(page,1,20);await expect(page.locator('#pendingCount')).toHaveText('1');
 await download(page,site,f.expected([[102,6,17,20]]));
});
closed('closed ascended inner pill gate previews but keeps Apply disabled',async({page,site})=>{
 const f=fixture();await page.goto(site.url);await loadRaw(page,site,f.raw);await selectCharacter(page,1);
 await expect(page.locator('#ascendedInnerPillStatus')).toContainText('入體內丹等級尚待隔離遊戲冒煙，目前停用');
 await page.locator('#ascendedInnerPillLevel').fill('12');await expect(page.locator('#ascendedInnerPillPreview')).toContainText('4 → 12');await expect(page.locator('#ascendedInnerPillApply')).toBeDisabled();
 await expect(page.locator('#pendingCount')).toHaveText('0');
});
