'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const A=require('../scripts/migration-analysis.cjs'),P=require('../scripts/migration-proof.cjs'),M=require('../scripts/verify-migration.cjs'),CLI=require('../scripts/migration-cli.cjs'),R=require('../scripts/verification-requirements.cjs');
const root=path.resolve(__dirname,'..'),core=require('./helpers/legacy-release.cjs').core;
const L=require('./helpers/legacy-release.cjs'),catalog=L.catalog(),proof=L.proof();
function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bandit-selective-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.mkdirSync(path.join(dir,'scripts'));fs.writeFileSync(path.join(dir,'scripts/c3runtime.js'),'support\nself.C3_GetObjectRefTable = function() {}');
  for(const table of ['cl','js','zy','sx','wp','kj','jz','rw','tf','ss','lw','yx','tz'])fs.writeFileSync(path.join(dir,table+'.json'),JSON.stringify({data:[Array.from({length:33},(_,i)=>[i])]}));
  const names=[...new Set(['存档','存档备份','读取进度',...Object.values(A.dependencies).flatMap(s=>[...s.effects,...s.lifecycle])])];
  const objects=Array.from({length:13},(_,i)=>['o'+i]);objects[3]=['角色名'];objects[12]=['save'];
  const refs=['C3.Plugins.System.Acts.SetVar','C3.Plugins.Arr.Acts.SetXYZ','C3.Plugins.Text.Acts.SetText','C3.Plugins.System.Exps.viewportwidth'];
  const variables=[[1,'v',0,0,false,false,12345,false,999]];
  const functions=names.map((name,i)=>({name,sid:i+100,sheet:'main'}));
  const events=functions.map(f=>[4,[f.name,0,[],true],false,null,f.sid,0,[],[],[]]);
  for(const sid of new Set(Object.values(R.uiEvents).flat()))events.push([4,['ui-'+sid,0,[],true],false,null,sid,0,[],[],[]]);
  const g={root:dir,project:[null,null,null,objects,null,null,[['main',[...variables,...events]]]],refs,expressions:[()=>1,()=>2,()=> '文字'],functions,operations:[],fingerprints:Object.fromEntries(Object.keys(catalog.fingerprints).map(f=>[f,A.sha(f)]))};
  const event=name=>events.find(n=>n[1][0]===name);
  const set=(name,expr=0)=>event(name)[7].push([-1,0,null,123,0,null,[[11,12345],[0,[expr]]]]);
  set('角色升级经验');
  const snap=()=>({...A.snapshot(g,core),gameVersion:'V1',dataHashes:Object.fromEntries(Object.keys(catalog.verification).map(g=>[g,P.dataHash(catalog,g)]))});
  const groups=Object.keys(catalog.verification).filter(g=>catalog.verification[g]);
  return {dir,g,events,event,set,snap,groups};
}
function legacy(f,base) {
  const k=structuredClone(catalog),p=structuredClone(proof);
  k.gameVersion=p.gameVersion='V1';k.fingerprints=p.fingerprints={...f.g.fingerprints};
  k.batch2Fingerprints=p.batch2.fingerprints=Object.fromEntries(['yx','tz'].map(n=>[n+'.json',base.fingerprints[n+'.json']]));
  return {k,p,base:P.baseline(k,p,base)};
}
const emptyResults=()=>({completed:true,date:'2026-10-23T00:00:00.000Z',copies:[],checks:{},platform:'synthetic'});

