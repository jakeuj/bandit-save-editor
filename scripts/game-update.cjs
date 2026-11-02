#!/usr/bin/env node
'use strict';
// Routine game update (docs/maintenance/game-update.md): check classifies the new Steam package against the current
// knowledge, apply registers a routine version, smoke runs one hidden Mac round trip. Sources and saves stay outside the repo.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync,spawnSync}=require('node:child_process');
const {members,files:sourceFiles}=require('./migration-source.cjs');
const root=path.resolve(__dirname,'..');
const args=process.argv.slice(2),command=['check','apply','smoke'].includes(args[0])?args[0]:'check';
const opt=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const writeJson=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const knowledgeFile=path.join(root,'knowledge/catalog.json'),proofFile=path.join(root,'knowledge/verification.json');
const artifactsRoot=path.resolve(opt('--artifacts',path.join(os.homedir(),'bandit-verification/artifacts')));
// Every reviewed version so far patched the same path sites: appFolder, nwjsAppFolder, savedir\ ×4, backup\ ×4.
const MAC_PATCH_COUNTS=[1,1,4,4];

function steamCommon(){
 const mac=path.join(os.homedir(),'Library/Application Support/CrossOver/Bottles/NGO-Steam-0/drive_c/Program Files (x86)/Steam/steamapps/common');
 return process.platform==='win32'?'C:\\Program Files (x86)\\Steam\\steamapps\\common':mac;
}
function packageDir(){
 if(opt('--package'))return path.resolve(opt('--package'));
 const found=['塔防山贼模拟器','bandit'].map(n=>path.join(steamCommon(),n)).find(d=>fs.existsSync(path.join(d,'package.nw')));
 if(!found)throw Error('找不到 Steam 遊戲目錄，請用 --package 指定');
 return found;
}
function steamBuild(dir){
 const apps=path.resolve(dir,'../..'),name=path.basename(dir);
 for(const f of fs.existsSync(apps)?fs.readdirSync(apps).filter(f=>/^appmanifest_\d+\.acf$/.test(f)):[]){
  const text=fs.readFileSync(path.join(apps,f),'utf8');
  if(text.match(/"installdir"\s+"([^"]*)"/)?.[1]===name)return text.match(/"buildid"\s+"(\d+)"/)?.[1]??null;
 }
 return null;
}
// gg.json column 2 is the newest version; rows below it are that version's update notes.
function announcements(gg,since){
 const out=[];
 for(let x=2;x<gg.data.length;x++){const v=String(gg.data[x][0][0]).trim();if(v===since)break;out.push({version:v,notes:gg.data[x].slice(1).map(c=>c[0]).filter(s=>typeof s==='string'&&s.trim())});}
 return out;
}
function workDir(version){
 const date=new Date().toLocaleDateString('sv').replace(/-/g,'');
 const existing=fs.existsSync(artifactsRoot)?fs.readdirSync(artifactsRoot).find(n=>n.startsWith(version.toLowerCase()+'-update-')):null;
 return path.join(artifactsRoot,existing||`${version.toLowerCase()}-update-${date}`);
}
function extractSource(pkg,dir){
 const target=path.join(dir,'source'),wanted=[...sourceFiles,'zddt.json'];
 const entries=members(path.join(pkg,'package.nw'),wanted);
 for(const [name,bytes]of entries){const dest=path.join(target,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);}
 return target;
}
// The previous version's source: any extracted copy outside the repo whose events and runtime match the current knowledge.
function previousSource(proof){
 if(opt('--previous'))return path.resolve(opt('--previous'));
 const candidates=[];
 for(const update of fs.existsSync(artifactsRoot)?fs.readdirSync(artifactsRoot):[]){
  const base=path.join(artifactsRoot,update);if(!fs.statSync(base).isDirectory())continue;
  for(const name of fs.readdirSync(base).filter(n=>/^source/.test(n))){
   const dir=path.join(base,name);
   try{if(sha(fs.readFileSync(path.join(dir,'data.json')))===proof.eventFingerprint&&sha(fs.readFileSync(path.join(dir,'scripts/c3runtime.js')))===proof.runtimeFingerprint)candidates.push(dir);}catch{}
  }
 }
 const best=candidates.find(d=>fs.existsSync(path.join(d,'zddt.json')))||candidates[0];
 if(!best)throw Error('找不到上一版的精簡來源（data.json 與 c3runtime 指紋相符者），請用 --previous 指定');
 return best;
}

