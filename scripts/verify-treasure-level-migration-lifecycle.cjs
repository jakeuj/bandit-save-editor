#!/usr/bin/env node
'use strict';
// Migration lifecycle step for a representative treasure copy: native move/equip/unequip on the edited row, then a new-PID re-read.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{evaluate,waitMain}=require('./verify-game.cjs'),L=require('./verify-treasure-level-lifecycle.cjs'),{rpc}=require('./verify-treasure-level-native.cjs');
async function run(argv){
 const opt=n=>argv[argv.indexOf(n)+1],file=opt('--state'),state=JSON.parse(fs.readFileSync(file)),scenario=JSON.parse(fs.readFileSync(opt('--scenario'))),reportFile=path.join(state.dir,'treasure-level-lifecycle.json');
 require('./migration-source.cjs').external(state.dir);await waitMain(state);
 if(argv.includes('--compare')){const report=JSON.parse(fs.readFileSync(reportFile));assert.deepEqual(await rpc(state,{op:'observe',locations:report.locations}),report.final);console.log('PASS treasure level lifecycle after new PID');return;}
 const first=scenario.items[0];assert.equal(first.id,1);
 const cycle=await evaluate(state,`(${L.nativeCycle.toString()})(${JSON.stringify({plane:first.plane,slot:first.slot,worn:false})})`);
 L.validateCycle(cycle,first.after);
 const locations=cycle.locations,final=await rpc(state,{op:'observe',locations});
 for(let id=1;id<=12;id++)for(const z of [7,9])for(let y=0;y<60;y++)state.cells.push([id,y,z]);
 for(let s=1;s<=6;s++)state.cells.push([1,15+s,2]);
 state.expected=await evaluate(state,`(()=>{const a=self.__banditValidationRuntime.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();return ${JSON.stringify(state.cells)}.map(([x,y,z])=>a.At(x,y,z));})()`);
 fs.writeFileSync(file,JSON.stringify(state));fs.writeFileSync(reportFile,JSON.stringify({cycle,locations,final}));
 console.log('PASS treasure level native move/equip/unequip');
}
module.exports={run};
if(require.main===module)run(process.argv.slice(2)).then(()=>process.stdout.write('',()=>process.exit(0))).catch(e=>{console.error(e.stack);process.exitCode=1;});