test('semantic digest resolves expression, object, bound-reference and declaration renumbering; follows actual calls',t=>{
  const f=fixture(t),sid=f.event('角色升级经验')[4],old=A.semanticDigest(f.g,[sid]);
  f.g.expressions.unshift(()=>99);f.event('角色升级经验')[7][0].at(-1)[1][1][0]++;
  f.g.project[6][0][1][0][8]++;
  assert.equal(A.semanticDigest(f.g,[sid]),old);
  f.event('角色升级经验')[7][0].at(-1)[1]=[0,[0]];
  assert.notEqual(A.semanticDigest(f.g,[sid]),old,'literal changes remain visible');
  const a=f.event('装备主属性'),b=f.event('装备等级上限');
  a[7].push([-2,'装备等级上限',null,7,0,null,[]]);const before=A.semanticDigest(f.g,[a[4]]);
  f.set('装备等级上限');assert.notEqual(A.semanticDigest(f.g,[a[4]]),before,'callee body must participate');
  b[7][0].at(-1)[1]=[0,[1,[4,3]]];const bound=A.semanticDigest(f.g,[b[4]]);
  f.g.refs.unshift('unused');for(const n of f.events)for(const action of n[7])if(action[0]!==-2)action[1]++;
  b[7][0].at(-1)[1][1][1][1]++;
  assert.equal(A.semanticDigest(f.g,[b[4]]),bound,'bound [4,ref] resolves to the ACE name');
});

test('text and rendering changes select no game copies; source hash alone does not trigger native work',t=>{
  const f=fixture(t),base=f.snap();
  const zy=JSON.parse(fs.readFileSync(path.join(f.dir,'zy.json')));zy.data[0][1]=['改名'];zy.data[0][5]=['新說明'];fs.writeFileSync(path.join(f.dir,'zy.json'),JSON.stringify(zy));
  f.event('角色升级经验')[7].push([3,2,null,88,0,null,[[1,[2]]]]);
  f.g.fingerprints['data.json']=A.sha('text-only');
  const p=P.selection(base,f.snap(),f.groups);
  assert.deepEqual(CLI.selectNames(p),[]);assert.equal(p.computerUse,false);assert.equal(p.sameSource,false);
});

test('formula changes select their native family without unchanged lifecycle; shared IO expands selection',t=>{
  const f=fixture(t),base=f.snap();f.event('角色升级经验')[7][0].at(-1)[1]=[0,[1]];
  const changed=P.selection(base,f.snap(),f.groups);
  assert.deepEqual(CLI.selectNames(changed),['growth']);assert.equal(changed.families.growth.lifecycle,false);
  f.set('存档');const global=P.selection(base,f.snap(),f.groups);
  assert.equal(CLI.selectNames(global).length,Object.entries(require('../scripts/migration-scenarios.cjs').availableCopies).filter(([,family])=>f.groups.some(g=>require('../scripts/verification-suite.cjs').familyOf(g)===family)).length);
  const full=P.selection(base,base,f.groups,{mode:'full'});assert.equal(CLI.selectNames(full).length,Object.entries(require('../scripts/migration-scenarios.cjs').availableCopies).filter(([,family])=>f.groups.some(g=>require('../scripts/verification-suite.cjs').familyOf(g)===family)).length);assert.equal(full.families.equipmentQuality.formulas,true);
});

test('missing events, unknown references, changed variable defaults and incomplete dependency records cannot silently carry',t=>{
  const f=fixture(t),base=f.snap();f.g.expressions[0]=()=>5;
  assert.ok(CLI.selectNames(P.selection(base,f.snap(),f.groups)).includes('growth'));
  f.event('角色升级经验')[7][0].at(-1)[1]=[0,[0,[99,1]]];
  assert.equal(P.selection(base,f.snap(),f.groups).blocked,true);
  assert.throws(()=>P.selection({...base,roles:{}},base,f.groups),/相依/);
  f.event('角色升级经验')[7][0].at(-1)[1]=[0,[0,[3,12345]]];
  const before=f.snap();f.g.project[6][0][1][0][3]=7;
  assert.ok(CLI.selectNames(P.selection(before,f.snap(),f.groups)).includes('growth'));
  const remove=f.g.functions.findIndex(fn=>fn.name==='角色升级经验');f.g.functions.splice(remove,1);
  assert.equal(P.selection(base,f.snap(),f.groups).blocked,true);
});

