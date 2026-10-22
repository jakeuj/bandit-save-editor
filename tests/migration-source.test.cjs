'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),zlib=require('node:zlib');
const Source=require('../scripts/migration-source.cjs');
// Tiny synthetic archives, including ZIP64 directory metadata. No game assets are fixtures.
function zip(entries,{zip64=false}={}) {
  const locals=[],directory=[];let offset=0;
  for(const [name,value]of entries){
    const filename=Buffer.from(name),bytes=Buffer.from(value),packed=zlib.deflateRawSync(bytes),local=Buffer.alloc(30),central=Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);local.writeUInt16LE(8,8);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(filename.length,26);
    central.writeUInt32LE(0x02014b50);central.writeUInt16LE(8,10);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);
    locals.push(local,filename,packed);directory.push(central,filename);offset+=local.length+filename.length+packed.length;
  }
  const table=Buffer.concat(directory),end=Buffer.alloc(22),extra=[];
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(zip64?65535:entries.length,8);end.writeUInt16LE(zip64?65535:entries.length,10);end.writeUInt32LE(table.length,12);end.writeUInt32LE(zip64?0xffffffff:offset,16);
  if(zip64){const record=Buffer.alloc(56),locator=Buffer.alloc(20);record.writeUInt32LE(0x06064b50);record.writeBigUInt64LE(44n,4);record.writeBigUInt64LE(BigInt(entries.length),24);record.writeBigUInt64LE(BigInt(entries.length),32);record.writeBigUInt64LE(BigInt(table.length),40);record.writeBigUInt64LE(BigInt(offset),48);locator.writeUInt32LE(0x07064b50);locator.writeBigUInt64LE(BigInt(offset+table.length),8);locator.writeUInt32LE(1,16);extra.push(record,locator);}
  return Buffer.concat([...locals,table,...extra,end]);
}
function directory(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bandit-source-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('static ZIP64 cache extracts only required sources, checks cached bytes and expands assets only on demand',t=>{
  const dir=directory(t),file=path.join(dir,'package.nw'),entries=Source.files.map(n=>[n,'synthetic '+n]);entries.push(['images/not-needed.png','synthetic-image'],['package.json','{}']);
  fs.writeFileSync(file,zip(entries,{zip64:true}));
  const first=Source.prepare(file,dir);assert.equal(first.reused,false);assert.equal(fs.existsSync(path.join(first.source,'images')),false);
  assert.equal(Source.prepare(file,dir).reused,true);
  fs.writeFileSync(path.join(first.source,'data.json'),'corrupt cache');assert.equal(Source.prepare(file,dir).reused,false);
  assert.equal(fs.readFileSync(path.join(first.source,'data.json'),'utf8'),'synthetic data.json');
  const full=Source.prepare(file,dir,{full:true});assert.equal(fs.readFileSync(path.join(full.source,'images/not-needed.png'),'utf8'),'synthetic-image');
  assert.notEqual(full.source,first.source);
});
test('archive traversal, duplicate or missing members and repo-local artifacts are rejected',t=>{
  const dir=directory(t),file=path.join(dir,'bad.nw');
  fs.writeFileSync(file,zip([['../escape','x']]));assert.throws(()=>Source.members(file),/Unsafe/);
  fs.writeFileSync(file,zip([['same','1'],['same','2']]));assert.throws(()=>Source.members(file),/Duplicate/);
  fs.writeFileSync(file,zip([['one','1']]));assert.throws(()=>Source.members(file,['missing']),/Missing/);
  assert.throws(()=>Source.external(path.resolve(__dirname,'..')),/outside/);
});
