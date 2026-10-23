'use strict';
// B8: merge the four set-quality first proofs and the two cross-pool set-level first proofs from the raw native results kept
// outside the repo. Coverage is recomputed from the raw shard/lifecycle/B6 files (not from any summary), every bound digest is
// checked, B4's old-core evidence is carried only through the pinned B7 equivalence, and the browser acceptance is recorded as
// owed to B9. Without --write it only reports; --write updates catalog/verification and builds the undelivered snapshot, and is
// refused on main.
//   node scripts/merge-set-equipment-quality-proof.cjs [--artifacts ROOT] [--report FILE] [--write]
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const D=require('./set-equipment-quality-data.cjs'),M=require('./set-equipment-quality-scenarios.cjs'),P=require('./set-equipment-quality-proof.cjs'),X=require('./set-equipment-quality-matrix.cjs');
const CP=require('./set-equipment-level-cross-pool-proof.cjs'),E=require('./set-equipment-quality-equivalence.cjs'),R=require('./verification-requirements.cjs');
const {hash}=D,root=path.resolve(__dirname,'..'),lf=s=>s.replace(/\r\n/g,'\n');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const codeHash=file=>hash(lf(fs.readFileSync(path.join(__dirname,file),'utf8')));
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
// Driver digests were taken from Function#toString without normalizing line endings, so a CRLF and an LF checkout of the same
// committed source give two digests. Both are accepted for exactly that content; anything else still differs.
const driverDigests=fn=>{const t=lf(fn.toString());return [hash(t),hash(t.replace(/\n/g,'\r\n'))];};
const lines=file=>fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
// SHA-256 of the raw result files exactly as recorded in sdd/set-equipment-quality-b/tasks.md (B4, B7 rerun of B6).
const pinned={
 b4:{dir:'set-equipment-quality-B4',files:{'a10-results.json':E.B4.a10ResultsSha256,'binding.json':E.B4.bindingSha256,'binding-matrix-run.json':'7609bcab428b1e9e2e2b14773bd3b85c625bbb05ac917f7e42c024c10888bd8f',
  'lifecycle/lifecycle-results.json':'6eb0a3ea0dd5476dfe2a4a3b21543f80d810c7d3e3c4933514d03933adac6bb0','lifecycle/b4-lifecycle-report.json':'e8987601030dd7625c6449f19b7e7c16706f419bb4679cf6ae5e165583ed8582'},
  matrixShards:{suffix:'-of-40-b5133b95',count:40,concatSha256:'0ce4366c60c43f65f355b6ecf26051c2c43e6185e6028f42d116ea1e759dd5a1'},rerunShard:{dir:'shard-0-of-1-8f839258',sha256:'816989185e6e489f05cb52a5f91f95e6767381f907b96c9a421f317920867a57'}},
 b6:{dir:'set-equipment-quality-B7-b6',files:{'a10-results.json':'7ec16f6ed17e486510b22fa6b7af0adc8d3bfa6d41ac5055a368b1b197618739','b6-results.json':'e082e4790b53214402b5e1831cb9e831fe41325e61b0213f375eae405a7c9e36'}}
};
const row=l=>({id:l.id,caseHash:l.caseHash,passed:l.passed,nativeCompared:l.nativeCompared});
const same=(a,b)=>hash(a)===hash(b);
const sorted=list=>hash(list.map(row).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0));

