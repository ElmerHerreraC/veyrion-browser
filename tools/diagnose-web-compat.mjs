import fs from 'node:fs/promises'
import path from 'node:path'
import {spawn} from 'node:child_process'
import assert from 'node:assert/strict'
import {root,braveExecutable} from './paths.mjs'

const profile=path.join(root,'.verify-profile','web-compat-'+Date.now())
const productionVerify=process.env.VEYRION_PRODUCTION_VERIFY==='1'
await fs.mkdir(profile,{recursive:true})
const child=spawn(braveExecutable(),['--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--mute-audio','--window-size=1100,800','about:blank'],{windowsHide:true,stdio:'ignore'})
const delay=ms=>new Promise(r=>setTimeout(r,ms))
let socket,id=0;const pending=new Map(),events=[]
const safeUrl=value=>{try{const url=new URL(value);return url.origin+url.pathname}catch{return ''}}
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('Timeout: '+method))},20000);pending.set(key,m=>{clearTimeout(timer);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result)});socket.send(JSON.stringify({id:key,method,params}))})
try{
  let port
  for(let i=0;i<200;i++){try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break}catch{}await delay(100)}
  if(!port)throw Error('No DevTools port')
  const target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page')
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
  socket.onmessage=e=>{const m=JSON.parse(e.data);const done=pending.get(m.id);if(done){pending.delete(m.id);done(m)}
    if(m.method==='Network.responseReceived'&&(m.params.type==='Document'||m.params.response.status>=400))events.push({type:m.params.type,url:safeUrl(m.params.response.url),status:m.params.response.status})
    if(m.method==='Network.loadingFailed')events.push({type:m.params.type,error:m.params.errorText})
    if(m.method==='Browser.downloadWillBegin')events.push({download:safeUrl(m.params.url)})
    if(m.method==='Browser.downloadProgress')events.push({downloadState:m.params.state,bytes:m.params.receivedBytes})
  }
  await call('Page.enable');await call('Network.enable')
  const kick=[]
  for(let pass=0;pass<(productionVerify?1:2);pass++){
    const start=Date.now();await call('Page.navigate',{url:productionVerify?'https://kick.com/goblinciano69':'https://kick.com/'});await delay(productionVerify?20000:10000)
    if(productionVerify){for(let gc=0;gc<3;gc++){await call('HeapProfiler.collectGarbage');await delay(2000);assert.equal(child.exitCode,null,'El navegador debe sobrevivir a la recolección de memoria')}}
    const r=await call('Runtime.evaluate',{expression:'JSON.stringify({url:location.origin+location.pathname,title:document.title,state:document.readyState,hasContent:!!document.body?.innerText?.trim(),navigation:performance.getEntriesByType("navigation").map(n=>({responseStart:n.responseStart,domContentLoaded:n.domContentLoadedEventEnd,load:n.loadEventEnd}))})',returnByValue:true})
    kick.push({pass,elapsed:Date.now()-start,page:JSON.parse(r.result.value)})
  }
  await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.join(profile,'Downloads'),eventsEnabled:true})
  await call('Page.navigate',{url:'https://clients2.google.com/service/update2/crx?response=redirect&os=win&arch=x64&prod=chromiumcrx&prodchannel=unknown&prodversion=155.1.97.0&lang=es&acceptformat=crx3,puff&x=id%3Dnngceckbapebfimnlniiiahkandclblb%26installsource%3Dondemand%26uc'})
  await delay(10000)
  const report={profile,kick,events};await fs.writeFile(path.join(root,'artifacts/web-compat-diagnostic.json'),JSON.stringify(report,null,2))
  if(productionVerify){
    assert.ok(kick[0].page.title.includes('KICK')&&kick[0].page.hasContent,'La página de Kick debe seguir respondiendo después del GC')
    assert.ok(events.some(event=>event.downloadState==='completed'&&event.bytes>0),'La descarga oficial de Bitwarden debe terminar')
    const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version
    await fs.writeFile(path.join(root,'artifacts/production-smoke.json'),JSON.stringify({passed:true,version,forcedGarbageCollections:3,kickResponsive:true,officialExtensionDownloaded:true},null,2))
  }
  console.log(JSON.stringify({productionVerify,kick,downloadCompleted:events.some(event=>event.downloadState==='completed')}))
  await call('Browser.close')
}finally{socket?.close();if(child.exitCode===null)child.kill()}
