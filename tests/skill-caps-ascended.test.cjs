'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setup:baseSetup}=require('./helpers/batch-fixture.cjs');
// Character 2: Q1, raw 30/30/30, talents 1–3 Lv1 and caps 28/20/10×7 like tests/random-character-skill-caps.test.cjs, ascended
// twice like tests/aptitude-ascended.test.cjs (z17 rows 400/401). 渡劫结束 leaves every witness cell alone, so only the record
// check differs from v2.8.
const coefficient=(q,k)=>Math.round(100*(Math.pow(1.2,k-1)*(0.4+((k+q)-2)*0.2)))/100;
const caps=[28,20,10,10,10,10,10,10,10];
function setup({flag=true,rounds=[[3,400],[5,401]],patch=()=>{}}={}){
 const f=baseSetup(450,3),inner=f.k.catalogs.items.filter(i=>i.kind==='内丹');
 for(const [y,v]of [[10,30],[11,30],[12,30],[49,1]])f.a[2][y][2]=v;
 caps.forEach((v,i)=>{f.a[2][22+i][2]=v;});
 for(let i=0;i<3;i++){f.a[2][1+i][12]=i+1;f.a[2][21+i][12]=1;}
 f.a[2][31][2]=5;f.a[2][40][2]=120;
 f.a[2][50][2]=rounds.length;
 rounds.forEach(([q,row],i)=>{
  const k=i+1,r=f.a[row];f.a[2][2*k-1][16]=q;f.a[2][2*k][16]=row;
  r[0][17]=row;r[1][17]=inner[i].id;r[3][17]=1;r[5][17]=q;r[6][17]=1;r[7][17]=2;r[8][17]=100;
  [107,108,109].forEach((v,j)=>{r[9+j][17]=v;r[15+j][17]=coefficient(q,k);});
 });
 patch(f.a,f.k);
 f.C.KNOWLEDGE.verification.randomCharacterSkillCaps=true;
 f.C.KNOWLEDGE.verification.randomCharacterSkillCapsAscended=flag;
 return {...f,m:f.reparse(),raw:f.rawWith()};
}
const preview=(C,m,v)=>C.previewCharacterSkillCaps(m,{characterId:2,caps:v});
const apply=(C,m,v)=>C.setCharacterSkillCaps(m,{characterId:2,caps:v},{preview:preview(C,m,v)});

test('flag off keeps ascended characters closed and plain characters unchanged',()=>{
 const {C,m}=setup({flag:false});
 assert.match(C.randomCharacterSkillCapsInfo(m,{characterId:2}).reasons.join(),/無結丹/);
 const plain=setup({flag:false,rounds:[]}),info=plain.C.randomCharacterSkillCapsInfo(plain.m,{characterId:2});
 assert.equal(info.eligible,true,info.reasons.join());assert.equal(info.ascensions,undefined);
});

test('an ascended character raises and lowers caps under the same witness, restore group and undo',()=>{
 const {C,m,raw,rawWith}=setup(),info=C.randomCharacterSkillCapsInfo(m,{characterId:2});
 assert.equal(info.eligible,true,info.reasons.join());assert.equal(info.ascensions,2);assert.ok(info.witnesses.length);
 const target=[38,27,14,4,10,10,10,10,10],p=preview(C,m,target);
 assert.equal(p.canApply,true,p.reasons.join());assert.equal(JSON.stringify(p.changes.map(c=>[c.id,c.before,c.after])),"[[1,28,38],[2,20,27],[3,10,14],[4,10,4]]");
 apply(C,m,target);
 assert.equal(C.serialize(m),rawWith([[2,22,2,38],[2,23,2,27],[2,24,2,14],[2,25,2,4]]));
 for(const d of m.changes.values())assert.equal(d.group,'skill-growth:2');
 // Ascension cells stay untouched and the record still reads the same.
 assert.equal(C.get(m,{x:2,y:50,z:2}),2);assert.equal(C.randomCharacterSkillCapsInfo(m,{characterId:2}).ascensions,2);
 C.undo(m);assert.equal(C.serialize(m),raw);
 apply(C,m,target);C.restore(m,{x:2,y:25,z:2});assert.equal(C.serialize(m),raw);
});

