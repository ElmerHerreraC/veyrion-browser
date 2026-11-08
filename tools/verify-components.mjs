import fs from 'node:fs/promises'
import path from 'node:path'
import {spawn} from 'node:child_process'
import assert from 'node:assert/strict'
import {root, braveExecutable} from './paths.mjs'

const profile = path.join(root, '.verify-profile', 'components-' + Date.now())
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
await fs.mkdir(profile, {recursive:true})
await fs.writeFile(path.join(profile, 'Local State'), JSON.stringify({brave:{widevine_opted_in:true}}))
const child = spawn(braveExecutable(), ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--enable-logging', '--v=1', `--log-file=${path.join(root,'artifacts/components-runtime-086.log')}`, 'chrome://components/'], {windowsHide:true, stdio:'ignore'})
let socket, sequence = 0
const pending = new Map()
const call = (method, params={}) => new Promise((resolve,reject) => {
  const id = ++sequence
  const timer = setTimeout(() => {pending.delete(id);reject(Error(method + ' timeout'))}, 20000)
  pending.set(id, message => {clearTimeout(timer);message.error?reject(Error(JSON.stringify(message.error))):resolve(message.result)})
  socket.send(JSON.stringify({id,method,params}))
})
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true})
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
try {
  let target
  for (let i=0;i<200;i++) {
    try {
      const port = Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0])
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type==='page')
      if (target) break
    } catch {}
    await delay(200)
  }
  assert.ok(target, 'Components test page must open')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve,reject) => {socket.onopen=resolve;socket.onerror=reject})
  socket.onmessage = event => {const m=JSON.parse(event.data),done=pending.get(m.id);if(done){pending.delete(m.id);done(m)}}
  await call('Page.navigate', {url:'chrome://components/'})
  await delay(1500)
  const read = `import('chrome://resources/js/cr.js').then(m=>m.sendWithPromise('requestComponentsData')).then(r=>r.components)`
  let components = []
  for (let i=0;i<100;i++) {components=await evaluate(read);if(components.some(c=>c.name.includes('Widevine')))break;await delay(300)}
  const requiredNames = ['CRLSet','File Type Policies','Widevine Content Decryption Module']
  const optionalNames = ['PKI Metadata','Crowd Deny','Certificate Error Assistant','Hyphenation','Safety Tips','Zxcvbn Data Dictionaries']
  const wanted = components.filter(c => [...requiredNames,...optionalNames].includes(c.name))
  assert.equal(wanted.filter(c=>requiredNames.includes(c.name)).length,3,'All three primary components must be registered')
  for (const c of wanted) await evaluate(`chrome.send('checkUpdate', [${JSON.stringify(c.id)}])`)
  let selected
  for (let i=0;i<180;i++) {
    components=await evaluate(read)
    selected=components.filter(c=>wanted.some(w=>w.id===c.id))
    if (selected.every(c=>c.version!=='0.0.0.0')) break
    if (i>=30 && selected.filter(c=>requiredNames.includes(c.name)).every(c=>c.version!=='0.0.0.0')) break
    if(i%10===0) console.log(JSON.stringify(selected))
    await delay(2000)
  }
  const passed=selected.filter(c=>requiredNames.includes(c.name)).every(c=>c.version!=='0.0.0.0')
  const report={passed,profile,components:selected,unavailable:components.filter(c=>c.version==='0.0.0.0').map(c=>({name:c.name,status:c.status}))}
  await fs.writeFile(path.join(root,'artifacts/component-verification-086.json'),JSON.stringify(report,null,2))
  assert.ok(passed,'Standard components must actually install, not merely return an update offer')
  console.log(JSON.stringify(report))
} finally {
  if(socket?.readyState===WebSocket.OPEN) {try{await call('Browser.close')}catch{}}
  socket?.close()
  if(child.exitCode===null) {await delay(1000);if(child.exitCode===null)child.kill()}
}
