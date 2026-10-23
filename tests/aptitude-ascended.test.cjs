'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup:baseSetup}=require('./helpers/batch-fixture.cjs');
// Character 2: Q1, raw 31/31/31, talents 1 (力量 104, c5) Lv2, 4 and 12 Lv1, so 力量 A = 3.1+2×5/10 = 4.1. Ascended twice like
// tests/pill-ascended.test.cjs: z17 rows 400/401 carry 0.8 and 1.68, M = 1.5+(0+0.8+1.68) = 3.98.
const coefficient=(q,k)=>Math.round(100*(Math.pow(1.2,k-1)*(0.4+((k+q)-2)*0.2)))/100;
const M=1.5+(0+0.8+1.68),cap=a=>Math.round(100*(a*M))/100;
function setup({flags=true,rounds=[[3,400],[5,401]],bonus=[120,0,0],patch=()=>{}}={}){
 const f=baseSetup(450,3),inner=f.k.catalogs.items.filter(i=>i.kind==='内丹');
 for(const [y,v]of [[10,31],[11,31],[12,31],[49,1],[13,bonus[0]],[14,bonus[1]],[15,bonus[2]]])f.a[2][y][2]=v;
 [[1,1,2],[2,4,1],[3,12,1]].forEach(([slot,id,level])=>{f.a[2][slot][12]=id;f.a[2][20+slot][12]=level;});
 f.a[2][50][2]=rounds.length;
 rounds.forEach(([q,row],i)=>{
  const k=i+1,r=f.a[row];f.a[2][2*k-1][16]=q;f.a[2][2*k][16]=row;
  r[0][17]=row;r[1][17]=inner[i].id;r[3][17]=1;r[5][17]=q;r[6][17]=1;r[7][17]=2;r[8][17]=100;
  [107,108,109].forEach((v,j)=>{r[9+j][17]=v;r[15+j][17]=coefficient(q,k);});
 });
 patch(f.a,f.k);
 for(const g of ['randomCharacterTalents','randomCharacterBaseAptitudes','pillAptitudeBonus','pillAptitudeBonusDecimal','pillAptitudeBonusAscended'])f.C.KNOWLEDGE.verification[g]=true;
 for(const g of ['randomCharacterBaseAptitudesAscended','randomCharacterTalentsAscended'])f.C.KNOWLEDGE.verification[g]=flags;
 return {...f,inner,m:f.reparse(),raw:f.rawWith()};
}
const wear=(a,k,x,kind,slot,owner=2)=>{const item=k.catalogs.items.find(i=>i.kind===kind&&i.slot===slot);a[x][0][9]=x;a[x][1][9]=item.id;a[x][3][9]=k.batch2Data.items[item.id].tier;a[x][5][9]=1;a[x][6][9]=1;a[x][7][9]=owner;if(owner)a[owner][15+slot][2]=x;return item;};
const talents=(C,m,levels)=>C.setCharacterTalents(m,{characterId:2,levels},{preview:C.previewCharacterTalents(m,{characterId:2,levels})});

test('flags off keep both entries closed for ascended characters and the 1.5 cap for the rest',()=>{
 const {C,m}=setup({flags:false});
 assert.match(C.randomCharacterGrowthInfo(m,{characterId:2}).reasons.join(),/無結丹/);
 assert.match(C.randomCharacterTalentsInfo(m,{characterId:2}).reasons.join(),/無結丹/);
 const plain=setup({flags:false,rounds:[],bonus:[0,0,0]}),info=plain.C.randomCharacterGrowthInfo(plain.m,{characterId:2});
 assert.equal(info.eligible,true);assert.equal(info.aptitudes[0].cap,Math.round(100*4.1*1.5)/100);assert.equal(info.ascensions,0);
 assert.equal(plain.C.randomCharacterTalentsInfo(plain.m,{characterId:2}).ascensions,undefined);
});

