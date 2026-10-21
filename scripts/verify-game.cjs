#!/usr/bin/env node
'use strict';
// Local, opt-in integration harness. Artifacts and copied player data stay outside the repository.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto');
const {spawn,execFileSync}=require('node:child_process');
const args=process.argv.slice(2),opt=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
const root=path.resolve(__dirname,'..');
const sum=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function launch(state){
 const log=fs.openSync(path.join(state.dir,'game.log'),'a');
 const child=spawn(state.runtime,[state.game,'--mute-audio','--user-data-dir='+path.join(state.dir,'profile'),'--remote-debugging-port='+state.port,'--remote-debugging-address=127.0.0.1','--enable-logging=stderr'],{cwd:state.game,detached:true,windowsHide:true,stdio:['ignore',log,log]});
 child.unref();fs.closeSync(log);return child.pid;
}
function ownedProcess(state){
 if(!Number.isSafeInteger(state.pid)||state.pid<=0)throw Error('Invalid test PID');
 if(process.platform==='win32'){
  const text=execFileSync('powershell.exe',['-NoProfile','-Command',`Get-CimInstance Win32_Process -Filter "ProcessId = ${state.pid}" | Select-Object ExecutablePath,CommandLine | ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true}).trim();
  if(!text)return false;
  const p=JSON.parse(text);
  if(path.resolve(p.ExecutablePath||'').toLowerCase()!==path.resolve(state.runtime).toLowerCase()||!p.CommandLine?.includes(path.join(state.dir,'profile')))throw Error('PID no longer belongs to disposable game');
  return true;
 }
 let command;try{command=execFileSync('ps',['-p',String(state.pid),'-o','command='],{encoding:'utf8'});}catch{return false;}
 if(!command.includes(state.game))throw Error('PID no longer belongs to disposable game');return true;
}
async function setup(){
 const source=path.resolve(opt('--source',path.join(os.homedir(),'bandit-mac-port/game'))),originalRuntime=path.resolve(opt('--runtime',path.join(os.homedir(),'bandit-mac-port/runtime/nwjs-sdk-v0.82.0-osx-arm64/nwjs.app/Contents/MacOS/nwjs')));
 const catalog=JSON.parse(fs.readFileSync(path.resolve(opt('--catalog',path.join(root,'knowledge/catalog.json'))),'utf8'));
 const fingerprints={...catalog.fingerprints,...catalog.batch2Fingerprints};
 for(const [file,hash]of Object.entries(fingerprints))if(sum(path.join(source,file))!==hash)throw Error('Test source does not match catalog fingerprint: '+file);
 const artifacts=fs.realpathSync(path.resolve(opt('--artifacts',os.tmpdir()))),relative=path.relative(root,artifacts);
 if(relative===''||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep)))throw Error('Validation artifacts must stay outside the repo');
 const dir=fs.mkdtempSync(path.join(artifacts,'bandit-editor-validation-')),game=path.join(dir,'game');
 let runtime;
 if(process.platform==='darwin'){
  const app=path.join(dir,'BANDIT Editor Test.app');execFileSync('ditto',[path.resolve(originalRuntime,'../../..'),app]);
  execFileSync('plutil',['-replace','CFBundleIdentifier','-string','com.jakeuj.bandit.editor-test.'+path.basename(dir).split('-').at(-1),path.join(app,'Contents/Info.plist')]);
  execFileSync('plutil',['-replace','CFBundleName','-string','BANDIT Editor Test',path.join(app,'Contents/Info.plist')]);
  runtime=path.join(app,'Contents/MacOS/nwjs');
 }else if(process.platform==='win32')runtime=path.join(game,path.basename(originalRuntime));
 else throw Error('Validation setup supports Windows and macOS');
 fs.cpSync(source,game,{recursive:true});fs.mkdirSync(path.join(dir,'cloud-mirror'));
 if(process.platform==='win32'){
  const runtimeDir=path.dirname(originalRuntime);
  for(const name of fs.readdirSync(runtimeDir))if(/\.(dll|pak|bin)$/i.test(name)||['icudtl.dat','vk_swiftshader_icd.json',path.basename(originalRuntime)].includes(name))fs.copyFileSync(path.join(runtimeDir,name),path.join(game,name));
  fs.mkdirSync(path.join(game,'locales'),{recursive:true});
  for(const name of fs.readdirSync(path.join(runtimeDir,'locales')))fs.copyFileSync(path.join(runtimeDir,'locales',name),path.join(game,'locales',name));
  const manifestPath=path.join(game,'package.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  manifest.name='com.jakeuj.bandit.validation.'+path.basename(dir);manifest.window={...manifest.window,show:false};
  manifest['chromium-args']=(manifest['chromium-args']||'').replace('--disable-devtools','')+' --disable-background-timer-throttling';
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
 }
 const saveFile=path.resolve(opt('--save-file',path.join(source,'savedir/ea3save.dat'))),before={};
 for(const folder of ['save','savedir','backup']){
  const original=path.join(path.dirname(path.dirname(saveFile)),folder);
  if(fs.existsSync(original))for(const name of fs.readdirSync(original))if(name.endsWith('.dat')){const file=path.join(original,name);before[file]=sum(file);}
  fs.mkdirSync(path.join(game,folder),{recursive:true});
  const info=path.join(path.dirname(saveFile),'saveinfo.dat');if(fs.existsSync(info))fs.copyFileSync(info,path.join(game,folder,'saveinfo.dat'));
 }
 before[saveFile]=sum(saveFile);
 const core=fs.readFileSync(path.join(root,'src/core.js'),'utf8').replace('/*__KNOWLEDGE__*/null',JSON.stringify(catalog)),ctx={};vm.runInNewContext(core,ctx);const C=ctx.SaveCore;
 for(const k of Object.keys(C.KNOWLEDGE.verification))C.KNOWLEDGE.verification[k]=true;
 const base=JSON.parse(fs.readFileSync(saveFile,'utf8').replace(/^\uFEFF/,''));
 // Only the disposable baseline changes; the actual editor still performs precise raw-text edits.
 base.data[1][3][2]=1;base.data[1][4][2]=0;base.data[1][50][2]=0;base.data[1][1][4]=1;base.data[1][1][5]=0;base.data[1][5][0]=5;base.data[1][59][2]=0;base.data[1][6][2]=1;base.data[1][31][2]=1;base.data[1][40][2]=0;base.data[1][22][2]=15;
 const scenarioPath=opt('--scenario'),scenario=scenarioPath?JSON.parse(fs.readFileSync(scenarioPath,'utf8')):null;
 for(const [x,y,z,value]of scenario?.baseline||[])base.data[x][y][z]=value;
 const model=C.parse(JSON.stringify(base));
 C.transaction(model,()=>{C.setField(model,{x:1,y:1,z:0},'驗證山寨');C.setField(model,{x:1,y:1,z:2},'驗證甲');});
 C.addExperience(model,{kind:'character',characterId:1,amount:6500});
 C.addExperience(model,{kind:'profession',characterId:1,id:1,amount:6500});
 C.addExperience(model,{kind:'profession',characterId:1,id:1,amount:1.5});
 C.addExperience(model,{kind:'skill',characterId:1,id:1,amount:21500});
 for(const operation of scenario?.operations||[]){if(!['setEquipmentLevel','setProfessionTrainingCap','setAdvancedTechnologyLevel','setEquipmentAffixCoefficient','setPillAptitudeBonus','setEquipmentAffix','setEquipmentQuality'].includes(operation.method))throw Error('Unsupported scenario operation');C[operation.method](model,operation.options);}
 const modified=C.serialize(model),expected=JSON.parse(modified).data;
 for(let slot=1;slot<=3;slot++)fs.writeFileSync(path.join(game,`savedir/ea${slot}save.dat`),modified);
 fs.mkdirSync(path.join(game,'backup'),{recursive:true});
 for(let slot=1;slot<=3;slot++)fs.writeFileSync(path.join(game,`backup/ea${slot}save.dat`),modified);
 let worker=fs.readFileSync(path.join(game,'workermain.js'),'utf8');
 worker=worker.replace('runtime=self["C3_CreateRuntime"](data);','runtime=self["C3_CreateRuntime"](data);self.__banditValidationRuntime=runtime;');
 worker=worker.replace('await self["C3_InitRuntime"](runtime,data)','await self["C3_InitRuntime"](runtime,data);const freeze=setInterval(()=>{if(runtime.GetMainRunningLayout()?.GetName()==="主界面"){runtime.SetTimeScale(0);clearInterval(freeze);}},20);');
 if(!worker.includes('self.__banditValidationRuntime'))throw Error('Worker instrumentation failed');
 fs.writeFileSync(path.join(game,'workermain.js'),worker);
 const guard=`\n// Disposable verification copy: retain real initialization and identity; redirect mutations.\n(()=>{const gw=module.exports,fs=require('fs'),path=require('path'),base=${JSON.stringify(dir)};const record=method=>fs.appendFileSync(path.join(base,'steam-writes.jsonl'),JSON.stringify({method})+'\\n');const ok=(...args)=>{for(const a of args)if(typeof a==='function'){a(true);break;}};gw.saveTextToFile=(name,content,...cb)=>{record('saveTextToFile');fs.writeFileSync(path.join(base,'cloud-mirror',path.basename(name)),content);ok(...cb);};gw.saveFilesToCloud=(files,...cb)=>{record('saveFilesToCloud');for(const f of Array.isArray(files)?files:[files])fs.copyFileSync(f,path.join(base,'cloud-mirror',path.basename(f)));ok(...cb);};gw.deleteFile=(name,...cb)=>{record('deleteFile');const f=path.join(base,'cloud-mirror',path.basename(name));if(fs.existsSync(f))fs.unlinkSync(f);ok(...cb);};for(const method of ['activateAchievement','clearAchievement','setStat','storeStats','resetAllStats','installDLC','uninstallDLC','fileShare','publishWorkshopFile','updatePublishedWorkshopFile'])if(typeof gw[method]==='function')gw[method]=(...a)=>{record(method);ok(...a);return true;};})();\n`;
 fs.appendFileSync(path.join(game,'greenworks.js'),guard);
 fs.appendFileSync(path.join(game,'greenworks.js'),`\n(()=>{const gw=module.exports,fs=require('fs'),path=require('path'),base=${JSON.stringify(dir)},init=gw.init;gw.init=function(...a){const result=init.apply(this,a);fs.writeFileSync(path.join(base,'steam-init.json'),JSON.stringify({initialized:true,platform:process.platform,arch:process.arch,nw:process.versions.nw}));return result;};if(typeof gw.enableCloud==='function')gw.enableCloud=()=>{fs.appendFileSync(path.join(base,'steam-writes.jsonl'),JSON.stringify({method:'enableCloud'})+'\\n');return true;};})();\n`);
 const port=Number(opt('--port','19384'));
 const cells=scenario?.observe||[[1,1,0],[1,1,2],[1,3,2],[1,4,2],[1,1,4],[1,1,5],[1,31,2],[1,40,2],[2,2,0],[1,56,2]];
 const state={dir,game,source,runtime,port,fingerprints,before,cells,gameVersion:catalog.gameVersion,expected:cells.map(([x,y,z])=>expected[x][y][z]),assertions:[]};
 state.pid=launch(state);
 fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify(state,null,2));console.log('STATE '+path.join(dir,'state.json'));
}
class CDP{
 constructor(url){this.ws=new WebSocket(url);this.next=0;this.pending=new Map();this.events=[];this.ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.id){const h=this.pending.get(r.id);if(h){this.pending.delete(r.id);r.error?h.reject(Error(JSON.stringify(r.error))):h.resolve(r.result);}}else this.events.push(r);});}
 async ready(){await new Promise((resolve,reject)=>{this.ws.addEventListener('open',resolve,{once:true});this.ws.addEventListener('error',reject,{once:true});});}
 send(method,params={},sessionId){const id=++this.next;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('CDP timeout: '+method));},20000);this.pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
 close(){this.ws.close();}
}
async function connect(state){const b=await(await fetch(`http://127.0.0.1:${state.port}/json/version`)).json();const cdp=new CDP(b.webSocketDebuggerUrl);await cdp.ready();const {targetInfos}=await cdp.send('Target.getTargets');const page=targetInfos.find(t=>t.type==='page');if(!page){cdp.close();throw Error('Game page not ready; probe again after startup');}const {sessionId:pageSession}=await cdp.send('Target.attachToTarget',{targetId:page.targetId,flatten:true});await cdp.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true},pageSession);await cdp.send('Runtime.enable',{},pageSession);const worker=cdp.events.find(e=>e.method==='Target.attachedToTarget'&&e.params.targetInfo.type==='worker'&&e.params.targetInfo.url.includes('workermain.js'));if(!worker){cdp.close();throw Error('Construct worker not found: '+JSON.stringify(cdp.events.filter(e=>e.method==='Target.attachedToTarget').map(e=>e.params.targetInfo)));}return {cdp,sessionId:worker.params.sessionId};}
async function evaluate(state,expression){const {cdp,sessionId}=await connect(state);try{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}finally{cdp.close();}}
async function probe(state){
 const result=await evaluate(state,`(()=>{const r=self.__banditValidationRuntime,a=r.GetObjectClassByName('save').GetInstances()[0].GetSdkInstance();if(r.GetMainRunningLayout().GetName()==='主界面')r.SetTimeScale(0);return {layout:r.GetMainRunningLayout().GetName(),values:${JSON.stringify(state.cells)}.map(([x,y,z])=>a.At(x,y,z))};})()`);
 if(!args.includes('--quiet'))console.log(JSON.stringify(result));return result;
}
async function waitMain(state,mainOnly=true){
 const deadline=Date.now()+30000;let last;
  while(Date.now()<deadline){try{const layout=await evaluate(state,"self.__banditValidationRuntime.GetMainRunningLayout().GetName()");if(layout==='主界面'||!mainOnly&&layout==='开始界面')return;}catch(e){last=e;}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw Error('Main layout did not become ready'+(last?': '+last.message:''));
}
async function run(){
 if(args.includes('--help')){console.log('Node 22+, Windows/macOS: verify-game.cjs --setup --source UNPACKED_GAME --runtime NWJS [--save-file ORIGINAL.dat] [--catalog CANDIDATE.json] [--artifacts OUTSIDE_REPO] [--scenario SCENARIO.json]\n--state /outside/repo/state.json --probe | --load [--mode 存档|备份|云存档] | --save | --assert | --stop | --restart\nIsolated launches and restarts are muted (--mute-audio). Stop the disposable process before --restart. Wait for the title/main layout before --load/--assert.');return;}
 if(args.includes('--setup'))return setup();
 const state=JSON.parse(fs.readFileSync(opt('--state'),'utf8'));
 if(args.includes('--probe'))await probe(state);
 if(args.includes('--load')){
  await waitMain(state,false);
  const mode=opt('--mode','云存档');
  console.log(await evaluate(state,`(()=>{const r=self.__banditValidationRuntime,f=r.GetEventSheetManager().GetFunctionBlockByName('读取进度'),b=f.GetEventBlock();b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),1,${JSON.stringify(mode)});return 'Requested real game file-load function';})()`));
 }
 if(args.includes('--restart')){
  if(ownedProcess(state))throw Error('Stop the disposable process before restarting');
  state.previousPid=state.pid;state.pid=launch(state);state.restarted=true;fs.writeFileSync(opt('--state'),JSON.stringify(state,null,2));console.log('Restarted disposable test game');
 }
 if(args.includes('--save')){await waitMain(state);console.log(await evaluate(state,`(()=>{const r=self.__banditValidationRuntime,f=r.GetEventSheetManager().GetFunctionBlockByName('存档'),b=f.GetEventBlock();b.RunAsExpressionFunctionCall(b.GetSolModifiersIncludingParents(),f.IsCopyPicked(),f.GetReturnType(),f.GetDefaultReturnValue(),1,0,'主动');return 'Requested native game save slot 1';})()`));}
 if(args.includes('--assert')){
  await waitMain(state);
  const got=await probe(state);if(got.layout!=='主界面'||JSON.stringify(got.values)!==JSON.stringify(state.expected))throw Error('Actual engine state does not match edited save');
  const savedFile=path.join(state.game,'save\\ea1save.dat');
  if(!fs.existsSync(savedFile))throw Error('Native manual-save file was not created');
  const disk=JSON.parse(fs.readFileSync(savedFile,'utf8')).data;
  for(const [i,[x,y,z]]of state.cells.entries())if(disk[x][y][z]!==state.expected[i])throw Error('Game-written save does not match expected cell '+[x,y,z]);
  for(const [name,hash]of Object.entries(state.before))if(sum(path.isAbsolute(name)?name:path.join(state.source,'savedir',name))!==hash)throw Error('Original save changed: '+name);
  for(const [name,hash]of Object.entries(state.fingerprints))if(sum(path.join(state.game,name))!==hash)throw Error('Tested game source changed: '+name);
  if(!JSON.parse(fs.readFileSync(path.join(state.dir,'steam-init.json'),'utf8')).initialized)throw Error('Real Steam initialization was not confirmed');
  (state.assertions??=[]).push({restarted:!!state.restarted,pid:state.pid,savedHash:sum(savedFile),passed:true});fs.writeFileSync(opt('--state'),JSON.stringify(state,null,2));
  console.log('PASS: live engine, game-written file and original source hashes');
 }
 if(args.includes('--stop')){if(!ownedProcess(state))throw Error('Disposable process already stopped');if(process.platform==='win32')execFileSync('taskkill',['/PID',String(state.pid),'/T','/F'],{windowsHide:true});else process.kill(state.pid,'SIGTERM');console.log('Stopped disposable test game');}
}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={CDP,connect,evaluate,waitMain};
