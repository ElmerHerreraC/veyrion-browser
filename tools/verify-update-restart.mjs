// Runs only against an isolated test profile. Never launches an installer.
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {root,braveExecutable} from './paths.mjs'
const executable=braveExecutable(), profile=path.join(root,'.verify-profile','restart-'+Date.now())
const cache=process.env.VEYRION_UPDATE_TEST_CACHE
assert.ok(cache,'Set VEYRION_UPDATE_TEST_CACHE to the real updater cache; close installed Veyrion first')
const status=path.join(cache,'status.json'), version='99.8.2', record=pid=>path.join(cache,`restart-${version}-${pid}.json`)
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
let original,child,socket,sequence=0,fixtureActive=false
const pending=new Map()
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'))},15000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value)},reject});socket.send(JSON.stringify({id,method,params}))})}
async function start(args){
  child=spawn(executable,[...args,'--remote-debugging-port=0','--no-first-run','--no-default-browser-check'],{stdio:['ignore','ignore','pipe'],windowsHide:false})
  child.stderr.on('data',data=>fs.appendFile(path.join(root,'artifacts/update-restart-runtime.log'),data).catch(()=>{}))
  for(let i=0;i<600;i++){
    assert.equal(child.exitCode,null,'Test browser must remain running')
    try{const port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();const tab=tabs.find(t=>t.type==='page');if(tab){socket=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});socket.onmessage=event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}};return {port,tabs}}}catch{}
    await delay(100)
  }
  throw Error('Test browser failed to start')
}
async function fixture(state,restartRequested){fixtureActive=true;await fs.writeFile(status,JSON.stringify({state,detail:version,restartRequested,checkedAt:new Date().toISOString()}))}
async function restore(){if(!fixtureActive)return;if(original)await fs.writeFile(status,original);else await fs.rm(status,{force:true});fixtureActive=false}
try{
  await fs.mkdir(profile,{recursive:true});await fs.mkdir(cache,{recursive:true})
  // The native infobar queue shows one standard notice at a time. This test
  // represents an existing profile where the initial notice was acknowledged.
  await fs.writeFile(path.join(profile,'Local State'),JSON.stringify({brave:{p3a:{notice_acknowledged:true}}}))
  try{original=await fs.readFile(status)}catch(error){if(error.code!=='ENOENT')throw error}
  await fixture('current',false)
  await start([`--user-data-dir=${profile}`,'chrome://settings/system'])
  await delay(2000)
  await cdp('Page.navigate',{url:'chrome://settings/system'})
  await delay(1000)
  const pid=child.pid
  await fixture('available',false)
  console.log('UPDATE UI READY: '+JSON.stringify({profile,pid}))
  if(process.env.VEYRION_UPDATE_UI_HOLD==='1'){
    let released=false
    for(let i=0;i<1200;i++){assert.equal(child.exitCode,null);try{await fs.access(path.join(profile,'continue-update'));released=true;break}catch{}await delay(250)}
    assert.ok(released,'UI inspection must complete within five minutes')
  }
  else await delay(8000)
  await fixture('ready-on-close',true)
  for(let i=0;i<300&&child.exitCode===null;i++)await delay(100)
  assert.equal(child.exitCode,0,'Verified ready state must cause a graceful native exit')
  const args=JSON.parse(await fs.readFile(record(pid),'utf8'))
  assert.deepEqual(args,[`--user-data-dir=${profile}`],'Native restart must retain the isolated profile')
  socket?.close();socket=null
  await restore()
  await fs.rm(path.join(profile,'DevToolsActivePort'),{force:true})
  const restored=await start([...args,'--restore-last-session'])
  let tabs=restored.tabs
  for(let i=0;i<100&&!tabs.some(t=>t.url.includes('settings/system'));i++){await delay(100);tabs=await(await fetch(`http://127.0.0.1:${restored.port}/json/list`)).json()}
  assert.ok(tabs.some(t=>t.url.includes('settings/system')),'Normal tab must restore after native shutdown')
  try{await cdp('Browser.close')}catch{}
  for(let i=0;i<100&&child.exitCode===null;i++)await delay(100)
  assert.equal(child.exitCode,0)
  await fs.writeFile(path.join(root,'artifacts/update-restart-verification-082.json'),JSON.stringify({passed:true,nativeGracefulExit:true,profilePreserved:true,normalTabRestored:true,installerExecuted:false},null,2))
  await fs.rm(record(pid),{force:true})
  console.log('Native update restart verification passed')
}finally{
  await restore()
  socket?.close()
  if(child?.exitCode===null)child.kill()
}
