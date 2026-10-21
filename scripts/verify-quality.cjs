#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {evaluate,waitMain}=require('./verify-game.cjs'),args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1],state=JSON.parse(fs.readFileSync(opt('--state'))),scenario=JSON.parse(fs.readFileSync(opt('--scenario')));
const root=path.resolve(__dirname,'..'),rel=path.relative(root,state.dir),child=path.relative(state.dir,state.game);
if(!rel||(!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep))||!child||path.isAbsolute(child)||child.startsWith('..'))throw Error('External disposable state required');
const ids=Object.keys(JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'))).equipmentQuality.attributes).map(Number);
if(args.includes('--formulas')){
 const vm=require('node:vm'),k=JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'))),ctx={};vm.runInNewContext(fs.readFileSync(path.join(root,'src/core.js'),'utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';const m=C.parse(JSON.stringify({c2array:true,size:[221,60,22],data}));scenario.items=[];
 for(const [template,t]of Object.entries(k.equipmentQuality.items))for(let q=1;q<=6;q++)for(const edge of [0,1])for(const level of [1,10+5*(q-1)]){
  const v=Array(60).fill(0);v[0]=1;v[1]=Number(template);v[2]=1;v[3]=t.tier;v[5]=q;v[6]=level;v[8]=80+30*(q-1)+(edge?30:0);for(let slot=1;slot<q;slot++){v[8+slot]=k.batch2Data.items[template].affixIds[slot-1];v[14+slot]=edge?60+10*q:10*(q-1);}v.forEach((value,y)=>m.original.data[1][y][7]=value);
  const options={itemId:1,plane:7,quality:q},preview=C.previewEquipmentQualityChange(m,options);scenario.items.push({id:scenario.items.length+1,options,before:v,preview,formulaOnly:true});
 }
 for(const attributeId of Object.keys(k.affixReplacement.attributes).map(Number))for(const tier of [1,9])for(let q=2;q<=6;q++)for(const edge of [0,1]){
  const template=Object.keys(k.equipmentQuality.items).map(Number).find(id=>k.equipmentQuality.items[id].tier===tier&&k.batch2Data.items[id].affixIds.includes(attributeId)),pool=k.batch2Data.items[template].affixIds.filter(id=>id!==attributeId),v=Array(60).fill(0);v[0]=1;v[1]=template;v[2]=1;v[3]=tier;v[5]=q;v[6]=3;v[8]=95+30*(q-1);
  for(let slot=1;slot<q;slot++){v[8+slot]=slot===1?attributeId:pool[slot-2];v[14+slot]=((edge?(60+10*q)*100-1:10*(q-1)*100+1))/100;}v.forEach((value,y)=>m.original.data[1][y][7]=value);
  const options={itemId:1,plane:7,quality:q},preview=C.previewEquipmentQualityChange(m,options);scenario.items.push({id:scenario.items.length+1,options,before:v,preview,formulaOnly:true});
 }
}
(async()=>{await waitMain(state);const results=[];
 // Small chunks keep native worker responses bounded, without changing target records.
 for(let offset=0;offset<scenario.items.length;offset+=20){const items=scenario.items.slice(offset,offset+20);const got=await evaluate(state,`(()=>{const r=self.__banditValidationRuntime,a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance(),wp=r.GetObjectClassByName('wp').GetInstances()[0].GetSdkInstance();const call=(name,...args)=>{const f=r.GetEventSheetManager().GetFunctionBlockByName(name),b=f.GetEventBlock();return b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),...args);};const total=(v,id)=>{let n=0;for(let s=0;s<3;s++)if(wp.At(v[1],8+s,0)===id)n+=call('装备主属性',v[6],v[3],id,v[8],wp.At(v[1],11+s,0),'主属性',0,v[5]);for(let s=1;s<=6;s++)if(v[8+s]===id)n+=call('装备主属性',v[6],v[3],id,v[14+s],100,'副词条',0,v[5]);return n;};return ${JSON.stringify(items)}.map(item=>{const v=item.formulaOnly?item.before:Array.from({length:60},(_,y)=>a.At(item.id,y,item.options.plane));return {id:item.id,plane:item.options.plane,record:v,cap:call('装备等级上限',v[5]),slots:call('装备词条数量',v[5]),effects:${JSON.stringify(ids)}.map(id=>({id,before:total(item.before,id),after:total(v,id)}))};});})()`);results.push(...got);}
 for(const item of scenario.items){const got=results.find(v=>v.id===item.id&&v.plane===item.options.plane),expected=item.before.slice();for(const c of item.preview.changes)expected[c.coordinate.y]=c.after;assert.deepEqual(got.record,expected);assert.equal(got.cap,item.preview.normalMax);assert.equal(got.slots,item.options.quality-1);for(const e of got.effects){const p=item.preview.effects.find(v=>v.attributeId===e.id);assert.ok(Number.isFinite(e.before)&&Number.isFinite(e.after));assert.ok(Math.abs(e.before-p.before)<1e-8&&Math.abs(e.after-p.after)<1e-8,'Native formula mismatch '+JSON.stringify({item:item.id,e,p}));}}
 const file=path.join(state.dir,args.includes('--formulas')?'quality-formulas.json':'quality-effects.json');if(args.includes('--compare'))assert.deepEqual(results,JSON.parse(fs.readFileSync(file)));else fs.writeFileSync(file,JSON.stringify(results));console.log('PASS '+results.length+' quality records, 54 native effects, caps and slots'+(args.includes('--compare')?' after restart':''));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
