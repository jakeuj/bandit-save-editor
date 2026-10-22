'use strict';
const assert=require('node:assert/strict'),{createHash}=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const group='randomCharacterTalents',hashPattern=/^[0-9a-f]{64}$/,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const INITIAL={matrixCases:33,lifecycleCases:2,formulaCases:535},REPRESENTATIVE_CASES=3;
const LIFECYCLE_EVENTS=['numericUpdate','transfer','prison','recall','rebirth','dismiss'];
// Binds the talent block and the v2.7 aptitude source it calls, not the whole core.
function formulaHash(source){
 const start=source.indexOf(' // Talent level rules.'),end=source.indexOf(' // Talent level rules end.',start);
 if(start<0||end<0)throw Error('Missing talent level source');
 return sha(source.slice(start,end).replace(/\r\n/g,'\n')+require('./random-character-growth-proof.cjs').formulaHash(source));
}
const dataHash=k=>sha({rules:k.randomCharacterTalents,talents:k.batch2Data.talents});
const binding=(k,source)=>({gameVersion:k.gameVersion,fingerprints:{...k.fingerprints,...k.batch2Fingerprints},dataHash:dataHash(k),formulaHash:formulaHash(source)});
const near=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<1e-8;
function core(k,source){const ctx={setTimeout};vm.runInNewContext(source.replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);return ctx.SaveCore;}
// Reads the JSON evidence a passing copy keeps beside its state file.
function readEvidence(stateFile){
 const dir=path.dirname(stateFile),read=name=>fs.existsSync(path.join(dir,name))?JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')):undefined,s=JSON.parse(fs.readFileSync(stateFile,'utf8'));
 return {source:{fingerprints:s.fingerprints,sourceHashes:s.sourceHashes,originalFileHashes:Object.values(s.before||{}),assertions:s.assertions},effects:read('talents-effects.json'),reload:read('talents-reload.json'),lifecycle:read('talents-lifecycle.json')};
}
function expectedRows(k,coverage){
 const {matrixSpecs}=require('./random-character-talents-scenarios.cjs');
 const specs=coverage==='lifecycle'?[{q:3,ids:[1,4,52],to:[4,3,2]},{q:3,ids:[5,44,66],to:[3,4,2]}]:matrixSpecs(k.randomCharacterTalents.talentLevels,coverage==='representative');
 return specs.map((s,i)=>({id:i+1,...s}));
}
function sums(C,ids,levels){const out={};ids.forEach((id,i)=>{const t=C.KNOWLEDGE.batch2Data.talents[id];t.attributes.forEach((a,s)=>{if(a)out[a]=(out[a]||0)+C.talentEffect(a,t.coefficients[s],levels[i]);});});return out;}
function checkCharacters(C,rows,expected,label){
 assert.equal(rows.length,expected.length,label+' character count');
 for(const [i,row]of rows.entries()){const e=expected[i],want=sums(C,e.ids,e.to);
  assert.equal(row.id,e.id);assert.deepEqual(row.cells,[...e.ids,...e.to],label+' cells '+e.id);
  assert.deepEqual(Object.keys(row.sums).sort(),Object.keys(want).sort(),label+' attributes '+e.id);
  for(const [a,v]of Object.entries(want))assert.ok(near(row.sums[a],v),`${label} sum ${e.id}:${a}`);}
}
// Independent per-copy validation; returns the checks this copy proves.
function copyChecks(copy,k,source){
 const e=copy.evidence,C=core(k,source),expected=binding(k,source).fingerprints,checks={};
 assert.ok(copy.ok&&e?.source,'copy evidence missing');
 assert.ok(same(e.source.fingerprints,expected)&&same(e.source.sourceHashes||e.source.fingerprints,expected),'tested sources differ');
 const assertions=e.source.assertions||[];assert.ok(assertions.length>=2&&assertions.every(a=>a.passed),'native assertions missing');
 const pids=new Set(assertions.map(a=>a.pid));assert.ok(assertions.some(a=>a.restarted)&&pids.size>=2,'no new-PID readback');
 checks.load=checks.save=checks.restart=checks.originalHashes=true;
 if(copy.lifecycle){
  const l=e.lifecycle,[kept]=expectedRows(k,'lifecycle');assert.ok(l,'lifecycle evidence missing');
  assert.deepEqual(l.events,LIFECYCLE_EVENTS);checkCharacters(C,l.initial,expectedRows(k,'lifecycle'),'lifecycle');checkCharacters(C,l.final,[kept],'lifecycle final');
  assert.ok(new Set(l.pids).size>=LIFECYCLE_EVENTS.length+1,'each lifecycle stage needs its own PID');
  Object.assign(checks,{numericUpdate:true,nativeTransfer:true,nativePrison:true,nativeRebirth:true,nativeDismiss:true,stageRoundtrips:true});
  return checks;
 }
 const coverage=e.effects?.coverage,rows=expectedRows(k,coverage);
 assert.ok(['initial-matrix','representative'].includes(coverage),'unknown matrix coverage');
 checkCharacters(C,e.effects.characters,rows,'effects');checkCharacters(C,e.reload.characters,rows,'reload');
 assert.deepEqual(e.reload.tokenTypes,{integer:rows.length*6});assert.notEqual(e.reload.pid,e.reload.previousPid);
 const formulas=e.effects.formulas,keys=new Set(formulas.map(([id,slot,,,L])=>[id,slot,L].join(',')));
 assert.equal(formulas.length,INITIAL.formulaCases);assert.equal(keys.size,INITIAL.formulaCases);
 for(const [id,slot,a,c,L,native]of formulas){const t=k.batch2Data.talents[id];assert.ok(t.attributes[slot]===a&&t.coefficients[slot]===c,'formula row source');assert.equal(native,C.talentEffect(a,c,L),`formula ${id}:${slot}:${L}`);}
 assert.deepEqual(e.reload.aptitudes,e.effects.aptitudes);
 const aptitudeRows=rows.filter(r=>r.aptitude);assert.equal(e.effects.aptitudes.length,aptitudeRows.length);
 for(const [i,r]of aptitudeRows.entries()){const n=e.effects.aptitudes[i],raw=Math.round(k.randomCharacterGrowth.totals[r.q-1][0]/3);assert.equal(n.id,r.id);
  for(let ap=1;ap<=3;ap++){const base=raw/10+(ap===r.aptitude?r.to[0]*(k.batch2Data.talents[r.aptitude].coefficients[0]/10):0);assert.ok(near(n.base[ap-1],base)&&near(n.caps[ap-1],Math.round(100*base*1.5)/100)&&near(n.totals[ap-1],base),`aptitude ${r.id}:${ap}`);}}
 Object.assign(checks,{nativeEffects:true,talentFormulas:true,aptitudeCap:aptitudeRows.length>0});
 return checks;
}
function validateResults(k,source,results,{initial=true}={}){
 const copies=results.copies.filter(c=>c.family===group),names=copies.map(c=>c.name);
 assert.ok(results.completed,'suite not completed');
 assert.deepEqual(names,initial?['random-talents-matrix','random-talents-lifecycle']:['random-talents-representative','random-talents-lifecycle']);
 assert.deepEqual(copies.map(c=>c.cases),initial?[INITIAL.matrixCases,INITIAL.lifecycleCases]:[REPRESENTATIVE_CASES,INITIAL.lifecycleCases]);
 const derived=copies.map(c=>copyChecks(c,k,source)),required=require('./verification-requirements.cjs').requiredChecks(group);
 const checks=Object.fromEntries(required.map(check=>[check,derived.some(d=>d[check]===true)&&derived.every(d=>d[check]!==false)]));
 assert.ok(Object.values(checks).every(Boolean),'native checks incomplete: '+JSON.stringify(checks));
 const validation={version:1,evidenceHash:sha(copies.map(c=>c.evidence)),manifestHash:sha(copies.map(c=>({name:c.name,cases:c.cases,lifecycle:c.lifecycle,steps:c.steps.map(s=>[s.step,s.script,s.ok])}))),...(initial?INITIAL:{})};
 return {checks,validation,copies:copies.map(c=>({name:c.name,operations:c.cases}))};
}
function initialProblem(initial){return !initial||initial.coverage!=='initial-matrix'||initial.matrixCases!==INITIAL.matrixCases||initial.lifecycleCases!==INITIAL.lifecycleCases||initial.formulaCases!==INITIAL.formulaCases||Object.keys(initial.fingerprints||{}).length!==15||!hashPattern.test(initial.dataHash||'')||!hashPattern.test(initial.formulaHash||'')||!hashPattern.test(initial.evidenceHash||'')||!hashPattern.test(initial.manifestHash||'');}
function record(k,source,{date,platform,checks,coverage='representative',copies,validation,initialVerification}){
 if(coverage==='initial-matrix')initialVerification={coverage,...binding(k,source),...validation};
 assert.ok(!initialProblem(initialVerification),'首次完整矩陣證明缺失');
 assert.ok(validation&&hashPattern.test(validation.evidenceHash||'')&&hashPattern.test(validation.manifestHash||''),'缺少原生結果摘要');
 return {date,platform,...binding(k,source),coverage,copies,validation,initialVerification,groups:{[group]:{checks}}};
}
function problem(k,proof,source){
 if(proof?.schemaVersion===2)return require('./migration-proof.cjs').problem(k,proof,source,group);
 const p=proof?.randomCharacterTalents,expected=binding(k,source),required=require('./verification-requirements.cjs').requiredChecks(group);
 if(!p||!k.randomCharacterTalents||Object.keys(expected.fingerprints).length!==15||!same({gameVersion:p.gameVersion,fingerprints:p.fingerprints,dataHash:p.dataHash,formulaHash:p.formulaHash},expected)||initialProblem(p.initialVerification)||!['initial-matrix','representative'].includes(p.coverage)||p.validation?.version!==1||!hashPattern.test(p.validation?.evidenceHash||'')||!required.every(c=>p.groups?.[group]?.checks?.[c]===true))return '一般隨機角色天賦等級缺少相符的獨立首次驗證';
 if(p.coverage==='initial-matrix'&&!same(p.initialVerification,{coverage:p.coverage,...expected,...p.validation}))return '一般隨機角色天賦等級首次證明與目前來源不符';
 return null;
}
function requireNativeRunner(){
 const family=require('./verification-suite.cjs').families.randomCharacterTalents;
 if(family.pendingReason)throw Error(family.pendingReason+'；不可產生或合併成功證明');
}
module.exports={group,sha,INITIAL,LIFECYCLE_EVENTS,formulaHash,dataHash,binding,readEvidence,expectedRows,copyChecks,validateResults,initialProblem,record,problem,requireNativeRunner};