// One line per event condition/action, object and variable indices replaced by names, expressions by their source.
function flatten(g){
 const objects=g.project[3].map(o=>o[0]),vars=new Map();
 (function visit(v){if(!Array.isArray(v))return;if(v[0]===1&&typeof v[1]==='string'&&typeof v[6]==='number')vars.set(v[6],v[1]);for(const c of v)visit(c);})(g.project[6]);
 const isEvent=v=>Array.isArray(v)&&(v[0]===0||v[0]===4)&&Number.isInteger(v[4])&&Array.isArray(v[7]);
 const src=i=>{const f=g.expressions[i];return f?f.toString().replace(/\s+/g,' '):'?expr'+i;};
 const node=n=>{
  if(!Array.isArray(n))return n;
  if(n[0]===1&&Number.isInteger(n[1]))return ['obj',objects[n[1]],g.refs[n[2]],...n.slice(3)];
  if(n[0]===3)return ['var',vars.get(n[1])??n[1]];
  if(n[0]===5)return ['fn',n[1]];
  if(n[0]===4&&Number.isInteger(n[1]))return ['sys'];
  if(n[0]===2&&Number.isInteger(n[1]))return ['o2',objects[n[1]],...n.slice(2)];
  return n;
 };
 const param=p=>{
  if(!Array.isArray(p))return p;
  if(Array.isArray(p[1])&&Number.isInteger(p[1][0]))return [p[0],src(p[1][0]),...p[1].slice(1).map(node)];
  if(p[0]===4&&Number.isInteger(p[1]))return ['objtype',objects[p[1]]];
  if(p[0]===2&&Number.isInteger(p[1]))return ['p2',objects[p[1]],...p.slice(2)];
  if(p[0]===3)return ['var',vars.get(p[1])??p[1]];
  return p;
 };
 const ace=a=>Array.isArray(a)?[a[0]===-1?'System':a[0]===-2?'call':(objects[a[0]]??('raw'+a[0])),a[0]===-2?a[1]:g.refs[a[1]],...a.slice(2,-1).filter((x,i)=>i!==1),Array.isArray(a.at(-1))?a.at(-1).map(param):a.at(-1)]:a;
 // heads: function parameter lists without the trailing variable index, which shifts with every new variable.
 const out=new Map(),heads=new Map();
 function walk(v,sheet,fn,parent){
  if(!Array.isArray(v))return;
  if(isEvent(v)){
   if(v[0]===4&&Array.isArray(v[1])&&typeof v[1][0]==='string'){fn=v[1][0];heads.set(fn,JSON.stringify((v[1][2]||[]).map(p=>Array.isArray(p)?p.slice(0,-1):p)));}
   const head=JSON.stringify(Array.isArray(v[1])?v[1].map(x=>Array.isArray(x)?x.map(p=>Array.isArray(p)&&p[0]===1&&typeof p[1]==='string'?p.slice(0,-1):p):x):v[1]);
   const lines=['H '+head+' flags '+JSON.stringify([v[2],v[3]])+' parent '+parent,...v[6].map(c=>'C '+JSON.stringify(ace(c))),...v[7].map(c=>'A '+JSON.stringify(ace(c)))];
   out.set(v[4],{fn,sheet,lines,children:(v[8]||[]).filter(isEvent).map(c=>c[4])});
   for(const c of v[8]||[])walk(c,sheet,fn,v[4]);
   return;
  }
  for(const c of v)walk(c,sheet,fn,parent);
 }
 for(const s of g.project[6])walk(s[1],s[0],'',0);
 return {out,heads,objects};
}
// Object renumbering is not a change; the reviewed digests do include it, so those are re-registered instead.
const normalize=l=>l.replace(/\["o2","[^"]*"/g,'["o2"').replace(/\[11,\d+\]/g,'[11]');
function reviewedRoots(catalog){
 const roots=new Set();
 for(const f of ['set-equipment-level','treasure-level','random-character-skill-caps','random-character-talents'])require('./'+f+'-data.cjs').sourceSids.forEach(s=>roots.add(s));
 Object.values(require('./set-equipment-quality-data.cjs').dependencies).forEach(d=>d.sids.forEach(s=>roots.add(s)));
 for(const v of Object.values(catalog))if(Array.isArray(v?.sourceSids))v.sourceSids.forEach(s=>roots.add(s));
 return roots;
}
const MAC_SCRIPT=path.join(root,'launcher/prepare-macos.py');
function macReview(pkg){return JSON.parse(execFileSync('python3',[MAC_SCRIPT,'--source',pkg,'--review-script'],{encoding:'utf8'}));}
function jsonDiff(a,b,prefix,out,limit=40){
 if(JSON.stringify(a)===JSON.stringify(b))return out;
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))jsonDiff(a[k],b[k],prefix+'.'+k,out,limit);return out;}
 if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.some(x=>x&&typeof x==='object')){a.forEach((x,i)=>jsonDiff(x,b[i],prefix+'['+i+']',out,limit));return out;}
 out.count=(out.count||0)+1;if(out.length<limit)out.push(`${prefix}: ${JSON.stringify(a)?.slice(0,120)} → ${JSON.stringify(b)?.slice(0,120)}`);return out;
}

