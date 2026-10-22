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
module.exports={algorithm,legacyAlgorithm,sha,rawHash,hash,identity,matches,same,supported};
