'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const knowledge = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/catalog.json'), 'utf8'));

knowledge.professionGuide = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/profession-guide.json'), 'utf8'));
const versionLabel = knowledge.gameVersion.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
html = html.replace(/(<span data-knowledge-version>)[\s\S]*?(<\/span>)/g, (_, start, end) => start + versionLabel + end);
// Lightweight write gate (docs/maintenance/lightweight.md): every open flag needs a record in verification.json for the same
// game version and game data fingerprints. Core edits do not invalidate records; re-check features by smoke test when the game updates.
const proofPath=path.join(root,'knowledge/verification.json');
const open=Object.entries(knowledge.verification).filter(([,enabled])=>enabled).map(([group])=>group);
if(open.length){
  if(!fs.existsSync(proofPath))throw Error('寫入閘門缺少遊戲驗證紀錄');
  const proof=JSON.parse(fs.readFileSync(proofPath,'utf8'));
  if(proof.gameVersion!==knowledge.gameVersion)throw Error(`驗證紀錄的遊戲版本 ${proof.gameVersion} 與知識版本 ${knowledge.gameVersion} 不符，請先冒煙驗證再更新紀錄`);
  if(!proof.fingerprints||Object.keys(proof.fingerprints).length!==Object.keys(knowledge.fingerprints).length||Object.entries(knowledge.fingerprints).some(([file,hash])=>proof.fingerprints[file]!==hash))throw Error('遊戲資料指紋與驗證紀錄不符，請先冒煙驗證再更新紀錄');
  for(const group of open)if(proof.groups?.[group]!==true)throw Error('驗證紀錄未涵蓋寫入群組：'+group);
}
for (const [id, file] of [['save-core', 'core'], ['save-ui', 'ui'], ['save-pwa', 'pwa']]) {
  const code = fs.readFileSync(path.join(root, `src/${file}.js`), 'utf8').replace('/*__KNOWLEDGE__*/null', JSON.stringify(knowledge).replace(/</g, '\\u003c')).replace('/*__KNOWLEDGE_UI__*/',()=>fs.readFileSync(path.join(root,'src/knowledge-ui.js'),'utf8')).replace('/*__PROFESSION_UI__*/',()=>fs.readFileSync(path.join(root,'src/profession-ui.js'),'utf8')).replace('/*__BATCH_UI__*/',()=>fs.readFileSync(path.join(root,'src/batch-ui.js'),'utf8')).replace('/*__RELIC_UI__*/',()=>fs.readFileSync(path.join(root,'src/relic-ui.js'),'utf8'));
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
