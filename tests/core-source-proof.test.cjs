'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../scripts/core-source-proof.cjs'),P=require('../scripts/random-character-skill-caps-proof.cjs');
const L=require('./helpers/legacy-release.cjs'),core=L.core,catalog=L.catalog(),proof=L.proof(),baseline=L.baseline();// 舊格式機制以凍結的舊版證明＋對應 core 驗證；現行 repo 證明為複合格式
test('AST omits trivia but retains all executable syntax, directives, regex and template semantics',()=>{
 const source='"use strict"; const a = 123n; function f(x) { return x + 1; }';
 assert.equal(C.hash(source),C.hash('// header\r\n"use strict";\n const a=123n; /* comment */ function f ( x ) {\n return x+1;\n}'));
 for(const [a,b]of [
  ['function f(){return 1;}','function f(){return\n1;}'],
  ['"use strict";x=1;','"use\\x20strict";x=1;'],
  ['const x=/a/g;','const x=/a/i;'],
  ['const x=123n;','const x=124n;'],
  ['const x=1e400;','const x=null;'],
  ['const x=tag`\\n`;','const x=tag`\n`;'],
  ['const x=a?.b.c;','const x=(a?.b).c;'],
  ['let a=1; a++;','let a=1; ++a;'],
  ['function f(){return 1;}','function f(){return 2;}']
 ])assert.notEqual(C.hash(a),C.hash(b),a);
 assert.throws(()=>C.hash('const = 1;'));
 assert.throws(()=>C.hash('import x from "x";'));
 assert.throws(()=>C.hash('using x = null;'));
 assert.throws(()=>C.identity('a'.repeat(64),'future-algorithm'));
});
test('legacy proof remains byte-identical and only an exact verified source can establish its AST bridge',()=>{
 const legacyProof=structuredClone(proof);legacyProof.randomCharacterSkillCaps.formulaHash=C.rawHash(core);delete legacyProof.randomCharacterSkillCaps.formulaHashAlgorithm;
 const legacyBaseline={...baseline,coreHash:C.rawHash(core),proofHash:require('../scripts/migration-analysis.cjs').sha(legacyProof)};delete legacyBaseline.coreHashAlgorithm;
 const prepare=require('../scripts/prepare-core-ast-baseline.cjs').prepare;
 const original=JSON.stringify(legacyProof),base=JSON.stringify(legacyBaseline);
 const result=prepare(core,legacyProof,legacyBaseline,catalog);
 assert.equal(result.bindings[0].legacyHash,legacyProof.randomCharacterSkillCaps.formulaHash);
 assert.equal(result.bindings[0].astHash,C.hash(core));
 assert.equal(JSON.stringify(legacyProof),original);assert.equal(JSON.stringify(legacyBaseline),base);
 assert.throws(()=>prepare(core+'\n// identical AST but not original bytes',legacyProof,legacyBaseline,catalog),/Original core bytes/);
 const wrong=structuredClone(legacyProof);delete wrong.randomCharacterSkillCaps.initialVerification;
 assert.throws(()=>prepare(core,wrong,legacyBaseline,catalog),/invalid/);
 assert.throws(()=>prepare(core,legacyProof,{...legacyBaseline,proofHash:'0'.repeat(64)},catalog),/does not belong/);
 assert.equal(P.problem(catalog,proof,core+'\n// legacy bridge'),null);
 assert.ok(P.problem(catalog,proof,core+'\nglobalThis.semanticChange=true;'));
 assert.equal(C.matches('const untouched=1;',C.rawHash('const untouched=1;')),true);
 assert.equal(C.matches('const untouched=1; // unregistered legacy digest',C.rawHash('const untouched=1;')),false);
});
test('real core comments and indentation carry; every shared dependency edit still invalidates the whole-core identity',()=>{
 const expected=C.hash(core);
 assert.equal(C.hash(core.replace('function transaction(', '/* comment */ function transaction(')),expected);
 assert.equal(C.hash(core.split('\n').map(line=>'  '+line).join('\n')),expected);
 for(const name of ['skillCapCombinations','transaction','undo','restoreAll','serialize','resolveField','addExperience','runBatch']){
  const changed=core.replace(new RegExp('(function '+name+'\\([^]*?\\)\\s*\\{)'), '$1 globalThis.semanticChange=true;');
  assert.notEqual(changed,core,name);assert.notEqual(C.hash(changed),expected,name);
  assert.ok(P.problem(catalog,proof,changed),name);
 }
});
test('actual builder accepts cosmetic core rebuilds without rewriting native evidence, and rejects executable changes',t=>{
 const path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bandit-core-ast-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const name of ['scripts','src','knowledge','assets','index.html','sw.js','manifest.webmanifest'])fs.cpSync(path.join(root,name),path.join(dir,name),{recursive:true});
 L.overlay(dir);
 const nativeBefore=fs.readFileSync(path.join(dir,'knowledge/verification.json'));
 const baselineBefore=fs.readFileSync(path.join(dir,'knowledge/migration-baseline.json'));
 const run=args=>spawnSync(process.execPath,['scripts/build-editor.cjs',...args],{cwd:dir,encoding:'utf8'});
 fs.writeFileSync(path.join(dir,'src/core.js'),core.replace('function skillCapCombinations(', '/* cosmetic */ function skillCapCombinations('));
 const built=run([]);assert.equal(built.status,0,built.stderr);
 assert.equal(run(['--check']).status,0);
 assert.deepEqual(fs.readFileSync(path.join(dir,'knowledge/verification.json')),nativeBefore);
 assert.deepEqual(fs.readFileSync(path.join(dir,'knowledge/migration-baseline.json')),baselineBefore);
 fs.appendFileSync(path.join(dir,'src/core.js'),'\nglobalThis.semanticChange=true;');
 const rejected=run([]);assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/技藝上限|套裝等級/);
});
