'use strict';
const fs = require('node:fs'), path = require('node:path'), {createHash} = require('node:crypto');
const Core=require('./core-source-proof.cjs');
const S = require('./verification-suite.cjs'), R = require('./verification-requirements.cjs');
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v==='object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])) : v;
const sha = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(canonical(value))).digest('hex');
const same = (a,b) => a===undefined||b===undefined ? a===b : sha(a) === sha(b);
const presentation = name => /^(刷新|打开|关闭|创建界面|生成侧边按钮)|tips|文本|音效|背景音乐|颜色|最大页码|数值显示|转场动画/.test(name) && !/^刷新(全角色全属性|单角色全属性|单角色单属性)/.test(name);

// Explicit native entry points. Calls are followed transitively; display-only callees are tracked separately.
const equipment = ['装备主属性','装备属性计算','装备等级上限','装备词条数量','装备主属性系数','装备词条系数','装备随机词条编号'];
const equipLife = ['词条洗练','词条洗练魂魄','穿戴装备','卸下装备','装备库取出','装备库存入','装备排序'];
const characterLife = ['数值更新','转职','转职条件判断','角色下狱','召回监牢人员','角色重生','角色解雇'];
const dependencies = {
  setEquipmentLevel:{effects:[...equipment,'套装属性','套装数量检测','相同套装数','升级装备','升级最大装备','升级装备货币','基础货币基数'],lifecycle:[...equipLife,'套装合成','合成灵物编号','获得物品','获得灵物'],tables:['wp','sx','tz','lw']},
  treasureLevel:{effects:[...equipment,'升级装备','升级最大装备','升级装备货币','升级装备魂魄','基础货币基数','分解宝物','宝物批量分解','获得魂魄'],lifecycle:[...equipLife,'获得物品','获得魂魄'],tables:['wp','sx']},
  setEquipmentQuality:{effects:[...equipment,'套装属性','套装数量检测','相同套装数'],lifecycle:[...equipLife,'套装合成','合成灵物编号','获得物品','获得灵物'],tables:['wp','sx','tz','lw','tf']},
  growth: {effects:['获得角色经验','获得职业经验','获得技艺经验','角色升级经验','职业升级经验','技艺升级经验'], lifecycle:[], tables:['zy','yx','tz']},
  advanced: {effects:['装备属性计算','加成属性效果','装备等级上限','操练等级上限','科技等级上限'], lifecycle:['穿戴装备','卸下装备','获得职业经验','转职','转职条件判断','科技研究','职业操练','取消设施进程'], tables:['wp','sx','zy','kj','jz','ss']},
  batch2: {effects:[...equipment,'角色资质计算','角色资质上限','普通丹药效果','丹药资质上限'], lifecycle:[...equipLife,'服用普通丹药','角色重生'], tables:['wp','sx','tf','js','yx','tz']},
  affixReplacement: {effects:equipment, lifecycle:equipLife, tables:['wp','sx','tf','yx','tz']},
  equipmentWorkflow: {effects:equipment, lifecycle:equipLife, tables:['wp','sx','tf','yx','tz']},
  equipmentQuality: {effects:equipment, lifecycle:equipLife, tables:['wp','sx','tf','yx','tz']},
  randomCharacterGrowth: {effects:['新刷新招募数据','属性计算','角色资质计算','角色资质上限'], lifecycle:[...characterLife,'服用普通丹药','获得职业经验'], tables:['js','tf','wp','sx','zy','yx','tz']},
  randomCharacterTalents: {effects:['新刷新招募数据','新刷初始角色数据','属性计算','角色资质计算','角色资质上限'], lifecycle:[...characterLife,'服用普通丹药','招募随机角色','招募随机角色2'], tables:['js','tf','wp','sx','zy','yx','tz']},
  randomCharacterSkillCaps: {effects:['新刷新招募数据','数值更新','获得技艺经验','技艺升级经验'], lifecycle:[...characterLife,'招募随机角色2','获得职业经验'], tables:['js','tf','wp','sx','zy','yx','tz']}
};
const sharedIo = ['存档','存档备份','读取进度'];
// SaveCore methods each family's native evidence depends on: verify-game's shared editSave steps, the scenario operations,
// batch requests and the family's own Node validators. tests/core-slice-roots.test.cjs keeps this list complete.
const sharedCoreRoots = ['parse','serialize','transaction','setField','addExperience','get','KNOWLEDGE','experienceNeed'];
const coreRoots = Object.fromEntries(Object.entries({
  setEquipmentLevel:['setEquipmentLevel'],
  treasureLevel:['setEquipmentLevel'],
  setEquipmentQuality:['setEquipmentLevel','setEquipmentLevelInfo','setEquipmentQualityCandidateInfo','previewSetEquipmentQualityCandidate','applySetEquipmentQualityCandidate','setEquipmentQualityCandidateEffects'],
  growth:[],
  advanced:['setEquipmentLevel','setProfessionTrainingCap','setAdvancedTechnologyLevel','editingInfo'],
  batch2:['setEquipmentAffixCoefficient','setPillAptitudeBonus','pillInfo','setRelicAttributes','previewRelicAttributes','relicAttributesInfo'],
  affixReplacement:['setEquipmentAffix','equipmentAffixReplacementInfo','previewEquipmentAffixReplacement'],
  equipmentWorkflow:['setEquipmentAffixCoefficient','setEquipmentAffix','setEquipmentLevel','equipmentAffixReplacementInfo','previewEquipmentAffixReplacement'],
  equipmentQuality:['setEquipmentQuality','previewEquipmentQualityChange'],
  randomCharacterGrowth:['setCharacterBaseAptitudes','randomCharacterGrowthInfo'],
  randomCharacterTalents:['setCharacterTalents','previewCharacterTalents','randomCharacterTalentsInfo','randomCharacterGrowthInfo','talentEffect'],
  randomCharacterSkillCaps:['setCharacterSkillCaps','previewCharacterSkillCaps','randomCharacterSkillCapsInfo','skillCapCombinations','previewBatch','applyBatch']
}).map(([family,roots])=>[family,[...sharedCoreRoots,...roots]]));
// Existing editable save regions. Additional writers are dependencies even when no declared entry point calls them.
const regions = {
  setEquipmentLevel:[[7,'*',[0,59]],[9,'*',[0,59]],[2,'*',[16,21]]],
  treasureLevel:[[7,'*',[0,59]],[9,'*',[0,59]],[2,'*',[16,21]]],
  setEquipmentQuality:[[7,'*',[0,59]],[9,'*',[0,59]],[2,'*',[16,21]]],
  growth:[[0,1,1],[0,[1,5],2],[2,'*',1],[2,'*',[3,5]],[2,'*',[31,48]],[4,'*','*'],[5,'*','*']],
  advanced:[[0,[31,44],4],[0,'*',5],[9,'*',6]],
  batch2:[[2,'*',[13,15]],[9,'*',[8,20]]], affixReplacement:[[9,'*',[8,33]]],
  equipmentWorkflow:[[7,'*','*'],[9,'*',[24,33]]], equipmentQuality:[[7,'*',[5,33]],[9,'*',[5,33]]],
  randomCharacterGrowth:[[2,'*',[10,15]],[3,'*',[10,15]]], randomCharacterSkillCaps:[[2,'*',[22,48]],[3,'*',[22,48]]],
  randomCharacterTalents:[[12,'*',[1,3]],[12,'*',[21,23]],[2,'*',[10,15]],[3,'*',[51,56]]]
};

