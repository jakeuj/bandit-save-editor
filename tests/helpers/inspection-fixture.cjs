'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');

const coreSource = `(() => {
  function read(){return 1;}
  function unused(){return 2;}
  globalThis.SaveCore={read};
})();\n`;
const metadata = () => ({families: {sample: {groups: ['flag']}}, sections: {sharedProof: {groups: ['flag']}}, coreRoots: {sample: ['read']}, sharedCoreRoots: [], verification: {flag: true}});
function fixture(t, {core = coreSource, ui = '(() => { const C=SaveCore; function show(){return C.read();} })();\n'} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bandit-inspection-test space-'));
  const write = (file, text) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), {recursive: true}); fs.writeFileSync(target, text); };
  write('src/core.js', core); write('src/ui.js', ui);
  write('scripts/editor-source.cjs', `const fs=require('node:fs'),path=require('node:path');
exports.readEditorSourceDetails=(entry,{root})=>{const file='src/'+entry+'.js',source=fs.readFileSync(path.join(root,file),'utf8');return {source,segments:[{file,sourceStart:0,outputStart:0,length:source.length}]};};`);
  const data = metadata();
  write('scripts/verification-suite.cjs', 'exports.families=' + JSON.stringify(data.families));
  write('scripts/verification-requirements.cjs', 'exports.sections=' + JSON.stringify(data.sections));
  write('scripts/migration-analysis.cjs', 'module.exports=' + JSON.stringify({coreRoots: data.coreRoots, sharedCoreRoots: []}));
  write('knowledge/catalog.json', JSON.stringify({verification: data.verification}));
  write('tests/read.test.cjs', "const C={}; C.read();\n");
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  const initGit = () => {
    git('init', '--initial-branch=main');
    git('config', 'user.name', 'Synthetic inspection test'); git('config', 'user.email', 'inspection@example.invalid');
    fs.mkdirSync(path.join(root, '.empty-hooks')); git('config', 'core.hooksPath', path.join(root, '.empty-hooks'));
    git('config', 'core.autocrlf', 'false'); git('config', 'commit.gpgsign', 'false');
    git('add', '.'); git('commit', '-m', 'synthetic baseline');
  };
  return {root, write, git, initGit};
}

module.exports = {fixture, metadata, coreSource};
