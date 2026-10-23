'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup:baseSetup}=require('./helpers/batch-fixture.cjs');
// Character 2: raw 31/31/31 (Q1), ascended twice. 渡劫结束 stores the inner pills in z17 rows 400/401 with y9–11 = 107–109
// and y15–17 = 结丹资质提升系数(q,k): q3 k1 → 0.8, q5 k2 → round(100×1.2×1.4)/100 = 1.68, so M = 1.5+0.8+1.68 = 3.98.
const coefficient=(q,k)=>Math.round(100*(Math.pow(1.2,k-1)*(0.4+((k+q)-2)*0.2)))/100;
function setup({ascended=true,rounds=[[3,400],[5,401]],patch=()=>{}}={}){
 const f=baseSetup(450,3),inner=f.k.catalogs.items.filter(i=>i.kind==='内丹');
 for(const [y,v]of [[10,31],[11,31],[12,31],[49,1]])f.a[2][y][2]=v;
 f.a[2][50][2]=rounds.length;
 rounds.forEach(([q,row],i)=>{
  const k=i+1,r=f.a[row];f.a[2][2*k-1][16]=q;f.a[2][2*k][16]=row;
  r[0][17]=row;r[1][17]=inner[i].id;r[3][17]=1;r[5][17]=q;r[6][17]=1;r[7][17]=2;r[8][17]=100;
  [107,108,109].forEach((v,j)=>{r[9+j][17]=v;r[15+j][17]=coefficient(q,k);});
 });
 const high=[1,2,3].map(a=>Number(Object.keys(f.k.batch2Data.pills).find(id=>f.k.batch2Data.pills[id].aptitude===a&&f.k.batch2Data.pills[id].cap>=40)));
 high.forEach(id=>f.a[id][6][0]=10);
 patch(f.a,f.k);
 for(const g of ['randomCharacterTalents','randomCharacterBaseAptitudes','pillAptitudeBonus','pillAptitudeBonusDecimal'])f.C.KNOWLEDGE.verification[g]=true;
 f.C.KNOWLEDGE.verification.pillAptitudeBonusAscended=ascended;
 return {...f,inner,high,m:f.reparse(),raw:f.rawWith()};
}
const B=(x,aptitude)=>({x,y:12+aptitude,z:2});
const wear=(a,k,x,kind,slot,owner=2)=>{const item=k.catalogs.items.find(i=>i.kind===kind&&i.slot===slot);a[x][0][9]=x;a[x][1][9]=item.id;a[x][3][9]=k.batch2Data.items[item.id].tier;a[x][5][9]=1;a[x][6][9]=1;a[x][7][9]=owner;if(owner)a[owner][15+slot][2]=x;return item;};

test('flag off keeps ascended characters read only and the 1.5 cap unchanged',()=>{
 const {C,m,high}=setup({ascended:false});
 assert.throws(()=>C.pillInfo(m,2,1,high[0]),/無結丹/);
 const plain=setup({ascended:false,rounds:[]});
 assert.equal(plain.C.pillInfo(plain.m,2,1,plain.high[0]).cap,4.65);assert.equal(plain.C.pillInfo(plain.m,2,1,plain.high[0]).multiplier,1.5);
});

test('two ascensions add both stored coefficients to the cap multiplier; the endpoint is accepted and the next step is not',()=>{
 const {C,m,high,raw,rawWith}=setup();
 for(let aptitude=1;aptitude<=3;aptitude++){
  const o={characterId:2,aptitude,pillId:high[aptitude-1]},info=C.pillInfo(m,2,aptitude,o.pillId);
  // 角色资质上限倍率 sums from 0 in k order and adds 1.5 last: 3.98, whereas 1.5+0.8+1.68 is 3.9799999999999995.
  assert.equal(info.ascensions,2);assert.equal(info.multiplier,1.5+(0+0.8+1.68));assert.notEqual(info.multiplier,1.5+0.8+1.68);
  assert.equal(info.cap,Math.round(100*(3.1*info.multiplier))/100);assert.equal(info.cap,12.34);assert.equal(info.max,92.4);
  for(const bonus of [92.5,93])assert.throws(()=>C.setPillAptitudeBonus(m,{...o,bonus}),/0–92\.4/);
  C.setPillAptitudeBonus(m,{...o,bonus:92.4});assert.equal(C.pillInfo(m,2,aptitude,o.pillId).total,12.34);
 }
 assert.equal(C.serialize(m),rawWith([[2,13,2,92.4],[2,14,2,92.4],[2,15,2,92.4]]));
 C.undo(m);assert.equal(C.get(m,B(2,3)),0);
 C.restore(m,B(2,1));assert.equal(m.changes.size,0);assert.equal(C.serialize(m),raw);
});

test('a single ascension and a non-ascended character use the same entry',()=>{
 const one=setup({rounds:[[9,400]]}),info=one.C.pillInfo(one.m,2,1,one.high[0]);
 assert.equal(info.multiplier,1.5+2);assert.equal(info.cap,10.85);assert.equal(info.max,77.5);
 const none=setup({rounds:[]}),plain=none.C.pillInfo(none.m,2,1,none.high[0]);
 assert.equal(plain.ascensions,0);assert.equal(plain.cap,4.65);assert.equal(plain.max,15.5);
});