test('catalog rule edits require revalidation, independently of identical game bytes',t=>{
  const f=fixture(t),base=f.snap(),current=structuredClone(base);current.dataHashes.equipmentQualityUpgrade=A.sha('different rule');
  const p=P.selection(base,current,f.groups);assert.ok(p.families.equipmentQuality.formulas);
  assert.ok(CLI.selectNames(p).every(n=>n.startsWith('quality-')));
});

test('composite evidence carries original native origins, defers UI and refuses changed code, missing evidence or first opening',t=>{
  const f=fixture(t),start=f.snap(),{k,p,base}=legacy(f,start),current={...start,gameVersion:'V2',fingerprints:{...start.fingerprints,'data.json':A.sha('new-source')}};
  const nextK={...k,gameVersion:'V2',fingerprints:{...k.fingerprints,'data.json':current.fingerprints['data.json']}},plan=P.selection(base,current,f.groups);
  const next=P.compose({catalog:nextK,previous:p,base,current,plan,results:emptyResults()});
  assert.equal(P.problem(nextK,next,core),null);
  const e=next.migration.evidence.equipmentQualityUpgrade;
  assert.equal(e.load.source,'carried');assert.equal(e.qualityUi.source,'deferred');
  assert.equal(next.migration.anchors[e.load.anchor].gameVersion,'V1');
  assert.equal(P.problem(nextK,next,core+'\n// formatting only'),null);
  assert.match(P.problem(nextK,next,core+'\nglobalThis.semanticChange=true;'),/不相符/);
  const missing=structuredClone(next);delete missing.migration.evidence.names.nativeSaveWritten;assert.match(P.problem(nextK,missing,core),/證據無效/);
  const first=structuredClone(next);first.migration.enabledBefore=first.migration.enabledBefore.filter(g=>g!=='names');assert.match(P.problem(nextK,first,core),/既有群組/);
  const tampered=structuredClone(next);tampered.migration.anchors[e.load.anchor].gameVersion='fake';assert.match(P.problem(nextK,tampered,core),/證據無效/);
  const initial=structuredClone(next);delete initial.migration.initialVerification;assert.match(P.problem(nextK,initial,core),/首次/);
  const third={...current,gameVersion:'V3',fingerprints:{...current.fingerprints,'data.json':A.sha('third')}};
  const k3={...nextK,gameVersion:'V3',fingerprints:{...nextK.fingerprints,'data.json':third.fingerprints['data.json']}};
  const next3=P.compose({catalog:k3,previous:next,base:current,current:third,plan:P.selection(current,third,f.groups),results:emptyResults()});
  assert.equal(P.problem(k3,next3,core),null);assert.equal(Object.keys(next3.migration.anchors).length,1,'carried chains stay flat');
});

test('builder accepts a complete composite proof and write-back restores every artifact on build failure',t=>{
  const f=fixture(t),start=f.snap(),{k,p,base}=legacy(f,start),current={...start,gameVersion:'V2',fingerprints:{...start.fingerprints,'data.json':A.sha('v2')}};
  const nextK={...k,gameVersion:'V2',fingerprints:{...k.fingerprints,'data.json':current.fingerprints['data.json']}},plan=P.selection(base,current,f.groups),results=emptyResults();
  const dir=path.join(f.dir,'repo');fs.cpSync(root,dir,{recursive:true,filter:p=>!/[\\/](\.git|graphify-out|node_modules)([\\/]|$)/.test(p)});L.overlay(dir);
  const paths=['knowledge/catalog.json','knowledge/verification.json','knowledge/migration-baseline.json','index.html','sw.js'].map(n=>path.join(dir,n)),bytes=()=>paths.map(p=>fs.readFileSync(p));
  const before=bytes();
  const failed=CLI.writeSelective({dir,catalog:nextK,previous:p,base,current,plan,results,exec:()=>({status:1,stderr:'synthetic build failure'})});
  assert.equal(failed.action,'restored');assert.deepEqual(bytes(),before);
  const written=CLI.writeSelective({dir,catalog:nextK,previous:p,base,current,plan,results});
  assert.equal(written.action,'written',written.reason);
  assert.equal(spawnSync(process.execPath,['scripts/build-editor.cjs','--check'],{cwd:dir,encoding:'utf8'}).status,0);
  const forged=CLI.writeSelective({dir,catalog:nextK,previous:p,base,current,plan,results:{...results,checks:{names:{nativeSaveWritten:true}}}});
  assert.equal(forged.action,'skipped');
});

