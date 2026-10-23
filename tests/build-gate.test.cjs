'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
// Lightweight gate (docs/maintenance/lightweight.md): open flags need a record for the same game version and data fingerprints; core edits never invalidate it.
function copy(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bandit-gate-'));for(const file of ['scripts','src','knowledge','assets','index.html','sw.js','manifest.webmanifest'])fs.cpSync(path.join(root,file),path.join(dir,file),{recursive:true});return dir;}
const build=dir=>spawnSync(process.execPath,['scripts/build-editor.cjs'],{cwd:dir,encoding:'utf8'});
const edit=(dir,file,fn)=>{const p=path.join(dir,file);fs.writeFileSync(p,JSON.stringify(fn(JSON.parse(fs.readFileSync(p,'utf8')))));};
test('core edits keep every open group buildable',()=>{
 const dir=copy();try{
  const core=path.join(dir,'src/core.js'),s=fs.readFileSync(core,'utf8'),i=s.indexOf('function applySetEquipmentQualityCandidate');
  fs.writeFileSync(core,s.slice(0,i)+'function unrelatedHelper(){return 1;}\n'+s.slice(i));
  const r=build(dir);assert.equal(r.status,0,r.stderr);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('an open flag without a record, another game version or changed data fingerprints is refused',()=>{
 for(const [label,file,fn,re] of [
  ['missing record','knowledge/verification.json',p=>{delete p.groups.setEquipmentQualityUpgrade;return p;},/未涵蓋寫入群組：setEquipmentQualityUpgrade/],
  ['game version','knowledge/verification.json',p=>({...p,gameVersion:'V0.0.0'}),/遊戲版本/],
  ['fingerprints','knowledge/catalog.json',k=>({...k,fingerprints:{...k.fingerprints,'data.json':'0'.repeat(64)}}),/指紋/],
 ]){const dir=copy();try{edit(dir,file,fn);const r=build(dir);assert.notEqual(r.status,0,label);assert.match(r.stderr,re,label);}finally{fs.rmSync(dir,{recursive:true,force:true});}}
});
test('a closed flag needs no record',()=>{
 const dir=copy();try{
  edit(dir,'knowledge/catalog.json',k=>{k.verification.setEquipmentQualityUpgrade=false;return k;});
  edit(dir,'knowledge/verification.json',p=>{delete p.groups.setEquipmentQualityUpgrade;return p;});
  const r=build(dir);assert.equal(r.status,0,r.stderr);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