function check(){
 // --source/--version/--build replay an update from an already extracted source (no package, no Mac review).
 const pkg=opt('--source')?null:packageDir(),proof=readJson(proofFile),catalog=readJson(knowledgeFile);
 const gg=pkg?JSON.parse(members(path.join(pkg,'package.nw'),['gg.json']).get('gg.json').toString('utf8').replace(/^\uFEFF/,'')):{data:[]};
 const version=opt('--version')||String(gg.data[2][0][0]).trim(),build=opt('--build')||(pkg&&steamBuild(pkg));
 if(version===proof.gameVersion&&(!build||build===proof.steamBuildId)){console.log(`已是最新：${version}（build ${build??'未知'}），不用改版。`);return {verdict:'current',version,build};}
 const dir=workDir(version);fs.mkdirSync(dir,{recursive:true});
 const {inspectGame,createCatalog,mergeCatalog,reviewedVersions}=require('./extract-game.cjs');
 const source=pkg?extractSource(pkg,dir):path.resolve(opt('--source')),previous=previousSource(proof);
 const g=inspectGame(source),o=inspectGame(previous);
 const blockers=[],notices=[];
 const changedSources=Object.keys(g.fingerprints).filter(f=>g.fingerprints[f]!==o.fingerprints[f]);
 for(const f of ['yx.json','tz.json','zddt.json'])if(fs.existsSync(path.join(previous,f))&&sha(fs.readFileSync(path.join(source,f)))!==sha(fs.readFileSync(path.join(previous,f))))changedSources.push(f);
 const oldReviewed=reviewedVersions[o.fingerprints['data.json']]||{};
 const report={verdict:null,date:new Date().toLocaleDateString('sv'),from:proof.gameVersion,to:version,steamBuildId:build,package:pkg,source,previous,changedSources,
  announcements:announcements(gg,proof.gameVersion),blockers,notices,closedFlags:[],catalogChanges:[],tableChanges:{},mac:null,register:null};
 if(!changedSources.length){
  notices.push(`遊戲內版號 ${version}、build ${build}，但 15 個分析來源都沒變：只更新 build 與版本紀錄`);
 }
 // Functions and their parameter lists: verification tools call natives by name and positional arguments.
 const key=f=>f.sheet+'|'+f.name+'|'+f.sid,oldF=new Set(catalog.functions.map(key)),newF=new Set(g.functions.map(key));
 const fnAdded=g.functions.filter(f=>!oldF.has(key(f))).map(key),fnRemoved=catalog.functions.filter(f=>!newF.has(key(f))).map(key);
 if(fnAdded.length||fnRemoved.length)notices.push(`函式 ${catalog.functions.length}→${g.functions.length}（新增 ${fnAdded.join('、')||'無'}；移除 ${fnRemoved.join('、')||'無'}）`);
 const N=flatten(g),O=flatten(o);
 const paramChanged=[...O.heads].filter(([n,h])=>N.heads.has(n)&&N.heads.get(n)!==h).map(([n])=>n);
 if(paramChanged.length)blockers.push('函式參數清單改變（驗證工具的原生呼叫要補參數）：'+paramChanged.join('、'));
 // SetXYZ write sites are the whole save-level surface.
 const writes=g.operations.filter(x=>x.operation==='SetXYZ');
 const ev=x=>[x.sid,x.actionSid,x.function,x.sheet,x.params[0]?.constant??'*',x.params[1]?.constant??'*',x.params[2]?.constant??'*'].join('|');
 const oldE=new Set(catalog.evidence.map(e=>[e.sid,e.actionSid,e.function,e.sheet,e.x,e.y,e.z].join('|'))),newE=new Set(writes.map(ev));
 const wAdded=[...newE].filter(k=>!oldE.has(k)),wRemoved=[...oldE].filter(k=>!newE.has(k));
 if(wAdded.length||wRemoved.length)blockers.push(`存檔寫入點改變（${catalog.evidence.length}→${writes.length}）：新增 ${wAdded.slice(0,20).join('；')||'無'}；移除 ${wRemoved.slice(0,20).join('；')||'無'}`);
 const opk=x=>[x.sid,x.actionSid,x.function,x.operation].join('|'),oo=new Set(o.operations.map(opk));
 const resized=g.operations.filter(x=>x.operation!=='SetXYZ'&&!oo.has(opk(x))&&/size/i.test(x.operation));
 if(resized.length)blockers.push('新的陣列尺寸操作（存檔層數可能改變）：'+resized.map(opk).join('；'));
 // Reviewed events and their subtrees, compared without object renumbering.
 const roots=reviewedRoots(catalog),all=new Set();
 const add=(m,s)=>{if(all.has(s))return;all.add(s);for(const c of m.get(s)?.children||[])add(m,c);};
 for(const s of roots){add(N.out,s);add(O.out,s);}
 const reviewedChanged=[];
 for(const s of all){const a=O.out.get(s),b=N.out.get(s);if(!a||!b){reviewedChanged.push(`${s} ${(a||b).fn} ${a?'刪除':'新增'}`);continue;}
  if(JSON.stringify(a.lines.map(normalize))!==JSON.stringify(b.lines.map(normalize)))reviewedChanged.push(`${s} ${b.fn}`);}
 if(reviewedChanged.length)blockers.push('已審核事件內容改變：'+reviewedChanged.join('；'));
 const added=[...N.out.keys()].filter(s=>!O.out.has(s)),removed=[...O.out.keys()].filter(s=>!N.out.has(s));
 const changed=[...N.out.keys()].filter(s=>O.out.has(s)&&JSON.stringify(N.out.get(s).lines)!==JSON.stringify(O.out.get(s).lines));
 const touched=[...new Set([...added,...changed].map(s=>N.out.get(s).fn).concat(removed.map(s=>O.out.get(s).fn)))].filter(Boolean);
 report.events={total:N.out.size,added:added.length,removed:removed.length,changed:changed.length,functions:touched};
 if(touched.includes('数值更新'))notices.push('数值更新 有變：Issue #4 的有名角色評估要補一行重核');
 // Expression factories the catalog points at must keep their bodies; a uniform shift becomes the new offset.
 const used=[...new Set([catalog.affixReplacement,catalog.equipmentQuality].flatMap(r=>Object.values(r?.attributes||{}).map(a=>a.expression)).filter(Number.isInteger))];
 const body=(x,i)=>x.expressions[i]?.toString();
 let delta=null;
 for(const d of [0,...Array.from({length:400},(_,i)=>i%2?-(i+1>>1):(i>>1)+1)])if(used.every(i=>body(o,i)!==undefined&&body(g,i+d)===body(o,i))){delta=d;break;}
 if(delta===null)blockers.push('修改器引用的 expression 找不到一致位移：'+used.join(','));
 const exprChanged=[];for(let i=0;i<Math.min(o.expressions.length,g.expressions.length);i++)if(body(o,i)!==body(g,i))exprChanged.push(i);
 report.expressions={used,delta,count:[o.expressions.length,g.expressions.length],changedIndices:exprChanged.length};
 const expressionOffset=(oldReviewed.expressionOffset||0)+(delta||0);
 // Mac launcher path patch sites.
 if(pkg&&g.fingerprints['scripts/c3runtime.js']!==o.fingerprints['scripts/c3runtime.js']){
  try{report.mac=macReview(pkg);const counts=Object.values(report.mac.path_replacements);
   if(JSON.stringify(counts)!==JSON.stringify(MAC_PATCH_COUNTS))blockers.push('Mac 啟動器路徑修正命中數改變：'+JSON.stringify(counts));}
  catch(e){blockers.push('Mac 啟動器路徑修正位置找不到：'+String(e.stderr||e.message).trim());}
 }
 // Candidate knowledge with the old flags carried over, then closed where their source data changed.
 const entry={version,...(expressionOffset?{expressionOffset}:{}),runtimes:[g.fingerprints['scripts/c3runtime.js']]};
 report.register={dataFingerprint:g.fingerprints['data.json'],entry,reused:!!reviewedVersions[g.fingerprints['data.json']]};
 if(!blockers.length)try{
  const {catalog:candidate}=createCatalog(g,reviewedVersions[g.fingerprints['data.json']]||entry);
  candidate.verification={...candidate.verification,...catalog.verification};
  mergeCatalog(catalog,candidate);
  report.closedFlags=Object.keys(catalog.verification).filter(k=>catalog.verification[k]===true&&candidate.verification[k]!==true);
  for(const k of new Set([...Object.keys(catalog),...Object.keys(candidate)]))if(!['gameVersion','fingerprints','verification','counts','functions','evidence','planes'].includes(k)&&JSON.stringify(catalog[k])!==JSON.stringify(candidate[k]))report.catalogChanges.push(k);
  for(const k of report.catalogChanges){const d=jsonDiff(catalog[k],candidate[k],k,[]);report.tableChanges[k]={count:d.count||0,sample:[...d]};}
  fs.mkdirSync(path.join(dir,'candidate'),{recursive:true});writeJson(path.join(dir,'candidate/catalog.json'),candidate);
 }catch(e){blockers.push('候選知識產生失敗（多半是已審核摘要只差物件編號，需登錄新摘要）：'+e.message);}
 report.verdict=blockers.length?'special':report.closedFlags.length?'data':'routine';
 writeJson(path.join(dir,'report.json'),report);
 print(report,dir);
 return report;
}
function print(r,dir){
 const label={routine:'例行（可自動完成並推送）',data:'資料變動（受影響功能冒煙後可推送）',special:'特別（停下來回報，不提交）'}[r.verdict];
 console.log(`${r.from} → ${r.to}（build ${r.steamBuildId}）：${label}`);
 for(const a of r.announcements)console.log(`公告 ${a.version}：${a.notes.join(' / ').slice(0,400)}`);
 console.log('變動來源：'+(r.changedSources.join('、')||'無'));
 if(r.events)console.log(`事件 ${r.events.total}：新增 ${r.events.added}、修改 ${r.events.changed}、刪除 ${r.events.removed}；涉及 ${r.events.functions.slice(0,30).join('、')}`);
 if(r.expressions)console.log(`expression 位移 ${r.expressions.delta}（offset ${r.register.entry.expressionOffset??0}），內容改變 ${r.expressions.changedIndices} 個`);
 for(const b of r.blockers)console.log('✖ '+b);
 for(const n of r.notices)console.log('• '+n);
 if(r.closedFlags.length)console.log('關閉的旗標（要冒煙才重開）：'+r.closedFlags.join('、'));
 for(const [k,v]of Object.entries(r.tableChanges))console.log(`catalog ${k}：${v.count} 處\n  `+v.sample.slice(0,12).join('\n  '));
 console.log('報告：'+path.join(dir,'report.json'));
}

