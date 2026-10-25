import fs from 'node:fs/promises'
import path from 'node:path'
import {spawn} from 'node:child_process'
import assert from 'node:assert/strict'
import {root,braveExecutable} from './paths.mjs'
const profile=path.join(root,'.verify-profile','private-'+Date.now()),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
await fs.mkdir(profile,{recursive:true})
const child=spawn(braveExecutable(),['--headless=new','--incognito','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','chrome://newtab/'],{windowsHide:true,stdio:'ignore'})
let socket,sequence=0;const pending=new Map()
const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Private test timeout: '+method))},15000);pending.set(id,message=>{clearTimeout(timer);message.error?reject(Error(JSON.stringify(message.error))):resolve(message.result)});socket.send(JSON.stringify({id,method,params}))})
try{
  let target
  for(let i=0;i<600;i++){try{const port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');if(target)break}catch{}await delay(100)}
  assert.ok(target,'Debe abrir una ventana privada de prueba')
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});socket.onmessage=event=>{const message=JSON.parse(event.data),resolve=pending.get(message.id);if(resolve){pending.delete(message.id);resolve(message)}}
  let branded=false
  for(let i=0;i<150;i++){const value=await cdp('Runtime.evaluate',{expression:'Boolean(document.querySelector(\'svg[aria-label="Veyrion"]\')?.textContent.includes("Veyrion"))',returnByValue:true});if(value.result.value){branded=true;break}await delay(100)}
  assert.ok(branded,'El inicio privado compartido con Tor debe mostrar la marca Veyrion')
  await fs.writeFile(path.join(root,'artifacts/private-branding-050.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'))
  try{await cdp('Browser.close')}catch{}
  for(let i=0;i<100&&child.exitCode===null;i++)await delay(100)
  assert.equal(child.exitCode,0,'La ventana privada debe cerrar limpiamente')
  const report={passed:true,privateBranding:'Veyrion',torNetworkNotModified:true,exitCode:child.exitCode}
  await fs.writeFile(path.join(root,'artifacts/private-verification-050.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{try{if(socket?.readyState===WebSocket.OPEN)await cdp('Browser.close')}catch{}socket?.close();if(child.exitCode===null)child.kill()}