// ---- raw B4 evidence ---------------------------------------------------------------------------------------------------------
function loadB4(dir,k,source){
 for(const [file,want] of Object.entries(pinned.b4.files))assert.equal(sha(path.join(dir,file)),want,'B4 結果檔雜湊與紀錄不符：'+file);
 const binding=read(path.join(dir,'binding.json')),matrixRun=read(path.join(dir,'binding-matrix-run.json')),a10=read(path.join(dir,'a10-results.json'));
 // Bound tools: everything but the core equals the current files; the core is the pinned pre-B7 one.
 const tools=X.toolBinding(source);
 for(const key of Object.keys(tools))if(key==='driverHash')assert.ok(driverDigests(X.matrixDriver).includes(binding.tools[key]),'B4 綁定工具與目前不符：'+key);
 else if(key!=='coreHash')assert.equal(binding.tools[key],tools[key],'B4 綁定工具與目前不符：'+key);
 assert.equal(binding.tools.coreHash,E.B4.from.coreHash,'B4 的 core 不是等價紀錄釘住的舊 core');
 assert.equal(binding.a10ManifestHash,E.B4.from.manifestHash,'B4 的 A10 manifest 與等價紀錄不符');
 assert.equal(binding.manifestHash,E.oldManifestHash(k,source,binding.inputs),'B4 真實輸入 manifest 無法由反向修補重現');
 // The 40 long-run shards ran before the contract-rejection fix: only the matrix module and its runner differ (B4 decision).
 const diff=Object.keys(binding.tools).filter(key=>binding.tools[key]!==matrixRun.tools[key]).sort();
 assert.deepEqual(diff,['matrixHash','runnerHash'],'長跑分片與最終 B4 綁定的差異超出拒絕案修正');
 const shards=fs.readdirSync(dir).filter(d=>d.endsWith(pinned.b4.matrixShards.suffix)).sort();
 assert.equal(shards.length,pinned.b4.matrixShards.count,'長跑分片數不符');
 assert.equal(crypto.createHash('sha256').update(Buffer.concat(shards.map(d=>fs.readFileSync(path.join(dir,d,'results.jsonl'))))).digest('hex'),pinned.b4.matrixShards.concatSha256,'長跑分片串接雜湊不符');
 assert.equal(sha(path.join(dir,pinned.b4.rerunShard.dir,'results.jsonl')),pinned.b4.rerunShard.sha256,'拒絕案重跑分片雜湊不符');
 const manifest=M.createManifest(k,source,binding.inputs),byId=new Map(manifest.cases.map(c=>[c.id,c])),byLine=new Map();
 const check=(d,tools)=>{const cp=read(path.join(dir,d,'checkpoint.json'));assert.equal(cp.manifestHash,binding.manifestHash,'分片 manifest 不符：'+d);assert.deepEqual(cp.tools,tools,'分片工具摘要不符：'+d);assert.equal(cp.toolsHash,hash(tools));return cp;};
 for(const d of shards){check(d,matrixRun.tools);for(const l of lines(path.join(dir,d,'results.jsonl')))byLine.set(l.id,l);}
 const rerun=check(pinned.b4.rerunShard.dir,binding.tools),rerunLines=lines(path.join(dir,pinned.b4.rerunShard.dir,'results.jsonl'));
 assert.ok(rerunLines.every(l=>byId.get(l.id)?.kind==='reject')&&rerunLines.length===rerun.count,'重跑分片只能是拒絕案');
 for(const l of rerunLines)byLine.set(l.id,l);
 // Lifecycle copies: their report is bound to the same old core/manifest and the current lifecycle runner.
 const life=read(path.join(dir,'lifecycle/lifecycle-results.json')),report=read(path.join(dir,'lifecycle/b4-lifecycle-report.json'));
 assert.equal(report.binding.coreHash,E.B4.from.coreHash);assert.equal(report.manifestHash,E.B4.from.manifestHash);assert.equal(report.resultsHash,pinned.b4.files['lifecycle/lifecycle-results.json']);
 assert.equal(report.binding.runnerHash,codeHash('verify-set-equipment-quality-migration-lifecycle.cjs'),'生命週期 runner 已改變');assert.equal(report.binding.scenarioHash,codeHash('set-equipment-quality-scenarios.cjs'));
 assert.deepEqual(report.binding.fingerprints,{...k.fingerprints,...k.batch2Fingerprints});
 assert.ok(report.cacheUnchanged===true&&same(report.guarded,report.guardedAfter)&&report.misses.length===0,'生命週期原檔或快取雜湊改變');
 const lifeLines=life.copies.map(v=>{const c=byId.get(v.caseId);assert.ok(c&&c.kind==='lifecycle','未知生命週期案例 '+v.caseId);return {id:c.id,caseHash:hash(c),passed:v.passed===true&&!v.miss&&!v.error,nativeCompared:true};});
 const rows=[...[...byLine.values()].map(row),...lifeLines];
 for(const r of rows){const c=byId.get(r.id);assert.ok(c,'未知案例 '+r.id);assert.equal(r.caseHash,hash(c),'案例摘要過期 '+r.id);}
 // The per-case file B4 emitted must be exactly what the raw lines give.
 assert.equal(sorted(rows),sorted(a10.cases),'B4 逐案列與原始分片／生命週期重建結果不符');
 assert.equal(a10.manifestHash,E.B4.from.manifestHash);assert.equal(a10.notPassed.length+a10.contractOnly.length,0);
 return {rows,lines:byLine,life,report,binding,sha:pinned.b4.files['a10-results.json']};
}

