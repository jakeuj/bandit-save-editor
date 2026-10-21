#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),args=process.argv.slice(2),out=args[args.indexOf('--output')+1];
if(!args.includes('--output'))throw Error('Usage: node scripts/prepare-quality-cases.cjs --output EXISTING_EXTERNAL_DIR');
const dir=fs.realpathSync(out),rel=path.relative(root,dir);if(!rel||(!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep)))throw Error('External artifacts required');
const k=JSON.parse(fs.readFileSync(path.join(root,'knowledge/catalog.json'))),ctx={};for(const g in k.verification)k.verification[g]=true;vm.runInNewContext(fs.readFileSync(path.join(root,'src/core.js'),'utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
const templates=Object.keys(k.equipmentQuality.items).map(Number),record=(template,q,edge)=>{const r=Array(60).fill(0);r[0]=1;r[1]=template;r[2]=1;r[3]=k.equipmentQuality.items[template].tier;r[5]=q;r[6]=1;r[8]=80+30*(q-1)+(edge?30:0);r[22]=edge;r[23]=edge?6:1;r[24]=edge;for(let s=1;s<q;s++){r[8+s]=k.batch2Data.items[template].affixIds[s-1];r[14+s]=edge?60+10*q:10*(q-1);}return r;};
const baseData=()=>{const data=Array.from({length:2501},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';data[1][0][2]=1;data[1][1][2]='驗證甲';return data;};
for(const plane of [7,9])for(const direction of ['Upgrade','Downgrade']){
 const data=baseData(),model=C.parse(JSON.stringify({c2array:true,size:[2501,60,22],data})),items=[],baseline=[],operations=[],observe=[];
 // Clear only the disposable baseline. All target references start unowned.
 for(let x=1;x<2501;x++){for(const z of [7,9])for(let y=0;y<60;y++)baseline.push([x,y,z,0]);if(x<50)for(let y=16;y<=21;y++)baseline.push([x,y,2,0]);}
 baseline.push([3,2,0,100000000]);
 const add=(template,from,to,edge,selected=0,duplicate=false)=>{const id=items.length+1,r=record(template,from,edge);r[0]=400; r[6]=edge?Math.min(10+5*(from-1),10+5*(to-1)):1;if(selected)r[27+selected]=1;if(duplicate&&from>=3)r[10]=r[9];
  r.forEach((v,y)=>{model.original.data[id][y][plane]=v;baseline.push([id,y,plane,v]);observe.push([id,y,plane]);});
  const pool=k.batch2Data.items[template].affixIds.filter(a=>!r.slice(9,9+Math.min(from-1,to-1)).includes(a)),options={itemId:id,plane,quality:to,confirmRemovedAffixes:true,addedAffixes:Array.from({length:Math.max(0,to-from)},(_,n)=>({slot:from+n,attributeId:pool[n],coefficient:edge?60+10*to:10*(to-1)}))};
  const preview=C.previewEquipmentQualityChange(model,options);C.setEquipmentQuality(model,options);model.changes.clear();model.history.length=0;
  items.push({id,options,before:r,preview,equipSlot:k.catalogs.items.find(t=>t.id===template).slot});operations.push({method:'setEquipmentQuality',options});
 };
 for(let from=1;from<=6;from++)for(let to=1;to<=6;to++)if(direction==='Upgrade'?to>from:to<from)for(const poolType of ['战斗','生产','通用'])for(const tier of [1,9])for(const edge of [0,1]){const template=templates.find(id=>k.equipmentQuality.items[id].tier===tier&&k.equipmentQuality.items[id].poolType===poolType);add(template,from,to,edge);}
 const template=templates.find(id=>k.equipmentQuality.items[id].tier===1&&k.equipmentQuality.items[id].poolType==='战斗');
 for(let from=2;from<=6;from++)for(let to=1;to<=6;to++)if(direction==='Upgrade'?to>from:to<from)for(let slot=1;slot<Math.min(from,to);slot++)add(template,from,to,slot%2,slot,from>=3);
 const file=path.join(dir,`quality-${plane}-${direction}.json`);fs.writeFileSync(file,JSON.stringify({baseline,operations,observe,items}));console.log(path.basename(file)+': '+items.length+' cases');
}
