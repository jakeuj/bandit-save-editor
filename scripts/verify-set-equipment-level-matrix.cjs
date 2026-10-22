#!/usr/bin/env node
'use strict';
// A-stage static/synthetic runner only. No launch, native proof writer, or gate mutation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),S=require('./set-equipment-level-scenarios.cjs');
function checkInputs(inputs,k){
 const sum=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 assert.equal(sum(inputs.baseline),inputs.baselineHash,'原始基準已改變');
 const runtime=JSON.parse(fs.readFileSync(inputs.runtimeManifest,'utf8'));
 for(const [manifest,root]of [[inputs.sourceManifest,inputs.source],[inputs.runtimeManifest,path.dirname(inputs.runtime)]]){
  const m=JSON.parse(fs.readFileSync(manifest,'utf8'));assert.equal(Object.keys(m.files||{}).length,manifest===inputs.sourceManifest?inputs.sourceFiles:inputs.runtimeFiles,'完整快取manifest檔案數不符');
  for(const [name,h]of Object.entries(m.files))assert.equal(sum(path.join(root,name)),h,'快取內容改變：'+name);
 }
 const {inspectGame,eventDigest}=require('./extract-game.cjs'),g=inspectGame(inputs.source),D=require('./set-equipment-level-data.cjs');
 for(const [name,h]of Object.entries({...k.fingerprints,...k.batch2Fingerprints}))assert.equal(sum(path.join(inputs.source,name)),h,'15來源不符：'+name);
 assert.equal(D.hash(D.extract(g,eventDigest,k.batch2Data,k.affixReplacement)),D.hash(k.setEquipmentLevel),'套裝資料不符實際來源');
 assert.equal(D.hash(runtime.files),runtime.runtimeHash,'runtime集合摘要不符');
 D.requireClosed(k);return {...runtime,sourceManifestHash:sum(inputs.sourceManifest),runtimeManifestHash:sum(inputs.runtimeManifest)};
}
function run(argv=process.argv.slice(2)){
 const opt=(key,fallback)=>{const i=argv.indexOf(key);return i<0?fallback:argv[i+1];};
 if(argv.includes('--help')){console.log('verify-set-equipment-level-matrix.cjs --inputs EXTERNAL-baseline.json --output EXISTING_EXTERNAL_DIR [--catalog FILE] [--plan | --synthetic] [--shard-index 0 --shard-total 100] [--kinds level,effect,cost,reject]\nA-stage only. Synthetic output is never a native first proof.');return;}
 const {external}=require('./migration-source.cjs'),out=external(opt('--output')),inputs=JSON.parse(fs.readFileSync(opt('--inputs'),'utf8'));
 const source=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8'),k=JSON.parse(fs.readFileSync(opt('--catalog',path.join(__dirname,'../knowledge/catalog.json')),'utf8'));
 assert.notEqual(argv.includes('--plan'),argv.includes('--synthetic'),'請明確指定 --plan 或 --synthetic');
 const runtime=checkInputs(inputs,k);
 const binding={baselineHash:inputs.baselineHash,runtimeHash:runtime.runtimeHash,sourceManifestHash:runtime.sourceManifestHash,runtimeManifestHash:runtime.runtimeManifestHash},manifest=S.createManifest(k,source,binding),file=path.join(out,'set-level-manifest.json');
 if(fs.existsSync(file))S.validateManifest(JSON.parse(fs.readFileSync(file)),k,source,binding);else fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
 const progressFile=path.join(out,'set-level-synthetic-progress.json');
 let progress=fs.existsSync(progressFile)?JSON.parse(fs.readFileSync(progressFile)):S.emptyProgress(manifest);S.validateProgress(manifest,progress);
 if(argv.includes('--synthetic')){
  const selected=S.shard(manifest,{index:Number(opt('--shard-index',0)),total:Number(opt('--shard-total',100)),kinds:opt('--kinds','level,effect,cost,reject').split(',')}),execute=S.createSyntheticRunner(k,source);
  for(const c of selected){if(progress.results.some(r=>r.id===c.id))continue;let passed=true,observation;
   try{observation=execute(c);}catch(e){passed=false;observation={error:e.message};}
   S.recordResult(manifest,progress,c,{passed,observation});
   // Atomic checkpoint; a failed case stays failed and cannot silently be skipped into success.
   fs.writeFileSync(progressFile+'.tmp',JSON.stringify(progress,null,2)+'\n');fs.renameSync(progressFile+'.tmp',progressFile);
   if(!passed)throw Error('合成案例失敗：'+c.id+' '+observation.error);
  }
 }
 const result=S.summary(manifest,progress);console.log(JSON.stringify({...result,manifestHash:manifest.manifestHash}));if(result.failed)throw Error('續跑仍含失敗案例，不能視為通過');return result;
}
if(require.main===module)try{run();}catch(e){console.error(e.stack);process.exitCode=1;}
module.exports={run,checkInputs};