// Text edits at fixed anchors: one new line in each reviewed map.
function insertBefore(file,anchor,line){
 const text=fs.readFileSync(file,'utf8'),i=text.indexOf(anchor);
 if(i<0)throw Error('找不到插入位置：'+file);
 const before=text.slice(0,i).replace(/\s*$/,''),sep=before.endsWith(',')||before.endsWith('{')?'':',';
 fs.writeFileSync(file,before+sep+'\n'+line+text.slice(before.length).replace(/^\s*(?=\n)/,''));
}
function apply(){
 const report=check();if(report.verdict==='current')return;
 if(report.verdict==='special')throw Error('特別版更不自動登錄：依 report.json 的 blockers 逐項核對');
 const dir=workDir(report.to),proof=readJson(proofFile),old=readJson(knowledgeFile),{register}=report;
 const extract=path.join(root,'scripts/extract-game.cjs');
 if(!register.reused)insertBefore(extract,'\n};\n\nfunction createCatalog',`  '${register.dataFingerprint}': ${JSON.stringify(register.entry).replace(/"(\w+)":/g,'$1: ').replace(/"/g,"'").replace(/,(?=\w)/g,', ').replace(/^\{/,'{ ').replace(/\}$/,' }')}`);
 const runtime=register.entry.runtimes[0];
 if(report.mac&&!report.mac.registered)insertBefore(MAC_SCRIPT,'\n}\nSTEAM_COMMON',`    "${runtime}": "${report.to}",`);
 delete require.cache[require.resolve('./extract-game.cjs')];
 const {inspectGame,createCatalog,mergeCatalog}=require('./extract-game.cjs'),g=inspectGame(report.source);
 const {glossary,catalog}=createCatalog(g);
 catalog.verification={...catalog.verification,...old.verification};mergeCatalog(old,catalog);
 writeJson(knowledgeFile,catalog);writeJson(path.join(root,'knowledge/traditional-names.json'),glossary);
 const note=`${report.to} 靜態核對沿用（寫入點、已審核事件與引用公式未變${report.catalogChanges.length?'；資料變動：'+report.catalogChanges.join('、'):''}）`;
 for(const [name,record]of Object.entries(proof.lightweight||{}))if(catalog.verification[name]!==false){record.gameVersion=report.to;record.gameUpdate=note;}
 const review=[
  `以 ${report.from} 精簡來源逐條正規化攤平比對：事件新增 ${report.events.added}、修改 ${report.events.changed}、刪除 ${report.events.removed}（${report.events.functions.slice(0,12).join('、')||'無'}）；函式 ${catalog.functions.length}、寫入點 ${catalog.evidence.length}，已審核事件不變`,
  `修改器引用的 expression 位移 ${report.expressions.delta}（expressionOffset ${register.entry.expressionOffset??0}）；內容改變的 expression ${report.expressions.changedIndices} 個不在引用清單`,
  ...report.catalogChanges.map(k=>`catalog ${k} 變動 ${report.tableChanges[k].count} 處：${report.tableChanges[k].sample.slice(0,6).join('；')}`),
  ...(report.mac?[`Mac 啟動器路徑修正命中數 ${Object.values(report.mac.path_replacements).join('/')} 不變，登錄新 c3runtime`]:[])
 ];
 if(proof.gameUpdate)(proof.gameUpdateHistory??=[]).unshift(proof.gameUpdate);
 Object.assign(proof,{date:report.date,gameVersion:report.to,steamBuildId:report.steamBuildId,eventFingerprint:g.fingerprints['data.json'],runtimeFingerprint:runtime,fingerprints:catalog.fingerprints,...(proof.batch2Fingerprints?{batch2Fingerprints:catalog.batch2Fingerprints}:{})});
 proof.gameUpdate={date:report.date,from:report.from,to:report.to,steamBuildId:report.steamBuildId,flow:'docs/maintenance/game-update.md',changedSources:report.changedSources,staticReview:review,smokes:[],rounds:null,
  carried:'其餘已開群組依靜態核對沿用；複合遷移證明（migration）仍是 V1.0.11.2 的歷史紀錄'+(report.closedFlags.length?`；${report.closedFlags.join('、')} 因資料變動關閉，冒煙後再開`:'')};
 writeJson(proofFile,proof);
 console.log(`已登錄 ${report.to}：extract-game、${report.mac?'prepare-macos、':''}catalog、verification。下一步：game-update.cjs smoke`);
}

