'use strict';
// Executed only in the instrumented, disposable worker. Original game functions remain unmodified.
function nativeDriver(request){
 const runtime=self.__banditValidationRuntime,manager=runtime.GetEventSheetManager();
 const table=n=>runtime.GetObjectClassByName(n).GetInstances()[0].GetSdkInstance(),a=table('save'),wp=table('wp');
 const call=(name,...args)=>{const f=manager.GetFunctionBlockByName(name);if(!f)throw Error('Missing native function '+name);const b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};
 const setGlobal=(sid,value)=>manager.GetEventVariableBySID(sid).SetValue(value);
 const read=(id,z)=>Array.from({length:60},(_,y)=>a.At(id,y,z));
 const put=(id,z,row)=>row.forEach((value,y)=>a.Set(id,y,z,value));
 const clear=(id,z)=>put(id,z,Array(60).fill(0));
 const refs=()=>Array.from({length:6},(_,i)=>a.At(1,16+i,2));
 const reset=()=>{for(let id=1;id<=12;id++)for(const z of [7,9,18])clear(id,z);for(let slot=1;slot<=6;slot++)a.Set(1,15+slot,2,0);a.Set(1,2,0,1e12);a.Set(3,2,0,1e9);};
 const find=(z,id)=>{for(let x=1;x<a.GetWidth();x++)if(a.At(x,1,z)===id&&a.At(x,0,z)>0)return x;throw Error('Native generated item missing '+id+' / '+z);};
 const single=(v,id)=>{let sum=0;for(let s=0;s<3;s++)if(wp.At(v[1],8+s,0)===id)sum+=call('装备主属性',v[6],v[3],id,v[8],wp.At(v[1],11+s,0),'主属性',0,v[5]);for(let s=1;s<=6;s++)if(v[8+s]===id)sum+=call('装备主属性',v[6],v[3],id,v[14+s],100,'副词条',0,v[5]);return sum;};
 if(request.op==='initialize'){
  for(let x=1;x<a.GetWidth();x++)for(const z of [7,9,18])clear(x,z);
  for(let x=1;x<50;x++)for(let slot=1;slot<=6;slot++)a.Set(x,15+slot,2,0);
  reset();runtime.SetTimeScale(0);return {layout:runtime.GetMainRunningLayout().GetName(),width:a.GetWidth(),pidWitness:true};
 }
 if(request.op==='generate')return request.items.map(item=>{
  reset();const origin=item.origin;
  let bag,before,attempts=0;
  do{for(let id=1;id<=12;id++)clear(id,7);call('获得物品',true,origin,item.quality,1,item.tier,95+30*(item.quality-1),1,false,0,'特定装备',false,false);bag=find(7,origin);before=read(bag,7);if(++attempts>512)throw Error('Native quality rejection sampling exhausted');}while(before[5]!==item.quality);
  const spirit=call('合成灵物编号',item.templateId);
  if(!spirit)throw Error('Native recipe spirit missing '+item.templateId);
  call('获得灵物',true,spirit,item.points||3,1,false,0,0,0,0,0,0,false);
  const spiritRow=find(18,spirit),material=read(spiritRow,18);
  setGlobal(551767285314451,bag);setGlobal(990563423582099,spiritRow);setGlobal(158219813858328,7);
  call('套装合成',item.templateId);
  const after=read(bag,7);if(after[1]!==item.templateId)throw Error('Native conversion did not occur '+item.templateId);
  return {templateId:item.templateId,quality:item.quality,origin,spirit,attempts,before,material,after};
 });
 if(request.op==='matrix')return request.items.map(item=>{
  reset();const z=item.state==='backpack'?7:9,row=item.before.slice();row[7]=item.state==='equipped'?1:0;put(1,z,row);
  if(item.state==='equipped')a.Set(1,15+item.slot,2,1);
  const loaded=read(1,z);let targetId=1;
  if(z===7){call('装备库存入',1,true,0,7);targetId=find(9,row[1]);}
  const moved=read(targetId,9),beforeEffects=request.attributes.map(id=>[id,single(moved,id)]);
  const after=item.after.slice();after[7]=row[7];put(targetId,9,after);
  const effects=request.attributes.map(id=>[id,single(read(targetId,9),id)]);
  // Compare a native upgrade from the low endpoint to the high endpoint for both edit directions.
  const low=Math.min(item.from,item.to),high=Math.max(item.from,item.to);a.Set(targetId,6,9,low);
  const copper=a.At(1,2,0),souls=a.At(3,2,0);for(let l=low;l<high;l++)call('升级装备',targetId,0);
  const upgraded=read(targetId,9),cost=copper-a.At(1,2,0),soulCost=souls-a.At(3,2,0);
  return {id:item.id,loaded,moved,after,upgraded,beforeEffects,effects,cost,soulCost,targetId};
 });
 if(request.op==='effects')return request.items.map(item=>{
  reset();item.records.forEach((row,i)=>{put(i+1,9,row);a.Set(1,15+item.slots[i],2,i+1);});
  const values=request.attributes.map(id=>[id,call('装备属性计算',1,id,0,0,0,0,0,0,0)]);
  const summary=[call('套装数量检测',item.records[0][1],1,0,0,0,0,0,0,0,0,0),call('套装数量检测',item.records[0][1],1,0,0,0,0,0,0,0,0,9),call('相同套装数',item.records[0][1],1,0,0)];
  return {id:item.id,values,summary,records:item.records.map((_,i)=>read(i+1,9)),refs:refs()};
 });
 if(request.op==='costs')return request.items.map(item=>{reset();put(1,9,item.record);a.Set(1,2,0,item.copper);a.Set(3,2,0,item.souls);call(item.maximum?'升级最大装备':'升级装备',1,0,0,true);return {id:item.id,record:read(1,9),copper:a.At(1,2,0),souls:a.At(3,2,0)};});
 if(request.op==='put'){reset();put(1,request.plane,request.record);if(request.record[7])a.Set(1,15+request.slot,2,1);return read(1,request.plane);}
 if(request.op==='observe')return {records:request.locations.map(v=>({...v,record:read(v.id,v.plane)})),refs:refs()};
 if(request.op==='cycle'){
  const initial=read(1,request.plane),steps=[];let bag=1,z9=1;
  if(request.plane===9){if(initial[7]){call('卸下装备',request.slot,1,1,false,false,7);}else call('装备库取出',1,true,0,7);bag=find(7,initial[1]);steps.push({phase:'takeout',id:bag,plane:7,record:read(bag,7),refs:refs()});}
  call('穿戴装备',request.slot,bag,1,false,false,7);z9=a.At(1,15+request.slot,2);steps.push({phase:'equip',id:z9,plane:9,record:read(z9,9),refs:refs()});
  call('刷新单角色全属性',1,true,0);
  call('卸下装备',request.slot,z9,1,false,false,7);bag=find(7,initial[1]);steps.push({phase:'unequip',id:bag,plane:7,record:read(bag,7),refs:refs()});
  return {initial,steps,locations:[{id:bag,plane:7},{id:z9,plane:9}]};
 }
 throw Error('Unknown native set request '+request.op);
}
module.exports={nativeDriver,prefix:nativeDriver.toString()};
