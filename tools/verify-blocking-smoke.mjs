import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createServer} from 'node:http'
import {root,braveExecutable} from './paths.mjs'

const profile=path.join(root,'.verify-profile','blocking-smoke-'+Date.now())
await fs.mkdir(profile,{recursive:true})
const results=new Map(),failures=[]
const server=createServer((request,response)=>{
  const url=new URL(request.url,'http://fixture')
  if(url.pathname==='/result')results.set(url.searchParams.get('kind'),url.searchParams.get('blocked'))
  response.setHeader('Content-Type','text/html')
  if(['/normal','/panel'].includes(url.pathname))response.end(`<html lang="en"><title>Blocking fixture</title><script>
    (async()=>{const allowed=await fetch('/allowed').then(r=>r.ok);const blocked=await fetch('http://veyrion-ad-test.ad.doubleclick.net:${server.address().port}/ad.js',{mode:'no-cors'}).then(()=>false,()=>true);await fetch('/result?kind=${url.pathname.slice(1)}&blocked='+Boolean(allowed&&blocked))})()
    </script><p>Hello world</p></html>`)
  else response.end('OK')
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const child=spawn(braveExecutable(),['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--no-proxy-server','--host-resolver-rules=MAP veyrion-control.invalid 127.0.0.1, MAP veyrion-ad-test.ad.doubleclick.net 127.0.0.1','chrome://newtab/'],{windowsHide:true,stdio:'ignore'})
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
let socket,id=0;const pending=new Map()
function cdp(method,params={}){return new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{pending.delete(key);reject(Error('Timeout: '+method))},15000);pending.set(key,message=>{clearTimeout(timer);message.error?reject(Error(JSON.stringify(message.error))):resolve(message.result)});socket.send(JSON.stringify({id:key,method,params}))})}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
async function until(check,attempts=120){for(let i=0;i<attempts;i++){if(child.exitCode!==null)throw Error('Browser exited: '+child.exitCode);try{const value=await check();if(value)return value}catch{}await delay(500)}throw Error('Condition timed out')}
try{
  const port=await until(async()=>Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]))
  const target=await until(async()=>(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page'))
  socket=new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
  socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.method==='Network.loadingFailed')failures.push(message.params.errorText);const done=pending.get(message.id);if(done){pending.delete(message.id);done(message)}}
  await cdp('Page.enable');await cdp('Network.enable')
  const home=await until(()=>evaluate('location.href.startsWith("chrome-extension://")&&document.body?.dataset.ready==="true"&&location.href'))
  await cdp('Page.navigate',{url:'chrome://settings/shields/filters'})
  const subscriptions=await until(async()=>{
    const rows=await evaluate("import('chrome://resources/js/cr.js').then(({sendWithPromise})=>sendWithPromise('brave_adblock.getListSubscriptions'))")
    return rows.length===4&&rows.every(row=>row.enabled&&row.last_successful_update_attempt>0)?rows:false
  })
  await cdp('Page.navigate',{url:`http://veyrion-control.invalid:${server.address().port}/normal`})
  await until(()=>results.has('normal'));assert.equal(results.get('normal'),'true')
  assert.ok(failures.includes('net::ERR_BLOCKED_BY_CLIENT'))
  await cdp('Page.navigate',{url:home})
  await until(()=>evaluate('Boolean(chrome.braveTheme?.setVeyrionPanel)&&document.body?.dataset.ready==="true"'))
  const panel=`http://veyrion-control.invalid:${server.address().port}/panel`
  await evaluate(`new Promise(resolve=>chrome.braveTheme.setVeyrionPanel('open',${JSON.stringify(panel)},360,false,resolve))`)
  await until(()=>results.has('panel'));assert.equal(results.get('panel'),'true')
  await evaluate(`new Promise(resolve=>chrome.braveTheme.setVeyrionPanel('close',${JSON.stringify(panel)},360,false,resolve))`)
  await cdp('Browser.close');await delay(1000)
  const report={passed:true,subscriptions:subscriptions.map(r=>({url:r.subscription_url,downloaded:true})),normalTabBlocked:true,sidebarBlocked:true,ordinaryResourcesAllowed:true,cleanExit:child.exitCode===0}
  assert.ok(report.cleanExit)
  await fs.writeFile(path.join(root,'artifacts/blocking-smoke-083.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{if(socket?.readyState===WebSocket.OPEN){try{await cdp('Browser.close')}catch{}socket.close()}if(child.exitCode===null)child.kill();server.close()}