test('base aptitudes of an ascended character use the ascension multiplier; a bonus above the new cap blocks',()=>{
 const {C,m,raw,rawWith}=setup(),info=C.randomCharacterGrowthInfo(m,{characterId:2});
 assert.equal(info.eligible,true,info.reasons.join());assert.equal(info.ascensions,2);assert.equal(info.multiplier,M);
 // B 120 would already exceed the 1.5 cap of 6.15; with M it sits under 16.32.
 assert.deepEqual([...info.aptitudes].map(a=>a.cap),[cap(4.1),cap(3.1),cap(3.1)]);assert.equal(info.aptitudes[0].cap,16.32);assert.equal(info.aptitudes[0].total,16.1);
 const lower=C.previewCharacterBaseAptitudes(m,{characterId:2,baseRaw:[30,31,31]});
 assert.equal(lower.canApply,false);assert.match(lower.reasons.join(),/16 超過上限 15\.92/);
 const o={characterId:2,baseRaw:[32,31,31]},p=C.previewCharacterBaseAptitudes(m,o);
 assert.ok(p.combination);assert.equal(p.canApply,true,p.reasons.join());assert.equal(p.aptitudes[0].after.cap,cap(4.2));assert.equal(p.aptitudes[0].before.cap,16.32);
 C.setCharacterBaseAptitudes(m,o);assert.equal(C.serialize(m),rawWith([[2,10,2,32]]));
 C.undo(m);assert.equal(C.serialize(m),raw);
});

test('talent levels of an ascended character move the cap with the multiplier and share the aptitude restore group',()=>{
 const {C,m,raw,high}=setup({bonus:[100,0,0]}),info=C.randomCharacterTalentsInfo(m,{characterId:2});
 assert.equal(info.eligible,true,info.reasons.join());assert.equal(info.ascensions,2);assert.equal(info.multiplier,M);
 const p=C.previewCharacterTalents(m,{characterId:2,levels:[1,1,1]});
 assert.equal(p.canApply,true,p.reasons.join());
 assert.deepEqual([...p.aptitudes].map(a=>[a.aptitude,a.before.cap,a.after.cap,a.after.total]),[[1,cap(4.1),cap(3.6),13.6]]);
 talents(C,m,[1,1,1]);assert.equal(C.get(m,{x:2,y:21,z:12}),1);
 // Restoring the base aptitude cell also restores the talent level (one aptitude:2 group).
 C.restore(m,{x:2,y:21,z:12});assert.equal(C.serialize(m),raw);
 const blocked=setup({bonus:[120,0,0]}),q=blocked.C.previewCharacterTalents(blocked.m,{characterId:2,levels:[1,1,1]});
 assert.equal(q.canApply,false);assert.match(q.reasons.join(),/15\.6 超過上限 14\.33/);
 // A non-aptitude level change on an ascended character needs no cap check.
 const other=setup(),s=other.C.previewCharacterTalents(other.m,{characterId:2,levels:[2,2,1]});assert.equal(s.canApply,true);assert.equal(s.aptitudes.length,0);
});

test('with the flags on, worn treasures, inner pills and set pieces are accepted for ascended and plain characters',()=>{
 const patch=(a,k)=>{wear(a,k,300,'宝物',6);wear(a,k,301,'内丹',5);wear(a,k,302,'套装',1);};
 for(const rounds of [[[3,400],[5,401]],[]]){
  const s=setup({rounds,bonus:rounds.length?[100,0,0]:[0,0,0],patch});
  assert.equal(s.C.randomCharacterGrowthInfo(s.m,{characterId:2}).eligible,true,String(rounds.length));
  {const p=s.C.previewCharacterTalents(s.m,{characterId:2,levels:[1,1,1]});assert.equal(p.canApply,true,p.reasons.join());}
 }
 const off=setup({flags:false,rounds:[],bonus:[0,0,0],patch:(a,k)=>wear(a,k,300,'宝物',6)});
 assert.equal(off.C.randomCharacterGrowthInfo(off.m,{characterId:2}).eligible,false);
 const affix=setup({patch:(a,k)=>{patch(a,k);a[300][9][9]=105;}});
 assert.match(affix.C.randomCharacterGrowthInfo(affix.m,{characterId:2}).reasons.join(),/資質加成/);
 assert.match(affix.C.previewCharacterTalents(affix.m,{characterId:2,levels:[1,1,1]}).reasons.join(),/資質加成/);
});

