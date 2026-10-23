'use strict';
// Every SaveCore method a family's native evidence depends on must be one of that family's slice roots.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const A=require('../scripts/migration-analysis.cjs'),S=require('../scripts/verification-suite.cjs'),Core=require('../scripts/core-source-proof.cjs');
const scripts=path.join(__dirname,'../scripts'),read=f=>fs.readFileSync(path.join(scripts,f),'utf8');
const used=text=>new Set([...text.matchAll(/\b(?:C|SaveCore)\.([A-Za-z_]\w*)\b/g)].map(m=>m[1]));
const union=new Set(Object.values(A.coreRoots).flat());
// Family modules loaded on the Node side besides the suite's oracle/lifecycle scripts.
const extra={setEquipmentLevel:['set-level-migration-scenarios.cjs'],treasureLevel:['treasure-level-migration-scenarios.cjs'],setEquipmentQuality:['set-equipment-quality-scenarios.cjs','set-equipment-quality-proof.cjs'],randomCharacterTalents:['random-character-talents-scenarios.cjs','random-character-talents-proof.cjs'],randomCharacterSkillCaps:['random-character-skill-caps-scenarios.cjs','random-character-skill-caps-proof.cjs'],randomCharacterGrowth:['random-character-growth-scenarios.cjs','random-character-growth-proof.cjs']};

test('every migration family declares roots, and the current core slices with them',()=>{
 assert.deepEqual(Object.keys(A.coreRoots).sort(),Object.keys(S.families).sort());
 for(const roots of Object.values(A.coreRoots))for(const shared of A.sharedCoreRoots)assert.ok(roots.includes(shared));
 const table=Core.slices(fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8'),A.coreRoots);
 assert.ok(table,'src/core.js 必須可切片；否則所有群組退回整份 core 綁定');
 assert.deepEqual(Object.keys(table.hashes).sort(),Object.keys(A.coreRoots).sort());
 // Slicing tolerates roots a legacy core lacks, so a typo would go unnoticed: every declared root must exist in the current core.
 const exported=Object.keys(require('../scripts/verify-game.cjs').loadCore(require('../knowledge/catalog.json')));
 for(const [family,roots] of Object.entries(A.coreRoots))for(const name of roots)assert.ok(exported.includes(name),family+': '+name+' 不在目前 SaveCore');
});
test('scenario operations and batch requests of every representative copy are roots of its family',()=>{
 const {buildScenarios}=require('../scripts/migration-scenarios.cjs'),catalog=require('../knowledge/catalog.json');
 const data=Array.from({length:2501},()=>Array.from({length:60},()=>Array(22).fill(0)));
 data[0][0][1]='szmnqea';data[1][1][0]='山寨';data[1][0][2]=1;data[1][1][2]='驗證甲';data[1][3][2]=1;for(const y of [10,11,12])data[1][y][2]=50;
 for(const [x,template] of [[4,5],[12,6]]){data[x][0][1]=x;data[x][1][1]=template;}data[2][0][2]=2;
 const copies=buildScenarios({catalog,saveText:JSON.stringify({c2array:true,size:[2501,60,22],data})});
 assert.ok(copies.length>=19);
 for(const copy of copies){
  const roots=A.coreRoots[copy.family];
  for(const op of copy.scenario?.operations||[])assert.ok(roots.includes(op.method),`${copy.name}: ${op.method} 未列入 ${copy.family} 根集合`);
  if(copy.batchRequests?.length)for(const m of ['previewBatch','applyBatch'])assert.ok(roots.includes(m),copy.name+': '+m);
 }
});
test('verify-game shared steps are shared roots; its family-specific calls and operation whitelist are owned',()=>{
 const text=read('verify-game.cjs'),editSave=text.slice(text.indexOf('function editSave'),text.indexOf('async function applyBatchRequests'));
 assert.ok(editSave.length>100);
 const specific={previewBatch:'randomCharacterSkillCaps',applyBatch:'randomCharacterSkillCaps',previewCharacterSkillCaps:'randomCharacterSkillCaps',previewCharacterTalents:'randomCharacterTalents'};
 for(const m of used(editSave))assert.ok(A.sharedCoreRoots.includes(m)||A.coreRoots[specific[m]]?.includes(m),'editSave: '+m);
 for(const m of used(text))assert.ok(union.has(m),'verify-game: '+m);
 const list=/\[('setCharacterTalents'[^\]]*)\]\.includes\(operation\.method\)/.exec(text);assert.ok(list,'找不到操作白名單');
 for(const m of [...list[1].matchAll(/'(\w+)'/g)].map(v=>v[1]))assert.ok(union.has(m),'白名單 '+m+' 不屬於任何 family');
});
test('family oracle, lifecycle and scenario modules call only their own roots',()=>{
 for(const [family,spec] of Object.entries(S.families)){
  const files=[spec.oracle,...(spec.lifecycle||[]),...(extra[family]||[])].filter(Boolean);
  for(const file of files){
   // verify-native-lifecycle and verify-affix-lifecycle are shared by several families; they must not call SaveCore at all.
   for(const m of used(read(file)))assert.ok(A.coreRoots[family].includes(m),`${file}: ${m} 未列入 ${family}`);
  }
 }
 for(const m of used(read('migration-scenarios.cjs')))assert.ok(union.has(m),'migration-scenarios: '+m);
});
