'use strict';
// Executed only in the instrumented, disposable worker. Original game functions remain unmodified.
// Plan-level driver: argument orders come from the reviewed function headers; first execution happens in task 6/9.
function nativeDriver(request){
 const runtime=self.__banditValidationRuntime,manager=runtime.GetEventSheetManager();
 const table=n=>runtime.GetObjectClassByName(n).GetInstances()[0].GetSdkInstance(),a=table('save');
 const call=(name,...args)=>{const f=manager.GetFunctionBlockByName(name);if(!f)throw Error('Missing native function '+name);const b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};
 const read=(id,z)=>Array.from({length:60},(_,y)=>a.At(id,y,z));
 const put=(id,z,row)=>row.forEach((value,y)=>a.Set(id,y,z,value));
 const clear=(id,z)=>put(id,z,Array(60).fill(0));
 const refs=()=>Array.from({length:6},(_,i)=>a.At(1,16+i,2));
 const reset=souls=>{for(let id=1;id<=12;id++)for(const z of [7,9,18])clear(id,z);for(let slot=1;slot<=6;slot++)a.Set(1,15+slot,2,0);a.Set(3,2,0,souls??1e12);};
 const find=(z,tpl)=>{for(let x=1;x<a.GetWidth();x++)if(a.At(x,1,z)===tpl&&a.At(x,0,z)>0)return x;throw Error('Native generated treasure missing '+tpl+' / '+z);};
 if(request.op==='initialize'){
  for(let x=1;x<a.GetWidth();x++)for(const z of [7,9,18])clear(x,z);
  for(let x=1;x<50;x++)for(let slot=1;slot<=6;slot++)a.Set(x,15+slot,2,0);
  reset();runtime.SetTimeScale(0);return {layout:runtime.GetMainRunningLayout().GetName(),width:a.GetWidth(),pidWitness:true};
 }
 // 获得物品(检测,物品编号,物品品质,物品等级,物品等阶,特定主属性,获得数量,背包满判断,次数,...,'特定装备'): native generation at an explicit level.
 if(request.op==='generate')return request.items.map(item=>{
  reset();let bag,before,attempts=0;
  do{clear(1,7);call('获得物品',true,item.templateId,item.quality,item.level||1,item.tier,95+30*(item.quality-1),1,false,0,'特定装备',false,false);bag=find(7,item.templateId);before=read(bag,7);if(++attempts>512)throw Error('Native quality rejection sampling exhausted');}while(before[5]!==item.quality);
  return {templateId:item.templateId,quality:item.quality,level:item.level||1,attempts,record:before};
 });
 // 升级装备(物品序号,角色序号) acts on z9 and pays souls; z7 rows are first moved by 装备库存入.
 if(request.op==='level')return request.items.map(item=>{
  reset(item.souls);const z=item.state==='backpack'?7:9;put(1,z,item.before);
  let id=1;if(z===7){call('装备库存入',1,true,0);id=find(9,item.before[1]);}
  if(item.state==='equipped'){const row=read(id,9);row[7]=1;put(id,9,row);a.Set(1,21,2,id);}
  const moved=read(id,9),souls0=a.At(3,2,0);
  for(let l=item.from;l<item.to;l++)call('升级装备',id,0);
  const upgraded=read(id,9);
  return {id:item.id,targetId:id,moved,upgraded,soulCost:souls0-a.At(3,2,0),refs:refs()};
 });
 if(request.op==='costs')return request.items.map(item=>{reset(item.souls);put(1,9,item.record);call(item.maximum?'升级最大装备':'升级装备',1,0,0,true);return {id:item.id,record:read(1,9),souls:a.At(3,2,0)};});
 // 分解宝物(物品序号,提示,自动出售): adds souls through 获得魂魄, then clears the z7 row.
 if(request.op==='decompose')return request.items.map(item=>{
  reset(item.souls);item.rows.forEach((row,i)=>put(i+1,7,row));
  if(item.mode==='single')call('分解宝物',1,false,false);else call('宝物批量分解',item.quality,0,0);
  return {id:item.id,rows:item.rows.map((_,i)=>read(i+1,7)),souls:a.At(3,2,0)};
 });
 if(request.op==='effects')return request.items.map(item=>{
  reset();put(1,9,item.record);a.Set(1,21,2,1);
  return {id:item.id,values:request.attributes.map(id=>[id,call('装备属性计算',1,id,0,0,0,0,0,0,0)]),record:read(1,9)};
 });
 // 装备主属性(等级,等阶,属性,系数,设置,'主属性',0,品质): the per-item main attribute, isolated from character totals.
 if(request.op==='single')return request.items.map(item=>({id:item.id,value:call('装备主属性',item.level,item.tier,item.attribute,item.coefficient,item.setting,'主属性',0,item.quality)}));
 if(request.op==='observe')return {records:request.locations.map(v=>({...v,record:read(v.id,v.plane)})),refs:refs()};
 throw Error('Unknown native treasure request '+request.op);
}
module.exports={nativeDriver,prefix:nativeDriver.toString()};