test('partial native effects merge with carried lifecycle checks and cannot accept a missing selected copy',t=>{
  const f=fixture(t),start=f.snap(),{k,p,base}=legacy(f,start);f.event('角色升级经验')[7][0].at(-1)[1]=[0,[1]];
  f.g.fingerprints['data.json']=A.sha('changed-formula');
  const current=f.snap(),nextK={...k,fingerprints:f.g.fingerprints},plan=P.selection(base,current,f.groups);
  const copy={name:'growth',family:'growth',cases:4,lifecycle:false,oracleArgs:[],ok:true};copy.steps=M.steps(copy,[]).map(s=>({...s,ok:true}));
  const results={...emptyResults(),copies:[copy],checks:M.provenChecks([copy],{},undefined,nextK)};
  const next=P.compose({catalog:nextK,previous:p,base,current,plan,results});assert.equal(P.problem(nextK,next,core),null);
  assert.equal(next.migration.evidence.names.nativeSaveWritten.source,'native');
  assert.equal(next.migration.evidence.names.subsequentResearchAndTrainingStartStop.source,'carried');
  assert.equal(next.migration.evidence.equipmentLevel.nativeSaveWritten.source,'carried');
  const outcome=CLI.writeSelective({catalog:nextK,previous:p,base,current,plan,results:emptyResults()});assert.equal(outcome.action,'skipped');
});

test('a composite proof can first-open a group only through its complete independent suite',t=>{
  const f=fixture(t),start=f.snap(),native=legacy(f,start),group='randomCharacterBaseAptitudes';
  native.k.verification[group]=false;delete native.p.groups[group];native.base=P.baseline(native.k,native.p,start);
  const current={...start,fingerprints:{...start.fingerprints,'data.json':A.sha('new')}};
  const k={...native.k,fingerprints:{...native.k.fingerprints,'data.json':current.fingerprints['data.json']}};
  const groups=f.groups.filter(g=>g!==group),next=P.compose({catalog:k,previous:native.p,base:native.base,current,plan:P.selection(native.base,current,groups),results:emptyResults()});
  const suite=require('../scripts/verify-random-character-suite.cjs'),checks=Object.fromEntries(R.requiredChecks(group).map(c=>[c,true]));
  const results={...emptyResults(),checks:{[group]:checks},copies:[{name:'random-growth-matrix',cases:24,ok:true},{name:'random-growth-lifecycle',cases:2,ok:true}]};
  assert.throws(()=>suite.mergeProof({catalog:k,proof:next,results:{...results,copies:results.copies.slice(0,1)},coreSource:core}),/未完成/);
  const merged=suite.mergeProof({catalog:k,proof:next,results,coreSource:core});assert.equal(P.problem(merged.catalog,merged.proof,core),null);
  assert.equal(merged.proof.migration.evidence[group].load.source,'native');
});

