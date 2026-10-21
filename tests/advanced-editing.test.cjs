const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(nx=221){
 const knowledge=JSON.parse(fs.readFileSync(path.join(__dirname,'../knowledge/catalog.json'),'utf8'));
 for(const group of Object.keys(knowledge.verification))knowledge.verification[group]=true;
 const ctx={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(knowledge)),ctx);
 const C=ctx.SaveCore,data=Array.from({length:nx},()=>Array.from({length:60},()=>Array(22).fill(0)));
 const put=(x,y,z,v)=>data[x][y][z]=v;
 put(0,0,1,'szmnqea');put(1,0,2,1);put(1,1,2,'測試甲');put(1,1,4,5);
 put(1,0,9,1);put(1,1,9,1);put(1,3,9,1);put(1,5,9,1);put(1,6,9,5);
 put(1,0,1,1);put(1,1,1,5);put(1,5,1,1);put(2,0,1,2);put(2,1,1,6);put(2,5,1,1);
 put(1,5,0,5);put(31,4,0,1);
 const text='\ufeff'+JSON.stringify({c2array:true,size:[nx,60,22],data}).replace('{','{ "large":987654321098765432109876543210,\n');
 return {C,model:C.parse(text),text,put};
}
test('equipment edits preserve ownership, attributes and raw text across undo and downgrade',()=>{
 const {C,model,text}=setup();const c={x:1,y:6,z:9};
 C.setEquipmentLevel(model,{itemId:1,level:10});C.setEquipmentLevel(model,{itemId:1,level:3});
 assert.equal(C.get(model,c),3);assert.equal(model.changes.size,1);
 const exported=C.serialize(model);assert.ok(exported.includes('987654321098765432109876543210'));
 assert.equal(JSON.parse(exported.slice(1)).data[1][7][9],0);
 C.undo(model);assert.equal(C.get(model,c),10);C.restore(model,c);assert.equal(C.serialize(model),text);
});

test('facility progress blocks editing even when its separate flag is zero',()=>{
 const {C,model}=setup(),a=model.original.data;
 a[3][0][21]=3;a[3][2][21]=2;a[3][3][21]=1;
 assert.throws(()=>C.setProfessionTrainingCap(model,{professionId:1,cap:10}),/正在操練/);
 a[3][2][21]=1;a[3][3][21]=31;
 assert.throws(()=>C.setAdvancedTechnologyLevel(model,{technologyId:31,level:2}),/正在研究/);
 assert.equal(model.changes.size,0);
});

test('special technology limits protect recruitment, inventory capacity and existing display stands',()=>{
 const {C,model}=setup(450),a=model.original.data;
 assert.throws(()=>C.setAdvancedTechnologyLevel(model,{technologyId:33,level:300,advanced:true}),/上限 299/);
 assert.throws(()=>C.setAdvancedTechnologyLevel(model,{technologyId:32,level:25}),/實體空間/);
 for(let x=1;x<=403;x++)a[x][0][7]=x;
 assert.throws(()=>C.setAdvancedTechnologyLevel(model,{technologyId:32,level:1}),/容量小於/);
 for(let x=3;x<14;x++){a[x][0][1]=x;a[x][1][1]=67;}
 assert.throws(()=>C.setAdvancedTechnologyLevel(model,{technologyId:44,level:1}),/容量小於/);
 assert.equal(model.changes.size,0);
});

test('corrupt equipment rank cannot produce overflowing native upgrade costs',()=>{
 const {C,model}=setup();model.original.data[1][3][9]=100000;
 assert.throws(()=>C.setEquipmentLevel(model,{itemId:1,level:10}),/公式/);
 assert.equal(model.changes.size,0);
});
test('equipment validates mode, special items, identity and bidirectional equipped pointers',()=>{
 const {C,model}=setup();
 assert.throws(()=>C.setEquipmentLevel(model,{itemId:1,level:11}),/上限/);
 C.setEquipmentLevel(model,{itemId:1,level:11,advanced:true});
 model.original.data[1][7][9]=1;
 assert.throws(()=>C.setEquipmentLevel(model,{itemId:1,level:9}),/雙向/);
 model.original.data[1][16][2]=1;C.setEquipmentLevel(model,{itemId:1,level:9});
 model.original.data[1][17][2]=1;assert.throws(()=>C.setEquipmentLevel(model,{itemId:1,level:8}),/雙向/);
 const special=C.KNOWLEDGE.catalogs.items.find(v=>['宝物','内丹'].includes(v.kind));
 model.original.data[1][1][9]=special.id;assert.throws(()=>C.setEquipmentLevel(model,{itemId:1,level:8}),/一般裝備/);
});
test('training caps account for every character and ongoing training without changing flags',()=>{
 const {C,model}=setup();
 model.original.data[2][0][2]=2;model.original.data[2][1][2]='測試乙';model.original.data[2][1][4]=12;
 assert.throws(()=>C.setProfessionTrainingCap(model,{professionId:1,cap:11}),/不小於 12/);
 C.setProfessionTrainingCap(model,{professionId:1,cap:15});
 assert.throws(()=>C.setProfessionTrainingCap(model,{professionId:1,cap:16}),/上限/);
 C.setProfessionTrainingCap(model,{professionId:1,cap:31,advanced:true});
 model.original.data[1][15][0]=1;assert.throws(()=>C.setProfessionTrainingCap(model,{professionId:1,cap:30,advanced:true}),/正在操練/);
 assert.equal(C.get(model,{x:1,y:15,z:0}),1);
});
test('technology distinguishes actual academy level, valid advanced IDs and research state',()=>{
 const {C,model}=setup();
 C.setAdvancedTechnologyLevel(model,{technologyId:31,level:119});
 assert.throws(()=>C.setAdvancedTechnologyLevel(model,{technologyId:31,level:120}),/上限/);
 C.setAdvancedTechnologyLevel(model,{technologyId:31,level:300,advanced:true});
 for(const technologyId of [1,29,30,45])assert.throws(()=>C.setAdvancedTechnologyLevel(model,{technologyId,level:1}),/進階科技/);
 model.original.data[31][13][0]=1;assert.throws(()=>C.setAdvancedTechnologyLevel(model,{technologyId:31,level:2}),/正在研究/);
});
test('advanced groups are independent; raw set and custom coordinates cannot bypass operations',()=>{
 const {C,model}=setup();C.KNOWLEDGE.verification.equipmentLevelAdvanced=false;
 assert.throws(()=>C.setEquipmentLevel(model,{itemId:1,level:11,advanced:true}),/驗證/);
 C.setEquipmentLevel(model,{itemId:1,level:10});
 for(const c of [{x:1,y:6,z:9},{x:1,y:5,z:0},{x:31,y:4,z:0}]){
  assert.throws(()=>C.setField(model,c,1),/唯讀/);assert.throws(()=>C.set(model,c,1),/唯讀/);
 }
});
test('invalid numbers, tested boundaries and failed composite operations leave no changes',()=>{
 const {C,model,text}=setup();
 for(const level of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'3'])assert.throws(()=>C.setEquipmentLevel(model,{itemId:1,level,advanced:true}));
 C.setEquipmentLevel(model,{itemId:1,level:1000,advanced:true});
 assert.throws(()=>C.setEquipmentLevel(model,{itemId:1,level:1001,advanced:true}),/上限/);C.undo(model);
 assert.throws(()=>C.transaction(model,()=>{C.setEquipmentLevel(model,{itemId:1,level:9});C.setAdvancedTechnologyLevel(model,{technologyId:29,level:1});}));
 assert.equal(C.serialize(model),text);assert.equal(model.history.length,0);
});
