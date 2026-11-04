'use strict';

const prefix = `const r=self.__banditValidationRuntime,a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();const call=(name,...args)=>{const f=r.GetEventSheetManager().GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};const record=(id,z)=>Array.from({length:50},(_,y)=>a.At(id,y,z));const global=name=>{const v=r.GetEventSheetManager().GetAllGlobalVariables().find(v=>v.GetName()===name);if(!v)throw Error('Missing global '+name);return v;};`;

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Select a map facility of the given template inside a building, the way the facility page selects its tile.
const selectFacility = (template, building) => `const start=global('主地图编号起始').GetValue();const sprite=r.GetObjectClassByName('地图建筑').GetInstances().find(i=>{const x=i.GetInstanceVariableValue(4),y=i.GetInstanceVariableValue(5),f=a.At(x-start+150,y-start,6);return f>0&&a.At(f,0,21)===f&&a.At(f,1,21)===${template}&&a.At(f,2,21)===${building};});if(!sprite)throw Error('No idle facility ${template} in building ${building}');const X=sprite.GetInstanceVariableValue(4),Y=sprite.GetInstanceVariableValue(5),f=a.At(X-start+150,Y-start,6);if(a.At(f,3,21)!==0)throw Error('Facility ${template} is busy');global('选中地块X').SetValue(X);global('选中地块Y').SetValue(Y);`;

module.exports = {prefix, pause, selectFacility};
