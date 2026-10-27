import fs from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {spawn} from 'node:child_process'
import assert from 'node:assert/strict'
import {root,braveExecutable} from './paths.mjs'

const releaseVersion=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version
const profile=path.join(root,'.verify-profile','pip-'+Date.now())
await fs.mkdir(path.join(profile,'Default'),{recursive:true})
await fs.writeFile(path.join(profile,'Default/Preferences'),JSON.stringify({profile:{default_content_setting_values:{auto_picture_in_picture:1}}}))
const machine=JSON.parse(await fs.readFile(path.join(root,'config/build-machine.json'),'utf8'))
const video=pathToFileURL(path.join(process.env.VEYRION_BUILD_ROOT||machine.buildRoot,'src/media/test/data/bear.webm')).href
const fixture=path.join(profile,'video.html')
await fs.writeFile(fixture,`<!doctype html><meta charset="utf-8"><title>Veyrion · Prueba de minirreproductor</title><body style="background:#12151f;color:white;font:20px Segoe UI"><h1>Prueba de vídeo local</h1><video id="video" controls preload="auto" loop width="800" src="${video}"></video>`)
const child=spawn(braveExecutable(),['--disable-features=CalculateNativeWinOcclusion','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--window-size=1100,850',pathToFileURL(fixture).href],{windowsHide:false,stdio:'ignore'})
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
let socket,id=0;const requests=new Map()
const cdp=(method,params={})=>new Promise((resolve,reject)=>{const current=++id,timer=setTimeout(()=>reject(Error('PiP timeout: '+method)),20000);requests.set(current,message=>{clearTimeout(timer);message.error?reject(Error(JSON.stringify(message.error))):resolve(message.result)});socket.send(JSON.stringify({id:current,method,params}))})
async function evaluate(expression){const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value}
async function until(expression){for(let i=0;i<150;i++){try{if(await evaluate(expression))return}catch{}await delay(100)}throw Error('PiP condition: '+expression)}
try{
  let target,port
  for(let i=0;i<600;i++){try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page'&&t.url.includes('video.html'));if(target)break}catch{}await delay(100)}
  assert.ok(target,'Debe abrirse la página de vídeo de prueba')
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});socket.onmessage=event=>{const value=JSON.parse(event.data),resolve=requests.get(value.id);if(resolve){requests.delete(value.id);resolve(value)}}
  await cdp('Page.enable');const {windowId}=await cdp('Browser.getWindowForTarget',{targetId:target.id});await cdp('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});await cdp('Page.bringToFront');await until('!document.hidden')
  await until('Boolean(document.querySelector("video"))')
  await evaluate('document.querySelector("video").play().then(()=>true)')
  await until('document.querySelector("video")?.readyState>=2')
  await delay(2000)
  await cdp('Target.createTarget',{url:'about:blank',background:false})
  await until('document.pictureInPictureElement === document.querySelector("video")')
  assert.equal(await evaluate('document.hidden'),true)
  assert.equal(await evaluate('document.querySelector("video").paused'),false)
  if(process.env.VEYRION_PIP_HOLD==='1'){
    console.log('PIP GUI READY: '+path.join(profile,'continue'))
    for(let i=0;i<240;i++){try{await fs.access(path.join(profile,'continue'));break}catch{}await delay(500)}
  }
  await cdp('Page.bringToFront')
  await until('!document.pictureInPictureElement')
  // Closing the native floating window must not be needed to return to the tab.
  const report={passed:true,version:releaseVersion,nativeOcclusionSuppressedForTest:true,automaticOnTabSwitch:true,videoContinuesPlaying:true,returnsToTab:true,testProfile:profile}
  await fs.writeFile(path.join(root,`artifacts/pip-verification-${releaseVersion.replaceAll('.','')}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}catch(error){if(socket?.readyState===WebSocket.OPEN){try{console.log('VIDEO DIAGNOSTIC',JSON.stringify(await evaluate('({url:location.href,src:document.querySelector("video")?.currentSrc,error:document.querySelector("video")?.error?.message,ready:document.querySelector("video")?.readyState,hidden:document.hidden,network:document.querySelector("video")?.networkState})')))}catch{}}throw error}finally{try{if(socket?.readyState===WebSocket.OPEN)await cdp('Browser.close')}catch{}socket?.close();if(child.exitCode===null)child.kill()}
