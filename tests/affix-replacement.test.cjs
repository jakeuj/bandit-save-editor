const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
function setup(){
 const K=JSON.parse(fs.readFileSync('knowledge/catalog.json'));K.verification.equipmentAffixReplacement=K.verification.equipmentAffixCoefficient=K.verification.pillAptitudeBonus=true;
 const ctx={};vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(K)),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='測試甲';data[1][2][2]=1;
 const template=K.batch2Data.characters[1];for(let i=0;i<3;i++){data[1][10+i][2]=template.base[i];data[1][1+i][12]=template.talents[i];data[1][21+i][12]=template.talentLevels[i];}
 data[1][0][9]=1;data[1][1][9]=1;data[1][3][9]=1;data[1][5][9]=2;data[1][6][9]=1;data[1][9][9]=K.batch2Data.items[1].affixIds[0];data[1][8][9]=120;data[1][15][9]=20;data[1][28][9]=1;
 const pills=[1,2,3].map(a=>Number(Object.keys(K.batch2Data.pills).find(id=>K.batch2Data.pills[id].aptitude===a&&K.batch2Data.pills[id].cap>=40)));pills.forEach(id=>data[id][6][0]=10);
 const text='\ufeff'+JSON.stringify({c2array:true,size:[221,60,22],data}).replace('{','{\r\n"large":987654321098765432109876543210,');
 return {C,m:C.parse(text),pills,text};
}

