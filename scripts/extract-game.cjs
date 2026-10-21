#!/usr/bin/env node
'use strict';
// Only the expression factory array is evaluated in an empty, timed VM. The game is never run.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

function inspectGame(root) {
  const bytes = name => fs.readFileSync(path.join(root, name));
  const runtime = bytes('scripts/c3runtime.js').toString('utf8');
  const project = JSON.parse(bytes('data.json')).project;
  const marker = 'self.C3_ExpressionFuncs = ';
  const start = runtime.indexOf(marker);
  if (start < 0 || !Array.isArray(project?.[6])) throw Error('不支援的 Construct 輸出格式');
  const expressions = vm.runInNewContext(runtime.slice(start + marker.length, runtime.lastIndexOf('];') + 1), Object.create(null), { timeout: 3000 });
  if (!expressions.every(f => typeof f === 'function')) throw Error('無法辨識 expression factories');
  const objects = project[3].map(o => o[0]);
  if(objects[12]!=='save')throw Error('save 物件位置已變更，請重新核對 Construct 輸出');
  const refStart = runtime.indexOf('self.C3_GetObjectRefTable = function');
  const refEnd = runtime.indexOf('self.C3_JsPropNameTable =', refStart);
  const refs = runtime.slice(refStart, refEnd).split('\n').filter(s => /^\t\tC3\./.test(s)).map(s => s.trim().replace(/,$/, ''));
  const variables = new Map();
  function visit(v, fn) { if (!Array.isArray(v)) return; fn(v); for (const c of v) visit(c, fn); }
  visit(project[6], v => { if (v[0] === 1 && typeof v[1] === 'string' && typeof v[6] === 'number') variables.set(v[6], v[1]); });
  function constant(a) {
    if (!Array.isArray(a?.[1]) || !expressions[a[1][0]]) return null;
    const body = expressions[a[1][0]].toString().replace(/^\(\) => /, '');
    try { const v = JSON.parse(body); return ['string', 'number', 'boolean'].includes(typeof v) ? v : null; } catch { return null; }
  }
  function argument(a) {
    if (!Array.isArray(a)) return a;
    if (a[0] === 3) return { variable: variables.get(a[1]) || String(a[1]) };
    if (a[0] === 1 && Number.isInteger(a[1])) return { object: objects[a[1]], reference: refs[a[2]] };
    if (a[0] === 5) return { function: a[1] };
    return { kind: a[0], id: a[1] };
  }
  function expression(a) {
    const c = constant(a);
    if (c !== null) return { constant: c };
    return { expression: a?.[1]?.[0], arguments: a?.[1]?.slice(1).map(argument) || [] };
  }
  const operations = [], functions = [], events = [], reads=[];
  function readArguments(text,nodeIndex){
    const results=[],needle=`n${nodeIndex}.ExpObject(`;let start=0;
    while((start=text.indexOf(needle,start))>=0){
      let depth=1,quote='',escaped=false,part='',parts=[];
      for(let i=start+needle.length;i<text.length;i++){
        const c=text[i];if(quote){part+=c;if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue;}
        if(c==='"'||c==="'"){quote=c;part+=c;continue;}
        if(c==='('||c==='['||c==='{')depth++;
        if(c===')'||c===']'||c==='}')depth--;
        if(depth===0){parts.push(part);start=i+1;break;}
        if(c===','&&depth===1){parts.push(part);part='';}else part+=c;
      }
      results.push(parts.map(s=>/^\s*\d+\s*$/.test(s)?Number(s):'*'));if(!parts.length)break;
    }
    return results;
  }
  function walk(v, sheet, context = '', event = null) {
    if (!Array.isArray(v)) return;
    if (v[0] === 4 && Array.isArray(v[1]) && typeof v[1][0] === 'string') {
      context = v[1][0]; functions.push({ name: context, sheet, sid: v[4] });
    }
    if ((v[0] === 0 || v[0] === 4) && v.length >= 8 && Number.isInteger(v[4]) && Array.isArray(v[7])) {
      event = v[4]; events.push({ sheet, function: context, sid: event });
      for(const branch of [v[6],v[7]])visit(branch,a=>{
        if(![0,1,7].includes(a[0])||!Array.isArray(a[1]))return;
        const factory=expressions[a[1][0]];if(!factory)return;
        for(const [i,arg]of a[1].slice(1).entries())if(arg?.[0]===1&&arg[1]===12&&refs[arg[2]]==='C3.Plugins.Arr.Exps.At'){
          for(const coords of readArguments(factory.toString(),i))reads.push({sheet,function:context||'初始化／事件',sid:event,expression:a[1][0],x:coords[0]??'*',y:coords[1]??'*',z:coords[2]??'*'});
        }
      });
      for (const action of v[7]) {
        if (action?.[0] !== 12 || !Array.isArray(action[6])) continue;
        const op = refs[action[1]];
        if (op?.startsWith('C3.Plugins.Arr.')) operations.push({ sheet, function: context || '初始化／事件', sid: event, actionSid: action[3], operation: op.split('.').pop(), params: action[6].map(expression) });
      }
      for (const child of v[8] || []) walk(child, sheet, context, event);
      return;
    }
    for (const c of v) walk(c, sheet, context, event);
  }
  for (const sheet of project[6]) walk(sheet[1], sheet[0]);
  const fingerprints = {};
  for (const name of ['data.json', 'scripts/c3runtime.js', ...Object.values(tableSpecs).map(([file])=>file+'.json')]) fingerprints[name] = crypto.createHash('sha256').update(bytes(name)).digest('hex');
  return { root, project, expressions, refs, functions, events, operations, reads, fingerprints, constant };
}

