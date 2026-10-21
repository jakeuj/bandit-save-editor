const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function core(){const ctx={};vm.runInNewContext(source.match(/<script id="save-core">([\s\S]*?)<\/script>/)[1],ctx);for(const k of Object.keys(ctx.SaveCore.KNOWLEDGE.verification))ctx.SaveCore.KNOWLEDGE.verification[k]=true;return ctx.SaveCore;}
function fixture(nx=221){
 const data=Array.from({length:nx},()=>Array.from({length:60},()=>Array(22).fill(0)));
 const put=(x,y,z,v)=>data[x][y][z]=v;
 put(0,0,1,'szmnqea');put(1,1,0,'測試山寨');put(1,0,2,1);put(1,1,2,'測試甲');put(1,3,2,1);put(1,6,2,1);put(1,1,4,1);put(1,5,0,5);put(2,2,0,12345);put(1,56,2,789);
 for(let k=1;k<=9;k++){put(1,30+k,2,1);put(1,21+k,2,50);}
 return '\ufeff'+JSON.stringify({c2array:true,size:[nx,60,22],data}).replace('{','{"unrelated":987654321098765432109876543210,\n');
}
test('catalog includes 22 planes, 724 functions, 843 write sites and localized names',()=>{
 const C=core(),K=C.KNOWLEDGE;
 assert.equal(K.planes.length,22);assert.equal(K.functions.length,724);assert.equal(K.evidence.length,843);
 assert.equal(K.catalogs.professions.find(v=>v.id===2).name,'嘍囉');
 assert.equal(C.SKILLS.length,9);assert.equal(C.SKILLS[7],'研究');
});
test('profession graph covers all six tiers without cycles, missing parents or disconnected branches',()=>{
 const K=core().KNOWLEDGE,rows=K.catalogs.professions,byId=new Map(rows.map(r=>[r.id,r]));
 assert.equal(rows.length,47);assert.deepEqual(Array.from(rows.filter(r=>!r.prerequisites.length),r=>r.id),[1]);
 assert.deepEqual(Array.from({length:6},(_,i)=>rows.filter(r=>r.tier===i+1).length),[1,2,4,8,16,16]);
 for(const r of rows){
  assert.ok([1,2,3,4].includes(r.family));
  const seen=new Set();let p=r;
  while(p.prerequisites.length){
   assert.ok(!seen.has(p.id));seen.add(p.id);assert.equal(p.prerequisites.length,1);
   const parent=byId.get(p.prerequisites[0]);assert.ok(parent);assert.equal(parent.tier,p.tier-1);p=parent;
  }
  assert.equal(p.id,1);
 }
 for(const [id,parent] of [[3,1],[10,5],[17,8],[28,14],[32,16],[47,31]])assert.equal(byId.get(id).prerequisites[0],parent);
 const guide=K.professionGuide;
 assert.ok(K.functions.some(f=>f.sid===guide.rules.conditionSid));assert.ok(K.functions.some(f=>f.sid===guide.rules.levelSid));
 assert.equal(guide.rules.initialRequiredLevel,5);assert.equal(guide.rules.otherRequiredLevel,10);
 assert.equal(Object.keys(guide.workSkills).length,31);
 for(const [id,skills] of Object.entries(guide.workSkills)){assert.ok(byId.get(Number(id)).tier<=5);for(const k of skills)assert.ok(k>=1&&k<=9);}
 assert.equal(guide.workSkills[17].length,0);assert.equal(guide.workSkills[32],undefined);
});
test('typed rename preserves raw source, escapes strings, validates UTF-16 length, and rolls back',()=>{
 const C=core(),raw=fixture(),m=C.parse(raw);
 C.transaction(m,()=>{C.setField(m,{x:1,y:1,z:0},'新寨');C.setField(m,{x:1,y:1,z:2},'甲"\\乙');},'改名');
 const output=C.serialize(m);
 assert.equal(output,raw.replace('測試山寨','新寨').replace('測試甲','甲\\"\\\\乙'));
 assert.equal(C.parse(output).original.data[1][1][2],'甲"\\乙');
 for(const name of ['', '七個文字超過長度','甲 乙','甲\n乙','😀😀😀甲'])assert.throws(()=>C.setField(m,{x:1,y:1,z:2},name));
 assert.doesNotThrow(()=>C.setField(m,{x:1,y:1,z:2},'😀😀😀'));
 C.undo(m);assert.equal(C.serialize(m),raw);
});
test('natural character experience spans levels without charging common pool or altering refund basis',()=>{
 const C=core(),m=C.parse(fixture());
 assert.equal(C.experienceNeed.character(1),1000);assert.equal(C.experienceNeed.character(2),5000);
 const result=C.addExperience(m,{kind:'character',characterId:1,amount:6500});
 assert.equal(result.level,3);assert.equal(result.experience,500);
 assert.equal(C.get(m,{x:2,y:2,z:0}),12345);assert.equal(C.get(m,{x:1,y:56,z:2}),789);
 assert.equal(m.history.length,1);assert.equal(m.changes.size,2);
 C.restore(m,{x:1,y:3,z:2});assert.equal(m.changes.size,0);C.undo(m);assert.equal(m.changes.size,2);
});
test('skill indices, caps and profession tier formula match source evidence',()=>{
 const C=core(),m=C.parse(fixture());
 assert.equal(C.experienceNeed.skill(1),10000);assert.equal(C.experienceNeed.skill(2),11000);
 assert.equal(C.experienceNeed.profession(1,1),3000);assert.equal(C.experienceNeed.profession(1,2),7250);
 const skill=C.addExperience(m,{kind:'skill',characterId:1,id:9,amount:21500});assert.equal(skill.level,3);assert.equal(skill.experience,500);
 assert.throws(()=>C.addExperience(m,{kind:'skill',characterId:1,id:10,amount:100}));
 const job=C.addExperience(m,{kind:'profession',characterId:1,id:1,amount:6500.5});assert.equal(job.level,3);assert.equal(job.experience,0);
 // An additional grant preserves a one-decimal final gain; no rounding to an integer on export.
 C.addExperience(m,{kind:'profession',characterId:1,id:1,amount:1.5});assert.equal(C.get(m,{x:1,y:1,z:5}),1.5);
 assert.equal(C.parse(C.serialize(m)).original.data[1][1][5],1.5);
 assert.equal(C.addExperience(m,{kind:'character',characterId:1,amount:1e12}).level,30);assert.equal(C.get(m,{x:1,y:4,z:2}),0);
});
test('known coordinates enforce readonly rules even through legacy set and failed batches roll back',()=>{
 const C=core(),m=C.parse(fixture());
 for(const c of [{x:1,y:3,z:2},{x:1,y:1,z:4},{x:1,y:1,z:5},{x:1,y:1,z:12}])assert.throws(()=>C.set(m,c,100));
 assert.throws(()=>C.transaction(m,()=>{C.set(m,{x:1,y:2,z:0},200);C.addExperience(m,{kind:'character',characterId:1,amount:-1});}));
 assert.equal(m.changes.size,0);assert.equal(m.history.length,0);
 C.KNOWLEDGE.verification.names=false;assert.throws(()=>C.setField(m,{x:1,y:1,z:2},'新名字'));
 C.KNOWLEDGE.verification.professionExperience=false;assert.throws(()=>C.addExperience(m,{kind:'profession',characterId:1,id:1,amount:1}));
});
test('schema mismatches, unlearned jobs and automatic transfer cannot silently change save state',()=>{
 const C=core(),raw=fixture(),m=C.parse(raw);
 m.original.data[1][1][0]=123;assert.throws(()=>C.setField(m,{x:1,y:1,z:0},'新寨'));
 assert.throws(()=>C.addExperience(m,{kind:'profession',characterId:1,id:2,amount:100}));
 m.original.data[1][59][2]=1;
 assert.throws(()=>C.addExperience(m,{kind:'profession',characterId:1,id:1,amount:100}));
 assert.equal(m.changes.size,0);assert.equal(m.history.length,0);
 const descriptor=C.resolveField(m,{x:1,y:4,z:2});
 assert.equal(descriptor.type,'integer');assert.equal(descriptor.editable,false);
 assert.equal(descriptor.related.length,3);assert.ok(descriptor.source.length>0);
});
test('repeated experience grants restore all linked changes and undo returns to the preceding transaction',()=>{
 const C=core(),m=C.parse(fixture());
 C.transaction(m,()=>C.addExperience(m,{kind:'profession',characterId:1,id:1,amount:6500}));
 C.transaction(m,()=>C.addExperience(m,{kind:'profession',characterId:1,id:1,amount:1.5}));
 assert.equal(C.get(m,{x:1,y:1,z:4}),3);assert.equal(C.get(m,{x:1,y:1,z:5}),1.5);
 C.restore(m,{x:1,y:1,z:5});assert.equal(C.get(m,{x:1,y:1,z:4}),1);assert.equal(m.changes.size,0);
 C.undo(m);assert.equal(C.get(m,{x:1,y:1,z:4}),3);assert.equal(C.get(m,{x:1,y:1,z:5}),1.5);
 C.undo(m);assert.equal(C.get(m,{x:1,y:1,z:4}),3);assert.equal(C.get(m,{x:1,y:1,z:5}),0);
});
test('actual save dimensions remain searchable and diff only materializes changed cells',()=>{
 const C=core(),raw=fixture(2501),m=C.parse(raw);
 assert.equal(C.listEntities(m,'characters').length,1);
 C.set(m,{x:1,y:2,z:0},1234);
 const modified=C.parse(C.serialize(m));const diff=C.diff(m.original,modified.original);
 assert.equal(diff.length,1);assert.equal(diff[0].label,'銅錢');
});
test('offline HTML embeds every executable dependency and requires no network API',()=>{
 assert.doesNotMatch(source,/<script\b[^>]*\bsrc\s*=/i);
 assert.doesNotMatch(source,/<link\b[^>]*rel=["']stylesheet["']/i);
 const scripts=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
 assert.doesNotMatch(scripts,/\b(?:fetch|XMLHttpRequest|WebSocket|importScripts)\s*\(/);
 assert.match(source,/connect-src 'none'/);
 assert.equal(CURRENT_HTML_CORE().KNOWLEDGE.gameVersion,'V1.0.9.1');
 function CURRENT_HTML_CORE(){const ctx={};vm.runInNewContext(source.match(/<script id="save-core">([\s\S]*?)<\/script>/)[1],ctx);return ctx.SaveCore;}
});
