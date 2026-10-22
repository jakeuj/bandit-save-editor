'use strict';
// Format migration only: never runs a game or changes a native proof / enabled flag.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('./core-source-proof.cjs');
function prepare(source,proof,baseline,catalog){
 const raw=C.rawHash(source),record=proof.schemaVersion===2?proof.migration?.snapshot:proof.randomCharacterSkillCaps;
 const recorded=proof.schemaVersion===2?record?.coreHash:record?.formulaHash;
 const version=proof.schemaVersion===2?record?.coreHashAlgorithm:record?.formulaHashAlgorithm;
 assert.ok(version===undefined||version===C.legacyAlgorithm,'Only exact legacy source can establish a bridge');
 assert.equal(raw,recorded,'Original core bytes do not match the historical proof');
 assert.equal(raw,baseline.coreHash,'Original core bytes do not match the migration baseline');
 assert.ok(baseline.coreHashAlgorithm===undefined||baseline.coreHashAlgorithm===C.legacyAlgorithm,'Expected legacy baseline');
 assert.equal(require('./random-character-skill-caps-proof.cjs').problem(catalog,proof,source),null,'Historical proof is invalid');
 const A=require('./migration-analysis.cjs');
 if(proof.schemaVersion===2)assert.ok(A.same(baseline,proof.migration.snapshot),'Migration baseline does not match the historical composite proof');
 else assert.equal(baseline.proofHash,A.sha(proof),'Migration baseline does not belong to the historical proof');
 return {version:1,algorithm:C.algorithm,bindings:[{legacyHash:raw,astHash:C.hash(source),proofHash:C.sha(JSON.stringify(proof))}]};
}
if(require.main===module){
 const args=process.argv.slice(2),value=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
 if(!value('--source')||!value('--output'))throw Error('Usage: node scripts/prepare-core-ast-baseline.cjs --source EXACT_LEGACY_CORE --output NEW_JSON');
 const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const result=prepare(fs.readFileSync(value('--source'),'utf8'),read('knowledge/verification.json'),read('knowledge/migration-baseline.json'),read('knowledge/catalog.json'));
 fs.writeFileSync(value('--output'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log('Core AST bridge created from exact verified legacy source; native proof unchanged.');
}
module.exports={prepare};