const planeNames = ['山寨與全局', '存檔識別與建築', '角色基本資料', '招募候選角色', '角色職業等級', '角色職業經驗', '主地圖格網', '背包物品', '未辨識層 8', '裝備庫與穿戴', '戰鬥地圖格網', '城市商店', '角色衍生屬性', '鍛造佇列', '未辨識層 14', '引導任務', '角色重生／渡劫', '內丹', '靈物背包', '靈物配置', '角色戰鬥位置', '設施進程'];
const tableSpecs = { materials: ['cl', 1, 3], characters: ['js', 1, null], professions: ['zy', 1, 2], attributes: ['sx', 1, 2], items: ['wp', 1, 5], technologies: ['kj', 1, 2], buildings: ['jz', 1, 3], quests: ['rw', 1, 2], talents: ['tf', 1, 4], facilities: ['ss', 1, 3], relics: ['lw', 1, 3] };

function createCatalog(game) {
  const reviewed = {
    '6661d77209c0e98069219965908fd4d6b9ee3dca84763c158dcd5f0a863df665': { version: 'V1.0.9.1', runtimes: ['b5bf45f38e8165bbd5093702695486fe77797a27914bba8b1fdd5f46658396bc','58d634814f9ee8145ad553ffde60a6a511b5f68cf27f7ba86933d66216901998'] },
    '32a36accc1b97e9bb3498eb3be76950e1e72b2e8f7a0cf9ce293b57aa5e0d820': { version: 'V1.0.10.2', runtimes: ['1e1643722efc032824881f03ce4d81df1135e6a8cd8e08d9fd87e56e480ac9f6'] }
  }[game.fingerprints['data.json']];
  if(!reviewed) {
    // Catalog coordinates and growth formulas must be reviewed when the event data changes.
    throw Error('遊戲事件指紋已變更，請先重新核對欄位及規則；未產生可編輯知識。');
  }
  if(!reviewed.runtimes.includes(game.fingerprints['scripts/c3runtime.js']))throw Error('JavaScript 指紋已變更，請重新核對 expression 規則');
  const catalogs = {};
  for (const [kind, [file, nameColumn, typeColumn]] of Object.entries(tableSpecs)) {
    const { data } = JSON.parse(fs.readFileSync(path.join(game.root, file + '.json'), 'utf8'));
    catalogs[kind] = data.map((r, id) => ({ id, name: r[nameColumn]?.[0], category: typeColumn === null ? '' : r[typeColumn]?.[0] })).filter(r => r.id && typeof r.name === 'string' && r.name.trim());
    if (kind === 'materials') for (const r of catalogs[kind]) r.tier = data[r.id][2][0];
    if (kind === 'items') for (const r of catalogs[kind]) {
      r.kind = data[r.id][4][0]; r.slot = data[r.id][6][0];
    }
    if (kind === 'technologies') for (const r of catalogs[kind]) {
      r.advanced = r.id >= 31 && r.id <= 44 && Number.isSafeInteger(data[r.id][5][0]);
      r.tableLimit = Number.isSafeInteger(data[r.id][5][0]) ? data[r.id][5][0] : null;
    }
    if (kind === 'professions') for (const r of catalogs[kind]) {
      r.tier = data[r.id][3][0];
      r.family = data[r.id][4][0];
      r.prerequisites = [10,11,12].map(column=>data[r.id][column][0]).filter(id=>id>0);
    }
  }
  // Only derived rules needed by the two batch-two operations, not full source tables.
  const table = name => JSON.parse(fs.readFileSync(path.join(game.root,name+'.json'),'utf8')).data.map(row=>row.map(c=>c[0]));
  const sx=table('sx'),wp=table('wp'),cl=table('cl'),js=table('js'),tf=table('tf'),yx=table('yx');
  const batch2Fingerprints=Object.fromEntries(['yx.json','tz.json'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(game.root,file))).digest('hex')]));
  const batch2Data={
    items:Object.fromEntries(catalogs.items.map(({id})=>[id,{tier:wp[id][3],setLink:wp[id][16],mainAttributes:wp[id].slice(8,11),affixIds:sx.map((r,id)=>({r,id})).filter(({r})=>r[8]===1&&(wp[id][23]==='战斗'?['战斗','通用'].includes(r[13]):wp[id][23]==='生产'?['生产','通用'].includes(r[13]):wp[id][23]==='通用'&&r[13+wp[id][9]-39]!==1)).map(({id})=>id)}])),
    characters:Object.fromEntries(catalogs.characters.map(({id})=>[id,{base:js[id].slice(10,13),talents:js[id].slice(51,54),talentLevels:js[id].slice(54,57)}])),
    talents:Object.fromEntries(catalogs.talents.map(({id})=>[id,{attributes:tf[id].slice(7,10),coefficients:tf[id].slice(10,13)}])),
    pills:Object.fromEntries(catalogs.materials.filter(({id})=>cl[id][5]==='丹药'&&['力量丹','敏捷丹','智力丹'].includes(cl[id][3])).map(({id})=>[id,{aptitude:['力量丹','敏捷丹','智力丹'].indexOf(cl[id][3])+1,cap:yx[cl[id][2]][cl[id][6]],effect:Math.round(cl[id][2]**1.2*2**(cl[id][6]-1))/10}]))
  };
  // Reviewed percent-stat branches in 装备主属性; separate from v2.2 proof data.
  const affixReplacement={version:1,sourceSids:[557896778643212,773239288013696,712721902672178,131416746119248,573912943040867],
    attributes:Object.fromEntries(sx.map((r,id)=>({r,id})).filter(({r})=>r[8]===1).map(({r,id})=>{
      if(r[4]!=='百分比')throw Error('詞條單位已變更，需重新核對');
      const formula=[12,51].includes(id)?[2,.75,.01,5299]:[13,52].includes(id)?[8,3,.4,5300]:[71,72].includes(id)?[2,.75,.1,5302]:[4,1.5,.2,5304];
      return [id,{unit:'%',base:formula[0],tier:formula[1],level:formula[2],expression:formula[3]}];
    }))};
  const affixReplacementLimits={plane:9,maxTier:9,maxQuality:6,selectedSlotOnly:true,allowNewDuplicates:false,originSlot:'positive-in-bounds-not-row-identity',mainQualityCoefficient:'integer-original-range-when-overlapping',attributeIds:Object.keys(affixReplacement.attributes).map(Number)};
  const equipmentWorkflowLimits={version:1,planes:[7,9],backpack:{minTier:1,maxTier:9,minQuality:1,maxQuality:6,quantity:1,owner:0,advanced:false},newItemMarkers:[0,1],unknownStateColumns:[25,26,27],firstSelection:'all-flags-zero-explicit-atomic',identity:'plane-and-current-row',sourceSids:[166680919655131,666416688115651,644557287879738,196601779910507,775039415186059,564254928232839,959041203712077,418018161514165]};
  // Name conversion only; evidence identifiers and source paths remain unchanged.
  const glossaryFile = path.join(__dirname, '../knowledge/traditional-names.json');
  const glossary = fs.existsSync(glossaryFile) ? JSON.parse(fs.readFileSync(glossaryFile, 'utf8')) : {};
  const words = [...new Set(Object.values(catalogs).flat().flatMap(r => [r.name, String(r.category || '')]))].filter(Boolean).sort();
  if (process.platform === 'darwin') {
    const result = spawnSync('/usr/bin/swift', [path.join(__dirname, 'to-traditional.swift')], { input: words.join('\n'), encoding: 'utf8', maxBuffer: 1024 * 1024 });
    if (result.status !== 0) throw Error('繁體名稱轉換失敗：' + result.stderr);
    const converted = result.stdout.trimEnd().split('\n');
    if (converted.length !== words.length) throw Error('繁體名稱轉換筆數不符');
    words.forEach((w, i) => { glossary[w] = converted[i]; });
  }
  for (const rows of Object.values(catalogs)) for (const r of rows) { r.name = glossary[r.name] || r.name; r.category = glossary[r.category] || r.category; }
  const writes = game.operations.filter(o => o.operation === 'SetXYZ');
  const planes = planeNames.map((name, z) => {
    const rows = writes.filter(o => o.params[2]?.constant === z);
    return { z, name, status: rows.length ? '程式證據' : '未辨識', writes: rows.length, reads:game.reads.filter(r=>r.z===z).length, sources: [...new Map(rows.map(o => [o.function, { function: o.function, sheet: o.sheet, sid: o.sid }])).values()], columns: [...new Set(rows.map(o => o.params[1]?.constant).filter(Number.isInteger))].sort((a, b) => a - b) };
  });
  // An index of write locations, not copies of the game's expressions or event bodies.
  const evidence = writes.map(o => ({ sid: o.sid, actionSid: o.actionSid, function: o.function, sheet: o.sheet, x: o.params[0]?.constant ?? '*', y: o.params[1]?.constant ?? '*', z: o.params[2]?.constant ?? '*', refs: o.params.map(p => p.expression ?? null) }));
  return { glossary, catalog: { version: 1, game: 'szmnqea', gameVersion: reviewed.version, equipmentWorkflowLimits, affixReplacement, affixReplacementLimits, fingerprints: game.fingerprints, batch2Fingerprints, batch2Data, batch2Limits:{equipmentAffixCoefficient:{plane:9,maxTier:9,maxQuality:6,selectedSlotOnly:true},pillAptitudeBonus:{maxStage:0,integerBonus:true,ownedPillRequired:true}}, counts: { functions: game.functions.length, setXYZ: writes.length, arrayActions: game.operations.length,readSites:game.reads.length }, planes, catalogs, functions: game.functions, evidence, editingLimits: {equipment:{max:1000},training:{max:1000},technology:{max:1000,maxById:{33:299}}}, verification: { backpackEquipmentLevel:false,backpackEquipmentAffixCoefficient:false,backpackEquipmentAffixReplacement:false,equipmentAffixInitialSelection:false,equipmentNewItemMarker:false,equipmentAffixReplacement:false,equipmentAffixCoefficient:false,pillAptitudeBonus:false,names: false, characterExperience: false, professionExperience: false, skillExperience: false, equipmentLevel:false,equipmentLevelAdvanced:false,professionTrainingCap:false,professionTrainingCapAdvanced:false,advancedTechnologyLevel:false,advancedTechnologyLevelAdvanced:false } } };
}