// Version 2 supplements the legacy digest retained by the original, reviewed extraction allowlists.
function semanticIndex(game) {
  const objects = game.project[3].map(o => o[0]), nodes = new Map(), variables = new Map(), functions = new Map(game.functions.map(f => [f.name,f.sid]));
  const isEvent = v => Array.isArray(v) && [0,4].includes(v[0]) && Number.isInteger(v[4]) && Array.isArray(v[7]);
  function visit(v) { if (!Array.isArray(v)) return; if (isEvent(v)) nodes.set(v[4],v); if (v[0]===1 && typeof v[1]==='string' && v.length===9) variables.set(v[6],v.slice(0,8)); for (const c of v) visit(c); }
  visit(game.project[6]);
  const checked = (v, what) => { if (v === undefined) throw Error('無法解析 ' + what); return v; };
  const obj = i => i === -1 ? 'System' : checked(objects[i], '物件 ' + i);
  const ref = i => checked(game.refs[i], '參照 ' + i);
  function bound(a, calls) {
    if (!Array.isArray(a)) throw Error('未知 expression 引數');
    switch (a[0]) {
      case 0: return [0,obj(a[1]),a[2],ref(a[3]),...a.slice(4)];
      case 1: return [1,obj(a[1]),ref(a[2]),...a.slice(3)];
      case 2: return [2,obj(a[1]),...a.slice(2)];
      case 3: return [3,a[1],checked(variables.get(a[1]),'變數 '+a[1]),...a.slice(2)];
      case 4: return [4,ref(a[1]),...a.slice(2)];
      case 5: if (typeof a[1] !== 'string') throw Error('動態函式參照'); calls.add(a[1]); return a;
      default: throw Error('未知 expression 引數種類 ' + a[0]);
    }
  }
  function parameter(p, calls) {
    if (!Array.isArray(p)) return p;
    if (p[0] === 4 && Number.isInteger(p[1])) return [4,obj(p[1]),...p.slice(2)];
    if (p[0] === 11) return [11,p[1],checked(variables.get(p[1]),'變數 '+p[1])];
    if (Array.isArray(p[1])) {
      const factory = checked(game.expressions[p[1][0]], 'expression ' + p[1][0]);
      return [p[0],[factory.toString().replace(/\r\n/g,'\n'),...p[1].slice(1).map(a => bound(a,calls))],...p.slice(2)];
    }
    return p;
  }
  function ace(a,calls) {
    if (!Array.isArray(a)) throw Error('未知 ACE');
    let target, operation;
    if (a[0] === -2) { target = 'Function'; operation = a[1]; if (typeof operation !== 'string') throw Error('動態函式呼叫'); calls.add(operation); }
    else { target = obj(a[0]); operation = ref(a[1]); }
    return [target,operation,...a.slice(2,-1),Array.isArray(a.at(-1)) ? a.at(-1).map(p => parameter(p,calls)) : a.at(-1)];
  }
  const declaration = v => !Array.isArray(v) ? v : v[0] === 1 && typeof v[1] === 'string' && v.length === 9 ? v.slice(0,8) : v.map(declaration);
  const renderingAction = a => a[0] === -2 ? presentation(a[1]) : a[0] >= 0 && /文本|图标|面板|标识|按钮|tips|角色名|进度条|背景/.test(objects[a[0]] || '') && /\.(?:SetText|ZMoveToObject|SetVisible|SetOpacity|SetFont.*|SetPos|SetX|SetY|SetSize|SetWidth|SetHeight|SetAnimation|Destroy)$/.test(game.refs[a[1]] || '');
  const containsFunction = v => Array.isArray(v) && (v[0]===5 && typeof v[1]==='string' || v.some(containsFunction));
  const renderingOnly = v => isEvent(v) && v[6].every(a=>a[0]!==-2&&!containsFunction(a.at(-1))) && v[7].every(renderingAction) && (v[8] || []).every(renderingOnly);
  function node(v,calls,omitRendering = false) {
    if (!isEvent(v)) return declaration(v);
    if (omitRendering && v[0]!==4 && renderingOnly(v)) return null;
    return {sid:v[4],type:v[0],head:declaration(v[1]),flags:[v[2],v[3]],conditions:v[6].map(a=>ace(a,calls)),actions:v[7].filter(a=>!omitRendering || !renderingAction(a)).map(a=>ace(a,calls)),children:(v[8]||[]).map(n=>node(n,calls,omitRendering)).filter(n=>n!==null)};
  }
  function digest(roots, {follow = true, omitPresentation = true} = {}) {
    const pending = [...roots], seen = new Set(), records = [], unknown = [];
    while (pending.length) {
      const key = pending.pop(), sid = typeof key === 'string' ? functions.get(key) : key;
      if (seen.has(sid)) continue;
      seen.add(sid);
      try {
        const calls = new Set(), tree = node(checked(nodes.get(sid),'事件 ' + key),calls,omitPresentation);
        records.push([sid,tree]);
        if (follow) for (const name of calls) if (!omitPresentation || !presentation(name)) pending.push(name);
      } catch (e) { unknown.push(String(key) + ': ' + e.message); }
    }
    return {digest:sha(records.sort((a,b)=>a[0]-b[0])), unknown:unknown.sort(), events:records.length, sources:Object.fromEntries(records.map(([sid,tree])=>[sid,sha(tree)]))};
  }
  return {digest,nodes,functions,canonical:sid=>node(nodes.get(sid),new Set())};
}
function semanticDigest(game,sids) { const result = semanticIndex(game).digest(sids); if (result.unknown.length) throw Error(result.unknown.join('; ')); return result.digest; }
function tableHash(source, table) {
  const data = JSON.parse(fs.readFileSync(path.join(source,table + '.json'),'utf8')).data;
  // Names and the three reviewed profession description columns are not write rules.
  return sha(data.map(row => row.map((cell,i) => i === 1 || table === 'zy' && [5,27,31].includes(i) ? null : cell)));
}
function snapshot(game, coreSource) {
  const index = semanticIndex(game), roles = {}, unknown = [], table = {};
  const take = (roots, options) => { const d = index.digest(roots,options); unknown.push(...d.unknown); return d.digest; };
  // Include asynchronous save-array JSON callbacks, not only the named entry points.
  const callbacks = [...index.nodes].filter(([,n]) => n[6].concat(n[7]).some(a => a[0] === 12 && /JSONLoad|AsJSON/.test(game.refs[a[1]] || ''))).map(([sid])=>sid);
  const runtime=fs.readFileSync(path.join(game.root,'scripts/c3runtime.js'),'utf8'),refStart=runtime.indexOf('self.C3_GetObjectRefTable = function');
  if(refStart<0)unknown.push('無法解析 runtime 支援區');
  const io = sha({events:take([...sharedIo,...callbacks]),layout:game.project[3][12],support:sha(runtime.slice(0,Math.max(0,refStart)))});
  const match = (v,spec) => v === null || v === '*' || spec === '*' || (Array.isArray(spec) ? v>=spec[0] && v<=spec[1] : v===spec);
  for (const [family, spec] of Object.entries(dependencies)) {
    const data = spec.tables.map(name => [name,table[name] ??= tableHash(game.root,name)]);
    const writers = [...new Set(game.operations.filter(op => {
      if (op.operation !== 'SetXYZ') return false;
      const [x,y,z] = op.params.slice(0,3).map(p=>p.constant ?? '*');
      // Equipment library parameters select z7/z9; they are not character planes just because z is dynamic.
      if (z==='*' && op.function==='套装合成' && !['advanced','batch2','affixReplacement','equipmentWorkflow','equipmentQuality'].includes(family)) return false;
      return regions[family].some(([pz,px,py])=>match(z,pz)&&match(x,px)&&match(y,py));
    }).map(op=>op.sid))];
    roles[family] = {io, effects:sha({events:take(spec.effects),data}), lifecycle:sha({events:take(spec.lifecycle),writers:take(writers,{follow:false}),data})};
  }
  const ui = Object.fromEntries(Object.entries(R.uiEvents).map(([check,sids])=>[check,index.digest(sids,{omitPresentation:false})]));
  for (const [name,d] of Object.entries(ui)) roles[name] = d.digest;
  return {version:2,fingerprints:{...game.fingerprints,...Object.fromEntries(['yx','tz'].map(t=>[t+'.json',sha(fs.readFileSync(path.join(game.root,t+'.json')))]))},coreHash:Core.hash(coreSource),coreHashAlgorithm:Core.algorithm,...(Core.slices(coreSource,coreRoots)?{coreSlices:Core.slices(coreSource,coreRoots)}:{}),roles,unknown:[...new Set(unknown)]};
}
function owners(group,check) {
  const own=S.familyOf(group);
  if(S.families[own]?.checks[check])return [own];
  return Object.keys(S.families).filter(f => S.families[f].groups.some(g=>R.sectionOf(g)===R.sectionOf(group)) && S.families[f].checks[check]);
}
function role(check, family) {
  const step = S.families[family].checks[check];
  if (step === 'ui') return 'ui';
  return step === 'lifecycle' ? 'lifecycle' : /^oracle/.test(step) ? 'effects' : 'io';
}
// Slices recorded in the snapshot, or bridged from knowledge/core-slice-baselines.json for a proven pre-slice snapshot.
function sliceTable(snap) {
  if (snap.coreSlices) return snap.coreSlices.algorithm===Core.sliceAlgorithm ? snap.coreSlices : null;
  return Core.sliceBridge(snap.coreHash,snap.coreHashAlgorithm);
}
// Core identity a check depends on: the slices of its owner families, else the full core (unsliceable or unknown).
function coreIdentity(snap,families) {
  const full = Core.identity(snap.coreHash,snap.coreHashAlgorithm), table = sliceTable(snap);
  if (table && families.every(f=>/^[a-f0-9]{64}$/.test(table.hashes[f]||''))) return {algorithm:table.algorithm,slices:[...new Set(families)].sort().map(f=>[f,table.hashes[f]])};
  return full;
}
function checkDigest(snap,group,check) {
  if (R.uiChecks[group] === check) return snap.roles[check];
  const deps = owners(group,check).map(f=>{const part=role(check,f),r=snap.roles[f];return [f,part,part==='io'&&r?.io&&r?.effects?sha({io:r.io,effects:r.effects}):part==='lifecycle'&&r?.io&&r?.lifecycle?sha({io:r.io,lifecycle:r.lifecycle}):r?.[part]];});
  if (!deps.length || deps.some(d=>!d[2])) throw Error('缺少檢查相依資訊：' + group + ':' + check);
  return sha({coreHash:coreIdentity(snap,deps.map(d=>d[0])),deps});
}
function plan(previous, current, groups, {mode='auto'}={}) {
  if (!['auto','full'].includes(mode)) throw Error('Unknown migration mode: ' + mode);
  if (current.unknown.length || previous?.unknown?.length) return {version:2,mode,blocked:true,reason:'無法解析來源相依資訊',unknown:[...new Set([...current.unknown,...previous?.unknown||[]])],families:{},checks:{}};
  if (!previous || previous.version !== 2) throw Error('缺少語意基準；請先以已驗證來源建立 --baseline');
  const checks = {}, families = {};
  for (const group of groups) {
    checks[group] = {};
    for (const check of R.requiredChecks(group)) {
      const ui = R.uiChecks[group] === check, changed = checkDigest(previous,group,check) !== checkDigest(current,group,check);
      checks[group][check] = ui ? (changed ? 'deferred' : 'carried') : mode === 'full' || changed ? 'native' : 'carried';
      if (!ui && checks[group][check] === 'native') for (const f of owners(group,check)) {
        const entry = families[f] ??= {effects:false,lifecycle:false,formulas:false,reasons:[]};
        const part = role(check,f); entry[part === 'io' ? 'effects' : part] = true;
        if (!entry.reasons.includes(part)) entry.reasons.push(part);
        if (f === 'equipmentQuality' && (mode === 'full' || previous.roles[f].effects !== current.roles[f].effects)) entry.formulas = true;
      }
    }
  }
  return {version:2,mode,blocked:false,sameSource:same(previous.fingerprints,current.fingerprints),families,checks,computerUse:false};
}
module.exports = {sha,same,dependencies,regions,sharedCoreRoots,coreRoots,sliceTable,coreIdentity,semanticIndex,semanticDigest,snapshot,checkDigest,owners,role,plan};
