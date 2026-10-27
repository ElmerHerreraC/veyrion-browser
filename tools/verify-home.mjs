import fs from 'node:fs/promises'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {createServer} from 'node:http'
import assert from 'node:assert/strict'
import {root,braveExecutable} from './paths.mjs'
const releaseVersion=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version, releaseTag=releaseVersion.replaceAll('.','')
const directory=path.join(root,'extension'),profile=path.join(root,'.verify-profile','home-'+Date.now())
await fs.mkdir(profile,{recursive:true})
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'}
const server=createServer(async(request,response)=>{try{const relative=decodeURIComponent(new URL(request.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';const file=path.resolve(directory,relative);if(!file.startsWith(directory+path.sep)){response.writeHead(403);response.end();return}response.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');response.end(await fs.readFile(file))}catch{response.writeHead(404);response.end()}})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const home=process.env.VEYRION_HOME_NATIVE==='1'?'chrome-extension://mnojpmjdmbbfmejpflffifhffcmidifd/veyrion_start/index.html':`http://127.0.0.1:${server.address().port}/index.html`
const child=spawn(braveExecutable(),['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check',home],{windowsHide:true,stdio:'ignore'})
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
let socket,id=0;const requests=new Map()
const cdp=(method,params={})=>new Promise((resolve,reject)=>{const current=++id,timer=setTimeout(()=>{requests.delete(current);reject(Error('Home test timeout: '+method))},20000);requests.set(current,message=>{clearTimeout(timer);message.error?reject(Error(JSON.stringify(message.error))):resolve(message.result)});socket.send(JSON.stringify({id:current,method,params}))})
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value}
async function until(expression){for(let i=0;i<150;i++){try{if(await evaluate(expression))return}catch{}await delay(100)}throw Error('Home condition failed: '+expression)}
try{
  let port,target
  for(let i=0;i<600;i++){try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);const list=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();target=list.find(t=>t.type==='page');if(target)break}catch{}await delay(100)}
  assert.ok(target)
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});socket.onmessage=event=>{const message=JSON.parse(event.data),resolve=requests.get(message.id);if(resolve){requests.delete(message.id);resolve(message)}}
  await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  await until('document.body.dataset.ready === "true" && document.body.dataset.wallpaperReady === "true" && document.querySelector("#shortcuts svg")')
  await until('document.body.dataset.homeExtrasReady === "true"')
  for(let i=0;i<150;i++){if(await evaluate('document.body.dataset.onboardingReady === "true"'))break;await delay(100)}
  assert.ok(await evaluate('document.body.dataset.onboardingReady === "true"'),'El asistente de perfil debe cargar');
  assert.equal(await evaluate("import('./app.js').then(module=>module.preferences().engine)"),'google','El inicio debe usar Google por defecto');
  assert.ok(await evaluate('!document.querySelector("footer").textContent.includes("ESPACIO PERSONAL")'));
  if(process.env.VEYRION_HOME_NATIVE==='1')assert.equal(await evaluate('document.querySelector("#profile-onboarding").open'),true,'El primer inicio debe ofrecer configurar el perfil');
  await evaluate('document.querySelector("#onboarding-done").click()');
  await until('!document.querySelector("#profile-onboarding").open');
  await evaluate('document.querySelector("#configure-profile").click()');
  assert.equal(await evaluate('document.querySelector("#profile-onboarding").open'),true,'El asistente debe poder reabrirse');
  await evaluate('document.querySelector("#onboarding-done").click()');
  await until('!document.querySelector("#profile-onboarding").open');
  if(process.env.VEYRION_HOME_NATIVE==='1'){
    await evaluate('new Promise(resolve=>chrome.history.addUrl({url:"https://recent.example.test/veyrion-fixture"},resolve))')
    await until('[...document.querySelectorAll("#recent-pages a")].some(anchor=>anchor.href === "https://recent.example.test/veyrion-fixture")')
    await evaluate('document.querySelector("#show-recent").click()')
    assert.equal(await evaluate('document.querySelector("#recent-pages").hidden'),true)
    await evaluate('document.querySelector("#show-recent").click()')
  }
  await evaluate('document.querySelector("#start-customize").click()')
  await until('[...document.querySelectorAll(".built-in-gallery img")].every(image=>image.complete&&image.naturalWidth>0)')
  for(const name of ['mountains','coast','planet','nebula']){
    await evaluate(`document.querySelector('[data-wallpaper-preset="${name}"]').click()`)
    assert.ok(await evaluate(`getComputedStyle(document.body,'::after').backgroundImage.includes('wallpapers/${name}.svg')`))
  }
  await evaluate('document.querySelector("#settings-dialog").close()')
  for(const file of ['onboarding.js','home.css','home-extras.js','live-wallpaper.js','index.html'])assert.equal(await evaluate(`fetch(new URL(${JSON.stringify(file)},location.href)).then(response=>response.text())`),await fs.readFile(path.join(directory,file),'utf8'),'El recurso probado debe coincidir con el código de la versión: '+file)
  await evaluate(`import('./app.js').then(module=>module.updatePreferences({tileSize:200}))`)
  assert.ok(await evaluate('document.querySelector(".shortcut").getBoundingClientRect().height >= 180'),'El tamaño elegido debe seguir modificando los accesos')
  await evaluate(`import('./app.js').then(module=>module.updatePreferences({tileSize:140}))`)
  await fs.writeFile(path.join(root,`artifacts/home-${releaseTag}.png`),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'))
  assert.ok(await evaluate('Math.abs(document.querySelector("main").getBoundingClientRect().x+document.querySelector("main").getBoundingClientRect().width/2-innerWidth/2)<2'))
  await cdp('Emulation.setDeviceMetricsOverride',{width:360,height:850,deviceScaleFactor:1,mobile:false})
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth+1'),'El inicio no debe desbordar horizontalmente a 360px')
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  const machine=JSON.parse(await fs.readFile(path.join(root,'config/build-machine.json'),'utf8'))
  const fixture=path.join(root,'artifacts/wallpaper-test.webm')
  await fs.copyFile(path.join(process.env.VEYRION_BUILD_ROOT||machine.buildRoot,'src/media/test/data/bear.webm'),fixture)
  await evaluate('document.querySelector("#start-customize").click()')
  const dom=await cdp('DOM.getDocument'),input=await cdp('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#live-wallpaper-input'})
  await cdp('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[fixture]})
  await until('document.querySelector("#media-wallpaper video")?.readyState >= 2')
  assert.ok(await evaluate('document.querySelector("#media-wallpaper video").muted'),'El fondo debe estar silenciado')
  await evaluate('document.querySelector("#pause-wallpaper").click()')
  assert.ok(await evaluate('document.querySelector("#media-wallpaper video").paused'),'La pausa manual debe funcionar')
  await cdp('Page.reload');await until('document.querySelector("#media-wallpaper video")?.readyState >= 2')
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await until('document.querySelector("#media-wallpaper video").paused')
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]})
  await until('!document.querySelector("#media-wallpaper video").paused')
  const before=await evaluate('document.querySelector("#media-wallpaper video").currentTime')
  await cdp('Target.createTarget',{url:'about:blank',background:false})
  await until('document.hidden && document.querySelector("#media-wallpaper video").paused')
  const pausedAt=await evaluate('document.querySelector("#media-wallpaper video").currentTime');await delay(250)
  assert.equal(await evaluate('document.querySelector("#media-wallpaper video").currentTime'),pausedAt,'No debe seguir reproduciéndose en una pestaña oculta')
  const report={passed:true,version:JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version,centered:true,narrowWidth:360,builtInWallpapers:4,recentPages:process.env.VEYRION_HOME_NATIVE==='1',localVideoPersisted:true,muted:true,manualPause:true,reducedMotion:true,hiddenTabPaused:true,positionBeforeHiding:before}
  await fs.writeFile(path.join(root,`artifacts/home-verification-${releaseTag}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{try{if(socket?.readyState===WebSocket.OPEN)await cdp('Browser.close')}catch{}socket?.close();server.close();if(child.exitCode===null)child.kill()}