test('a stored inner pill left behind by native rebirth is ignored, like 角色资质上限倍率 ignores it',()=>{
 const residue=(a,k)=>{const r=a[402];r[0][17]=2;r[1][17]=k.catalogs.items.filter(i=>i.kind==='内丹')[5].id;r[7][17]=2;[107,108,109].forEach((v,j)=>{r[9+j][17]=v;r[15+j][17]=1.68;});};
 const after=setup({rounds:[],patch:residue});assert.equal(after.C.pillInfo(after.m,2,1,after.high[0]).multiplier,1.5);
 const again=setup({patch:residue});assert.equal(again.C.pillInfo(again.m,2,1,again.high[0]).multiplier,3.98);
});

test('inconsistent ascension records are rejected',()=>{
 const cases=[
  [a=>{a[2][50][2]=9;},/0–8/],
  [a=>{a[2][50][2]=1.5;},/0–8/],
  [a=>{a[2][50][2]=1;},/結丹次數以外/],
  [a=>{a[2][50][2]=3;},/結丹品質/],
  [a=>{a[2][1][16]=10;},/結丹品質/],
  [a=>{a[2][2][16]=0;},/列號/],
  [a=>{a[2][2][16]=450;},/列號/],
  [a=>{a[2][4][16]=400;},/列號/],
  [(a,k)=>{a[401][1][17]=a[400][1][17];},/範本/],
  [(a,k)=>{a[400][1][17]=k.catalogs.items.find(i=>i.kind==='宝物').id;},/範本/],
  [a=>{a[400][7][17]=1;},/owner/],
  [a=>{a[400][9][17]=0;},/係數/],
  [a=>{a[401][15][17]=1.69;},/係數/],
  [a=>{a[401][17][17]=0;},/係數/],
 ];
 for(const [patch,message]of cases){const {C,m,high}=setup({patch});assert.throws(()=>C.pillInfo(m,2,1,high[0]),message,String(patch));}
 const {C,m,high,inner}=setup(),rules=C.KNOWLEDGE.batch2Data.items[inner[0].id],main=rules.mainAttributes;
 rules.mainAttributes=[104,0,0];try{assert.throws(()=>C.pillInfo(m,2,1,high[0]),/資質加成/);}finally{rules.mainAttributes=main;}
});

test('worn treasures, inner pills and set pieces are accepted while none of them carries an aptitude',()=>{
 const patch=(a,k)=>{wear(a,k,300,'宝物',6);wear(a,k,301,'内丹',5);wear(a,k,302,'套装',1);};
 const off=setup({ascended:false,rounds:[],patch:(a,k)=>wear(a,k,300,'宝物',6)});assert.throws(()=>off.C.pillInfo(off.m,2,1,off.high[0]),/不符|一般裝備/);
 const {C,m,high}=setup({patch});assert.equal(C.pillInfo(m,2,1,high[0]).cap,12.34);
 const cases=[
  [a=>{a[300][9][9]=105;},/資質加成/],
  [a=>{a[302][14][9]=106;},/資質加成/],
  [a=>{a[301][7][9]=1;},/部位不符/],
  [a=>{a[2][16][2]=300;},/部位不符/],
  [a=>{a[2][21][2]=0;},/未穿戴/],
  [a=>{a[2][21][2]=450;},/越界/],
 ];
 for(const [extra,message]of cases){const s=setup({patch:(a,k)=>{patch(a,k);extra(a);}});assert.throws(()=>s.C.pillInfo(s.m,2,1,s.high[0]),message,String(extra));}
 const s=setup({patch}),set=s.C.KNOWLEDGE.setEquipmentLevel.sets[s.C.KNOWLEDGE.batch2Data.items[s.C.get(s.m,{x:302,y:1,z:9})].setLink],effects=set.effects;
 set.effects=[...effects,{pieces:2,attributeId:104,coefficient:1}];try{assert.throws(()=>s.C.pillInfo(s.m,2,1,s.high[0]),/資質加成/);}finally{set.effects=effects;}
});

test('without their own v2.17 flags, base aptitudes and talents stay closed for ascended characters; custom coordinates cannot bypass',()=>{
 const {C,m,high}=setup();
 for(const g of ['randomCharacterBaseAptitudesAscended','randomCharacterTalentsAscended'])C.KNOWLEDGE.verification[g]=false;
 assert.match(C.randomCharacterTalentsInfo(m,{characterId:2}).reasons.join(),/無結丹/);
 assert.equal(C.randomCharacterGrowthInfo(m,{characterId:2}).eligible,false);
 assert.match(C.randomCharacterGrowthInfo(m,{characterId:2}).reasons.join(),/無結丹/);
 for(const c of [B(2,1),{x:2,y:50,z:2},{x:2,y:1,z:16},{x:400,y:15,z:17}]){assert.throws(()=>C.set(m,c,1),/唯讀/);assert.throws(()=>C.setField(m,c,1),/唯讀/);}
 assert.throws(()=>C.setPillAptitudeBonus(m,{characterId:2,aptitude:1,pillId:high[0],bonus:1,advanced:true}),/超限/);
 C.KNOWLEDGE.verification.pillAptitudeBonus=false;assert.throws(()=>C.setPillAptitudeBonus(m,{characterId:2,aptitude:1,pillId:high[0],bonus:1}),/驗證/);
 assert.equal(m.changes.size,0);
});

