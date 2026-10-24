'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {setup:baseSetup}=require('./helpers/batch-fixture.cjs');
// Ascension quality: z16[c,2k−1]=q and the k-th stored pill's z17 y15–17 = 结丹资质提升系数(q,k) change together; only M moves.
// Character 2 as in tests/aptitude-ascended.test.cjs: 力量 A 4.1, 敏捷／智力 3.1; rounds q3 (row 400, 0.8) and q5 (row 401,
// 1.68), M = 3.98.
const coefficient=(q,k)=>Math.round(100*(Math.pow(1.2,k-1)*(0.4+((k+q)-2)*0.2)))/100;
const cap=(a,M)=>Math.round(100*(a*M))/100;
function setup({gate=true,rounds=[[3,400],[5,401]],bonus=[0,0,0],patch=()=>{}}={}){
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
 f.C.KNOWLEDGE.verification.ascensionQuality=gate;
 return {...f,inner,m:f.reparse(),raw:f.rawWith()};
}
const quality=(C,m,round,q)=>C.setAscensionQuality(m,{characterId:2,round,quality:q});

test('gate defaults closed in the extractor and is registered in the batch2 family',()=>{
 const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),S=require('../scripts/verification-suite.cjs');
 assert.equal(typeof k.verification.ascensionQuality,'boolean');
 assert.match(fs.readFileSync('scripts/extract-game.cjs','utf8'),/ascensionQuality:false/);
 assert.equal(S.familyOf('ascensionQuality'),'batch2');
 if(k.verification.ascensionQuality){assert.equal(proof.groups.ascensionQuality,true);assert.equal(proof.lightweight.ascensionQuality.passed,true);assert.equal(proof.lightweight.ascensionQuality.gameVersion,k.gameVersion);}
});

test('closed gate previews but refuses to write',()=>{
 const {C,m,raw}=setup({gate:false}),p=C.previewAscensionQuality(m,{characterId:2,round:1,quality:9});
 assert.equal(p.verified,false);assert.equal(p.canApply,false);assert.equal(p.changes.length,4);assert.equal(p.reasons.length,0);
 assert.throws(()=>quality(C,m,1,9),/尚未完成/);assert.equal(C.serialize(m),raw);
});

test('info lists each ascension with its pill, coefficient, M and the three caps',()=>{
 const {C,m,inner}=setup(),info=C.ascensionQualityInfo(m,{characterId:2});
 assert.equal(info.eligible,true,info.reasons.join());assert.equal(info.ascensions,2);assert.equal(info.multiplier,3.98);
 assert.deepEqual([...info.records].map(r=>[r.round,r.quality,r.row,r.coefficient,r.name]),[[1,3,400,0.8,inner[0].name],[2,5,401,1.68,inner[1].name]]);
 assert.deepEqual([...info.aptitudes].map(a=>[a.total,a.cap]),[[4.1,cap(4.1,3.98)],[3.1,cap(3.1,3.98)],[3.1,cap(3.1,3.98)]]);
});

test('raising rewrites quality and the three coefficients; the other entries follow the new M; undo restores',()=>{
 const {C,m,raw,rawWith}=setup(),p=C.previewAscensionQuality(m,{characterId:2,round:1,quality:9});
 assert.equal(p.canApply,true,p.reasons.join());assert.equal(p.coefficient,2);assert.equal(p.nextMultiplier,5.18);
 assert.deepEqual([...p.aptitudes].map(a=>[a.before.cap,a.after.cap]),[[cap(4.1,3.98),cap(4.1,5.18)],[cap(3.1,3.98),cap(3.1,5.18)],[cap(3.1,3.98),cap(3.1,5.18)]]);
 quality(C,m,1,9);
 assert.equal(C.serialize(m),rawWith([[2,1,16,9],[400,15,17,2],[400,16,17,2],[400,17,17,2]]));
 assert.equal(C.ascensionQualityInfo(m,{characterId:2}).multiplier,5.18);
 C.KNOWLEDGE.verification.randomCharacterBaseAptitudesAscended=true;assert.equal(C.randomCharacterGrowthInfo(m,{characterId:2}).multiplier,5.18);
 C.undo(m);assert.equal(C.serialize(m),raw);
});

test('second round uses its own k; summation order matches the native multiplier',()=>{
 const {C,m,rawWith}=setup(),p=C.previewAscensionQuality(m,{characterId:2,round:2,quality:9});
 // 1.2×(0.4+9×0.2)=2.64; 1.5+(0+0.8+2.64).
 assert.equal(p.coefficient,2.64);assert.equal(p.nextMultiplier,1.5+(0+0.8+2.64));
 quality(C,m,2,9);assert.equal(C.serialize(m),rawWith([[2,3,16,9],[401,15,17,2.64],[401,16,17,2.64],[401,17,17,2.64]]));
});