if (require.main === module) {
  const args = process.argv.slice(2), value = (flag, fallback) => { const i = args.indexOf(flag); return i < 0 ? fallback : args[i + 1]; };
  if (args.includes('--help') || !value('--source')) { console.log('node scripts/extract-game.cjs --source /path/to/unpacked/game [--output knowledge/catalog.json] [--audit /outside/repo/audit.json]\n未知版本只做分析：加上 --audit-only --audit /outside/repo/audit.json，不產生或修改知識目錄。'); process.exit(args.includes('--help') ? 0 : 1); }
  const auditOnly = args.includes('--audit-only'), audit = value('--audit');
  if (auditOnly && !audit) throw Error('--audit-only 需要 --audit 指定 repo 外的分析輸出');
  const auditTarget = audit ? path.resolve(audit) : null;
  if (auditTarget) {
    const relative = path.relative(path.resolve(__dirname, '..'), auditTarget);
    if (relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep))) throw Error('原始分析輸出必須放在 repo 外');
  }
  const game = inspectGame(path.resolve(value('--source')));
  const counts = { functions: game.functions.length, setXYZ: game.operations.filter(o => o.operation === 'SetXYZ').length, arrayActions: game.operations.length, readSites: game.reads.length };
  const writeAudit = () => {
    if (!auditTarget) return;
    fs.mkdirSync(path.dirname(auditTarget), { recursive: true });
    fs.writeFileSync(auditTarget, JSON.stringify({ fingerprints: game.fingerprints, counts, functions: game.functions, operations: game.operations, reads: game.reads }, null, 2));
  };
  if (auditOnly) {
    writeAudit();
    console.log(JSON.stringify({ auditOnly: true, ...counts }));
    process.exit(0);
  }
  const { glossary, catalog } = createCatalog(game);
  const output = path.resolve(value('--output', 'knowledge/catalog.json'));
  if (fs.existsSync(output)) {
    const old = JSON.parse(fs.readFileSync(output, 'utf8'));
    if (JSON.stringify(old.fingerprints) === JSON.stringify(catalog.fingerprints)) catalog.verification = {...catalog.verification,...old.verification};
    if(JSON.stringify(old.equipmentWorkflowLimits)!==JSON.stringify(catalog.equipmentWorkflowLimits)||JSON.stringify(old.affixReplacement)!==JSON.stringify(catalog.affixReplacement)||JSON.stringify(old.batch2Data.items)!==JSON.stringify(catalog.batch2Data.items)||JSON.stringify(old.batch2Fingerprints)!==JSON.stringify(catalog.batch2Fingerprints))for(const group of ['backpackEquipmentLevel','backpackEquipmentAffixCoefficient','backpackEquipmentAffixReplacement','equipmentAffixInitialSelection','equipmentNewItemMarker'])catalog.verification[group]=false;
    if(JSON.stringify(old.affixReplacement)!==JSON.stringify(catalog.affixReplacement)||JSON.stringify(old.affixReplacementLimits)!==JSON.stringify(catalog.affixReplacementLimits)||JSON.stringify(old.batch2Fingerprints)!==JSON.stringify(catalog.batch2Fingerprints))catalog.verification.equipmentAffixReplacement=false;
    if(JSON.stringify(old.batch2Fingerprints)!==JSON.stringify(catalog.batch2Fingerprints)||JSON.stringify(old.batch2Data)!==JSON.stringify(catalog.batch2Data)||JSON.stringify(old.batch2Limits)!==JSON.stringify(catalog.batch2Limits)){catalog.verification.equipmentAffixCoefficient=false;catalog.verification.pillAptitudeBonus=false;}
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(catalog, null, 2) + '\n');
  fs.writeFileSync(path.join(path.dirname(output), 'traditional-names.json'), JSON.stringify(glossary, null, 2) + '\n');
  writeAudit();
  console.log(JSON.stringify({ ...catalog.counts, planes: catalog.planes.length, catalogRows: Object.values(catalog.catalogs).reduce((n, rows) => n + rows.length, 0) }));
}
module.exports = { inspectGame, createCatalog };
