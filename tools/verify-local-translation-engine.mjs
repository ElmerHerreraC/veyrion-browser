import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createServer} from 'node:http'
import {root,braveExecutable} from './paths.mjs'
const directory=path.join(root,'extension/translation')
const profile=path.join(root,'.verify-profile','translation-engine-'+Date.now())
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://fixture')
    if(url.pathname==='/'){
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'")
      res.setHeader('Content-Type','text/html');res.end('<html lang="en"><title>Local translation fixture</title><body><h1>Hello world</h1><p id="ordinary">This browser translates offline.</p><input value="Keep my input"><p translate="no">Do not translate.</p><script type="module" src="/test.js"></script></body></html>');return
    }
    if(url.pathname==='/test.js'){
      res.setHeader('Content-Type','application/javascript');res.end(`import {createLocalTranslator} from '/translation/engine.js';window.result=(async()=>{const engine=createLocalTranslator();try{
const a=await engine.translate({from:'en',to:'es',text:'Hello world. This browser translates offline.',html:false});
const b=await engine.translate({from:'es',to:'en',text:'Buenos días. Este navegador traduce sin conexión.',html:false});
let handler,finished;const completion=new Promise(r=>finished=r);
chrome.runtime={id:'fixture',onMessage:{addListener:fn=>handler=fn},sendMessage:(m,reply)=>{
 if(m.type==='veyrion-translate-finish'){reply({ok:true});finished(m.success);return}
 Promise.all(m.texts.map(text=>engine.translate({from:'en',to:'es',text,html:false}))).then(rows=>reply({texts:rows.map(r=>r.target.text)}));
}};
await import('/translation/content.js');
const request={type:'veyrion-native-translate',action:'translate',requestId:'fixture-request',from:'en',to:'es'};
handler(request,{id:'fixture'},()=>{});if(!await completion)throw Error('Content translation failed');
const translated=document.querySelector('h1').textContent;
const preserved=document.querySelector('input').value==='Keep my input'&&document.querySelector('[translate=no]').textContent==='Do not translate.';
document.querySelector('#ordinary').textContent='Application changed this text.';
handler({...request,action:'revert'},{id:'fixture'},()=>{});
const restored=document.querySelector('h1').textContent==='Hello world'&&document.documentElement.lang==='en';
const applicationChangePreserved=document.querySelector('#ordinary').textContent==='Application changed this text.';
return {englishToSpanish:a.target.text,spanishToEnglish:b.target.text,contentTranslated:translated,contentRestored:restored,formAndExcludedPreserved:preserved,applicationChangePreserved};
}catch(e){return {error:e.stack||String(e)}}finally{engine.delete()}})()`);return
    }
    if(!url.pathname.startsWith('/translation/')){res.writeHead(404);res.end();return}
    const file=path.resolve(directory,'.'+url.pathname.slice('/translation'.length))
    assert.ok(file.startsWith(directory+path.sep))
    res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'application/javascript':'application/octet-stream')
    res.end(await fs.readFile(file))
  }catch{res.writeHead(404);res.end()}
})
await new Promise(r=>server.listen(0,'127.0.0.1',r));await fs.mkdir(profile,{recursive:true})
const child=spawn(braveExecutable(),['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--proxy-server=http://127.0.0.1:9','--proxy-bypass-list=localhost;127.0.0.1',`http://127.0.0.1:${server.address().port}/`],{windowsHide:true,stdio:'ignore'})
const delay=ms=>new Promise(r=>setTimeout(r,ms));let socket,id=0;const pending=new Map()
const cdp=(method,params={})=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>reject(Error(method+' timeout')),120000);pending.set(key,m=>{clearTimeout(timer);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result)});socket.send(JSON.stringify({id:key,method,params}))})
try{
  let target
  for(let i=0;i<150&&!target;i++){try{const port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page')}catch{}if(!target)await delay(200)}
  assert.ok(target);socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j});socket.onmessage=e=>{const m=JSON.parse(e.data);pending.get(m.id)?.(m);pending.delete(m.id)}
  let response
  for(let i=0;i<100;i++){response=await cdp('Runtime.evaluate',{expression:'window.result',awaitPromise:true,returnByValue:true});if(response.result?.value)break;await delay(200)}
  const result=response.result?.value;assert.ok(result);assert.ok(!result.error,result.error)
  assert.match(result.englishToSpanish,/mundo/i);assert.match(result.spanishToEnglish,/browser/i)
  assert.match(result.contentTranslated,/mundo/i);assert.ok(result.contentRestored);assert.ok(result.formAndExcludedPreserved);assert.ok(result.applicationChangePreserved)
  const report={passed:true,internetBlocked:true,strictCsp:true,...result}
  await fs.writeFile(path.join(root,'artifacts/local-translation-engine-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))
  await cdp('Browser.close')
}finally{socket?.close();if(child.exitCode===null){await delay(1000);if(child.exitCode===null)child.kill()}server.close()}
