const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Backpack (z7) ordinary equipment over-limit level: own gate, same 1000 ceiling and checks as the z9 advanced path.
function setup(gates={}){
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json'));for(const group of Object.keys(k.verification))k.verification[group]=true;Object.assign(k.verification,gates);
 const ctx={setTimeout};vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='甲';
 for(const z of [7,9]){const put=(y,v)=>data[1][y][z]=v;put(0,100);put(1,16);put(2,1);put(3,1);put(5,3);put(6,3);put(8,155);put(9,12);put(10,13);put(15,30);put(16,40);put(24,1);put(28,1);}
 const text='﻿'+JSON.stringify({c2array:true,size:[221,60,22],data}).replace('{','{\r\n"large":987654321098765432109876543210,');return {C,m:C.parse(text),text};
}
const level=(C,m,z=7)=>C.get(m,{x:1,y:6,z});
test('closed backpack gate keeps v2.4 behavior and is independent of the z9 advanced gate',()=>{
 const {C,m,text}=setup({backpackEquipmentLevelAdvanced:false});
 assert.equal(C.editingInfo(m,'equipment',1,7).advancedVerified,false);assert.equal(C.editingInfo(m,'equipment',1,9).advancedVerified,true);
 assert.throws(()=>C.setEquipmentLevel(m,{itemId:1,plane:7,level:21,advanced:true}),/尚未完成/);assert.throws(()=>C.setEquipmentLevel(m,{itemId:1,plane:7,level:21}),/一般模式/);
 C.setEquipmentLevel(m,{itemId:1,plane:9,level:21,advanced:true});assert.equal(level(C,m,9),21);C.undo(m);assert.equal(C.serialize(m),text);
 m.original.data[1][6][7]=100;assert.throws(()=>C.setEquipmentLevel(m,{itemId:1,plane:7,level:10}),/超限裝備停用/);
 const other=setup({equipmentLevelAdvanced:false});other.C.setEquipmentLevel(other.m,{itemId:1,plane:7,level:21,advanced:true});
 assert.throws(()=>other.C.setEquipmentLevel(other.m,{itemId:1,plane:9,level:21,advanced:true}),/尚未完成/);
});
test('open gate allows normal cap plus one through 1000 and rejects outside values atomically',()=>{
 const {C,m,text}=setup(),info=C.editingInfo(m,'equipment',1,7);
 assert.deepEqual([info.normalMax,info.advancedMax,info.advancedVerified],[20,1000,true]);
 assert.throws(()=>C.setEquipmentLevel(m,{itemId:1,plane:7,level:21}),/一般模式上限 20/);
 for(const value of [21,1000,4]){C.setEquipmentLevel(m,{itemId:1,plane:7,level:value,advanced:true});assert.equal(level(C,m),value);}
 for(const value of [1001,0,10.5,'12',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>C.setEquipmentLevel(m,{itemId:1,plane:7,level:value,advanced:true}));
 assert.equal(level(C,m,9),3,'z9 row with the same id stays untouched');
 C.restore(m,{x:1,y:6,z:7});assert.equal(C.serialize(m),text);assert.ok(C.serialize(m).includes('987654321098765432109876543210'));
});
test('only y6 changes and undo walks back each level transaction',()=>{
 const {C,m,text}=setup();C.setEquipmentLevel(m,{itemId:1,plane:7,level:500,advanced:true});C.setEquipmentLevel(m,{itemId:1,plane:7,level:1000,advanced:true});
 assert.deepEqual([...m.changes.values()].map(c=>[c.x,c.y,c.z]),[[1,6,7]]);const out=JSON.parse(C.serialize(m).replace(/^﻿/,'')),src=JSON.parse(text.replace(/^﻿/,''));src.data[1][6][7]=1000;assert.deepEqual(out,src);
 C.undo(m);assert.equal(level(C,m),500);C.undo(m);assert.equal(C.serialize(m),text);
});
test('an already over-limit backpack row (for example natively moved from z9) can be lowered or re-raised',()=>{
 const {C,m}=setup();m.original.data[1][6][7]=1000;
 C.setEquipmentLevel(m,{itemId:1,plane:7,level:20});assert.equal(level(C,m),20);C.setEquipmentLevel(m,{itemId:1,plane:7,level:700,advanced:true});assert.equal(level(C,m),700);
 assert.throws(()=>C.setEquipmentLevel(m,{itemId:1,plane:7,level:21}),/一般模式/);
});
test('structural backpack checks still apply in advanced mode',()=>{
 for(const [y,v]of [[2,2],[7,1],[24,2],[25,1],[3,10],[5,7],[15,99]]){const {C,m,text}=setup();m.original.data[1][y][7]=v;assert.throws(()=>C.setEquipmentLevel(m,{itemId:1,plane:7,level:21,advanced:true}));assert.equal(C.serialize(m),text);}
});
test('affix-edited rows cannot be raised past the normal cap; over-limit rows keep affix and quality edits closed',()=>{
 const {C,m}=setup();C.setEquipmentAffixCoefficient(m,{itemId:1,plane:7,slot:1,coefficient:50});
 assert.throws(()=>C.setEquipmentLevel(m,{itemId:1,plane:7,level:21,advanced:true}),/詞條/);C.setEquipmentLevel(m,{itemId:1,plane:7,level:20,advanced:true});
 const over=setup();over.C.setEquipmentLevel(over.m,{itemId:1,plane:7,level:21,advanced:true});
 assert.throws(()=>over.C.setEquipmentAffixCoefficient(over.m,{itemId:1,plane:7,slot:1,coefficient:50}),/超限/);
 assert.throws(()=>over.C.equipmentQualityInfo(over.m,{itemId:1,plane:7}),/超限/);
});
test('highest backpack tier and quality keep upgrade formulas finite at 1000',()=>{
 const {C,m}=setup(),d=m.original.data[1];
 const id=Object.entries(C.KNOWLEDGE.batch2Data.items).map(([id,v])=>({id:Number(id),v,t:C.KNOWLEDGE.catalogs.items.find(i=>i.id===Number(id))})).find(e=>e.v.tier===9&&e.v.setLink===0&&e.t?.kind==='普通'&&e.t.slot<=4);
 assert.ok(id,'catalog has a tier-9 ordinary backpack item');
 d[1][7]=id.id;d[3][7]=9;d[5][7]=6;d[8][7]=230;for(let y=9;y<=33;y++)d[y][7]=0;
 for(let slot=1;slot<=5;slot++){d[8+slot][7]=id.v.affixIds[slot-1];d[14+slot][7]=50;}d[28][7]=1;
 C.setEquipmentLevel(m,{itemId:1,plane:7,level:1000,advanced:true});assert.equal(level(C,m),1000);
});
test('batch upgrade does not lower over-limit backpack rows and custom coordinates cannot bypass the gate',async()=>{
 const {C,m}=setup();C.setEquipmentLevel(m,{itemId:1,plane:7,level:21,advanced:true});
 const preview=await C.previewBatch(m,{kind:'equipmentMax',plane:7});assert.deepEqual([preview.summary.blocked,preview.summary.changed],[1,0]);assert.match(preview.rows[0].reason,/不會自動降級/);
 for(const method of ['set','setField'])assert.throws(()=>C[method](m,{x:1,y:6,z:7},500));assert.equal(level(C,m),21);
});
test('the open flag carries its lightweight smoke record and stays out of the composite migration proof',()=>{
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json')),proof=JSON.parse(fs.readFileSync('knowledge/verification.json')),P=require('../scripts/migration-proof.cjs');
 assert.equal(k.verification.backpackEquipmentLevelAdvanced,true);assert.equal(proof.groups.backpackEquipmentLevelAdvanced,true);
 const rec=proof.lightweight.backpackEquipmentLevelAdvanced;assert.equal(rec.passed,true);assert.equal(rec.gameVersion,k.gameVersion);assert.match(rec.resultSha256,/^[a-f0-9]{64}$/);
 assert.equal(P.composite(proof,'backpackEquipmentLevelAdvanced'),false);assert.equal(P.composite(proof,'backpackEquipmentLevel'),true);
});