// ---- raw B6 (final-core rerun) evidence --------------------------------------------------------------------------------------
function loadB6(dir,k,source){
 for(const [file,want] of Object.entries(pinned.b6.files))assert.equal(sha(path.join(dir,file)),want,'B6 結果檔雜湊與紀錄不符：'+file);
 const a10=read(path.join(dir,'a10-results.json')),res=read(path.join(dir,'b6-results.json')),B6=require('./verify-set-equipment-level-cross-pool.cjs');
 const manifest=M.createManifest(k,source,Object.fromEntries(['baselineHash','runtimeHash','sourceManifestHash','runtimeManifestHash'].map(x=>[x,'0'.repeat(64)])));
 const driver=driverDigests(B6.crossPoolDriver);assert.ok(driver.includes(res.binding.driverHash),'B6 driver 與目前不符');
 const want={coreHash:P.textHash(source),crossPoolGroups:[...D.crossPoolGroups],runnerHash:codeHash('verify-set-equipment-level-cross-pool.cjs'),driverHash:res.binding.driverHash,
  matrixHash:codeHash('set-equipment-quality-matrix.cjs'),lifecycleHash:codeHash('verify-set-equipment-quality-migration-lifecycle.cjs'),levelOracleHash:codeHash('set-equipment-level-oracle.cjs'),manifestHash:manifest.manifestHash,fingerprints:{...k.fingerprints,...k.batch2Fingerprints}};
 assert.deepEqual(res.binding,want,'B6 綁定與目前 core／工具不符');assert.deepEqual(a10.binding,want);
 assert.equal(a10.manifestHash,manifest.manifestHash);assert.equal(a10.resultsHash,pinned.b6.files['b6-results.json']);assert.ok(a10.complete===true&&a10.missing.length===0);
 assert.ok(same(a10.guarded,a10.guardedAfter),'B6 原檔雜湊改變');
 const byId=new Map(manifest.cases.map(c=>[c.id,c]));
 for(const r of res.cases){const c=byId.get(r.id);assert.ok(c&&c.kind==='level-regression','未知 B6 案例 '+r.id);assert.equal(r.caseHash,hash(c));}
 assert.equal(sorted(res.cases),sorted(a10.cases),'B6 逐案列與原始結果不符');
 return {rows:res.cases.map(row),cases:res.cases,a10,res,sha:pinned.b6.files['a10-results.json']};
}

