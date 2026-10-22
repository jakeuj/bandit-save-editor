#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {evaluate,waitMain}=require('./verify-game.cjs');
const {prefix,externalState,nativeSnapshot,near,loadStateCore}=require('./verify-random-character-growth.cjs');
const TALENT_CELLS=[1,2,3,21,22,23];
// Native talent-only sums per attribute; 天赋属性计算(角色序号, 属性编号, 天赋序号, 计数) starts both accumulators at 0.
async function nativeTalents(state,ids,catalog){
 const attributes=Object.keys(catalog.randomCharacterTalents.attributes).map(Number);
 return evaluate(state,`(()=>{${prefix}return ${JSON.stringify(ids)}.map(id=>({id,cells:${JSON.stringify(TALENT_CELLS)}.map(y=>a.At(id,y,12)),sums:Object.fromEntries(${JSON.stringify(attributes)}.map(v=>[v,call('天赋属性计算',id,v,0,0)]).filter(([,v])=>v!==0))}));})()`);
}
// Every talent attribute slot at every level through the native 天赋属性(属性编号, 属性系数, 天赋等级).
async function nativeFormulas(state,catalog){
 const rows=[];for(const [id,t]of Object.entries(catalog.batch2Data.talents))t.attributes.forEach((a,slot)=>{if(a)for(let L=1;L<=5;L++)rows.push([Number(id),slot,a,t.coefficients[slot],L]);});
 return evaluate(state,`(()=>{${prefix}return ${JSON.stringify(rows)}.map(r=>[...r,call('天赋属性',r[2],r[3],r[4])]);})()`);
}
// Raw literal of each requested cell in the game-written save text; parsed numbers cannot tell 1 from 1.0.
function rawTokens(text,cells){
 const want=new Set(cells.map(c=>c.join(','))),out={},token=/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]/g;
 const start=text.indexOf('"data"');token.lastIndex=text.indexOf('[',start);let depth=0,match;const pos=[0,0,0];
 while((match=token.exec(text))){const t=match[0];if(t==='['){depth++;if(depth<=3)pos[depth-1]=0;}else if(t===']'){depth--;if(!depth)break;}else if(t===',')pos[depth-1]++;else if(depth===3&&want.has(pos.join(',')))out[pos.join(',')]=t;}
 return out;
}
function expectedSums(C,model,id){
 const info=C.randomCharacterTalentsInfo(model,{characterId:id});assert.ok(info.eligible,info.reasons.join());const sums={};
 for(const s of info.slots)for(const e of s.effects)sums[e.attributeId]=(sums[e.attributeId]||0)+e.value;
 return {info,sums};
}
async function verify(state,scenario,compare=false){
 externalState(state);if(compare)assert.ok(state.restarted&&state.pid!==state.previousPid,'Reload must use a different PID');await waitMain(state);
 const ids=scenario.talentCharacters;if(!Array.isArray(ids)||!ids.length)throw Error('No talent characters');
 const catalog=JSON.parse(fs.readFileSync(state.catalogPath||path.join(__dirname,'../knowledge/catalog.json'),'utf8')),C=loadStateCore(state);
 const model=C.parse(fs.readFileSync(path.join(state.game,'savedir/ea1save.dat'),'utf8'));
 const characters=await nativeTalents(state,ids,catalog);
 for(const row of characters){
  const {info,sums}=expectedSums(C,model,row.id),want=scenario.expectedLevels[row.id];
  assert.deepEqual(row.cells,[...want.ids,...want.levels],`native talent cells ${row.id}`);
  assert.deepEqual(Array.from(info.slots,s=>s.level),want.levels);
  assert.deepEqual(Object.keys(row.sums).sort(),Object.keys(sums).sort(),`talent attributes ${row.id}`);
  for(const [a,v]of Object.entries(sums))near(row.sums[a],v,`native talent sum ${row.id}:${a}`);
 }
 const aptitudes=scenario.talentAptitudeCharacters?.length?await nativeSnapshot(state,scenario.talentAptitudeCharacters):[];
 for(const row of aptitudes){const g=C.randomCharacterGrowthInfo(model,{characterId:row.id});assert.ok(g.eligible,g.reasons.join());for(let i=0;i<3;i++){near(row.base[i],g.aptitudes[i].base,'native A');near(row.caps[i],g.aptitudes[i].cap,'native C');near(row.totals[i],g.aptitudes[i].total,'native total');}}
 let formulas=[];
 if(scenario.talentFormulas){
  formulas=await nativeFormulas(state,catalog);
  for(const [id,slot,a,c,L,native]of formulas)assert.equal(native,C.talentEffect(a,c,L),`talent ${id}:${slot} attribute ${a} level ${L}`);
 }
 const file=path.join(state.dir,'talents-effects.json'),scenarioName=path.basename(process.argv[process.argv.indexOf('--scenario')+1]||'');
 if(compare){
  const prior=JSON.parse(fs.readFileSync(file,'utf8'));assert.deepEqual({characters,aptitudes,formulas},{characters:prior.characters,aptitudes:prior.aptitudes,formulas:prior.formulas});
  const saved=fs.readFileSync(path.join(state.game,'save\\ea1save.dat'),'utf8'),tokens=rawTokens(saved,ids.flatMap(id=>TALENT_CELLS.map(y=>[id,y,12]))),types={};
  for(const t of Object.values(tokens))types[/^-?\d+$/.test(t)?'integer':t]=(types[/^-?\d+$/.test(t)?'integer':t]||0)+1;
  assert.deepEqual(types,{integer:ids.length*6},'talent tokens must stay integer literals');
  fs.writeFileSync(path.join(state.dir,'talents-reload.json'),JSON.stringify({scenario:scenarioName,pid:state.pid,previousPid:state.previousPid,tokenTypes:types,characters,aptitudes},null,2));
 }else fs.writeFileSync(file,JSON.stringify({scenario:scenarioName,coverage:scenario.talentCoverage,pid:state.pid,characters,aptitudes,formulas},null,2));
 console.log(`PASS: ${ids.length} talent characters, ${aptitudes.length} aptitude rows${formulas.length?`, ${formulas.length} native formula values`:''} agree${compare?' after new-PID reload; tokens are integers':''}`);
}
async function main(){const args=process.argv.slice(2),opt=k=>args[args.indexOf(k)+1];await verify(JSON.parse(fs.readFileSync(opt('--state'))),JSON.parse(fs.readFileSync(opt('--scenario'))),args.includes('--compare'));}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={TALENT_CELLS,nativeTalents,nativeFormulas,rawTokens,expectedSums,verify};
