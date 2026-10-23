const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json'));for(const group of Object.keys(k.verification))k.verification[group]=true;
 const ctx={};vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='甲';
 for(const z of [7,9]){const put=(y,v)=>data[1][y][z]=v;put(0,100);put(1,16);put(2,1);put(3,1);put(5,3);put(6,3);put(8,155);put(9,12);put(10,13);put(15,30);put(16,40);put(24,1);put(28,1);}
 const text='\ufeff'+JSON.stringify({c2array:true,size:[221,60,22],data}).replace('{','{\r\n"large":987654321098765432109876543210,');return {C,m:C.parse(text),text};
}
const opt={itemId:1,slot:1,plane:7,attributeId:17,coefficient:50.01};
test('plane identity isolates overlapping rows and restore groups across operations',()=>{
 const {C,m,text}=setup();m.original.data[1][7][9]=1;m.original.data[1][18][2]=1;
 C.setEquipmentLevel(m,{itemId:1,plane:7,level:10});C.setEquipmentAffix(m,opt);C.setEquipmentAffixCoefficient(m,{itemId:1,plane:9,slot:1,coefficient:50});
 assert.equal(C.get(m,{x:1,y:6,z:9}),3);C.restore(m,{x:1,y:9,z:7});assert.equal(C.get(m,{x:1,y:6,z:7}),3);assert.equal(C.get(m,{x:1,y:15,z:9}),50);
 C.restore(m,{x:1,y:15,z:9});assert.equal(C.serialize(m),text);assert.ok(C.serialize(m).includes('987654321098765432109876543210'));
});
test('backpack validates plane quantity owner bounds and unknown state without treating z9 refs as z7 refs',()=>{
 for(const override of [{plane:0},{plane:'7'},{plane:null},{plane:8},{plane:NaN}]){const {C,m,text}=setup();assert.throws(()=>C.setEquipmentAffix(m,{...opt,...override}));assert.equal(C.serialize(m),text);}
 for(const [y,v]of [[0,0],[0,221],[2,2],[7,1],[24,2],[25,1],[26,1],[27,1],[3,10],[5,7],[6,100]]){const {C,m,text}=setup();C.KNOWLEDGE.verification.backpackEquipmentLevelAdvanced=false;m.original.data[1][y][7]=v;assert.throws(()=>C.setEquipmentLevel(m,{itemId:1,plane:7,level:4}));assert.equal(C.serialize(m),text);}
 const {C,m}=setup();m.original.data[1][7][9]=1;m.original.data[1][18][2]=1;C.setEquipmentAffix(m,opt);assert.equal(C.get(m,{x:1,y:7,z:7}),0);
});
test('first selection is explicit and atomic; same-value lock is meaningful, later same-value write is noop',()=>{
 for(const plane of [7,9]){const {C,m}=setup();m.original.data[1][28][plane]=0;const options={itemId:1,plane,slot:2,attributeId:13,coefficient:40};
  const i=C.equipmentAffixReplacementInfo(m,options);assert.equal(i.requiresInitialSelection,true);assert.deepEqual(Array.from(i.selectableSlots),[1,2]);
  assert.throws(()=>C.setEquipmentAffix(m,options),/確認首次/);assert.equal(m.changes.size,0);
  const preview=C.previewEquipmentAffixReplacement(m,{...options,selectUnwashedSlot:true});assert.equal(m.changes.size,0);assert.equal(preview.unchanged,false);assert.equal(preview.selectionChange.after,2);
  C.setEquipmentAffix(m,{...options,selectUnwashedSlot:true});assert.equal(m.changes.size,1);assert.equal(C.get(m,{x:1,y:29,z:plane}),1);assert.equal(C.get(m,{x:1,y:24,z:plane}),1);
  const n=m.history.length;C.setEquipmentAffix(m,options);assert.equal(m.history.length,n);assert.throws(()=>C.setEquipmentAffix(m,{...options,selectUnwashedSlot:true}),/已有選槽/);assert.throws(()=>C.setEquipmentAffix(m,{...options,slot:1}),/不能更換/);
  C.undo(m);assert.equal(C.get(m,{x:1,y:29,z:plane}),0);
 }
});
test('first-selection rollback and whole-item restore retain complete unmodified source',()=>{
 const {C,m}=setup();m.original.data[1][28][7]=0;const options={...opt,selectUnwashedSlot:true},before=C.serialize(m);
 assert.throws(()=>C.transaction(m,()=>{C.setEquipmentAffix(m,options);C.setEquipmentLevel(m,{itemId:1,plane:7,level:999});}));assert.equal(m.history.length,0);assert.equal(C.serialize(m),before);
 C.setEquipmentAffix(m,options);assert.equal(m.changes.size,3);C.setEquipmentLevel(m,{itemId:1,plane:7,level:10});C.setEquipmentAffixCoefficient(m,{itemId:1,plane:7,slot:1,coefficient:60});C.restore(m,{x:1,y:28,z:7});assert.equal(C.serialize(m),before);
});
test('first-selection does not allow invalid structure duplicates or custom-coordinate writes',()=>{
 for(const [y,v]of [[28,2],[29,1],[30,1],[5,1],[15,20.001],[9,72]]){const {C,m}=setup();m.original.data[1][28][7]=0;m.original.data[1][y][7]=v;assert.throws(()=>C.setEquipmentAffix(m,{...opt,selectUnwashedSlot:true}));assert.equal(m.changes.size,0);}
 const {C,m}=setup();m.original.data[1][28][7]=0;assert.throws(()=>C.setEquipmentAffix(m,{...opt,attributeId:13,selectUnwashedSlot:true}),/重複/);for(const y of [6,9,15,28])for(const method of ['set','setField'])assert.throws(()=>C[method](m,{x:1,y,z:7},1));
});
test('new write gates are independent and source-new markers cannot borrow old evidence',()=>{
 for(const group of ['backpackEquipmentLevel','backpackEquipmentAffixCoefficient','backpackEquipmentAffixReplacement','equipmentAffixInitialSelection','equipmentNewItemMarker']){
  const {C,m}=setup();C.KNOWLEDGE.verification[group]=false;
  const action=group==='backpackEquipmentLevel'?()=>C.setEquipmentLevel(m,{itemId:1,plane:7,level:4}):group==='backpackEquipmentAffixCoefficient'?()=>C.setEquipmentAffixCoefficient(m,{itemId:1,plane:7,slot:1,coefficient:50}):group==='equipmentNewItemMarker'?()=>C.setEquipmentAffix(m,{...opt,plane:9}):()=>{if(group==='equipmentAffixInitialSelection')m.original.data[1][28][7]=0;C.setEquipmentAffix(m,{...opt,selectUnwashedSlot:group==='equipmentAffixInitialSelection'});};
  assert.throws(action);assert.equal(m.changes.size,0);
 }
});
test('backpack normal caps remain bounded and cannot request advanced mode while its gate is closed',()=>{
 for(let q=1;q<=6;q++){const {C,m}=setup(),d=m.original.data[1];C.KNOWLEDGE.verification.backpackEquipmentLevelAdvanced=false;d[5][7]=q;for(let y=9;y<=33;y++)d[y][7]=0;d[24][7]=q%2;
  for(let slot=1;slot<q;slot++){d[8+slot][7]=12;d[14+slot][7]=10*(q-1);}const max=10+(q-1)*5;
  C.setEquipmentLevel(m,{itemId:1,plane:7,level:max});assert.throws(()=>C.setEquipmentLevel(m,{itemId:1,plane:7,level:max+1}));assert.throws(()=>C.setEquipmentLevel(m,{itemId:1,plane:7,level:max,advanced:true}));
  if(q===1)assert.throws(()=>C.setEquipmentAffix(m,{...opt,selectUnwashedSlot:true}));
 }
});
