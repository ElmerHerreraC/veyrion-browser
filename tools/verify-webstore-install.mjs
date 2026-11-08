import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {root} from './paths.mjs'

// Observe a user-confirmed install in an empty test profile. Never approve
// permissions, call installation APIs, or inspect a password-manager vault.
const session=JSON.parse((await fs.readFile(path.join(root,'artifacts/webstore-install-session.json'),'utf8')).replace(/^\uFEFF/,''))
const extensionId='nngceckbapebfimnlniiiahkandclblb'
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const port=Number((await fs.readFile(path.join(session.profile,'DevToolsActivePort'),'utf8')).split('\n')[0])
let target
for(let i=0;i<120;i++){
  target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page'&&t.url.startsWith('https://chromewebstore.google.com/')&&t.url.includes(extensionId))
  if(target)break
  await delay(500)
}
assert.ok(target,'Debe estar abierta la ficha oficial de Bitwarden en el perfil de prueba')
const socket=new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let sequence=0;const pending=new Map()
socket.onmessage=event=>{const message=JSON.parse(event.data);const done=pending.get(message.id);if(done){pending.delete(message.id);done(message)}}
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Tiempo agotado: '+method))},15000);pending.set(id,m=>{clearTimeout(timer);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result)});socket.send(JSON.stringify({id,method,params}))})}
try{
  let status,previous
  for(let i=0;i<300;i++){
    const result=await call('Runtime.evaluate',{expression:`new Promise(resolve=>chrome.webstorePrivate.getExtensionStatus('${extensionId}',resolve))`,returnByValue:true,awaitPromise:true})
    if(result.exceptionDetails){await delay(1000);continue}
    status=result.result.value
    if(status!==previous){console.log('Estado de instalación:',status);previous=status}
    if(status==='enabled')break
    await delay(2000)
  }
  assert.equal(status,'enabled','Bitwarden debe estar instalado y habilitado, no solo descargado')
  await call('Browser.close');await delay(1500)
  const log=JSON.parse(await fs.readFile(session.netlog,'utf8'))
  const names=Object.fromEntries(Object.entries(log.constants.logEventTypes).map(([name,id])=>[id,name]))
  const installs=log.events.filter(e=>e.params?.url).filter(e=>{try{const u=new URL(e.params.url);return u.hostname==='clients2.google.com'&&u.pathname==='/service/update2/crx'&&u.searchParams.get('x')?.includes(extensionId)}catch{return false}})
  assert.ok(installs.length,'La instalación debe utilizar el servidor oficial de Google')
  const sources=new Set(installs.map(e=>e.source.id))
  const statuses=log.events.filter(e=>sources.has(e.source.id)&&names[e.type]==='HTTP_TRANSACTION_READ_RESPONSE_HEADERS').flatMap(e=>(e.params.headers||[]).filter(h=>/^HTTP\//.test(h)).map(h=>Number(h.match(/\s(\d{3})\b/)?.[1])))
  assert.ok(statuses.includes(200),'La descarga de instalación debe finalizar con HTTP 200')
  assert.ok(!statuses.includes(401)&&!statuses.includes(403),'La instalación no debe recibir acceso denegado')
  const directory=path.join(session.profile,'Default/Extensions',extensionId)
  const versions=await fs.readdir(directory)
  assert.ok(versions.length,'Debe existir la extensión instalada en el perfil')
  const report={passed:true,version:session.version,extensionId,status,transport:'https://clients2.google.com/service/update2/crx',httpStatuses:statuses,installedVersions:versions,userConfirmedPermissions:true}
  await fs.writeFile(path.join(root,'artifacts/webstore-install-verification.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify(report))
}finally{socket.close()}
