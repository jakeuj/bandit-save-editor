'use strict';
// Fixed manifest and shard contract for set-equipment quality (A9). Candidate planning only: no native proof, no group opens.
// Cases carry an explicit classification so legal / rejected / unknown / not-applicable are counted separately per group.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {hash,groups}=require('./set-equipment-quality-data.cjs'),T=require('./set-equipment-quality-oracle.cjs'),E=require('./set-equipment-quality-effects-oracle.cjs');
const [BACKPACK_UP,BACKPACK_DOWN,STORED_UP,STORED_DOWN]=groups;
const levelGroups=['backpackSetEquipmentLevel','setEquipmentLevel'];
const states=['backpack','stored','equipped'];
const groupOf=(state,direction)=>state==='backpack'?(direction==='up'?BACKPACK_UP:BACKPACK_DOWN):(direction==='up'?STORED_UP:STORED_DOWN);
const planeOf=state=>state==='backpack'?7:9;
const classes={legal:'legal-pending-native',reject:'policy-rejection',unknown:'unknown-native',na:'not-applicable'};
const kinds=['base','effect','coefficient','level-cap','pool','lifecycle','level-regression','reject'];
// Mother-spec "首次驗證矩陣" rows mapped to the kinds that implement them; every row must have at least one executable case.
const dimensions={base:['base'],coefficientAndCap:['coefficient','level-cap'],pools:['pool'],setEffects:['effect'],lifecycle:['lifecycle'],levelRegression:['level-regression'],rejection:['reject']};
const transitions=T.conversions();
const codeHash=file=>hash(fs.readFileSync(path.join(__dirname,file),'utf8').replace(/\r\n/g,'\n'));
function binding(k,core,{baselineHash,runtimeHash,sourceManifestHash,runtimeManifestHash}={}){
 const valid=/^[0-9a-f]{64}$/;assert.match(baselineHash||'',valid,'缺基準雜湊');assert.match(runtimeHash||'',valid,'缺runtime雜湊');
 assert.match(sourceManifestHash||'',valid,'缺來源manifest雜湊');assert.match(runtimeManifestHash||'',valid,'缺runtime manifest雜湊');
 assert.ok(k.setEquipmentQuality&&k.setEquipmentLevel,'缺少套裝品質或套裝等級規則');
 const fingerprints={...k.fingerprints,...k.batch2Fingerprints};assert.equal(Object.keys(fingerprints).length,15);for(const h of Object.values(fingerprints))assert.match(h,valid);
 return {gameVersion:k.gameVersion,fingerprints,baselineHash,runtimeHash,sourceManifestHash,runtimeManifestHash,
  qualitySourceDigest:k.setEquipmentQuality.sourceDigest,qualityDataHash:hash(k.setEquipmentQuality),levelDataHash:hash(k.setEquipmentLevel),
  coreHash:hash(core.replace(/\r\n/g,'\n')),dataScriptHash:codeHash('set-equipment-quality-data.cjs'),transactionOracleHash:codeHash('set-equipment-quality-oracle.cjs'),
  effectOracleHash:codeHash('set-equipment-quality-effects-oracle.cjs'),scenarioHash:codeHash('set-equipment-quality-scenarios.cjs')};
}
const na=(c,reason)=>({...c,classification:classes.na,reason});
function createManifest(k,core,inputs){
 const rules=k.setEquipmentQuality,level=k.setEquipmentLevel,census=T.reachabilityCensus(rules,level),cases=[];
 const templates=Object.keys(rules.pools).map(Number).sort((a,b)=>a-b);
 const originOf=new Map();for(const row of census)if(!originOf.has(row.templateId)||row.originId<originOf.get(row.templateId))originOf.set(row.templateId,row.originId);
 const add=c=>cases.push({candidateOnly:true,...c});
 // 1. Base: 216 templates × 30 directed transitions × 3 states. Low level, unselected slots, traceable metadata.
 for(const templateId of templates)for(const {from,to,direction} of transitions)for(const state of states)
  add({id:`base:${templateId}:${from}>${to}:${state}`,kind:'base',group:groupOf(state,direction),templateId,originId:originOf.get(templateId),state,direction,from,to,level:1,classification:classes.unknown});
 // 2. Set effects: 54 sets × 1–4 parts × same/mixed score × up/down. Natural five/six-piece effects do not exist and are listed, not passed.
 const effectUp=[2,3],effectDown=[3,2];
 for(const [setId,set] of Object.entries(level.sets))for(let parts=1;parts<=6;parts++)for(const score of ['same','mixed'])for(const direction of ['up','down']){
  const [from,to]=direction==='up'?effectUp:effectDown;
  const c={id:`effect:${setId}:${parts}:${score}:${direction}`,kind:'effect',group:groupOf('equipped',direction),setId:+setId,templateId:set.members[0],state:'equipped',direction,from,to,parts,score,effectFormats:[...new Set(set.effects.map(e=>e.format))].sort(),level:1};
  add(parts>set.members.length?na(c,'目前沒有自然 '+parts+' 件套裝效果，不造假案例'):{...c,classification:classes.unknown});
 }
 // 3. Coefficient endpoints per transition and state (main/sub range ends, two-decimal boundary, new tail slot ends).
 const endpoints=['main-low','main-high','sub-low','sub-high','sub-hundredth','tail-low','tail-high'];
 for(const {from,to,direction} of transitions)for(const state of states)for(const endpoint of endpoints){
  const c={id:`coefficient:${from}>${to}:${state}:${endpoint}`,kind:'coefficient',group:groupOf(state,direction),state,direction,from,to,endpoint,templateId:28,level:1};
  if(endpoint.startsWith('sub')&&Math.min(from,to)<2)add(na(c,'較低品質沒有保留槽，無副係數端點'));
  else if(endpoint.startsWith('tail')&&direction==='down')add(na(c,'降品沒有新增尾槽'));
  else add({...c,classification:classes.unknown});
 }
 // 4. Level cap boundaries: L=1, the largest level legal on both sides, and a legal start above the target cap (reject).
 for(const {from,to,direction} of transitions)for(const state of states)for(const boundary of ['level-1','common-cap','over-target-cap']){
  const lv=boundary==='level-1'?1:boundary==='common-cap'?Math.min(T.cap(from),T.cap(to)):T.cap(to)+1;
  const c={id:`level-cap:${from}>${to}:${state}:${boundary}`,kind:'level-cap',group:groupOf(state,direction),state,direction,from,to,boundary,level:lv,templateId:28};
  if(boundary==='over-target-cap'&&direction==='up')add(na(c,'升品目標上限不低於起點，沒有超 cap 的合法起點'));
  else add({...c,classification:boundary==='over-target-cap'?classes.reject:classes.unknown});
 }
 // 5. Dual pool × selected slot, enumerated from the real same-tier/same-slot origin rows. Missing combinations are not-applicable with a reason.
 const pools=[
  {name:'unselected-origin-only',need:r=>r.originOnly>0,why:'原池沒有專有 ID',cls:classes.unknown},
  {name:'unselected-shared',need:r=>r.shared>0,why:'兩池沒有交集 ID',cls:classes.unknown},
  {name:'unselected-set-only',need:r=>r.setOnly>0,why:'套裝池沒有專有 ID',cls:classes.reject},
  {name:'selected-head-origin-only',need:r=>r.originOnly>0,why:'原池沒有專有 ID',cls:classes.unknown},{name:'selected-tail-origin-only',need:r=>r.originOnly>0,why:'原池沒有專有 ID',cls:classes.unknown},
  {name:'selected-head-shared',need:r=>r.shared>0,why:'兩池沒有交集 ID',cls:classes.unknown},{name:'selected-tail-shared',need:r=>r.shared>0,why:'兩池沒有交集 ID',cls:classes.unknown},
  {name:'selected-head-set-only',need:r=>r.setOnly>0,why:'套裝池沒有專有 ID',cls:classes.unknown},{name:'selected-tail-set-only',need:r=>r.setOnly>0,why:'套裝池沒有專有 ID',cls:classes.unknown},
  {name:'existing-duplicate',need:r=>r.originCount>=2,why:'原池不足兩個 ID',cls:classes.unknown}
 ];
 for(const row of census)for(const p of pools)for(const [direction,state,[from,to]] of [['up','backpack',effectUp],['down','backpack',effectDown],['up','stored',effectUp],['down','stored',effectDown]]){
  const c={id:`pool:${row.templateId}:${row.originId}:${p.name}:${state}:${direction}`,kind:'pool',group:groupOf(state,direction),templateId:row.templateId,originId:row.originId,state,direction,from,to,pool:p.name,level:1};
  add(p.need(row)?{...c,classification:p.cls}:na(c,p.why));
 }
 // 6. Lifecycle starts from the A8 oracle: 3 states × up/down, then extra axes crossed with the four groups.
 const life=E.lifecycleStarts();
 for(const b of life.base)add({id:`lifecycle:${b.id}`,kind:'lifecycle',group:groupOf(b.state,b.direction),state:b.state,direction:b.direction,ioRounds:2,moveColumns:50,tailColumns:10,classification:classes.unknown});
 for(const ex of life.extras)for(const g of groups){
  const direction=g.endsWith('Upgrade')?'up':'down',plane=g.startsWith('backpack')?'z7':'z9';
  const c={id:`lifecycle:${ex.id}:${g}`,kind:'lifecycle',group:g,direction,axis:ex.axis,extra:ex.id,ioRounds:2,moveColumns:50,tailColumns:10};
  if(ex.axis==='transition'&&(ex.to>ex.from?'up':'down')!==direction)add(na(c,'轉換方向與群組不同'));
  else if(ex.axis==='path'&&ex.value!==plane)add(na(c,'合成路徑屬於另一庫別'));
  else add({...c,classification:classes.unknown});
 }
 // 7. Level regression (existing set-level groups need a cross-pool supplement; quality results never replace them).
 for(const [plane,group] of [['z7','backpackSetEquipmentLevel'],['z9','setEquipmentLevel']])for(const name of ['refined-set-only-id','level-up','level-down','at-cap','wear-effect','io-two-rounds','quality-level-quality-undo','accumulated-restore'])
  add({id:`level-regression:${plane}:${name}`,kind:'level-regression',group,plane,regression:name,supplementsExistingGroup:true,classification:classes.unknown});
 // 8. Rejections per group; direction-specific ones are listed as not-applicable on the other direction.
 const rejects=[['q0'],['q7'],['fraction'],['wrong-plane'],['wrong-kind'],['missing-metadata'],['bad-pointer'],['duplicate-reference'],['multi-flag'],['tail-data-outside-slots'],['pool-outside-id'],['unselected-set-pool-id'],['special-main-coefficient'],
  ['permission-bypass-coordinate'],['permission-bypass-legacy-set'],['permission-bypass-batch'],['stale-proof'],['incomplete-proof'],['atomic-rollback'],['new-duplicate','up'],['remove-selected','down'],['downgrade-over-cap','down']];
 for(const g of groups)for(const [name,only] of rejects){
  const direction=g.endsWith('Upgrade')?'up':'down',c={id:`reject:${g}:${name}`,kind:'reject',group:g,direction,rejection:name};
  add(only&&only!==direction?na(c,'此拒絕只適用於'+(only==='up'?'升品':'降品')):{...c,classification:classes.reject});
 }
 assert.equal(new Set(cases.map(c=>c.id)).size,cases.length,'案例 ID 重複');
 const counts=Object.fromEntries(kinds.map(kind=>[kind,cases.filter(c=>c.kind===kind).length]));
 assert.equal(counts.base,19440);assert.equal(cases.filter(c=>c.kind==='effect'&&c.classification!==classes.na).length,864);
 const denominators=denominatorsOf(cases);
 const payload={schemaVersion:1,phase:'A',nativeProof:false,binding:binding(k,core,inputs),counts,dimensions,denominators,cases};
 return {...payload,manifestHash:hash(payload)};
}
// Per-group denominators: kind × classification. Not-applicable cases stay listed but never count as executable or passed.
function denominatorsOf(cases){
 const out={};
 for(const c of cases){const g=out[c.group]??={total:0,executable:0,kinds:{},classes:{}};g.total++;if(c.classification!==classes.na)g.executable++;
  const kc=g.kinds[c.kind]??={};kc[c.classification]=(kc[c.classification]||0)+1;g.classes[c.classification]=(g.classes[c.classification]||0)+1;}
 return out;
}
function validateManifest(m,k,core,inputs){
 // Recompute from the current sources and compare digests: any drift in inputs, cases or counts changes the payload hash.
 const fresh=createManifest(k,core,inputs),{manifestHash,...payload}=m;
 assert.equal(manifestHash,fresh.manifestHash,'來源、oracle、核心、輸入或案例 manifest 不符');assert.equal(hash(payload),fresh.manifestHash,'manifest 內容與摘要不符');return true;
}
const executable=c=>c.classification!==classes.na;
// Round-robin over the (stable) filtered list so shards are balanced; the union of all shards equals the filtered list exactly once.
function shard(m,{index=0,total=1,kinds:wanted=kinds,groups:wantedGroups,includeNotApplicable=false}={}){
 assert.ok(Number.isSafeInteger(total)&&total>=1&&Number.isSafeInteger(index)&&index>=0&&index<total,'非法分片');
 assert.ok(Array.isArray(wanted)&&wanted.length&&new Set(wanted).size===wanted.length&&wanted.every(v=>kinds.includes(v)),'非法案例類型');
 if(wantedGroups!==undefined)assert.ok(Array.isArray(wantedGroups)&&wantedGroups.length&&wantedGroups.every(g=>Object.hasOwn(m.denominators,g)),'非法群組');
 return m.cases.filter(c=>wanted.includes(c.kind)&&(!wantedGroups||wantedGroups.includes(c.group))&&(includeNotApplicable||executable(c))).filter((c,i)=>i%total===index);
}
// A checkpoint binds the manifest, the exact shard selection and the id list; resuming needs all three to match.
function checkpoint(m,selection={}){
 const cases=shard(m,selection);return {schemaVersion:1,manifestHash:m.manifestHash,binding:hash(m.binding),selection:{index:selection.index??0,total:selection.total??1,kinds:selection.kinds??kinds,groups:selection.groups??null,includeNotApplicable:!!selection.includeNotApplicable},count:cases.length,idsHash:hash(cases.map(c=>c.id))};
}
function validateCheckpoint(m,cp){
 assert.equal(cp.schemaVersion,1);assert.equal(cp.manifestHash,m.manifestHash,'checkpoint 與 manifest 不符');assert.equal(cp.binding,hash(m.binding),'checkpoint 綁定輸入不符');
 const {index,total,kinds:ks,groups:gs,includeNotApplicable}=cp.selection,cases=shard(m,{index,total,kinds:ks,groups:gs??undefined,includeNotApplicable});
 assert.equal(cp.count,cases.length,'checkpoint 案例數不符');assert.equal(cp.idsHash,hash(cases.map(c=>c.id)),'checkpoint 案例清單不符');return true;
}
function emptyProgress(m){return {schemaVersion:1,manifestHash:m.manifestHash,mode:'synthetic',results:[]};}
function validateProgress(m,p){
 assert.equal(p.schemaVersion,1);assert.equal(p.mode,'synthetic','A階段不能接收原生證明');assert.equal(p.manifestHash,m.manifestHash,'續跑輸入不符');assert.ok(Array.isArray(p.results));
 const seen=new Set(),byId=new Map(m.cases.map(c=>[c.id,c]));
 for(const r of p.results){
  const c=byId.get(r.id);assert.ok(c&&!seen.has(r.id),'未知或重複案例');seen.add(r.id);assert.ok(executable(c),'不適用案例不可有結果');assert.equal(r.caseHash,hash(c),'案例摘要不符');
  assert.equal(typeof r.passed,'boolean');assert.equal(r.nativeCompared,false,'合成結果不可冒充原生');assert.ok(r.observation&&typeof r.observation==='object','缺少合成觀察');assert.equal(r.observationHash,hash(r.observation),'合成觀察摘要不符');
  if(r.passed)assert.equal(r.observation.nativeCompared,false,'成功觀察必須標記合成');else assert.equal(typeof r.observation.error,'string','失敗觀察缺少原因');assert.equal(!!r.observation.error,!r.passed,'失敗不能改標通過');
 }
 return true;
}
function recordResult(m,p,c,{passed,observation}){
 validateProgress(m,p);assert.ok(m.cases.some(v=>v.id===c.id&&hash(v)===hash(c)),'未知案例');assert.ok(executable(c),'不適用案例不可記錄');assert.ok(!p.results.some(r=>r.id===c.id),'重複案例');assert.equal(typeof passed,'boolean');
 p.results.push({id:c.id,caseHash:hash(c),passed,observation,observationHash:hash(observation),nativeCompared:false});validateProgress(m,p);
}
// Reconciliation list per group: no group can be reported complete until all of its executable cases passed; native is never complete in phase A.
function summary(m,p){
 validateProgress(m,p);const done=new Map(p.results.map(r=>[r.id,r])),byGroup={};
 for(const c of m.cases){const g=byGroup[c.group]??={total:0,notApplicable:0,executable:0,attempted:0,passed:0,failed:0,pending:0,rejectionCases:0,unknownNative:0};
  g.total++;if(!executable(c)){g.notApplicable++;continue;}g.executable++;if(c.classification===classes.reject)g.rejectionCases++;if(c.classification===classes.unknown)g.unknownNative++;
  const r=done.get(c.id);if(!r)g.pending++;else{g.attempted++;if(r.passed)g.passed++;else g.failed++;}}
 for(const g of Object.values(byGroup))g.syntheticComplete=g.passed===g.executable;
 return {cases:m.cases.length,attempted:p.results.length,nativeComplete:false,groups:byGroup,opened:Object.fromEntries(groups.map(g=>[g,false]))};
}
module.exports={groups,levelGroups,states,classes,kinds,dimensions,groupOf,planeOf,binding,createManifest,validateManifest,denominatorsOf,shard,checkpoint,validateCheckpoint,emptyProgress,validateProgress,recordResult,summary};
