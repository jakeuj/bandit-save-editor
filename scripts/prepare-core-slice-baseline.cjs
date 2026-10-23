'use strict';
// Format migration only: records per-family slices for the exact core a composite proof already binds.
// Never runs a game or changes a native proof / enabled flag; refuses anything but the exact proven core.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('./core-source-proof.cjs'),A=require('./migration-analysis.cjs');
function prepare(source,proof,baseline,catalog,existing=[]){
 assert.equal(proof.schemaVersion,2,'Only a composite proof can establish slice baselines');
 const snapshot=proof.migration?.snapshot;
 assert.ok(snapshot&&!snapshot.coreSlices,'Snapshot already records slices');
 assert.ok(A.same(baseline,snapshot),'Migration baseline does not match the composite proof');
 assert.ok(C.matches(source,snapshot.coreHash,snapshot.coreHashAlgorithm),'Core does not match the proven snapshot');
 assert.equal(require('./migration-proof.cjs').problem(catalog,proof,source),null,'Composite proof is invalid for this core');
 const id=C.identity(snapshot.coreHash,snapshot.coreHashAlgorithm),table=C.slices(source,A.coreRoots);
 assert.equal(id.algorithm,C.algorithm,'Only an AST-bound snapshot can be sliced');
 assert.ok(table,'Core cannot be sliced: '+C.sliceProblem(source));
 assert.ok(!existing.some(b=>b.coreHash===id.hash),'Slice baseline already recorded for this core');
 return {version:1,algorithm:C.sliceAlgorithm,coreAlgorithm:C.algorithm,bindings:[...existing,{coreHash:id.hash,slices:table.hashes}]};
}
if(require.main===module){
 const args=process.argv.slice(2),value=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
 if(!value('--source')||!value('--output'))throw Error('Usage: node scripts/prepare-core-slice-baseline.cjs --source EXACT_PROVEN_CORE --output NEW_JSON');
 const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const result=prepare(fs.readFileSync(value('--source'),'utf8'),read('knowledge/verification.json'),read('knowledge/migration-baseline.json'),read('knowledge/catalog.json'),C.sliceBaselines());
 fs.writeFileSync(value('--output'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log('Core slice baseline created from the exact proven core; native proof unchanged.');
}
module.exports={prepare};
