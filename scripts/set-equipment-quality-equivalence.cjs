'use strict';
// B4 ran its 67,755 native cases before B7 wrote the cross-pool gate into the core. The user decided (B7/B8) to carry those
// results instead of re-running them, provided the merge records exactly what changed. This module pins that one change and
// nothing else: the old core, data script and A10 manifest are rebuilt from the current files by reversing the reviewed B7
// patches, so any other difference (or a tampered record) no longer reproduces the pinned old digests and is refused.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const D=require('./set-equipment-quality-data.cjs'),M=require('./set-equipment-quality-scenarios.cjs'),Core=require('./core-source-proof.cjs');
const {hash}=D,root=path.resolve(__dirname,'..'),lf=s=>s.replace(/\r\n/g,'\n'),text=s=>hash(lf(s));
const filler=Object.fromEntries(['baselineHash','runtimeHash','sourceManifestHash','runtimeManifestHash'].map(k=>[k,'0'.repeat(64)]));
// The reviewed B7 change (commit 1b0abd0) as old/new line windows; the unchanged lines inside each window are part of it.
const patches={
 'src/core.js':{
  old:["  let selected=0;","  for(let slot=1;slot<=6;slot++){","   const id=record[8+slot],coefficient=record[14+slot],flag=record[27+slot];","   if(![0,1].includes(flag))fail('洗練旗標不符。');",
   "   if(slot<quality){if(!origin.affixIds.includes(id)||!decimal2(coefficient)||coefficient<10*(quality-1)||coefficient>60+10*quality)fail('原裝備詞條或係數不符。');}"],
  new:["  // Cross-pool scope reuses the set-quality pool (P套) for the one selected slot, behind its own per-plane first proof; closed, it is the original-pool check.",
   "  const crossPool=KNOWLEDGE.verification[plane===7?'backpackSetEquipmentLevelCrossPool':'setEquipmentLevelCrossPool']===true?KNOWLEDGE.setEquipmentQuality?.pools?.[record[1]]:undefined;",
   "  let selected=0;","  for(let slot=1;slot<=6;slot++){","   const id=record[8+slot],coefficient=record[14+slot],flag=record[27+slot];","   if(![0,1].includes(flag))fail('洗練旗標不符。');",
   "   if(slot<quality){if(!(origin.affixIds.includes(id)||flag===1&&!!crossPool?.affixIds.includes(id))||!decimal2(coefficient)||coefficient<10*(quality-1)||coefficient>60+10*quality)fail('原裝備詞條或係數不符。');}"]
 },
 'scripts/set-equipment-quality-data.cjs':{
  old:["function requireClosed(k){for(const group of groups)if(k.verification[group]!==undefined&&k.verification[group]!==false)throw Error('套裝品質 A 階段沒有首次證明，群組必須關閉：'+group);}",
   "module.exports={extract,reviewedRules,reviewedDigests,dependencies,sourceSids,groups,hash,classify,canPreserve,requireClosed};"],
  new:["// Cross-pool scope of the two existing set-level groups (selected slot in P套); opened only by its own first proof, never by quality proofs.",
   "const crossPoolGroups=['backpackSetEquipmentLevelCrossPool','setEquipmentLevelCrossPool'];",
   "function requireClosed(k){for(const group of [...groups,...crossPoolGroups])if(k.verification[group]!==undefined&&k.verification[group]!==false)throw Error('套裝品質 A 階段沒有首次證明，群組必須關閉：'+group);}",
   "module.exports={extract,reviewedRules,reviewedDigests,dependencies,sourceSids,groups,crossPoolGroups,hash,classify,canPreserve,requireClosed};"]
 }
};
// The only evidence this equivalence may carry: B4's per-case file and its binding, at the tree it ran on.
const B4={
 kind:'b7-cross-pool-gate',commit:'5271ce4',evidence:'set-equipment-quality-B4',
 from:{coreHash:'69b462a0e3c02e9dbe29a1b59aab6b0c31b969a2e5a5e64172c6acf40bf1d6d5',dataScriptHash:'41895659d92e848c127ef374fe161efb8fd22fba27c93fa5fb5ec9cd2b788a9e',manifestHash:'629075b861aa6c7e29f4c219df8757529fde4a5d0ceae57bce962cbc3fe6e1eb'},
 a10ResultsSha256:'1cc22b2ed0bfcf97cd25e217e8702f0ec2de1baf28870c77ea10439642c253e2',bindingSha256:'07457ab263f7dfa969a6e7643238737b821667347039ea264b3947e48f49c3e6',
 basis:['tests/set-equipment-level-cross-pool.test.cjs：跨池群組關閉時正式等級入口的結果、訊息、bytes 與變更數和 B7 前 core 逐一相同',
  'core-slice-report：差異只在 setEquipmentLevelInfo；套裝品質候選入口與 B4 矩陣／生命週期 runner 都不呼叫它，跨池旗標的開關不影響 B4 驗過的品質路徑',
  'data 腳本只新增 crossPoolGroups 並讓 requireClosed 涵蓋它；manifest 的案例、分母、計數與維度不變，差異只在 binding 的 coreHash／dataScriptHash']
};
const patchHash=hash(patches);
function reverse(current,patch){
 const block=patch.new.join('\n'),at=current.indexOf(block);
 if(at<0||current.indexOf(block,at+1)>=0)return null;
 return current.slice(0,at)+patch.old.join('\n')+current.slice(at+block.length);
}
const read=file=>lf(fs.readFileSync(path.join(root,file),'utf8'));
// The A10 manifest of the old tree: identical payload except the two binding digests the B7 change touched.
function oldManifestHash(k,source,inputs=filler,from=B4.from){
 const {manifestHash,...payload}=M.createManifest(k,source,inputs);
 return hash({...payload,binding:{...payload.binding,coreHash:from.coreHash,dataScriptHash:from.dataScriptHash}});
}
// The record field the merge writes, recomputed from the current repository. Memoized: the manifest is costly and every
// open group checks the same description; the other bound files are read fresh by the manifest itself.
const described=new Map();
function describe(k,source,data=read('scripts/set-equipment-quality-data.cjs')){
 const key=hash([k.gameVersion,k.fingerprints,k.batch2Fingerprints,k.setEquipmentQuality,k.setEquipmentLevel,lf(source),data]);
 if(!described.has(key))described.set(key,fresh(k,source,data));
 return structuredClone(described.get(key));
}
function fresh(k,source,data){
 const oldCore=reverse(lf(source),patches['src/core.js']),oldData=reverse(data,patches['scripts/set-equipment-quality-data.cjs']);
 if(oldCore===null||oldData===null)throw Error('目前 core 或 data 腳本找不到唯一的 B7 跨池修補，無法重建舊版');
 return {kind:B4.kind,commit:B4.commit,evidence:B4.evidence,patchHash,
  core:{from:text(oldCore),to:text(source),fromAst:Core.hash(oldCore),toAst:Core.hash(source),algorithm:Core.algorithm},
  dataScript:{from:hash(oldData),to:hash(data)},
  manifest:{from:oldManifestHash(k,source),to:M.createManifest(k,source,filler).manifestHash},
  a10ResultsSha256:B4.a10ResultsSha256,bindingSha256:B4.bindingSha256,basis:B4.basis};
}
// Problem with an equivalence record, or null. The record must equal a fresh description field by field, and the rebuilt old
// digests must be exactly the pinned B4 ones: a different core/data change, a different manifest or other evidence fails.
function problem(eq,k,source,data){
 let now;try{now=describe(k,source,data);}catch(e){return e.message;}
 if(!eq||hash(eq)!==hash(now))return '套裝品質等價紀錄缺漏或與目前來源不符';
 if(now.core.from!==B4.from.coreHash||now.dataScript.from!==B4.from.dataScriptHash||now.manifest.from!==B4.from.manifestHash)return '差異超出 B7 跨池修補範圍';
 return null;
}
// A native run may use the equivalence only when it is exactly the B4 evidence on the B4 tree.
function runProblem(run,k,source,data){
 const bad=problem(run?.equivalence,k,source,data);if(bad)return bad;
 if(run.manifestHash!==B4.from.manifestHash||run.coreHash!==B4.from.coreHash||run.evidenceSha256!==B4.a10ResultsSha256||run.bindingSha256!==B4.bindingSha256)return '等價紀錄只適用 B4 的原生證據';
 return null;
}
// Merge-time check against Git: the reversed files must be byte-identical to the commit B4 ran on, and every other bound
// tool must be unchanged since then.
const unchanged=['scripts/set-equipment-quality-oracle.cjs','scripts/set-equipment-quality-effects-oracle.cjs','scripts/set-equipment-level-oracle.cjs','scripts/set-equipment-quality-scenarios.cjs',
 'scripts/set-equipment-quality-matrix.cjs','scripts/verify-set-equipment-quality.cjs','scripts/verify-set-equipment-quality-migration-lifecycle.cjs'];
function gitProblem(cwd=root){
 const show=file=>lf(execFileSync('git',['show',B4.commit+':'+file],{cwd,encoding:'utf8',maxBuffer:1<<28}));
 for(const [file,patch] of Object.entries(patches))if(reverse(read(file),patch)!==show(file))return '從 '+B4.commit+' 重算的舊版與反向修補不符：'+file;
 for(const file of unchanged)if(read(file)!==show(file))return 'B4 之後綁定工具已改變：'+file;
 const k=JSON.parse(show('knowledge/catalog.json')),cur=JSON.parse(read('knowledge/catalog.json'));
 for(const key of ['setEquipmentQuality','setEquipmentLevel','fingerprints','batch2Fingerprints','gameVersion'])if(hash(k[key])!==hash(cur[key]))return 'B4 之後規則或來源已改變：'+key;
 return null;
}
module.exports={B4,patches,patchHash,reverse,oldManifestHash,describe,problem,runProblem,gitProblem,unchanged};