test('native ascend preparation and ascended rebirth send compilable page code and check each native result',async()=>{
 const gamePath=require.resolve('../scripts/verify-game.cjs'),lifecyclePath=require.resolve('../scripts/verify-native-lifecycle.cjs');
 const real=require(gamePath),answers=[],sent=[];
 const fake={...real,waitMain:async()=>{},evaluate:async(state,expression)=>{new Function('return '+expression);sent.push(expression);return answers.shift()(expression);}};
 delete require.cache[lifecyclePath];require.cache[gamePath]={...require.cache[gamePath],exports:fake};
 try{
  const {ascend,pillsAndRebirth}=require(lifecyclePath),zero=Array(50).fill(0);
  const stored=(t,q,k)=>Array.from({length:50},(_,y)=>y===1?t:y===7?8:y>=9&&y<=11?98+y:y>=15&&y<=17?coefficient(q,k):0);
  const round=(t,q,k,row)=>answers.push(()=>40+k,()=>true,()=>({slot:5,id:60+k,record:Array.from({length:50},(_,y)=>y===1?t:y===7?8:0)}),()=>true,()=>({count:k,quality:q,row,stored:stored(t,q,k),slot:0,source:zero}));
  const scenario={ascend:{character:8,rounds:[{template:52,quality:3},{template:53,quality:5}],treasure:575},pillCharacter:8,pills:[{aptitude:1,pillId:64}]};
  const run=multiplier=>{round(52,3,1,400);round(53,5,2,401);answers.push(()=>45,()=>true,()=>({slot:6,id:70,record:Array.from({length:50},(_,y)=>y===1?575:y===7?8:0)}),()=>({multiplier,caps:[1,1,1],totals:[1,1,1]}));};
  const state={cells:[]};run(1.5+(0+0.8+1.68));const result=await ascend(state,scenario);
  assert.equal(result.rounds.length,2);assert.ok(sent.some(e=>e.includes("v('渡劫结丹品质').SetValue(5)")&&e.includes("call('渡劫结束',false)")));
  assert.ok(state.cells.some(([x,y,z])=>x===401&&y===15&&z===17)&&state.cells.some(([x,y,z])=>x===8&&y===50&&z===2));
  run(1.5+0.8+1.68);await assert.rejects(ascend({cells:[]},scenario),/Native cap multiplier/);
  answers.length=0;round(52,3,1,400);answers[4]=()=>({count:1,quality:3,row:400,stored:stored(52,3,2),slot:0,source:zero});
  await assert.rejects(ascend({cells:[]},{ascend:{character:8,rounds:[{template:52,quality:3}]}}),/deepStrictEqual|Expected/);
  answers.length=0;sent.length=0;
  answers.push(()=>[{aptitude:1,pillId:64,count:[5,4],bonus:[10,12]}],()=>true,()=>[0,0,0],()=>({count:0,record:Array(16).fill(0),owned:[]}));
  const after=await pillsAndRebirth({cells:[]},scenario);assert.equal(after.cleared.count,0);assert.ok(sent[0].includes("call('服用普通丹药',pillId,8,1)")&&sent[1].includes("call('角色重生',8,0,0)"));
  answers.push(()=>[{aptitude:1,pillId:64,count:[5,4],bonus:[10,12]}],()=>true,()=>[0,0,0],()=>({count:0,record:Array(16).fill(0),owned:[401]}));
  assert.deepEqual((await pillsAndRebirth({cells:[]},scenario)).cleared.owned,[401]);
  answers.push(()=>[{aptitude:1,pillId:64,count:[5,4],bonus:[10,12]}],()=>true,()=>[0,0,0],()=>({count:0,record:[3,...Array(15).fill(0)],owned:[]}));
  await assert.rejects(pillsAndRebirth({cells:[]},scenario),/kept z16/);
 }finally{require.cache[gamePath].exports=real;delete require.cache[lifecyclePath];}
});

test('the shipped flag has a lightweight smoke record and stays out of the composite migration proof',()=>{
 const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),P=require('../scripts/migration-proof.cjs');
 assert.equal(k.verification.pillAptitudeBonusAscended,true);assert.equal(proof.groups.pillAptitudeBonusAscended,true);
 const rec=proof.lightweight.pillAptitudeBonusAscended;assert.equal(rec.passed,true);assert.equal(rec.gameVersion,k.gameVersion);
 assert.equal(P.composite(proof,'pillAptitudeBonusAscended'),false);
});