test('witness, level and remainder rules still block for ascended characters',()=>{
 const {C,m}=setup();
 assert.match(preview(C,m,Array(9).fill(20)).reasons.join(),/共同生成見證/);
 assert.match(preview(C,m,[4,20,10,10,10,10,10,10,10]).reasons.join(),/不得低於目前等級 5/);
 assert.match(preview(C,m,[5,20,10,10,10,10,10,10,10]).reasons.join(),/餘額 120/);
 const atLevel=setup({patch:a=>{a[2][24][2]=10;a[2][33][2]=6;a[2][42][2]=30;}});
 assert.match(preview(atLevel.C,atLevel.m,[28,20,6,10,10,10,10,10,10]).reasons.join(),/餘額 30/);
});

test('inconsistent ascension records, named templates and prisoners stay read only',()=>{
 const cases=[
  [a=>{a[2][50][2]=1;},/結丹次數以外/],
  [a=>{a[2][50][2]=9;},/0–8/],
  [a=>{a[2][1][16]=10;},/結丹品質/],
  [a=>{a[2][4][16]=400;},/列號/],
  [a=>{a[400][7][17]=1;},/owner/],
  [a=>{a[401][15][17]=1.69;},/係數/],
  [a=>{a[2][2][2]=3;},/範本 0/],
  [a=>{a[2][55][2]=1;},/在監/],
 ];
 for(const [patch,message]of cases){
  const {C,m}=setup({patch});
  assert.match(C.randomCharacterSkillCapsInfo(m,{characterId:2}).reasons.join(),message,String(patch));
  assert.equal(preview(C,m,[38,20,10,10,10,10,10,10,10]).canApply,false);
 }
});

test('worn items do not matter, and a stored inner pill left by native rebirth is ignored',()=>{
 const wear=(a,k,x,kind,slot)=>{const item=k.catalogs.items.find(i=>i.kind===kind&&i.slot===slot);a[x][0][9]=x;a[x][1][9]=item.id;a[x][3][9]=k.batch2Data.items[item.id].tier;a[x][5][9]=1;a[x][6][9]=1;a[x][7][9]=2;a[2][15+slot][2]=x;a[x][9][9]=105;};
 const worn=setup({patch:(a,k)=>{wear(a,k,300,'宝物',6);wear(a,k,301,'内丹',5);}});
 assert.equal(worn.C.randomCharacterSkillCapsInfo(worn.m,{characterId:2}).eligible,true);
 const residue=(a,k)=>{const r=a[402];r[0][17]=2;r[1][17]=k.catalogs.items.filter(i=>i.kind==='内丹')[5].id;r[7][17]=2;[107,108,109].forEach((v,j)=>{r[9+j][17]=v;r[15+j][17]=1.68;});};
 for(const flag of [true,false]){
  const {C,m}=setup({flag,rounds:[],patch:residue}),info=C.randomCharacterSkillCapsInfo(m,{characterId:2});
  assert.equal(info.eligible,true,info.reasons.join());assert.equal(info.ascensions,flag?0:undefined);
 }
});

test('custom coordinates cannot bypass the entry, and the closed base flag still stops the write',()=>{
 const {C,m}=setup();
 for(const c of [{x:2,y:22,z:2},{x:2,y:50,z:2},{x:2,y:2,z:16}]){assert.throws(()=>C.set(m,c,30),/唯讀/);assert.throws(()=>C.setField(m,c,30),/唯讀/);}
 const target=[38,20,10,10,10,10,10,10,10],p=preview(C,m,target);
 C.KNOWLEDGE.verification.randomCharacterSkillCaps=false;
 assert.throws(()=>C.setCharacterSkillCaps(m,{characterId:2,caps:target},{preview:p}),/驗證|預覽/);
 assert.equal(m.changes.size,0);
});

test('the flag belongs to the skill-cap family and opens only with its smoke record',()=>{
 const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),S=require('../scripts/verification-suite.cjs');
 assert.equal(S.familyOf('randomCharacterSkillCapsAscended'),'randomCharacterSkillCaps');
 assert.equal(Object.hasOwn(k.verification,'randomCharacterSkillCapsAscended'),true);
 if(k.verification.randomCharacterSkillCapsAscended){
  const r=proof.lightweight.randomCharacterSkillCapsAscended;
  assert.equal(proof.groups.randomCharacterSkillCapsAscended,true);assert.equal(r.passed,true);assert.equal(r.gameVersion,k.gameVersion);
 }
});