const wait=ms=>new Promise(r=>setTimeout(r,ms));
function tool(name,list){return spawnSync(process.execPath,[path.join(root,'scripts',name),...list],{encoding:'utf8'});}
async function retry(label,list,times=60,pause=2000){
 for(let i=0;i<times;i++){const r=tool('verify-game.cjs',list);if(r.status===0)return r.stdout;await wait(pause);}
 throw Error('冒煙失敗：'+label);
}
// A save the game itself wrote in the previous version, kept by the last smoke.
function baseSave(proof){
 if(opt('--save-file'))return path.resolve(opt('--save-file'));
 const want=new Set([proof.gameUpdate,...(proof.gameUpdateHistory||[])].flatMap(u=>(u?.smokes||[]).map(s=>s.finalSaveSha256)).filter(Boolean));
 const found=[];
 for(const update of fs.readdirSync(artifactsRoot)){
  const smoke=path.join(artifactsRoot,update,'smoke');if(!fs.existsSync(smoke))continue;
  const kept=path.join(smoke,'final-save.dat');if(fs.existsSync(kept))found.push(kept);
  const runs=path.join(smoke,'runs');if(fs.existsSync(runs))for(const r of fs.readdirSync(runs)){const f=path.join(runs,r,'game','save\\ea1save.dat');if(fs.existsSync(f))found.push(f);}
 }
 const hit=found.filter(f=>want.has(sha(fs.readFileSync(f)))).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs)[0];
 if(!hit)throw Error('找不到上一輪冒煙由遊戲寫出的存檔，請用 --save-file 指定');
 return hit;
}
async function smoke(){
 if(process.platform!=='darwin')throw Error('smoke 目前只做 Mac 隱藏副本；Windows 請依 native-lessons 手動跑');
 const proof=readJson(proofFile),catalog=readJson(knowledgeFile);
 if(proof.gameVersion!==catalog.gameVersion)throw Error('先跑 apply');
 const pkg=packageDir(),dir=workDir(proof.gameVersion),port=path.join(dir,'mac-port'),runs=path.join(dir,'smoke/runs');
 fs.mkdirSync(runs,{recursive:true});
 const archive=path.join(os.homedir(),'bandit-verification/mac-port/downloads/nwjs-sdk-v0.82.0-osx-arm64.zip');
 execFileSync('python3',[MAC_SCRIPT,'--source',pkg,'--output',port,...(fs.existsSync(archive)?['--runtime-archive',archive]:[])],{stdio:'inherit'});
 const save=baseSave(proof),baseline=sha(fs.readFileSync(save));
 const setup=tool('verify-game.cjs',['--setup','--source',path.join(port,'game'),'--runtime',path.join(port,'runtime/nwjs-sdk-v0.82.0-osx-arm64/nwjs.app/Contents/MacOS/nwjs'),'--package',pkg,'--save-file',save,'--artifacts',runs]);
 if(setup.status!==0)throw Error('冒煙 setup 失敗：'+setup.stderr);
 const state=setup.stdout.match(/^STATE (.+)$/m)[1],st=['--state',state];
 const stop=()=>tool('verify-game.cjs',[...st,'--stop']);
 try{
  await retry('雲存檔載入',[...st,'--load','--mode','云存档']);await wait(3000);
  await retry('原版存檔',[...st,'--save']);await wait(3000);
  await retry('存檔核對',[...st,'--assert']);stop();await wait(3000);
  await retry('新程序',[...st,'--restart'],10,1000);
  await retry('讀回存檔',[...st,'--load','--mode','存档']);await wait(3000);
  await retry('讀回核對',[...st,'--assert']);
 }finally{stop();}
 const s=readJson(state),written=path.join(s.game,'save\\ea1save.dat');
 await wait(2000);
 const left=spawnSync('pgrep',['-f',s.game],{encoding:'utf8'}).stdout.trim();
 if(left)throw Error('冒煙結束後仍有遊戲程序：'+left);
 const {loadCore}=require('./verify-game.cjs'),C=loadCore(catalog),raw=fs.readFileSync(written,'utf8');
 if(C.serialize(C.parse(raw))!==raw)throw Error('修改器重讀遊戲寫出的存檔沒有逐字元往返');
 const final=sha(fs.readFileSync(written));fs.copyFileSync(written,path.join(dir,'smoke/final-save.dat'));
 proof.gameUpdate.smokes.push({name:'routine-round-trip',scenario:`以上一版遊戲寫出的存檔為基準，修改器改名稱與角色／職業／技藝經驗；雲存檔載入、原版存檔、新 PID 讀回；修改器重讀遊戲寫出檔逐字元往返`,baselineSaveSha256:baseline,finalSaveSha256:final,passed:true});
 proof.gameUpdate.rounds=`Mac（${os.cpus()[0].model}、CrossOver 正式分支 ${proof.gameVersion}）隱藏隔離副本：雲存檔載入、原版存檔、新 PID 讀回；修改器重讀遊戲寫出的存檔`;
 writeJson(proofFile,proof);
 console.log(`冒煙通過：${s.dir}（最終存檔 ${final}），已寫入 verification.json`);
}

if(require.main===module){
 if(args.includes('--help')){console.log('node scripts/game-update.cjs [check|apply|smoke] [--package STEAM_GAME_DIR] [--artifacts OUTSIDE_REPO] [--previous OLD_SOURCE] [--save-file BASE.dat] [--source EXTRACTED --version V --build N]');process.exit(0);}
 Promise.resolve(({check,apply,smoke})[command]()).catch(e=>{console.error(e.message);process.exit(1);});
}
module.exports={flatten,normalize,insertBefore,announcements};
