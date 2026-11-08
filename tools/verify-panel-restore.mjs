import fs from 'node:fs/promises'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {createServer} from 'node:http'
import assert from 'node:assert/strict'
import {root,braveExecutable} from './paths.mjs'

const profile=path.join(root,'.verify-profile','panel-restore-'+Date.now())
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const home='chrome-extension://mnojpmjdmbbfmejpflffifhffcmidifd/veyrion_start/index.html'
const server=createServer((req,res)=>{
  if(req.url==='/'){res.writeHead(302,{Location:'/app'});res.end();return}
  res.writeHead(200,{'Content-Type':'text/html'})
  res.end('<!doctype html><title>Panel restore fixture</title><input id="draft"><p>Local test</p>')
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin=`http://127.0.0.1:${server.address().port}`,panelUrl=origin+'/'
await fs.mkdir(path.join(profile,'Default'),{recursive:true})
await fs.writeFile(path.join(profile,'Default/Preferences'),JSON.stringify({session:{restore_on_startup:1}}))
let child,control,port
const sockets=[]
async function connect(target){
  const socket=new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
  sockets.push(socket)
  let sequence=0;const pending=new Map()
  socket.onmessage=event=>{const m=JSON.parse(event.data),done=pending.get(m.id);if(done){pending.delete(m.id);done(m)}}
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Timeout: '+method))},20000)
    pending.set(id,m=>{clearTimeout(timer);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result)})
    socket.send(JSON.stringify({id,method,params}))
  })
  return {call,evaluate:async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}}
}
async function targets(){return (await fetch(`http://127.0.0.1:${port}/json/list`)).json()}
async function start(restore){
  child=spawn(braveExecutable(),['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-mode',...(restore?['--restore-last-session']:[]),home],{windowsHide:true,stdio:'ignore'})
  let target
  for(let i=0;i<300;i++){
    assert.equal(child.exitCode,null,'Test browser must stay running')
    try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);target=(await targets()).find(t=>t.type==='page'&&t.url.startsWith(home));if(target)break}catch{}
    await delay(200)
  }
  assert.ok(target,'Native component control tab must load')
  control=await connect(target)
  for(let i=0;i<100;i++){if(await control.evaluate('Boolean(chrome.braveTheme?.setVeyrionPanel)'))return;await delay(100)}
  throw Error('Panel API unavailable')
}
const panel=action=>control.evaluate(`new Promise((resolve,reject)=>chrome.braveTheme.setVeyrionPanel(${JSON.stringify(action)},${JSON.stringify(panelUrl)},360,false,value=>chrome.runtime.lastError?reject(Error(chrome.runtime.lastError.message)):resolve(value)))`)
const tabs=()=>control.evaluate('chrome.tabs.query({}).then(t=>t.map(x=>({id:x.id,url:x.url,pinned:x.pinned})))')
async function stop(){
  await control.call('Browser.close')
  for(let i=0;i<100&&child.exitCode===null;i++)await delay(100)
  assert.equal(child.exitCode,0,'Session must close cleanly before restoration')
  for(const socket of sockets)socket.close()
  sockets.length=0
}
try{
  await start(false)
  await control.evaluate(`chrome.tabs.create({url:${JSON.stringify(origin+'/normal')},active:false})`)
  await panel('add');await panel('open')
  let first
  for(let i=0;i<100;i++){first=(await tabs()).filter(t=>t.url===origin+'/app'&&t.pinned);if(first.length)break;await delay(100)}
  assert.equal(first.length,1,'First panel creates one pinned tab')
  await stop()
  await start(true)
  let restored
  for(let i=0;i<150;i++){restored=(await tabs()).filter(t=>t.url===origin+'/app'&&t.pinned);if(restored.length)break;await delay(100)}
  assert.equal(restored.length,1,'Pinned panel must be restored from the previous session')
  await control.evaluate(`chrome.tabs.update(${restored[0].id},{active:true})`)
  let target
  for(let i=0;i<100;i++){target=(await targets()).find(t=>t.type==='page'&&t.url===origin+'/app');if(target)break;await delay(100)}
  assert.ok(target,'Restored document must become available')
  const document=await connect(target)
  for(let i=0;i<100;i++){if(await document.evaluate('Boolean(document.querySelector("#draft"))'))break;await delay(100)}
  await document.evaluate('globalThis.restoreSentinel="kept";document.querySelector("#draft").value="Borrador de prueba";true')
  await panel('open');await delay(300)
  const after=await tabs()
  assert.equal(after.filter(t=>t.url===origin+'/app').length,1,'Reopening the sidebar after restart must not duplicate the restored tab')
  assert.equal(after.find(t=>t.url===origin+'/app').id,restored[0].id,'The restored tab itself must be reused')
  assert.equal(after.filter(t=>t.url===origin+'/normal'&&!t.pinned).length,1,'Ordinary browsing tabs must remain separate')
  assert.equal(await document.evaluate('globalThis.restoreSentinel'),'kept','Opening the panel must not reload the restored document')
  assert.equal(await document.evaluate('document.querySelector("#draft").value'),'Borrador de prueba','Existing draft must survive panel attachment')
  await panel('close');await panel('open')
  assert.equal((await tabs()).filter(t=>t.url===origin+'/app').length,1,'Closing and reopening must still reuse one panel')
  await stop()
  const report={passed:true,version:'0.8.8',cleanRestart:true,rootRedirectHandled:true,activeRestoredTabHandled:true,restoredTabReused:true,duplicateTabsCreated:0,ordinaryTabPreserved:true,documentAndDraftPreserved:true}
  await fs.writeFile(path.join(root,'artifacts/panel-restore-verification-088.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify(report))
}finally{
  for(const socket of sockets)socket.close()
  if(child?.exitCode===null)child.kill()
  server.close()
}
