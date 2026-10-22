'use strict';
const fs=require('node:fs'),vm=require('node:vm');
const {performance}=require('node:perf_hooks');
function setup(nx=450,count=2){
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json','utf8')),ctx={setTimeout,performance};
 vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);
 const C=ctx.SaveCore,a=Array.from({length:nx},()=>Array.from({length:60},()=>Array(22).fill(0)));
 a[0][0][1]='szmnqea';a[1][1][0]='測試山寨';
 for(let x=1;x<=count;x++){
  a[x][0][2]=x;a[x][1][2]='測試'+x;a[x][3][2]=1;a[x][1][4]=1;
  for(let id=1;id<=9;id++){a[x][21+id][2]=50;a[x][30+id][2]=1;}
 }
 a[1][5][0]=5;a[4][0][1]=4;a[4][1][1]=5;a[4][5][1]=1;
 for(let id=31;id<=44;id++)a[id][4][0]=1;
 const item=k.catalogs.items.find(i=>i.kind==='普通'&&i.category==='裝備'&&i.slot<=4);
 function equipment(x,z=9,owner=0){
  const r=a[x];r[0][z]=x;r[1][z]=item.id;r[2][z]=1;r[3][z]=k.batch2Data.items[item.id].tier;r[5][z]=1;r[6][z]=1;r[7][z]=owner;
  if(owner)a[owner][15+item.slot][2]=x;
 }
 equipment(3);equipment(5);equipment(6,7);
 // The independent expected renderer uses fixture coordinates, not SaveCore.serialize or its change map.
 const token=(x,y,z)=>` ${JSON.stringify(a[x][y][z])} `;
 function rawWith(patches=[]){const replace=new Map(patches.map(([x,y,z,v])=>[`${x},${y},${z}`,v]));return '\ufeff{ "unrelated":987654321098765432109876543210,"exponent":1e+03,\n"c2array":true,"size":['+nx+',60,22],"data":['+a.map((row,x)=>'['+row.map((cell,y)=>'['+cell.map((v,z)=>replace.has(`${x},${y},${z}`)?' '+JSON.stringify(replace.get(`${x},${y},${z}`))+' ':token(x,y,z)).join(',')+']').join(',')+']').join(',')+']}\n';}
 const raw=rawWith(),m=C.parse(raw);
 return {C,m,k,a,equipment,raw,rawWith,reparse:()=>C.parse(rawWith())};
}
module.exports={setup};