test('runner checkpoints completed copies, resumes matching evidence and deduplicates formulas despite cleanup failure',async t=>{
  const f=fixture(t),runDir=path.join(f.dir,'run');fs.mkdirSync(runDir);
  let setups=0,formulas=0,failSecond=true;
  const exec=(script,args)=>{
    if(args[0]==='--setup'){
      setups++;const dir=fs.mkdtempSync(path.join(runDir,'copy-')),state=path.join(dir,'state.json');
      fs.mkdirSync(path.join(dir,'game'));fs.mkdirSync(path.join(dir,'profile'));fs.writeFileSync(state,JSON.stringify({game:path.join(dir,'game')}));return {status:0,stdout:'STATE '+state};
    }
    if(args.includes('--formulas'))formulas++;
    if(failSecond&&setups===2&&args.includes('--save'))return {status:1,stderr:'synthetic IO failure'};
    return {status:0,stdout:''};
  };
  const copies=()=>['q1','q2'].map(name=>({name,family:'equipmentQuality',cases:1,scenario:{items:[]},oracleArgs:[],lifecycle:false}));
  const options={catalog,proof,copies:copies(),runDir,setupArgs:[],identity:'same-input',exec,sleep:async()=>{},log:()=>{},remove:()=>{throw Error('synthetic file lock');}};
  const first=await M.runMigration(options);assert.equal(first.completed,false);assert.equal(first.warnings.length,2);assert.equal(formulas,1);
  const checkpoint=JSON.parse(fs.readFileSync(path.join(runDir,'checkpoint.json')));assert.equal(checkpoint.copies.length,1);
  failSecond=false;const resumed=await M.runMigration({...options,copies:copies(),resume:true});
  assert.equal(resumed.completed,true);assert.equal(setups,3);assert.equal(formulas,1,'first successful formula is reused with its completed copy');
  await assert.rejects(M.runMigration({...options,copies:copies(),resume:true,identity:'changed'}),/identity/);
  fs.appendFileSync(checkpoint.copies[0].record.state,' ');
  await assert.rejects(M.runMigration({...options,copies:copies(),resume:true}),/evidence/);
});

test('unknown and duplicate copy names fail before source/save setup',()=>{
  const {validateNames}=require('../scripts/migration-scenarios.cjs');
  assert.throws(()=>validateNames(['random-growth-representative']),/Unknown/);assert.throws(()=>validateNames(['growth','growth']),/duplicate/);
  const cli=spawnSync(process.execPath,['scripts/verify-migration.cjs','--source','missing','--artifacts',os.tmpdir(),'--copies','typo'],{cwd:root,encoding:'utf8'});
  assert.notEqual(cli.status,0);assert.match(cli.stderr,/Unknown/);assert.ok(!cli.stderr.includes('ENOENT'));
});

 test('whole-core AST identity carries comments but selects semantic changes, including legacy verified baselines',t=>{
  const C=require('../scripts/core-source-proof.cjs'),f=fixture(t),base=f.snap();
  const cosmetic={...A.snapshot(f.g,core+'\n// no operation'),gameVersion:base.gameVersion,dataHashes:base.dataHashes};
  assert.deepEqual(CLI.selectNames(P.selection(base,cosmetic,f.groups)),[]);
  const bridge=require('../knowledge/core-ast-baselines.json').bindings[0],old={...base,coreHash:bridge.legacyHash};delete old.coreHashAlgorithm;
  assert.deepEqual(CLI.selectNames(P.selection(old,{...cosmetic,coreHash:bridge.astHash},f.groups)),[],'verified legacy bridge normalizes both sides');
  const executable={...A.snapshot(f.g,core+'\nglobalThis.semanticChange=true;'),gameVersion:base.gameVersion,dataHashes:base.dataHashes};
  assert.equal(CLI.selectNames(P.selection(base,executable,f.groups)).length,Object.entries(require('../scripts/migration-scenarios.cjs').availableCopies).filter(([,family])=>f.groups.some(g=>require('../scripts/verification-suite.cjs').familyOf(g)===family)).length);
  const unknown={...base,coreHashAlgorithm:'unknown'};
  assert.throws(()=>P.selection(unknown,base,f.groups),/algorithm/);
 });