// ---- checks and IO, derived from the raw observations ------------------------------------------------------------------------
function lifecycleIo(copies){
 assert.ok(copies.length,'沒有生命週期副本');
 for(const v of copies){
  const rounds=v.report?.rounds;
  assert.ok(Array.isArray(rounds)&&rounds.length===2,'不是兩輪 IO：'+v.id);
  for(const r of rounds){assert.ok(Array.isArray(r.pids)&&r.pids.length===2&&r.pids[0]!==r.pids[1],'讀回不是新 PID：'+v.id);assert.ok(same(r.observed,r.reloaded),'新 PID 讀回不同：'+v.id);}
  assert.ok(v.source?.assertions?.length&&v.source.assertions.every(a=>a.passed),'原生斷言未全過：'+v.id);
  const steps=v.report.cycle?.steps||[];assert.ok(steps.length,'沒有搬移：'+v.id);
  for(const s of steps){
   assert.ok(s.source.slice(0,50).every(x=>x===0),'搬移後來源 y0–49 未清除：'+v.id);
   assert.ok(same(s.source.slice(50),s.markers)&&s.markers.length===10,'來源 y50–59 標記未保留：'+v.id);
   assert.ok(!same(s.record.slice(50),s.markers)&&s.record[1]===v.report.cycle.initial[1],'尾十欄被複製或目的列不是該件：'+v.id);
  }
 }
 return {rounds:2,newPidReadback:true,shiftedColumns:50,tailColumns:10};
}
function b6Io(b6,levelGroup){
 const key=levelGroup===M.levelGroups[0]?'z7':'z9',c=b6.cases.find(v=>v.id==='level-regression:'+key+':io-two-rounds');
 assert.ok(c?.passed&&c.observation.rounds.length===1,'B6 缺兩輪 IO 案');
 const pids=c.observation.rounds[0].pids;assert.ok(pids.length===2&&pids.every(p=>p.length===2&&p[0]!==p[1]),'B6 讀回不是新 PID');
 assert.ok(c.observation.rounds[0].summary.steps.length,'B6 沒有搬移（B2 validateCopy 的 y0–49／尾十欄斷言）');
 return {rounds:2,newPidReadback:true,shiftedColumns:50,tailColumns:10};
}
function qualityResults(k,source,group,b4,b6,inputs){
 const e=P.expected(k,source,group),ids=new Set(e.cases.map(c=>c.id)),kinds=new Map(e.cases.map(c=>[c.id,c.kind]));
 const own=b4.rows.filter(r=>ids.has(r.id)&&kinds.get(r.id)!=='level-regression').map(r=>({...r,run:0}));
 const level=b6.rows.filter(r=>ids.has(r.id)).map(r=>({...r,run:1}));
 const cases=[...own,...level],passedAll=list=>list.length>0&&list.every(r=>r.passed&&r.nativeCompared);
 const copies=b4.life.copies.filter(v=>ids.has(v.caseId)),io=lifecycleIo(copies);b6Io(b6,M.levelGroups[group.startsWith('backpack')?0:1]);
 const of=kind=>cases.filter(r=>kinds.get(r.id)===kind);
 const checks={load:passedAll(of('lifecycle'))&&copies.length===of('lifecycle').length,save:true,restart:true,originalHashes:same(b4.report.guarded,b4.report.guardedAfter)&&b4.report.cacheUnchanged===true&&same(b6.a10.guarded,b6.a10.guardedAfter),
  nativeEffects:passedAll(of('base'))&&(!of('effect').length||passedAll(of('effect')))&&passedAll(of('level-regression')),lifecycle:passedAll(of('lifecycle'))&&passedAll(of('level-regression'))};
 checks.save=checks.restart=checks.load;
 return {completed:true,checks:{[group]:checks},copies:[],native:{[group]:{coverage:'initial-matrix',manifestHash:e.manifestHash,cases,io,ui:{pending:'B9'},
  oracles:{transactionOracleHash:codeHash('set-equipment-quality-oracle.cjs'),effectOracleHash:codeHash('set-equipment-quality-effects-oracle.cjs')},inputs,
  runs:[{label:'B4（B7 前 core，經等價紀錄沿用）',manifestHash:E.B4.from.manifestHash,coreHash:E.B4.from.coreHash,evidenceSha256:b4.sha,bindingSha256:E.B4.bindingSha256,equivalence:E.describe(k,source)},
   {label:'B6 在最終 core 重跑（B7）',manifestHash:e.manifestHash,coreHash:P.textHash(source),evidenceSha256:b6.sha}]}}};
}
function crossPoolResults(k,source,group,b6,inputs){
 const e=CP.expected(k,source,group),ids=new Set(e.cases.map(c=>c.id)),cases=b6.rows.filter(r=>ids.has(r.id)),io=b6Io(b6,CP.levelGroupOf(group));
 const ok=name=>cases.some(r=>r.id.endsWith(':'+name)&&r.passed&&r.nativeCompared),all=cases.length===e.cases.length&&cases.every(r=>r.passed&&r.nativeCompared);
 const checks={load:ok('io-two-rounds'),save:ok('io-two-rounds'),restart:ok('io-two-rounds'),originalHashes:same(b6.a10.guarded,b6.a10.guardedAfter),nativeEffects:ok('wear-effect')&&ok('level-up')&&ok('level-down'),lifecycle:all};
 return {completed:true,checks:{[group]:checks},copies:[],native:{[group]:{coverage:'initial-matrix',manifestHash:e.manifestHash,cases,io,ui:{pending:'B9'},
  levelOracleHash:codeHash('set-equipment-level-oracle.cjs'),runnerHash:codeHash('verify-set-equipment-level-cross-pool.cjs'),inputs,
  run:{label:'B6 在最終 core 重跑（B7）',manifestHash:e.manifestHash,coreHash:P.textHash(source),evidenceSha256:b6.sha}}}};
}
function coverage(k,source,group,results,expectedOf){
 const e=expectedOf(k,source,group),n=results.native[group],seen=new Set(n.cases.map(r=>r.id));
 return {required:e.cases.length,results:n.cases.length,missing:e.cases.filter(c=>!seen.has(c.id)).length,duplicates:n.cases.length-seen.size,
  unknown:n.cases.filter(r=>!e.caseHashes.has(r.id)).length,stale:n.cases.filter(r=>e.caseHashes.get(r.id)!==r.caseHash).length,notPassed:n.cases.filter(r=>!r.passed).length,notNative:n.cases.filter(r=>r.nativeCompared!==true).length,
  byRun:n.runs?n.runs.map((run,i)=>({label:run.label,cases:n.cases.filter(r=>r.run===i).length})):[{label:n.run.label,cases:n.cases.length}],checks:results.checks[group]};
}
function flip(text,group){const flag=`"${group}": false`;assert.equal(text.split(flag).length,2,'catalog 旗標不唯一：'+group);return text.replace(flag,`"${group}": true`);}

