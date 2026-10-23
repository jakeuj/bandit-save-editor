'use strict';
const {createHash}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const parserHash='fdb08546776ec6228b03e8d02b40d4ab3255bae5f401adba7ff5dad927ac5c9c';
if(createHash('sha256').update(fs.readFileSync(path.join(__dirname,'vendor/acorn.cjs'))).digest('hex')!==parserHash)throw Error('Core AST parser bytes differ from the pinned release');
const acorn=require('./vendor/acorn.cjs');
const algorithm='core-estree-acorn-8.15.0-es2024-v1',legacyAlgorithm='sha256-lf-v1';
const hex=/^[a-f0-9]{64}$/;
const sha=s=>createHash('sha256').update(s).digest('hex');
const rawHash=source=>sha(source.replace(/\r\n/g,'\n'));
const cache=new Map();
// Keep every semantic field. Only parser coordinates and Literal spelling are omitted.
// In particular, directive spelling and template raw strings remain significant.
function canonical(value){
 if(typeof value==='bigint')return {$bigint:String(value)};
 if(typeof value==='number'&&!Number.isFinite(value))return {$number:String(value)};
 if(Object.is(value,-0))return {$number:'-0'};
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object'){
  if(value instanceof RegExp)return {$regexp:value.source,flags:value.flags};
  return Object.fromEntries(Object.keys(value).sort().filter(k=>!['start','end','loc','range'].includes(k)&&!(value.type==='Literal'&&k==='raw')).map(k=>[k,canonical(value[k])]));
 }
 return value;
}
function hash(source){
 if(typeof source!=='string')throw Error('core source must be text');
 if(acorn.version!=='8.15.0')throw Error('Unsupported core AST parser version');
 if(cache.has(source))return cache.get(source);
 const ast=acorn.parse(source,{ecmaVersion:2024,sourceType:'script',allowHashBang:true});
 const digest=sha(JSON.stringify({algorithm,ast:canonical(ast)}));
 if(cache.size>=8)cache.clear();cache.set(source,digest);return digest;
}
function supported(version){return version===undefined||version===legacyAlgorithm||version===algorithm;}
// Second stage: per-family slices of the IIFE. A family's slice is every top-level binding statically reachable from its
// SaveCore roots, plus the shared prelude (directives, top-level loops). Anything that defeats name-based reachability
// makes the whole core unsliceable, and callers fall back to the full-core identity.
const sliceAlgorithm='core-slice-acorn-8.15.0-es2024-v1',sliceCache=new Map();
function references(node,names,problems){
 const out=new Set();
 const visit=(n,parent,key)=>{
  if(Array.isArray(n)){for(const v of n)visit(v,parent,key);return;}
  if(!n||typeof n!=='object'||typeof n.type!=='string')return;
  if(n.type==='WithStatement'||n.type==='ImportExpression')problems.push(n.type);
  if(n.type==='Identifier'){
   if(n.name==='eval'||n.name==='Function')problems.push(n.name);
   // Non-computed property names, object keys and labels are names, not references.
   const label=parent&&['LabeledStatement','BreakStatement','ContinueStatement'].includes(parent.type)&&key==='label';
   const member=parent&&parent.type==='MemberExpression'&&key==='property'&&!parent.computed;
   const prop=parent&&['Property','MethodDefinition','PropertyDefinition'].includes(parent.type)&&key==='key'&&!parent.computed;
   if(!label&&!member&&!prop&&names.has(n.name))out.add(n.name);
   return;
  }
  // Reading a top-level function's source text would let unrelated text changes alter behaviour.
  if(n.type==='MemberExpression'&&!n.computed&&n.property.name==='toString'&&n.object.type==='Identifier'&&names.has(n.object.name))problems.push('toString');
  for(const k of Object.keys(n))if(!['start','end','loc','range','type'].includes(k))visit(n[k],n,k);
 };
 visit(node,null,null);return out;
}
function sliceIndex(source){
 if(typeof source!=='string')throw Error('core source must be text');
 if(sliceCache.has(source))return sliceCache.get(source);
 const ast=acorn.parse(source,{ecmaVersion:2024,sourceType:'script',allowHashBang:true}),call=ast.body.length===1&&ast.body[0].type==='ExpressionStatement'?ast.body[0].expression:null;
 const fn=call?.type==='CallExpression'&&!call.arguments.length&&['ArrowFunctionExpression','FunctionExpression'].includes(call.callee.type)&&!call.callee.params.length&&call.callee.body.type==='BlockStatement'?call.callee:null;
 let index;
 if(!fn)index={problem:'core 不是單一無參數 IIFE'};
 else{
  const nodes=new Map(),prelude=[],problems=[];let exported=null;
  const add=(name,node)=>{if(nodes.has(name))problems.push('重複頂層名稱 '+name);nodes.set(name,node);};
  for(const n of fn.body.body){
   const target=n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&n.expression.operator==='='?n.expression.left:null;
   if(n.type==='FunctionDeclaration'&&n.id)add(n.id.name,n);
   else if(n.type==='VariableDeclaration'&&n.declarations.every(d=>d.id.type==='Identifier'))for(const d of n.declarations)add(d.id.name,{kind:n.kind,declarator:d});
   else if(target?.type==='MemberExpression'&&!target.computed&&target.object.type==='Identifier'&&target.object.name==='globalThis'&&target.property.name==='SaveCore'){if(exported)problems.push('重複匯出');exported=n.expression.right;}
   else prelude.push(n);
  }
  const names=new Set(nodes.keys()),refs=new Map([...nodes].map(([name,node])=>[name,references(node.declarator||node,names,problems)])),json=new Map([...nodes].map(([name,node])=>[name,JSON.stringify(canonical(node))]));
  const exports=new Map();
  if(exported?.type!=='ObjectExpression')problems.push('缺少 SaveCore 物件匯出');
  else for(const p of exported.properties){if(p.type!=='Property'||p.computed||p.kind!=='init'||p.key.type!=='Identifier'||p.value.type!=='Identifier'||!names.has(p.value.name))problems.push('無法分析的匯出 '+(p.key?.name||p.type));else exports.set(p.key.name,p.value.name);}
  const preludeRefs=references(prelude,names,problems);
  index=problems.length?{problem:problems[0]}:{refs,json,prelude:JSON.stringify(canonical(prelude)),preludeRefs,exports};
 }
 if(sliceCache.size>=8)sliceCache.clear();sliceCache.set(source,index);return index;
}
// {algorithm,hashes:{family:hash}}, or null when the source cannot be sliced (callers then bind the full core).
function slices(source,roots){
 const index=sliceIndex(source);if(index.problem)return null;
 const hashes={};
 for(const family of Object.keys(roots).sort()){
  const seen=new Set(),queue=[...index.preludeRefs],used=[...new Set(roots[family])].sort().map(name=>{
   if(!index.exports.has(name))throw Error('core 切片根不在 SaveCore 匯出：'+family+':'+name);
   queue.push(index.exports.get(name));return [name,index.exports.get(name)];
  });
  while(queue.length){const name=queue.pop();if(seen.has(name))continue;seen.add(name);queue.push(...index.refs.get(name));}
  hashes[family]=sha(JSON.stringify({algorithm:sliceAlgorithm,prelude:index.prelude,exports:used,bindings:[...seen].sort().map(name=>[name,index.json.get(name)])}));
 }
 return {algorithm:sliceAlgorithm,hashes};
}
function sliceProblem(source){return sliceIndex(source).problem||null;}
// Slices recorded for an already proven core whose snapshot predates slicing (written only from the exact core text).
function sliceBaselines(){
 const file=path.join(__dirname,'../knowledge/core-slice-baselines.json');
 if(!fs.existsSync(file))return [];
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 if(data.version!==1||data.algorithm!==sliceAlgorithm||data.coreAlgorithm!==algorithm||!Array.isArray(data.bindings))throw Error('Invalid core slice baseline format');
 const seen=new Set();
 for(const entry of data.bindings){
  if(!hex.test(entry.coreHash)||seen.has(entry.coreHash)||!entry.slices||!Object.values(entry.slices).every(h=>hex.test(h)))throw Error('Invalid core slice baseline binding');
  seen.add(entry.coreHash);
 }
 return data.bindings;
}
function sliceBridge(digest,version){
 const id=identity(digest,version);if(id.algorithm!==algorithm)return null;
 const entry=sliceBaselines().find(b=>b.coreHash===id.hash);
 return entry?{algorithm:sliceAlgorithm,hashes:entry.slices}:null;
}
function bindings(){
 const fs=require('node:fs'),path=require('node:path'),file=path.join(__dirname,'../knowledge/core-ast-baselines.json');
 if(!fs.existsSync(file))return [];
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 if(data.algorithm!==algorithm||data.version!==1||!Array.isArray(data.bindings))throw Error('Invalid core AST baseline format');
 const seen=new Set();
 for(const entry of data.bindings){
  if(!hex.test(entry.legacyHash)||!hex.test(entry.astHash)||!hex.test(entry.proofHash)||seen.has(entry.legacyHash))throw Error('Invalid core AST baseline binding');
  seen.add(entry.legacyHash);
 }
 return data.bindings;
}
function identity(digest,version){
 if(!hex.test(digest)||!supported(version))throw Error('Unknown core digest algorithm or invalid hash');
 if(version===algorithm)return {algorithm,hash:digest};
 const bridge=bindings().find(b=>b.legacyHash===digest);
 return bridge?{algorithm,hash:bridge.astHash}:{algorithm:legacyAlgorithm,hash:digest};
}
function matches(source,digest,version){
 // Parse even legacy exact matches, so unsupported/invalid programs cannot pass.
 const astHash=hash(source),id=identity(digest,version);
 return id.algorithm===algorithm?id.hash===astHash:id.hash===rawHash(source);
}
function same(a,b){return JSON.stringify(identity(a.coreHash,a.coreHashAlgorithm))===JSON.stringify(identity(b.coreHash,b.coreHashAlgorithm));}
module.exports={algorithm,legacyAlgorithm,sliceAlgorithm,sha,rawHash,hash,identity,matches,same,supported,slices,sliceProblem,sliceBaselines,sliceBridge};