test('inconsistent ascension records, named templates and prisoners stay read only in both entries',()=>{
 const cases=[
  [a=>{a[2][50][2]=1;},/結丹次數以外/],
  [a=>{a[2][1][16]=10;},/結丹品質/],
  [a=>{a[2][4][16]=400;},/列號/],
  [a=>{a[400][7][17]=1;},/owner/],
  [a=>{a[401][15][17]=1.69;},/係數/],
  [a=>{a[2][2][2]=3;},/範本 0/],
  [a=>{a[2][55][2]=1;},/在監/],
 ];
 for(const [patch,message]of cases){
  const {C,m}=setup({patch});
  assert.match(C.randomCharacterGrowthInfo(m,{characterId:2}).reasons.join(),message,String(patch));
  assert.match(C.randomCharacterTalentsInfo(m,{characterId:2}).reasons.join(),message,String(patch));
  assert.throws(()=>C.setCharacterBaseAptitudes(m,{characterId:2,baseRaw:[32,31,31]}),message);
 }
});

test('a stored inner pill left by native rebirth does not raise the multiplier or block the entries',()=>{
 const residue=(a,k)=>{const r=a[402];r[0][17]=2;r[1][17]=k.catalogs.items.filter(i=>i.kind==='内丹')[5].id;r[7][17]=2;[107,108,109].forEach((v,j)=>{r[9+j][17]=v;r[15+j][17]=1.68;});};
 const {C,m}=setup({rounds:[],bonus:[0,0,0],patch:residue}),info=C.randomCharacterGrowthInfo(m,{characterId:2});
 assert.equal(info.eligible,true);assert.equal(info.multiplier,1.5);assert.equal(info.aptitudes[0].cap,Math.round(100*(4.1*1.5))/100);
 assert.equal(C.randomCharacterTalentsInfo(m,{characterId:2}).eligible,true);
});

test('custom coordinates cannot bypass the entries, and closed base flags still stop the write',()=>{
 const {C,m}=setup();
 for(const c of [{x:2,y:10,z:2},{x:2,y:21,z:12},{x:2,y:50,z:2},{x:400,y:15,z:17}]){assert.throws(()=>C.set(m,c,1),/唯讀/);assert.throws(()=>C.setField(m,c,1),/唯讀/);}
 C.KNOWLEDGE.verification.randomCharacterBaseAptitudes=false;assert.throws(()=>C.setCharacterBaseAptitudes(m,{characterId:2,baseRaw:[32,31,31]}),/驗證/);
 C.KNOWLEDGE.verification.randomCharacterTalents=false;assert.equal(C.previewCharacterTalents(m,{characterId:2,levels:[1,1,1]}).canApply,false);
 assert.equal(m.changes.size,0);
});

test('both flags belong to their families and are not open before the smoke record exists',()=>{
 const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),S=require('../scripts/verification-suite.cjs');
 assert.equal(S.familyOf('randomCharacterBaseAptitudesAscended'),'randomCharacterGrowth');
 assert.equal(S.familyOf('randomCharacterTalentsAscended'),'randomCharacterTalents');
 for(const g of ['randomCharacterBaseAptitudesAscended','randomCharacterTalentsAscended']){
  assert.equal(Object.hasOwn(k.verification,g),true);
  if(k.verification[g]){assert.equal(proof.groups[g],true);assert.equal(proof.lightweight[g].passed,true);assert.equal(proof.lightweight[g].gameVersion,k.gameVersion);}
 }
});
