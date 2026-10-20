'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const knowledge = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/catalog.json'), 'utf8'));
const proofPath=path.join(root,'knowledge/verification.json');
if(Object.values(knowledge.verification).some(Boolean)){
  if(!fs.existsSync(proofPath))throw Error('寫入閘門缺少遊戲驗證紀錄');
  const proof=JSON.parse(fs.readFileSync(proofPath,'utf8'));
  if(proof.eventFingerprint!==knowledge.fingerprints['data.json']||proof.runtimeFingerprint!==knowledge.fingerprints['scripts/c3runtime.js']||!Object.values(proof.checks).every(v=>v===true))throw Error('遊戲驗證紀錄與來源不相符');
  if(!proof.fingerprints||Object.keys(proof.fingerprints).length!==Object.keys(knowledge.fingerprints).length||Object.entries(knowledge.fingerprints).some(([file,hash])=>proof.fingerprints[file]!==hash))throw Error('資料表指紋與遊戲驗證紀錄不相符');
  for(const [group,enabled]of Object.entries(knowledge.verification))if(enabled&&proof.groups[group]!==true)throw Error('驗證未涵蓋寫入群組：'+group);
}
for (const [id, file] of [['save-core', 'core'], ['save-ui', 'ui']]) {
  const code = fs.readFileSync(path.join(root, `src/${file}.js`), 'utf8').replace('/*__KNOWLEDGE__*/null', JSON.stringify(knowledge).replace(/</g, '\\u003c')).replace('/*__KNOWLEDGE_UI__*/',()=>fs.readFileSync(path.join(root,'src/knowledge-ui.js'),'utf8'));
  html = html.replace(new RegExp(`(<script id="${id}">)[\\s\\S]*?(</script>)`), (_, start, end) => `${start}\n${code.trim()}\n${end}`);
}
if (process.argv.includes('--check')) {
  if (html !== fs.readFileSync(htmlPath, 'utf8')) { console.error('index.html 與 src／knowledge 不同步，請執行 node scripts/build-editor.cjs'); process.exit(1); }
  console.log('單檔修改器與來源同步');
} else fs.writeFileSync(htmlPath, html);
