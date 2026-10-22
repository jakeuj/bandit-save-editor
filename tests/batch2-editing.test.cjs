const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
function setup(){
 const K=JSON.parse(fs.readFileSync('knowledge/catalog.json'));K.verification.equipmentAffixCoefficient=K.verification.pillAptitudeBonus=true;
 const ctx={};vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(K)),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='測試甲';data[1][2][2]=1;
 const template=K.batch2Data.characters[1];for(let i=0;i<3;i++){data[1][10+i][2]=template.base[i];data[1][1+i][12]=template.talents[i];data[1][21+i][12]=template.talentLevels[i];}
 data[1][0][9]=1;data[1][1][9]=1;data[1][3][9]=1;data[1][5][9]=2;data[1][6][9]=1;data[1][9][9]=K.batch2Data.items[1].affixIds[0];data[1][15][9]=20;data[1][28][9]=1;
 const pills=[1,2,3].map(a=>Number(Object.keys(K.batch2Data.pills).find(id=>K.batch2Data.pills[id].aptitude===a&&K.batch2Data.pills[id].cap>=40)));pills.forEach(id=>data[id][6][0]=10);
 const text='\ufeff'+JSON.stringify({c2array:true,size:[221,60,22],data}).replace('{','{\r\n"large":987654321098765432109876543210,');
 return {C,m:C.parse(text),pills,text};
}
test('affix changes preserve IDs flags ownership and original tokens through undo/restore',()=>{
 const {C,m,text}=setup();C.setEquipmentAffixCoefficient(m,{itemId:1,slot:1,coefficient:10.01});C.setEquipmentAffixCoefficient(m,{itemId:1,slot:1,coefficient:80});
 assert.equal(m.changes.size,1);const out=C.serialize(m);assert.ok(out.startsWith('\ufeff'));assert.ok(out.includes('987654321098765432109876543210'));assert.ok(out.includes('\r\n'));
 assert.equal(C.get(m,{x:1,y:28,z:9}),1);C.undo(m);assert.equal(C.get(m,{x:1,y:15,z:9}),10.01);C.restore(m,{x:1,y:15,z:9});assert.equal(C.serialize(m),text);
});
test('affix invalid values, pool, slots, selected flag and special state reject before writing',()=>{
 for(const coefficient of [0,9.99,80.01,10.001,NaN,Infinity,'20',null]){const {C,m}=setup();assert.throws(()=>C.setEquipmentAffixCoefficient(m,{itemId:1,slot:1,coefficient}));assert.equal(m.changes.size,0);}
 for(const [y,v]of [[9,104],[28,0],[29,1],[25,1],[5,7],[6,16]]){const {C,m}=setup();m.original.data[1][y][9]=v;assert.throws(()=>C.setEquipmentAffixCoefficient(m,{itemId:1,slot:1,coefficient:20}));}
 const {C,m}=setup();assert.throws(()=>C.setEquipmentAffixCoefficient(m,{itemId:1,slot:6,coefficient:20}));assert.throws(()=>C.setEquipmentAffixCoefficient(m,{itemId:1,slot:1,coefficient:20,advanced:true}));m.original.data[1][7][9]=1;assert.throws(()=>C.affixInfo(m,1,1),/雙向/);
});
test('pill bounds include template talents, three aptitudes, zero and no material debit',()=>{
 const {C,m,pills}=setup();for(let aptitude=1;aptitude<=3;aptitude++){
 const info=C.pillInfo(m,1,aptitude,pills[aptitude-1]);assert.ok(info.base>0);assert.ok(info.max>0);
 C.setPillAptitudeBonus(m,{characterId:1,aptitude,pillId:pills[aptitude-1],bonus:info.max});assert.equal(C.get(m,{x:pills[aptitude-1],y:6,z:0}),10);
 assert.throws(()=>C.setPillAptitudeBonus(m,{characterId:1,aptitude,pillId:pills[aptitude-1],bonus:info.max+1}),/累積增量/);
 C.setPillAptitudeBonus(m,{characterId:1,aptitude,pillId:pills[aptitude-1],bonus:0});}
 assert.equal(m.changes.size,0);
});
test('pill rejects malformed inputs, wrong or absent pill and overwritten/high-stage state',()=>{
 const {C,m,pills}=setup();for(const bonus of [-1,0.1,NaN,Infinity,'1',null])assert.throws(()=>C.setPillAptitudeBonus(m,{characterId:1,aptitude:1,pillId:pills[0],bonus}));
 assert.throws(()=>C.pillInfo(m,1,1,pills[1]));assert.throws(()=>C.pillInfo(m,0,1,pills[0]));
 for(const [x,y,z,v]of [[1,50,2,0.5],[1,2,16,1],[1,10,2,99],[1,1,12,999],[1,13,2,1.1],[pills[0],6,0,0]]){const f=setup();f.m.original.data[x][y][z]=v;assert.throws(()=>f.C.pillInfo(f.m,1,1,f.pills[0]));}
});
test('pill group restore and composite transaction rollback preserve other operations',()=>{
 const {C,m,pills,text}=setup();assert.throws(()=>C.transaction(m,()=>{C.setEquipmentAffixCoefficient(m,{itemId:1,slot:1,coefficient:30});C.setPillAptitudeBonus(m,{characterId:1,aptitude:1,pillId:pills[0],bonus:-1});}));assert.equal(C.serialize(m),text);
 C.setPillAptitudeBonus(m,{characterId:1,aptitude:1,pillId:pills[0],bonus:1});C.setPillAptitudeBonus(m,{characterId:1,aptitude:1,pillId:pills[0],bonus:2});C.setPillAptitudeBonus(m,{characterId:1,aptitude:2,pillId:pills[1],bonus:1});C.restore(m,{x:1,y:13,z:2});assert.equal(m.changes.size,0);assert.equal(C.get(m,{x:1,y:14,z:2}),0);
});
test('batch two gates are independent and custom coordinates cannot bypass them',()=>{
 const {C,m,pills}=setup();C.KNOWLEDGE.verification.equipmentAffixCoefficient=false;assert.throws(()=>C.setEquipmentAffixCoefficient(m,{itemId:1,slot:1,coefficient:30}),/驗證/);C.setPillAptitudeBonus(m,{characterId:1,aptitude:1,pillId:pills[0],bonus:1});C.KNOWLEDGE.verification.pillAptitudeBonus=false;assert.throws(()=>C.setPillAptitudeBonus(m,{characterId:1,aptitude:1,pillId:pills[0],bonus:2}),/驗證/);
 for(const c of [{x:1,y:15,z:9},{x:1,y:28,z:9},{x:1,y:13,z:2},{x:2,y:14,z:2}]){assert.throws(()=>C.set(m,c,1),/唯讀/);assert.throws(()=>C.setField(m,c,1),/唯讀/);}
});
test('random template-zero characters retain saved aptitude and nonzero talent effects',()=>{
 const {C,m,pills}=setup();const d=m.original.data;d[1][2][2]=0;d[1][10][2]=60;d[1][1][12]=1;d[1][21][12]=2;d[1][2][12]=0;d[1][22][12]=0;d[1][3][12]=0;d[1][23][12]=0;
 const i=C.pillInfo(m,1,1,pills[0]);assert.equal(i.base,7);assert.equal(i.cap,10.5);assert.equal(i.max,35);
 C.setPillAptitudeBonus(m,{characterId:1,aptitude:1,pillId:pills[0],bonus:35});assert.equal(C.pillInfo(m,1,1,pills[0]).total,10.5);
});
test('equipment level and affix restores stay one valid group and reject later overcap',()=>{
 const {C,m,text}=setup();C.setEquipmentLevel(m,{itemId:1,level:3});C.setEquipmentAffixCoefficient(m,{itemId:1,slot:1,coefficient:30.01});assert.throws(()=>C.setEquipmentLevel(m,{itemId:1,level:1000,advanced:true}),/詞條係數/);C.restore(m,{x:1,y:6,z:9});assert.equal(C.serialize(m),text);
});