test('lowering is blocked while a current total exceeds the new cap, and allowed otherwise',()=>{
 const blocked=setup({bonus:[120,0,0]}),p=blocked.C.previewAscensionQuality(blocked.m,{characterId:2,round:2,quality:1});
 // q1 at k=2: 1.2×0.6=0.72, M=3.02, 力量 cap 12.38 < 16.1.
 assert.equal(p.canApply,false);assert.match(p.reasons.join(),/力量目前總資質 16\.1 超過新上限 12\.38/);
 assert.throws(()=>quality(blocked.C,blocked.m,2,1),/超過新上限/);assert.equal(blocked.C.serialize(blocked.m),blocked.raw);
 const ok=setup({bonus:[80,0,0]}),q=ok.C.previewAscensionQuality(ok.m,{characterId:2,round:2,quality:1});
 assert.equal(q.canApply,true,q.reasons.join());assert.equal(q.aptitudes[0].after.cap,12.38);assert.equal(q.aptitudes[0].before.total,12.1);
 quality(ok.C,ok.m,2,1);assert.equal(ok.C.serialize(ok.m),ok.rawWith([[2,3,16,1],[401,15,17,0.72],[401,16,17,0.72],[401,17,17,0.72]]));
});

test('same quality is a no-op and malformed input is rejected',()=>{
 const {C,m}=setup(),same=C.previewAscensionQuality(m,{characterId:2,round:1,quality:3});
 assert.equal(same.unchanged,true);assert.equal(same.canApply,false);assert.equal(same.changes.length,0);
 for(const o of [{round:0,quality:5},{round:3,quality:5},{round:1.5,quality:5},{round:1,quality:0},{round:1,quality:10},{round:1,quality:4.5},{round:1,quality:'5'}])
  assert.equal(C.previewAscensionQuality(m,{characterId:2,...o}).canApply,false,JSON.stringify(o));
 assert.match(C.previewAscensionQuality(m,{characterId:2,round:1,quality:5,coefficient:9}).reasons.join(),/只接受/);
 assert.equal(m.changes.size,0);
});

test('characters without an ascension, named, imprisoned or with an inconsistent record are refused',()=>{
 const reason=o=>{const {C,m}=setup(o);return C.ascensionQualityInfo(m,{characterId:2}).reasons.join();};
 assert.match(reason({rounds:[]}),/尚未結丹/);
 assert.match(reason({patch:a=>{a[2][2][2]=1;}}),/範本 0/);
 assert.match(reason({patch:a=>{a[2][55][2]=1;}}),/非在監/);
 assert.match(reason({patch:a=>{a[400][16][17]=0.9;}}),/結丹係數不符/);
 assert.match(reason({patch:a=>{a[400][7][17]=3;}}),/owner/);
 assert.match(reason({patch:a=>{a[2][5][16]=7;}}),/結丹次數以外/);
 assert.match(reason({bonus:[200,0,0]}),/超過角色資質上限/);
 const {C,m}=setup();assert.equal(C.ascensionQualityInfo(m,{characterId:99}).eligible,false);
});

test('restore shares the aptitude group with pills; custom coordinates cannot bypass the entry',()=>{
 const pillId=k=>Number(Object.keys(k.batch2Data.pills).find(id=>k.batch2Data.pills[id].aptitude===1));
 const {C,m,raw}=setup({patch:(a,k)=>{a[pillId(k)][6][0]=1;}});
 // Restoring one coefficient cell restores the whole aptitude:2 group, the later pill edit included.
 quality(C,m,1,9);C.setPillAptitudeBonus(m,{characterId:2,aptitude:1,pillId:pillId(C.KNOWLEDGE),bonus:50});
 assert.equal(m.changes.get('400,15,17').group,'aptitude:2');
 C.restore(m,{x:400,y:15,z:17});assert.equal(C.serialize(m),raw);
 for(const c of [{x:2,y:1,z:16},{x:2,y:2,z:16},{x:400,y:15,z:17},{x:400,y:6,z:17},{x:400,y:1,z:17}]){assert.throws(()=>C.set(m,c,9),/唯讀/);assert.throws(()=>C.setField(m,c,9),/唯讀/);}
 assert.equal(m.changes.size,0);
});
