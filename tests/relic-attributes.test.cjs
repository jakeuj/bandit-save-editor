const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Backpack relic attributes: z18 y5–9 and the y10 mean change together, only to vectors 获得灵物 can roll.
function setup(gates={},row={}){
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json'));for(const group of Object.keys(k.verification))k.verification[group]=true;Object.assign(k.verification,gates);
 const ctx={setTimeout};vm.runInNewContext(fs.readFileSync('src/core.js','utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(k)),ctx);const C=ctx.SaveCore;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';
 // A natural V1.0.11.2 roll: 妖狐靈火, level 2, quality 1.
 const values={0:1,1:1,2:2,3:1,4:1,5:1.2,6:1.6,7:0.4,8:1.6,9:0.9,10:1.1,...row};for(const [y,v]of Object.entries(values))data[1][y][18]=v;
 data[3][0][18]=3;data[3][1][18]=3;data[3][2][18]=4;data[3][3][18]=1;data[3][4][18]=3;data[3][5][18]=1.9;data[3][6][18]=4.3;data[3][7][18]=1.7;data[3][8][18]=2.8;data[3][9][18]=3.8;data[3][10][18]=2.9;data[3][13][18]=1;
 const text='﻿'+JSON.stringify({c2array:true,size:[221,60,22],data}).replace('{','{\r\n"large":987654321098765432109876543210,');return {C,k,m:C.parse(text),text};
}
const row=(C,m,x=1)=>Array.from({length:14},(_,y)=>C.get(m,{x,y,z:18}));
// The game's own generation (expressions 4692, 2850–2856) with injected randomness.
function roll(bases,L,Q,rand){
 const R=(80+30*(Q-1))+rand()*30,G=Math.round(((10*5)*(1+(L*0.2)))*(R/100))/10,c=bases.map(b=>b*(0.6+rand()*0.4)),D=((((c[0]+c[1])+c[2])+c[3])+c[4]);
 const a=c.map(v=>Math.round((10*G)*(v/D))/10);return {a,mean:Math.round(10*(((((a[0]+a[1])+a[2])+a[3])+a[4])/5))/10};
}
test('catalog carries the five lw bases for every relic template and the gate defaults closed',()=>{
 const k=JSON.parse(fs.readFileSync('knowledge/catalog.json'));
 assert.equal(k.catalogs.relics.length,33);for(const r of k.catalogs.relics){assert.equal(r.bases.length,5);assert.ok(r.bases.every(b=>Number.isFinite(b)&&b>0));}
 assert.deepEqual(k.catalogs.relics[0].bases,[55,95,30,75,45]);
 assert.equal(typeof k.verification.relicAttributes,'boolean');
 assert.match(fs.readFileSync('scripts/extract-game.cjs','utf8'),/relicAttributes:false/);
});
test('closed gate previews but refuses to write',()=>{
 const {C,m,text}=setup({relicAttributes:false}),info=C.relicAttributesInfo(m,{itemId:1});
 assert.equal(info.verified,false);assert.equal(C.previewRelicAttributes(m,{itemId:1,values:info.proportional}).verified,false);
 assert.throws(()=>C.setRelicAttributes(m,{itemId:1,values:info.proportional}),/尚未完成/);assert.equal(C.serialize(m),text);
});
test('info reads the row, natural total range and presets',()=>{
 const {C,m}=setup(),info=C.relicAttributesInfo(m,{itemId:1});
 assert.deepEqual([info.name,info.level,info.quality,info.total.min,info.total.max,info.natural],['妖狐靈火',2,1,5.6,7.7,true]);
 assert.deepEqual([...info.values],[1.2,1.6,0.4,1.6,0.9]);assert.deepEqual([...info.elements],['金','木','水','火','土']);
 assert.deepEqual([...C.listRelics(m).map(r=>r.id)],[1,3]);
 for(const v of [info.proportional,...info.focused])C.previewRelicAttributes(m,{itemId:1,values:v});
 for(const [i,r]of info.ranges.entries()){assert.ok(r.min<=info.values[i]&&info.values[i]<=r.max);assert.equal(info.focused[i][i],r.max);}
 assert.equal(setup({},{9:1.0,10:1.1}).C.relicAttributesInfo(setup({},{9:1.0,10:1.1}).m,{itemId:1}).natural,false,'one element off');
 const s=setup({},{10:1.2});assert.equal(s.C.relicAttributesInfo(s.m,{itemId:1}).natural,false,'inconsistent mean');
});
test('every simulated native roll is accepted and every witness reproduces it with the game expressions',()=>{
 const {C,k}=setup();let seed=7;const rand=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
 const data=Array.from({length:221},()=>Array.from({length:60},()=>Array(22).fill(0)));data[0][0][1]='szmnqea';
 for(let n=0;n<400;n++){
  const r=k.catalogs.relics[n%33],Q=1+n%6,L=n%13,{a,mean}=roll(r.bases,L,Q,rand);
  [1,r.id,L,1,Q,...a,mean,0,0,0].forEach((v,y)=>data[1][y][18]=v);
  const m=C.parse(JSON.stringify({c2array:true,size:[221,60,22],data})),info=C.relicAttributesInfo(m,{itemId:1});
  assert.equal(info.natural,true,JSON.stringify({r:r.id,Q,L,a}));
  const p=C.previewRelicAttributes(m,{itemId:1,values:info.focused[n%5]}),w=p.witness;
  assert.ok(w.ratios.every(x=>x>=0.6&&x<1));assert.ok(info.totals.includes(w.total));
  const c=w.ratios.map((x,i)=>r.bases[i]*x),D=((((c[0]+c[1])+c[2])+c[3])+c[4]);
  assert.deepEqual([...c.map(v=>Math.round((10*w.total)*(v/D))/10)],[...p.after]);assert.equal(p.average.after,Math.round(10*(((((p.after[0]+p.after[1])+p.after[2])+p.after[3])+p.after[4])/5))/10);
 }
});
test('rejects vectors outside the joint generation and malformed input without writing',()=>{
 const {C,m,text}=setup();
 // Equal elements break the 木/水 base ratio (95/30 at least 1.9 before rounding) even though the sum fits.
 for(const values of [[1.3,1.3,1.3,1.3,1.3],[0,0,0,0,0],[9,9,9,9,9],[1.4,2.4,0.8,1.9,1.2].map((v,i)=>i===2?3:v),[1.2,1.6,0.4,1.6],[1.2,1.6,0.4,1.6,0.95],[1.2,1.6,-0.4,1.6,0.9],[1.2,'1.6',0.4,1.6,0.9],[1.2,1.6,0.4,1.6,NaN]])assert.throws(()=>C.setRelicAttributes(m,{itemId:1,values}));
 for(const itemId of [0,2,221,1.5])assert.throws(()=>C.relicAttributesInfo(m,{itemId}));
 assert.equal(C.serialize(m),text);
});
test('rows outside the checked shape stay read-only',()=>{
 for(const [y,v,pattern]of [[12,4,/擺放建築/],[0,0,/列號/],[0,'1',/列號/],[1,99,/基底/],[4,7,/品質或等級/],[2,1.5,/品質或等級/],[7,'x',/有效數值/],[10,null,/有效數值/]]){
  const {C,m,text}=setup({},{[y]:v});assert.throws(()=>C.relicAttributesInfo(m,{itemId:1}),pattern);assert.equal(C.serialize(m),text);
 }
});
test('writes the five elements and the mean together, keeps other fields and raw tokens, and undoes as one step',()=>{
 const {C,m,text}=setup(),info=C.relicAttributesInfo(m,{itemId:1}),before=row(C,m);
 const p=C.setRelicAttributes(m,{itemId:1,values:info.focused[1]});
 assert.deepEqual(row(C,m).slice(5,11),[...info.focused[1],p.average.after]);assert.deepEqual(row(C,m).filter((_,y)=>y<5||y>10),before.filter((_,y)=>y<5||y>10));
 assert.ok([...m.changes.values()].every(c=>c.z===18&&c.x===1&&c.y>=5&&c.y<=10&&c.group==='relic:1'));
 const out=C.serialize(m);assert.ok(out.startsWith('﻿{\r\n"large":987654321098765432109876543210,'));
 const src=JSON.parse(text.replace(/^﻿/,'')),got=JSON.parse(out.replace(/^﻿/,''));for(let y=5;y<=10;y++)src.data[1][y][18]=row(C,m)[y];assert.deepEqual(got,src);
 assert.equal(C.relicAttributesInfo(C.parse(out),{itemId:1}).natural,true,'the exported row reads back as a natural roll');
 C.undo(m);assert.equal(C.serialize(m),text);
 C.setRelicAttributes(m,{itemId:1,values:info.proportional});C.setRelicAttributes(m,{itemId:3,values:C.relicAttributesInfo(m,{itemId:3}).proportional});
 C.restore(m,{x:1,y:6,z:18});assert.ok([...m.changes.values()].every(c=>c.x===3),'restore drops the whole relic group');C.restoreAll(m);assert.equal(C.serialize(m),text);
});
test('re-entering the current values is a no-op, partial edits only touch changed cells',()=>{
 const {C,m,text}=setup();
 const same=C.setRelicAttributes(m,{itemId:1,values:[1.2,1.6,0.4,1.6,0.9]});assert.equal(same.unchanged,true);assert.equal(m.changes.size,0);assert.equal(m.history.length,0);assert.equal(C.serialize(m),text);
 const p=C.setRelicAttributes(m,{itemId:1,values:[1.2,1.7,0.4,1.6,0.9]});assert.deepEqual([...p.changes.map(c=>c.coordinate.y)],[6,10]);assert.equal(p.average.after,1.2);
 const q=C.setRelicAttributes(m,{itemId:1,values:[1.2,1.8,0.4,1.6,0.9]});assert.deepEqual([...q.changes.map(c=>c.coordinate.y)],[6]);assert.equal(q.average.after,1.2);
});
test('a relic natively returned to another row keeps its stale y0 and stays editable',()=>{
 const {C,m,text}=setup({},{0:6});assert.deepEqual([...C.listRelics(m).map(r=>r.id)],[1,3]);
 const p=C.setRelicAttributes(m,{itemId:1,values:C.relicAttributesInfo(m,{itemId:1}).proportional});assert.equal(C.get(m,{x:1,y:0,z:18}),6);assert.ok(p.changes.every(c=>c.coordinate.y>=5));
 const empty=setup({},{1:0});assert.throws(()=>empty.C.relicAttributesInfo(empty.m,{itemId:1}),/沒有背包靈物/);C.undo(m);assert.equal(C.serialize(m),text);
});
test('custom coordinates and direct field writes cannot bypass the named operation',()=>{
 const {C,m,text}=setup();
 for(let y=0;y<=13;y++){assert.equal(C.resolveField(m,{x:1,y,z:18}).editable,false);assert.throws(()=>C.set(m,{x:1,y,z:18},2),/唯讀/);}
 assert.equal(C.serialize(m),text);
});
test('the shipped flag has a lightweight smoke record and stays out of the composite migration proof',()=>{
 const k=require('../knowledge/catalog.json'),proof=require('../knowledge/verification.json'),P=require('../scripts/migration-proof.cjs');
 assert.equal(k.verification.relicAttributes,true);assert.equal(proof.groups.relicAttributes,true);
 const rec=proof.lightweight.relicAttributes;assert.equal(rec.passed,true);assert.equal(rec.gameVersion,k.gameVersion);
 assert.equal(P.composite(proof,'relicAttributes'),false);
});
