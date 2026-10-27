import fs from 'node:fs/promises'
import path from 'node:path'
import {spawn} from 'node:child_process'
import assert from 'node:assert/strict'
import {root,braveExecutable} from './paths.mjs'
const delay=ms=>new Promise(r=>setTimeout(r,ms)), clients=[]
async function open(label){
  const profile=path.join(root,'.verify-profile','sync-'+Date.now()+'-'+label)
  await fs.mkdir(profile,{recursive:true})
  const child=spawn(braveExecutable(),['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','chrome://settings/braveSync'],{windowsHide:true,stdio:'ignore'})
  const client={child};clients.push(client)
  let port,target
  for(let i=0;i<600;i++){try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');if(target)break}catch{}await delay(100)}
  assert.ok(target,'El perfil de prueba debe iniciar')
  const socket=new WebSocket(target.webSocketDebuggerUrl);client.socket=socket
  await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j})
  let id=0;const pending=new Map()
  socket.onmessage=e=>{const m=JSON.parse(e.data);pending.get(m.id)?.(m)}
  client.cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,t=setTimeout(()=>{pending.delete(n);reject(Error('Tiempo agotado: '+method))},100000);pending.set(n,m=>{clearTimeout(t);pending.delete(n);m.error?reject(Error('Error de protocolo')):resolve(m.result)});socket.send(JSON.stringify({id:n,method,params}))})
  client.evaluate=async expression=>{const result=await client.cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error('Sincronización: '+result.exceptionDetails.text+'; '+(result.exceptionDetails.exception?.description||'sin detalle').slice(0,350));return result.result.value}
  await client.cdp('Page.enable'); await client.cdp('Page.navigate',{url:'chrome://settings/braveSync'}); await delay(3000)
  return client
}
const call=(method,args='')=>`import('chrome://resources/js/cr.js').then(({sendWithPromise})=>sendWithPromise(${JSON.stringify(method)}${args?', '+args:''}))`
try{
  const a=await open('A'),b=await open('B')
  // The linking secret remains in memory and is never written to logs/artifacts.
  console.log('Generando código en perfil aislado');
  const code=await a.evaluate(call('SyncSetupGetSyncCode'))
  assert.ok(typeof code==='string'&&code.split(' ').length>=24,'Debe generar un código de vinculación')
  console.log('Conectando primer perfil');
  assert.equal(await a.evaluate(call('SyncSetupSetSyncCode',JSON.stringify(code))),true,'El primer perfil debe conectar al servidor')
  console.log('Vinculando segundo perfil');
  assert.equal(await b.evaluate(call('SyncSetupSetSyncCode',JSON.stringify(code))),true,'El segundo perfil debe unirse')
  let linked=false
  for(let i=0;i<60;i++){const [aa,bb]=await Promise.all([a.evaluate(call('SyncGetDeviceList')),b.evaluate(call('SyncGetDeviceList'))]);if(aa.length>=2&&bb.length>=2){linked=true;break}await delay(1000)}
  assert.ok(linked,'Ambos perfiles deben verse en la cadena cifrada')
  const report={passed:true,version:JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version,twoIsolatedProfilesLinked:true,secretLogged:false,bookmarksAndPasswordsTransferVerified:false}
  await fs.writeFile(path.join(root,'artifacts/sync-verification-070.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{for(const c of clients){try{await c.cdp?.('Browser.close')}catch{}c.socket?.close();if(c.child.exitCode===null)c.child.kill()}}