const options={itemId:1,slot:1,attributeId:13,coefficient:40.5};
test('replacement preview is pure, correctly removes old effect, writes only ID and coefficient',()=>{
 const {C,m,text}=setup();const old=C.get(m,{x:1,y:9,z:9});const p=C.previewEquipmentAffixReplacement(m,options);
 assert.equal(m.changes.size,0);assert.equal(m.history.length,0);assert.equal(p.effects.find(e=>e.attributeId===13).after,4.45);
 C.setEquipmentAffix(m,options);assert.equal(m.changes.size,2);assert.equal(C.get(m,{x:1,y:28,z:9}),1);assert.equal(C.get(m,{x:1,y:5,z:9}),2);
 const output=C.serialize(m);assert.ok(output.includes('987654321098765432109876543210'));assert.ok(output.startsWith('\ufeff'));assert.ok(output.includes('\r\n'));
 C.undo(m);assert.equal(C.serialize(m),text);assert.equal(C.get(m,{x:1,y:9,z:9}),old);
});
test('gate independent from coefficient; advanced and malformed requests rejected without mutation',()=>{
 for(const change of [{attributeId:999},{attributeId:'13'},{coefficient:NaN},{coefficient:Infinity},{coefficient:80.01},{coefficient:10.001},{coefficient:'20'},{slot:2},{itemId:0},{advanced:true}]){
  const {C,m,text}=setup();assert.throws(()=>C.setEquipmentAffix(m,{...options,...change}));assert.equal(C.serialize(m),text);assert.equal(m.history.length,0);
 }
 const {C,m}=setup();C.KNOWLEDGE.verification.equipmentAffixReplacement=false;assert.equal(C.previewEquipmentAffixReplacement(m,options).verified,false);assert.throws(()=>C.setEquipmentAffix(m,options));C.setEquipmentAffixCoefficient(m,{itemId:1,slot:1,coefficient:30});
});
test('invalid structure, pool category, wash flags and backlinks remain blocked',()=>{
 for(const [y,v]of [[28,0],[29,1],[25,1],[5,7],[7,1],[6,999],[10,13]]){const {C,m}=setup();m.original.data[1][y][9]=v;assert.throws(()=>C.setEquipmentAffix(m,options));assert.equal(m.changes.size,0);}
 const {C,m}=setup();const pool=C.equipmentAffixReplacementInfo(m,{itemId:1,slot:1}).candidates.map(c=>c.attributeId);const excluded=Object.keys(C.KNOWLEDGE.affixReplacement.attributes).map(Number).find(id=>!pool.includes(id));assert.ok(excluded);assert.throws(()=>C.setEquipmentAffix(m,{...options,attributeId:excluded}));
});
test('new duplicates rejected; pre-existing duplicate may be preserved or replaced',()=>{
 const {C,m}=setup(),d=m.original.data[1];d[5][9]=3;d[8][9]=150;d[10][9]=13;d[16][9]=30;
 assert.throws(()=>C.setEquipmentAffix(m,options),/重複/);
 d[9][9]=13;const p=C.previewEquipmentAffixReplacement(m,{...options,coefficient:30});assert.equal(p.effects[0].after,6.6);
 C.setEquipmentAffix(m,{...options,coefficient:30});C.setEquipmentAffix(m,{...options,attributeId:12,coefficient:30});assert.equal(C.get(m,{x:1,y:10,z:9}),13);
});
test('slot rounding and main overlap use distinct levels, no-op does not create history',()=>{
 const {C,m}=setup();m.original.data[1][1][9]=16;const id=C.KNOWLEDGE.batch2Data.items[16].mainAttributes.find(id=>C.KNOWLEDGE.affixReplacement.attributes[id]);assert.ok(id);
 const r=C.KNOWLEDGE.affixReplacement.attributes[id],f=(l,c)=>Math.floor(((r.base+r.tier+r.level*l)*(c/100))*100)/100;
 C.setEquipmentAffix(m,{...options,attributeId:id,coefficient:20});const p=C.previewEquipmentAffixReplacement(m,{...options,attributeId:id,coefficient:20});assert.equal(p.effects[0].after,f(1,120)+f(0,20));assert.equal(p.unchanged,true);
 const n=m.history.length;C.setEquipmentAffix(m,{...options,attributeId:id,coefficient:20});assert.equal(m.history.length,n);
});
test('whole equipment restore and transaction rollback cannot leave incompatible changes',()=>{
 const {C,m,text}=setup();C.setEquipmentAffix(m,options);C.setEquipmentLevel(m,{itemId:1,level:10});C.setEquipmentAffixCoefficient(m,{itemId:1,slot:1,coefficient:50});C.restore(m,{x:1,y:9,z:9});assert.equal(C.serialize(m),text);
 C.setEquipmentAffix(m,options);const before=C.serialize(m);assert.throws(()=>C.transaction(m,()=>{C.setEquipmentAffix(m,{...options,attributeId:12});throw Error('abort');}));assert.equal(C.serialize(m),before);
 assert.throws(()=>C.setEquipmentLevel(m,{itemId:1,level:50,advanced:true}),/詞條/);
 assert.throws(()=>C.setField(m,{x:1,y:9,z:9},13));assert.throws(()=>C.set(m,{x:1,y:9,z:9},13));
});

test('unknown formula is read-only and main overlap with unsupported quality coefficient is rejected',()=>{
 const {C,m}=setup();delete C.KNOWLEDGE.affixReplacement.attributes[13];assert.throws(()=>C.setEquipmentAffix(m,options),/公式/);assert.equal(m.changes.size,0);
 const f=setup();f.m.original.data[1][1][9]=16;f.m.original.data[1][8][9]=0;assert.throws(()=>f.C.previewEquipmentAffixReplacement(f.m,{...options,attributeId:12}),/主屬性品質係數/);
});

test('native inventory moves retain origin slot without requiring current row or uniqueness',()=>{
 const {C,m}=setup();m.original.data[1][0][9]=100;C.setEquipmentAffix(m,options);assert.equal(C.get(m,{x:1,y:0,z:9}),100);
 m.original.data[2]=m.original.data[1].map(row=>row.slice());C.setEquipmentAffix(m,{...options,itemId:2});assert.equal(C.get(m,{x:2,y:0,z:9}),100);
 for(const value of [0,-1,1.5,NaN,221]){const f=setup();f.m.original.data[1][0][9]=value;assert.throws(()=>f.C.setEquipmentAffix(f.m,options));}
});
