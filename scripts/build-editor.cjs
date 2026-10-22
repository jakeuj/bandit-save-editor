'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const R = require('./verification-requirements.cjs');
const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const knowledge = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/catalog.json'), 'utf8'));
knowledge.professionGuide = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/profession-guide.json'), 'utf8'));
const versionLabel = knowledge.gameVersion.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
html = html.replace(/(<span data-knowledge-version>)[\s\S]*?(<\/span>)/g, (_, start, end) => start + versionLabel + end);
const proofPath=path.join(root,'knowledge/verification.json');
if(Object.values(knowledge.verification).some(Boolean)){
  if(!fs.existsSync(proofPath))throw Error('寫入閘門缺少遊戲驗證紀錄');
  const proof=JSON.parse(fs.readFileSync(proofPath,'utf8'));
  if(Object.hasOwn(proof,'schemaVersion')&&proof.schemaVersion!==2)throw Error('不支援的驗證證明格式');
  if(proof.schemaVersion===2){
    const issue=require('./migration-proof.cjs').problem(knowledge,proof,fs.readFileSync(path.join(root,'src/core.js'),'utf8'));
    if(issue)throw Error(issue);
  }else{
  if(proof.eventFingerprint!==knowledge.fingerprints['data.json']||proof.runtimeFingerprint!==knowledge.fingerprints['scripts/c3runtime.js']||!Object.values(proof.checks).every(v=>v===true))throw Error('遊戲驗證紀錄與來源不相符');
  for(const [group,enabled]of Object.entries(knowledge.verification))if(enabled)R.requiredChecks(group);
  if(R.sections.base.groups.some(group=>knowledge.verification[group])&&!R.sections.base.checks.every(k=>proof.checks[k]===true))throw Error('基礎與進階修改缺少必要的遊戲驗證項目');
  if(!proof.fingerprints||Object.keys(proof.fingerprints).length!==Object.keys(knowledge.fingerprints).length||Object.entries(knowledge.fingerprints).some(([file,hash])=>proof.fingerprints[file]!==hash))throw Error('資料表指紋與遊戲驗證紀錄不相符');
  if(R.sections.batch2.groups.some(group=>knowledge.verification[group])&&(!proof.batch2||!proof.batch2.checks||!Object.values(proof.batch2.checks).every(v=>v===true)||!R.sections.batch2.checks.every(k=>proof.batch2.checks[k]===true)||JSON.stringify(proof.batch2.fingerprints)!==JSON.stringify(knowledge.batch2Fingerprints)||JSON.stringify(proof.batch2.limits)!==JSON.stringify(knowledge.batch2Limits)||proof.batch2.dataHash!==createHash('sha256').update(JSON.stringify(knowledge.batch2Data)).digest('hex')))throw Error('第二批來源、規則或值域缺少相符驗證');
  if(knowledge.verification.equipmentAffixReplacement){const p=proof.affixReplacement;const required=R.requiredChecks('equipmentAffixReplacement');if(!p||!required.every(k=>p.checks?.[k]===true)||JSON.stringify(p.fingerprints)!==JSON.stringify({...knowledge.fingerprints,...knowledge.batch2Fingerprints})||JSON.stringify(p.limits)!==JSON.stringify(knowledge.affixReplacementLimits)||p.dataHash!==createHash('sha256').update(JSON.stringify({rules:knowledge.affixReplacement,items:knowledge.batch2Data.items})).digest('hex'))throw Error('精準洗練缺少相符的獨立驗證');}
  for(const group of R.sections.equipmentWorkflow.groups)if(knowledge.verification[group]){
    const p=proof.equipmentWorkflow,c=p?.groups?.[group];
    if(!c||!R.requiredChecks(group).every(k=>c.checks?.[k]===true)||JSON.stringify(p.fingerprints)!==JSON.stringify({...knowledge.fingerprints,...knowledge.batch2Fingerprints})||JSON.stringify(p.limits)!==JSON.stringify(knowledge.equipmentWorkflowLimits)||p.dataHash!==createHash('sha256').update(JSON.stringify({rules:knowledge.equipmentWorkflowLimits,items:knowledge.batch2Data.items,formulas:knowledge.affixReplacement})).digest('hex'))throw Error('裝備操作缺少相符的獨立驗證：'+group);
    const ui=R.uiEvidenceProblem(group,c,knowledge.gameVersion);if(ui)throw Error(ui+'：'+group);
  }
  if(knowledge.verification.randomCharacterSkillCaps){const P=require('./random-character-skill-caps-proof.cjs'),problem=P.problem(knowledge,proof,fs.readFileSync(path.join(root,'src/core.js'),'utf8'));if(problem)throw Error(problem);P.requireNativeRunner();}
  if(knowledge.verification.randomCharacterBaseAptitudes){const problem=require('./random-character-growth-proof.cjs').problem(knowledge,proof,fs.readFileSync(path.join(root,'src/core.js'),'utf8'));if(problem)throw Error(problem);}
  for(const [group,enabled]of Object.entries(knowledge.verification))if(enabled&&proof.groups[group]!==true)throw Error('驗證未涵蓋寫入群組：'+group);
  for(const group of R.sections.equipmentQuality.groups)if(knowledge.verification[group]){
    const p=proof.equipmentQuality,c=p?.groups?.[group];
    const formula=fs.readFileSync(path.join(root,'src/core.js'),'utf8').match(/ function qualityAttributeEffect\([\s\S]*?(?= function previewEquipmentQualityChange)/)?.[0].replace(/\r\n/g,'\n');
    if(!formula||p?.formulaHash!==createHash('sha256').update(formula).digest('hex'))throw Error('品質升降公式缺少相符的獨立驗證：'+group);
    if(!c||!R.requiredChecks(group).every(k=>c.checks?.[k]===true)||JSON.stringify(p.fingerprints)!==JSON.stringify({...knowledge.fingerprints,...knowledge.batch2Fingerprints})||p.dataHash!==createHash('sha256').update(JSON.stringify({quality:knowledge.equipmentQuality,items:knowledge.batch2Data.items,workflow:knowledge.equipmentWorkflowLimits})).digest('hex'))throw Error('品質升降缺少相符的獨立驗證：'+group);
    const ui=R.uiEvidenceProblem(group,c,knowledge.gameVersion);if(ui)throw Error(ui+'：'+group);
  }
  if(['equipmentLevel','professionTrainingCap','advancedTechnologyLevel'].some(group=>knowledge.verification[group]||knowledge.verification[group+'Advanced'])&&JSON.stringify(proof.editingLimits)!==JSON.stringify(knowledge.editingLimits))throw Error('進階修改範圍與遊戲驗證紀錄不相符');
  }
}
for (const [id, file] of [['save-core', 'core'], ['save-ui', 'ui'], ['save-pwa', 'pwa']]) {
  const code = fs.readFileSync(path.join(root, `src/${file}.js`), 'utf8').replace('/*__KNOWLEDGE__*/null', JSON.stringify(knowledge).replace(/</g, '\\u003c')).replace('/*__KNOWLEDGE_UI__*/',()=>fs.readFileSync(path.join(root,'src/knowledge-ui.js'),'utf8')).replace('/*__PROFESSION_UI__*/',()=>fs.readFileSync(path.join(root,'src/profession-ui.js'),'utf8')).replace('/*__BATCH_UI__*/',()=>fs.readFileSync(path.join(root,'src/batch-ui.js'),'utf8'));
  html = html.replace(new RegExp(`(<script id="${id}">)[\\s\\S]*?(</script>)`), (_, start, end) => `${start}\n${code.trim()}\n${end}`);
}
const sha256 = content => createHash('sha256').update(content).digest('hex');
const assetPaths = ['index.html', 'manifest.webmanifest', 'assets/favicon.svg', 'assets/icon-192.png',
  'assets/icon-512.png', 'assets/icon-maskable-512.png', 'assets/apple-touch-icon.png'];
const assets = assetPaths.map(file => ({path: file, sha256: sha256(file === 'index.html' ? html : fs.readFileSync(path.join(root, file)))}));
const template = fs.readFileSync(path.join(root, 'src/service-worker.js'), 'utf8');
const version = sha256(template + JSON.stringify(assets));
const worker = template.replace('__PWA_VERSION__', version).replace('/*__PWA_ASSETS__*/[]', JSON.stringify(assets));
const outputs = [[htmlPath, html], [path.join(root, 'sw.js'), worker]];
if (process.argv.includes('--check')) {
  for (const [file, content] of outputs) {
    if (!fs.existsSync(file) || content !== fs.readFileSync(file, 'utf8')) {
      console.error(`${path.basename(file)} 與 src／knowledge／PWA 資產不同步，請執行 node scripts/build-editor.cjs`);
      process.exit(1);
    }
  }
  console.log('單檔修改器與 PWA 快取版本均與來源同步');
} else for (const [file, content] of outputs) fs.writeFileSync(file, content);
