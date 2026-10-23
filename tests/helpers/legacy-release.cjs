'use strict';
// A frozen release from before the treasure-level core change: its legacy-shaped proof, migration baseline and the exact
// core they bind. The repository itself now carries the composite (schema 2) proof; tests that exercise legacy-proof
// machinery use this matching trio instead of the live files. Groups opened after it (treasure, set quality and the set-level
// cross-pool scope, and lightweight-flow groups such as decimal pills, backpack over-limit levels and relic attributes) stay closed in every overlay.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const fixtures=path.join(__dirname,'../fixtures/legacy-release'),root=path.join(__dirname,'../..');
const text=name=>fs.readFileSync(path.join(fixtures,name),'utf8');
const Q=require('../../scripts/set-equipment-quality-data.cjs');
const treasureGroups=['backpackTreasureLevel','treasureLevel',...Q.groups,...Q.crossPoolGroups,'pillAptitudeBonusDecimal','pillAptitudeBonusAscended','backpackEquipmentLevelAdvanced','relicAttributes','randomCharacterBaseAptitudesAscended','randomCharacterTalentsAscended'];
const legacy={
 core:text('core.js'),
 proof:()=>JSON.parse(text('verification.json')),
 baseline:()=>JSON.parse(text('migration-baseline.json')),
 // The live catalog with the unproven treasure groups closed, as it was when the legacy proof was written.
 catalog:()=>{const k=JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'),'utf8'));for(const g of treasureGroups)if(Object.hasOwn(k.verification,g))k.verification[g]=false;return k;},
 // Lays the legacy trio over a copied tree and rebuilds it so HTML and worker agree with that core.
 overlay(dir,{build=true}={}){
  fs.writeFileSync(path.join(dir,'src/core.js'),legacy.core);
  fs.writeFileSync(path.join(dir,'knowledge/verification.json'),text('verification.json'));
  fs.writeFileSync(path.join(dir,'knowledge/migration-baseline.json'),text('migration-baseline.json'));
  let catalog=fs.readFileSync(path.join(dir,'knowledge/catalog.json'),'utf8');
  for(const g of treasureGroups)catalog=catalog.replace(`"${g}": true`,`"${g}": false`);
  fs.writeFileSync(path.join(dir,'knowledge/catalog.json'),catalog);
  if(build){const r=spawnSync(process.execPath,['scripts/build-editor.cjs'],{cwd:dir,encoding:'utf8'});if(r.status!==0)throw Error('legacy overlay build failed: '+(r.stderr||r.stdout));}
  return dir;
 }
};
module.exports=legacy;
