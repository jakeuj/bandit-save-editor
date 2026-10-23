'use strict';
// Per-family core slices: what changes a family's binding, what falls back to the whole core, and how the
// selective plan and the composite proof gate use them.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Core=require('../scripts/core-source-proof.cjs'),A=require('../scripts/migration-analysis.cjs'),P=require('../scripts/migration-proof.cjs'),Report=require('../scripts/core-slice-report.cjs');
const root=path.join(__dirname,'..'),core=fs.readFileSync(path.join(root,'src/core.js'),'utf8'),proof=JSON.parse(fs.readFileSync(path.join(root,'knowledge/verification.json'),'utf8')),catalog=JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'),'utf8'));
const tiny=`(() => {
 'use strict';
 const T=[1];
 for(const x of T)x;
 function a(){return b();}
 function b(){return 1;}
 function c(){return 2;}
 const d=()=>c();
 globalThis.SaveCore={a,d,c};
})();`;
const roots={A:['a'],D:['d']},cut=src=>Core.slices(src,roots)?.hashes;
// Inserts a statement at the start of a top-level function body of the real core.
const edit=(name,stmt='void 0;')=>{const i=core.indexOf(' function '+name+'(');assert.ok(i>0,name);let depth=0,at=core.indexOf('(',i);for(;;at++){if(core[at]==='(')depth++;else if(core[at]===')'&&--depth===0)break;}at=core.indexOf('{',at)+1;return core.slice(0,at)+stmt+core.slice(at);};

test('a slice follows static references only from its roots; comments and layout never matter',()=>{
 const base=cut(tiny);
 assert.notEqual(base.A,base.D);
 assert.deepEqual(cut(tiny.replace('return 1;','return 1;/* note */')),base);
 assert.deepEqual(cut(tiny.replace(/\n /g,'\n    ')),base);
 const b=cut(tiny.replace('return 1;','return 3;'));assert.notEqual(b.A,base.A);assert.equal(b.D,base.D);
 const c=cut(tiny.replace('return 2;','return 4;'));assert.equal(c.A,base.A);assert.notEqual(c.D,base.D,'const arrow 也須追蹤其參照');
});
test('prelude, export mapping and unknown roots behave conservatively',()=>{
 const base=cut(tiny);
 const loop=cut(tiny.replace('for(const x of T)x;','for(const x of T)x+1;'));assert.notEqual(loop.A,base.A);assert.notEqual(loop.D,base.D);
 assert.deepEqual(cut(tiny.replace('function c(){','function e(){return 5;}\n function c(){').replace('{a,d,c}','{a,d,c,e}')),base,'只新增匯出名稱不影響既有 family');
 const remap=cut(tiny.replace('{a,d,c}','{a,d:a,c}'));assert.equal(remap.A,base.A);assert.notEqual(remap.D,base.D);
 assert.throws(()=>Core.slices(tiny,{X:['missing']}),/匯出/);
 assert.ok(cut(tiny.replace('const T=[1];','const {length}=[1];\n const T=[1];')),'解構宣告歸入前導');
});
test('constructs that defeat name-based reachability make the whole core unsliceable',()=>{
 for(const [label,src] of [
  ['eval',tiny.replace('return 1;','return eval("1");')],
  ['Function',tiny.replace('return 1;','return Function("return 1")();')],
  ['with',tiny.replace("'use strict';",'').replace('function b(){return 1;}','function b(){with({}){return 1;}}')],
  ['toString',tiny.replace('return 1;','return a.toString().length;')],
  ['outside IIFE',tiny+'\nglobalThis.x=1;'],
  ['computed export',tiny.replace('{a,d,c}',"{a,d,['c']:c}")],
  ['duplicate export',tiny.replace("globalThis.SaveCore={a,d,c};","globalThis.SaveCore={a,d,c};\n globalThis.SaveCore={a};")]
 ]){assert.equal(Core.slices(src,roots),null,label);assert.ok(Core.sliceProblem(src),label);}
});
test('a family-private edit selects only that family; a hub edit or an unsliceable core selects all',()=>{
 // The baseline is the current core, not the proven snapshot: since the lightweight flow core edits do not re-bind old proofs.
 const previous={...proof.migration.snapshot,coreHash:Core.hash(core),coreHashAlgorithm:Core.algorithm,coreSlices:Core.slices(core,A.coreRoots)},groups=Object.keys(proof.groups).filter(g=>proof.groups[g]&&P.composite(proof,g));
 const next=src=>({...previous,coreHash:Core.hash(src),coreHashAlgorithm:Core.algorithm,coreSlices:Core.slices(src,A.coreRoots)||undefined});
 const families=src=>Object.keys(P.selection(previous,next(src),groups).families).sort();
 assert.deepEqual(families(core),[]);
 assert.deepEqual(families(edit('qualityAttributeEffect')),['equipmentQuality']);
 assert.deepEqual(families(edit('setCharacterSkillCaps')),['randomCharacterSkillCaps']);
 assert.deepEqual(families(edit('undo')),[],'UI 專用函式不屬於任何 family');
 const all=Object.keys(P.selection(previous,{...previous,coreHash:'0'.repeat(64),coreHashAlgorithm:Core.algorithm,coreSlices:undefined},groups).families).length;
 assert.equal(families(edit('editingInfo')).length,all);
 assert.equal(families(core+'\nglobalThis.semanticChange=true;').length,all,'無法切片時退回整份 core');
 const r=Report.report(edit('qualityAttributeEffect'),previous,catalog);assert.deepEqual(r.changed,['equipmentQuality']);assert.equal(r.copies,4);
});
