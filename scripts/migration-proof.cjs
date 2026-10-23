'use strict';
// Composite evidence keeps native observations at their original version. Carried/deferred checks are never booleans.
const Core=require('./core-source-proof.cjs');
const A = require('./migration-analysis.cjs'), R = require('./verification-requirements.cjs'), S = require('./verification-suite.cjs');
const allSources = k => ({...k.fingerprints,...k.batch2Fingerprints});
const hashPattern = /^[a-f0-9]{64}$/;
function recordedChecks(proof, group) {
  const section = R.sectionOf(group);
  return section === 'base' ? proof.checks : section === 'batch2' ? proof.batch2?.checks : section === 'affixReplacement' ? proof.affixReplacement?.checks : proof[section]?.groups?.[group]?.checks;
}
function dataHash(k,group) {
  const family = S.familyOf(group), clean = value => Array.isArray(value) ? value.map(clean) : value && typeof value==='object' ? Object.fromEntries(Object.entries(value).filter(([key])=>!['expression','sourceDigest'].includes(key)).map(([key,v])=>[key,clean(v)])) : value;
  const data = {
    setEquipmentLevel:[k.setEquipmentLevel], treasureLevel:[k.treasureLevel], setEquipmentQuality:[k.setEquipmentQuality,k.setEquipmentLevel], growth:[], advanced:[k.editingLimits,k.batch2Data], batch2:[k.batch2Limits,k.batch2Data],
    affixReplacement:[k.affixReplacement,k.affixReplacementLimits,k.batch2Data?.items],
    equipmentWorkflow:[k.equipmentWorkflowLimits,k.affixReplacement,k.batch2Data?.items],
    equipmentQuality:[k.equipmentQuality,k.equipmentWorkflowLimits,k.batch2Data?.items],
    randomCharacterGrowth:[k.randomCharacterGrowth,k.batch2Data?.talents,k.batch2Data?.items],
    randomCharacterSkillCaps:[k.randomCharacterSkillCaps],
    randomCharacterTalents:[k.randomCharacterTalents,k.batch2Data?.talents]
  }[family];
  if (!data) throw Error('Unknown evidence family: '+family);
  return A.sha(clean(data));
}
function baseline(catalog,proof,snapshot) {
  if (snapshot.unknown.length || !A.same(snapshot.fingerprints,allSources(catalog)) || !A.same(proof.fingerprints,catalog.fingerprints)) throw Error('語意基準必須來自已驗證的相符來源');
  return {...snapshot,gameVersion:catalog.gameVersion,proofHash:A.sha(proof),dataHashes:Object.fromEntries(Object.keys(catalog.verification).map(g=>[g,dataHash(catalog,g)]))};
}
function imported(previous,base) {
  if (previous.migration?.version===2) {
    if (!A.same(previous.migration.snapshot,base)) throw Error('語意基準與現有複合證明不符');
    return {anchors:{...previous.migration.anchors},evidence:previous.migration.evidence,initialVerification:previous.migration.initialVerification,talentInitialVerification:previous.migration.talentInitialVerification,setInitialVerification:previous.migration.setInitialVerification,treasureInitialVerification:previous.migration.treasureInitialVerification,qualityInitialVerification:previous.migration.qualityInitialVerification};
  }
  if (base.proofHash!==A.sha(previous)) throw Error('語意基準不屬於既有原生證明');
  const checks = {}, evidence = {}, groups = Object.keys(previous.groups).filter(g=>previous.groups[g]);
  for (const group of groups) checks[group] = R.requiredChecks(group).filter(c=>c!==R.uiChecks[group]&&recordedChecks(previous,group)?.[c]===true);
  const anchor = {kind:'legacy-native',gameVersion:base.gameVersion,fingerprints:base.fingerprints,snapshot:base,proofHash:base.proofHash,checks};
  const id = A.sha(anchor);
  for (const group of groups) evidence[group] = Object.fromEntries(checks[group].map(c=>[c,{source:'native',anchor:id}]));
  return {anchors:{[id]:anchor},evidence,initialVerification:previous.randomCharacterSkillCaps?.initialVerification,talentInitialVerification:previous.randomCharacterTalents?.initialVerification,setInitialVerification:previous.setEquipmentLevel?.initialVerification,treasureInitialVerification:previous.treasureLevel?.initialVerification,qualityInitialVerification:previous.setEquipmentQuality?.initialVerification};
}
function digest(snapshot,group,check) {
  const data = snapshot.dataHashes?.[group];
  if (!hashPattern.test(data||'')) throw Error('缺少群組規則摘要：'+group);
  return A.sha({events:A.checkDigest(snapshot,group,check),data});
}
function selection(previous,current,groups,options) {
  const p = A.plan(previous,current,groups,options);
  if (p.blocked) return p;
  for (const group of groups) for (const check of R.requiredChecks(group)) {
    if (check===R.uiChecks[group] || p.checks[group][check]==='native' || digest(previous,group,check)===digest(current,group,check)) continue;
    p.checks[group][check]='native';
    for (const family of A.owners(group,check)) {
      const spec=p.families[family]??={effects:false,lifecycle:false,formulas:false,reasons:[]}, role=A.role(check,family);
      spec[role==='io'?'effects':role]=true;
      if(!spec.reasons.includes('catalog'))spec.reasons.push('catalog');
      if(family==='equipmentQuality')spec.formulas=true;
    }
  }
  return p;
}
function compose({catalog,previous,base,current,plan,results,steamBuild}) {
  if (plan.blocked || !results.completed) throw Error('選跑尚未完成，不可寫回');
  const importedProof = imported(previous,base), {anchors} = importedProof, evidence = {};
  const groups = Object.keys(previous.groups).filter(g=>previous.groups[g]&&Object.hasOwn(catalog.verification,g));
  const checks = Object.fromEntries(groups.map(g=>[g,R.requiredChecks(g).filter(c=>c!==R.uiChecks[g]&&results.checks?.[g]?.[c]===true)]));
  const native = {kind:'native',gameVersion:catalog.gameVersion,fingerprints:current.fingerprints,snapshot:current,checks,evidenceHash:A.sha(results.copies),copies:results.copies.map(c=>c.name)};
  const nativeId=A.sha(native); anchors[nativeId]=native;
  for (const group of groups) {
    evidence[group]={};
    for (const check of R.requiredChecks(group)) {
      if(check===R.uiChecks[group]) {
        evidence[group][check]={source:'deferred',reason:'例行遷移不重驗遊戲 UI',previousVersion:previous.gameVersion,eventDigest:current.roles[check]};
        continue;
      }
      if(checks[group].includes(check)) evidence[group][check]={source:'native',anchor:nativeId};
      else {
        const old=importedProof.evidence[group]?.[check], anchor=anchors[old?.anchor];
        if(plan.checks[group]?.[check]!=='carried'||!anchor||digest(anchor.snapshot,group,check)!==digest(current,group,check)) throw Error('缺少本版實證或可沿用證據：'+group+':'+check);
        evidence[group][check]={source:'carried',anchor:old.anchor};
      }
    }
  }
  const used=new Set(Object.values(evidence).flatMap(checks=>Object.values(checks).map(e=>e.anchor)).filter(Boolean));
  return {schemaVersion:2,date:results.date.slice(0,10),gameVersion:catalog.gameVersion,steamBuildId:steamBuild||null,
    eventFingerprint:catalog.fingerprints['data.json'],runtimeFingerprint:catalog.fingerprints['scripts/c3runtime.js'],fingerprints:catalog.fingerprints,batch2Fingerprints:catalog.batch2Fingerprints,
    groups:Object.fromEntries(Object.keys(catalog.verification).map(g=>[g,groups.includes(g)])),
    method:'按功能相依選跑；原生、沿用與 UI 未重驗分開記錄',
    migration:{version:2,policy:'selective-existing-v1',previousGameVersion:previous.gameVersion,enabledBefore:groups,snapshot:current,anchors:Object.fromEntries(Object.entries(anchors).filter(([id])=>used.has(id))),evidence,initialVerification:importedProof.initialVerification,talentInitialVerification:importedProof.talentInitialVerification,setInitialVerification:importedProof.setInitialVerification,treasureInitialVerification:importedProof.treasureInitialVerification,qualityInitialVerification:importedProof.qualityInitialVerification},
    limits:['例行改版未重驗遊戲 UI；沿用項目的原生實測版本見 anchors','不代表 Mac 啟動、真實 Cloud 或長時間遊玩已驗證']};
}
// Only the independent first-opening suites call this, after their complete native validation succeeds.
function mergeInitial(catalog,proof,group,record,results,source) {
  if(proof.schemaVersion!==2)return proof;
  if(!['randomCharacterSkillCaps','randomCharacterBaseAptitudes','randomCharacterTalents','backpackTreasureLevel','treasureLevel',...require('./set-equipment-quality-data.cjs').groups].includes(group)||record.coverage!=='initial-matrix'||!results.completed)throw Error('新增群組必須使用獨立首次證明');
  if(group==='randomCharacterSkillCaps')require('./random-character-skill-caps-proof.cjs').validateResults(catalog,source,results,{initial:true});
  if(group==='randomCharacterTalents')require('./random-character-talents-proof.cjs').validateResults(catalog,source,results,{initial:true});
  const m=proof.migration;
  m.snapshot={...m.snapshot,dataHashes:{...m.snapshot.dataHashes,[group]:dataHash(catalog,group)}};
  const checks=R.requiredChecks(group).filter(c=>c!==R.uiChecks[group]);
  if(!checks.every(c=>results.checks?.[group]?.[c]===true))throw Error('首次原生 checks 不完整');
  const anchor={kind:'native',gameVersion:catalog.gameVersion,fingerprints:allSources(catalog),snapshot:m.snapshot,checks:{[group]:checks},evidenceHash:A.sha(results.copies),initialProofHash:A.sha(record),copies:results.copies.map(c=>c.name)};
  const id=A.sha(anchor);m.anchors[id]=anchor;m.evidence[group]=Object.fromEntries(checks.map(c=>[c,{source:'native',anchor:id}]));
  if(!m.enabledBefore.includes(group))m.enabledBefore.push(group);
  if(group==='randomCharacterSkillCaps')m.initialVerification=record.initialVerification;
  if(group==='randomCharacterTalents')m.talentInitialVerification=record.initialVerification;
  if(require('./treasure-level-data.cjs').groups.includes(group))m.treasureInitialVerification={...m.treasureInitialVerification,[group]:record.initialVerification[group]};
  if(require('./set-equipment-quality-data.cjs').groups.includes(group))m.qualityInitialVerification={...m.qualityInitialVerification,[group]:record.initialVerification[group]};
  return proof;
}
// The source must match the snapshot on every family that owns a check of an open group: by slice when both sides can be
// sliced, otherwise by the full core. Code no open family reaches may change without a new native run.
function coreMatches(source,snapshot,k,onlyGroup) {
  const table=A.sliceTable(snapshot),current=table&&Core.slices(source,A.coreRoots);
  if(!table||!current||current.algorithm!==table.algorithm)return Core.matches(source,snapshot.coreHash,snapshot.coreHashAlgorithm);
  const groups=onlyGroup?[onlyGroup]:Object.keys(k.verification).filter(g=>k.verification[g]);
  const families=[...new Set(groups.flatMap(g=>R.requiredChecks(g).filter(c=>c!==R.uiChecks[g]).flatMap(c=>A.owners(g,c))))];
  return families.every(f=>/^[a-f0-9]{64}$/.test(table.hashes[f]||'')&&table.hashes[f]===current.hashes[f]);
}
function problem(k,proof,source,onlyGroup) {
  try {
    const m=proof.migration;
    if(proof.schemaVersion!==2||m?.version!==2||m.policy!=='selective-existing-v1'||proof.gameVersion!==k.gameVersion||Object.keys(allSources(k)).length!==15||!Object.values(allSources(k)).every(h=>hashPattern.test(h))||!A.same(allSources(k),m.snapshot?.fingerprints)||!A.same(proof.fingerprints,k.fingerprints)||!A.same(proof.batch2Fingerprints,k.batch2Fingerprints)||!coreMatches(source,m.snapshot,k,onlyGroup)||!Array.isArray(m.snapshot.unknown)||m.snapshot.unknown.length) throw Error('複合證明與來源或程式不相符');
    const groups=onlyGroup?[onlyGroup]:Object.keys(k.verification).filter(g=>k.verification[g]);
    for(const group of groups) {
      if(!proof.groups[group]||!m.enabledBefore.includes(group)||m.snapshot.dataHashes?.[group]!==dataHash(k,group))throw Error('缺少既有群組或規則證據：'+group);
      if(group==='randomCharacterSkillCaps'&&require('./random-character-skill-caps-proof.cjs').initialProblem(m.initialVerification))throw Error('首次完整矩陣證明缺失');
      if(require('./set-equipment-level-data.cjs').groups.includes(group)&&require('./set-equipment-level-proof.cjs').initialProblem(m.setInitialVerification?.[group],group))throw Error('套裝等級首次完整矩陣證明缺失');
      if(group==='randomCharacterTalents'&&require('./random-character-talents-proof.cjs').initialProblem(m.talentInitialVerification))throw Error('天賦首次完整矩陣證明缺失');
      if(require('./treasure-level-data.cjs').groups.includes(group)&&(require('./treasure-level-proof.cjs').initialProblem(m.treasureInitialVerification?.[group],group)||m.treasureInitialVerification[group].dataHash!==require('./treasure-level-data.cjs').hash(k.treasureLevel)))throw Error('寶物等級首次完整矩陣證明缺失');
      if(require('./set-equipment-quality-data.cjs').groups.includes(group)&&require('./set-equipment-quality-proof.cjs').recordProblem(m.qualityInitialVerification?.[group],group,k,source))throw Error('套裝品質首次完整矩陣證明缺失');
      for(const check of R.requiredChecks(group)) {
        const e=m.evidence[group]?.[check];
        if(check===R.uiChecks[group]) {if(e?.source!=='deferred'||e.eventDigest!==m.snapshot.roles[check]||!hashPattern.test(e.eventDigest||''))throw Error('UI 未重驗紀錄不完整');continue;}
        const a=m.anchors[e?.anchor];
        if(!['native','carried'].includes(e?.source)||!a||e.anchor!==A.sha(a)||!['native','legacy-native'].includes(a.kind)||!a.checks[group]?.includes(check)||!hashPattern.test(a.evidenceHash||a.proofHash||'')||!A.same(a.fingerprints,a.snapshot.fingerprints)||Object.keys(a.fingerprints).length!==15||a.snapshot.unknown?.length||digest(a.snapshot,group,check)!==digest(m.snapshot,group,check))throw Error('原生／沿用證據無效：'+group+':'+check);
        if(e.source==='native'&&(!A.same(a.fingerprints,allSources(k))||a.gameVersion!==k.gameVersion))throw Error('原生證據版本不符');
      }
    }
    return null;
  } catch(e) { return e.message; }
}
module.exports={allSources,recordedChecks,dataHash,baseline,digest,selection,compose,mergeInitial,problem};