function run(argv=process.argv.slice(2)){
 const opt=n=>argv.includes(n)?argv[argv.indexOf(n)+1]:undefined,write=argv.includes('--write');
 const k=read(path.join(root,'knowledge/catalog.json')),source=fs.readFileSync(path.join(root,'src/core.js'),'utf8');
 const gitBad=E.gitProblem(root);assert.ok(!gitBad,gitBad);
 const index=read(path.join(root,'.local/game-sources.json')),entry=index.entries.find(e=>e.id===index.preferredDevelopmentSourceId);
 const artifacts=opt('--artifacts')||entry.artifactsRoot,b4=loadB4(path.join(artifacts,pinned.b4.dir),k,source),b6=loadB6(path.join(artifacts,pinned.b6.dir),k,source);
 // Sources and runtime: the cache is re-hashed and must still be the one B1/B4 bound.
 const sources=require('./set-equipment-quality-baseline.cjs').verifySources(entry,k);
 for(const key of ['runtimeHash','sourceManifestHash','runtimeManifestHash'])assert.equal(sources[key],b4.binding.inputs[key],'來源或 runtime 與 B4 綁定不符：'+key);
 const qInputs=b4.binding.inputs,cpInputs={fixedSaveHash:b6.a10.guarded.fixedSave,levelBaselineHash:b6.a10.guarded.levelBaselines,runtimeHash:sources.runtimeHash,sourceManifestHash:sources.sourceManifestHash,runtimeManifestHash:sources.runtimeManifestHash};
 const results=[...P.groups.map(g=>[g,qualityResults(k,source,g,b4,b6,qInputs),P]),...CP.groups.map(g=>[g,crossPoolResults(k,source,g,b6,cpInputs),CP])];
 let proof=read(path.join(root,'knowledge/verification.json')),catalogText=fs.readFileSync(path.join(root,'knowledge/catalog.json'),'utf8');
 const report={schemaVersion:1,task:'set-equipment-quality-B8',equivalence:E.describe(k,source),groups:{}};
 for(const [group,r,proofModule] of results){
  const records=proofModule.buildRecord(k,source,r,group);
  proof=proofModule.mergeProof({catalog:k,proof,group,results:r,source});catalogText=flip(catalogText,group);
  report.groups[group]={coverage:coverage(k,source,group,r,proofModule.expected),recordHash:hash(records),ui:records.ui};
 }
 if(opt('--report'))fs.writeFileSync(opt('--report'),JSON.stringify(report,null,1)+'\n');
 if(write){
  const branch=spawnSync('git',['rev-parse','--abbrev-ref','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
  assert.ok(branch&&!['main','gh-pages','HEAD'].includes(branch),'只能在不推送的快照分支寫入開閘結果');
  fs.writeFileSync(path.join(root,'knowledge/catalog.json'),catalogText);fs.writeFileSync(path.join(root,'knowledge/verification.json'),JSON.stringify(proof,null,2)+'\n');
  for(const mode of [['--pending-ui-snapshot'],['--check','--pending-ui-snapshot']]){const b=spawnSync(process.execPath,[path.join(__dirname,'build-editor.cjs'),...mode],{cwd:root,encoding:'utf8'});if(b.status!==0)throw Error(b.stderr||b.stdout);}
 }
 return report;
}
if(require.main===module){const r=run();console.log(JSON.stringify(Object.fromEntries(Object.entries(r.groups).map(([g,v])=>[g,{...v.coverage,checks:undefined,allChecks:Object.values(v.coverage.checks).every(Boolean)}])),null,1));}
module.exports={driverDigests,pinned,loadB4,loadB6,lifecycleIo,b6Io,qualityResults,crossPoolResults,coverage,flip,run};
