import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createServer} from 'node:http'
import {root,braveExecutable} from './paths.mjs'
const events=[],mainNavigations=[],profile=path.join(root,'.verify-profile','panel-resize-'+Date.now())
const liveMain=process.env.VEYRION_TEST_MAIN_URL
const server=createServer((req,res)=>{
  const u=new URL(req.url,'http://fixture')
  if(u.pathname==='/event'){events.push(Object.fromEntries(u.searchParams));res.end('OK');return}
  res.setHeader('Content-Type','text/html');res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><title>Panel resize fixture</title><input value="Keep this draft"><script>const id=crypto.randomUUID();const report=kind=>fetch('/event?kind='+kind+'&id='+id+'&page='+location.pathname+'&visibility='+document.visibilityState+'&width='+innerWidth);report('load');addEventListener('resize',()=>report('resize'));addEventListener('visibilitychange',()=>report('visibility'));</script>`)
})
await new Promise(r=>server.listen(0,'127.0.0.1',r));await fs.mkdir(profile,{recursive:true})
const child=spawn(braveExecutable(),['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--no-proxy-server','chrome://newtab/'],{windowsHide:true,stdio:'ignore'})
const delay=ms=>new Promise(r=>setTimeout(r,ms));let socket,id=0;const pending=new Map()
function cdp(method,params={},sessionId){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>reject(Error(method+' timeout')),15000);pending.set(key,m=>{clearTimeout(timer);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result)});socket.send(JSON.stringify({id:key,method,params,...(sessionId?{sessionId}:{})}))})}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
async function until(check){for(let i=0;i<100;i++){const r=await check();if(r)return r;await delay(200)}throw Error('Panel condition timed out')}
try{
  const port=await until(async()=>{try{return Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0])}catch{return false}})
  const target=await until(async()=>(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page'))
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j});socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Page.frameNavigated'&&!m.params.frame.parentId)mainNavigations.push(m.params.frame.loaderId);pending.get(m.id)?.(m);pending.delete(m.id)}
  await until(()=>evaluate('Boolean(chrome.braveTheme?.setVeyrionPanel)&&document.body?.dataset.ready==="true"'))
  const main=await cdp('Target.createTarget',{url:liveMain||`http://127.0.0.1:${server.address().port}/main`})
  let mainSession,mainLoader,mainTitle
  if(liveMain){
    mainSession=(await cdp('Target.attachToTarget',{targetId:main.targetId,flatten:true})).sessionId
    await cdp('Page.enable',{},mainSession);await delay(12000)
    mainLoader=(await cdp('Page.getFrameTree',{},mainSession)).frameTree.frame.loaderId
    mainTitle=(await cdp('Runtime.evaluate',{expression:'document.title',returnByValue:true},mainSession)).result.value
    mainNavigations.length=0
  }else await until(()=>events.some(e=>e.page==='/main'&&e.kind==='load'))
  const panel=`http://127.0.0.1:${server.address().port}/panel`
  const resize=width=>evaluate(`new Promise(r=>chrome.braveTheme.setVeyrionPanel('resize',${JSON.stringify(panel)},${width},false,r))`)
  await evaluate(`new Promise(r=>chrome.braveTheme.setVeyrionPanel('open',${JSON.stringify(panel)},360,${process.env.VEYRION_TEST_MOBILE === '1'},r))`)
  await until(()=>events.some(e=>e.page==='/panel'&&e.kind==='load'))
  const targets=await cdp('Target.getTargets')
  const panelTarget=targets.targetInfos.find(t=>t.type==='page'&&t.url===panel)
  assert.ok(panelTarget,'The live panel must have a native tab target')
  await cdp('Target.activateTarget',{targetId:panelTarget.targetId})
  for(const width of [520,300,640,360]){const count=events.length;await resize(width);await until(()=>events.length>count)}
  for(const page of (liveMain?['/panel']:['/main','/panel'])){
    assert.equal(events.filter(e=>e.page===page&&e.kind==='load').length,1,'Resize must not reload '+page)
    assert.equal(new Set(events.filter(e=>e.page===page).map(e=>e.id)).size,1,'Resize must preserve '+page)
  }
  if(liveMain){await delay(2000);assert.equal((await cdp('Page.getFrameTree',{},mainSession)).frameTree.frame.loaderId,mainLoader);assert.equal(mainNavigations.length,0,'The normal page navigated during resizing')}
  const report={passed:true,mainTitle,liveMain:Boolean(liveMain),mobile:process.env.VEYRION_TEST_MOBILE === '1',mainVisibility:events.filter(e=>e.page === '/main').at(-1)?.visibility,widthChanges:4,panelLoads:1,mainLoads:1,sameDocuments:true,observedWidths:[...new Set(events.map(e=>Number(e.width)))]}
  await fs.writeFile(path.join(root,'artifacts/panel-resize-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await cdp('Browser.close')
}finally{if(socket?.readyState===WebSocket.OPEN){try{await cdp('Browser.close')}catch{}}socket?.close();if(child.exitCode===null){await delay(500);if(child.exitCode===null)child.kill()}server.close()}
