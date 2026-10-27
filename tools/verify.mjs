import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createServer as createTlsServer } from 'node:https'
import {inflateSync} from 'node:zlib'
import { root, braveExecutable } from './paths.mjs'
const profile = path.join(root, '.verify-profile', String(Date.now()))
const executable = braveExecutable()
const native = process.env.VEYRION_NATIVE_VERIFY === '1' || path.basename(executable).toLowerCase() === 'veyrion.exe'
const testExtensions = process.env.VEYRION_TEST_EXTENSIONS === '1'
const releaseVersion = JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version
const loadExtensions = [...(!native ? [path.join(root, 'extension')] : []), ...(testExtensions ? [path.join(root, 'tests/fixture-extension')] : [])]
await fs.mkdir(profile, { recursive: true })
if(native){await fs.mkdir(path.join(profile,'Default'),{recursive:true});await fs.writeFile(path.join(profile,'Local State'),JSON.stringify({brave:{ad_block:{custom_filters:'/veyrion-ad-fixture.js^'}}}))}
await fs.mkdir(path.join(root, 'artifacts'), { recursive: true })
const child = spawn(executable, [
  ...(process.env.VEYRION_WINDOWED_VERIFY === '1' ? ['--window-size=1500,1000'] : ['--headless=new']), '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  ...(loadExtensions.length ? [`--load-extension=${loadExtensions.join(',')}`] : []), '--no-first-run', '--no-default-browser-check', 'brave://newtab/'
], { stdio: ['ignore','ignore','pipe'], windowsHide: process.env.VEYRION_WINDOWED_VERIFY !== '1' })
child.stderr.on('data', data => { fs.appendFile(path.join(root,'artifacts/native-runtime-stderr.log'),data).catch(()=>{}) })
child.on('exit', (code,signal) => { if(process.env.VEYRION_VERIFY_TRACE==='1') console.log('BROWSER EXIT',code,signal) })
child.on('error', error => console.error(error.message))
let socket
let tlsServer
let dragServiceOrder
let sequence = 0
const pending = new Map()
const testServer = createServer((request, response) => {
  if (request.url === '/check.js') {
    response.writeHead(200, { 'content-type': 'text/javascript' })
    response.end('document.body.dataset.executed="yes"')
  } else {
    response.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': "default-src 'self'; script-src 'self'" })
    response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veyrion navigation check</title><body>Navigation works<p><label>Entrada de prueba <input id="test-input" placeholder="Prueba de foco del panel"></label></p><script src="/check.js"></script>')
  }
})
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method + ' ' + String(params.expression || '').slice(0,180))) }, 15000)
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value) }, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  if (process.env.VEYRION_VERIFY_TRACE === '1') console.log('VERIFY', expression.slice(0,180))
  const response = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails))
  return response.result.value
}
try {
  let port
  for (let i = 0; i < 600; i++) {
    if(child.exitCode!==null)throw new Error('El binario de prueba terminó antes de iniciar DevTools: '+child.exitCode)
    try { port = Number((await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break } catch { await delay(100) }
  }
  assert.ok(port, 'Veyrion debe iniciar el depurador con el perfil de pruebas')
  let target
  for(let i=0;i<150;i++) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    target = targets.find(item => item.type === 'page')
    if(target)break
    if(child.exitCode!==null)throw new Error('Veyrion terminó antes de abrir la pestaña de prueba: '+child.exitCode)
    await delay(100)
  }
  assert.ok(target, 'Debe existir una pestaña')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onmessage = event => {
    const result = JSON.parse(event.data)
    const request = pending.get(result.id)
    if (request) { pending.delete(result.id); result.error ? request.reject(new Error(JSON.stringify(result.error))) : request.resolve(result.result) }
  }
  await cdp('Page.enable')
  if(process.env.VEYRION_WINDOWED_VERIFY==='1')await cdp('Page.bringToFront')
  if(process.env.VEYRION_WINDOWED_VERIFY!=='1')await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  let ready = false
  for (let i = 0; i < 100; i++) {
    ready = await evaluate('document.body?.dataset.ready === "true" && document.body?.dataset.customizationReady === "true" && document.body?.dataset.unifiedReady === "true"')
    if (ready) break
    await delay(100)
  }
  assert.ok(ready, 'La extensión debe reemplazar la nueva pestaña y cargar sus módulos')
  for(let i=0;i<150;i++){if(await evaluate('document.body.dataset.onboardingReady === "true"'))break;await delay(100)}
  assert.ok(await evaluate('document.body.dataset.onboardingReady === "true"'),'El asistente de perfil debe cargar');
  assert.ok(await evaluate('!document.querySelector("footer").textContent.includes("ESPACIO PERSONAL")'));
  await evaluate('document.querySelector("#onboarding-done").click()');

  for(const width of (process.env.VEYRION_WINDOWED_VERIFY==='1'?[null]:[1920,1440])){
    if(width)await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false})
    const alignment=await evaluate(`(()=>{const rect=document.querySelector('main').getBoundingClientRect();return Math.abs(rect.x+rect.width/2-innerWidth/2)})()`)
    assert.ok(alignment<2,'El contenido debe estar centrado también en pantallas anchas')
  }
  if (native) {
    let initialized=false
    for(let i=0;i<100;i++){
      initialized=await evaluate(`new Promise(resolve=>chrome.braveTheme.getVeyrionChrome(json=>resolve(JSON.parse(json).initialized)))`)
      if(initialized)break
      await delay(100)
    }
    assert.ok(initialized,'La inicialización de apariencia debe completarse antes de cambiar ajustes')
    assert.equal(await evaluate('fetch(new URL("update-config.json",location.href)).then(response=>response.json()).then(config=>config.version)'),releaseVersion,'El binario debe incorporar los recursos de la versión actual')
    const automatic = await evaluate(`new Promise(resolve => chrome.alarms.get('veyrion-updates', alarm => resolve(alarm?.periodInMinutes)))`)
    assert.equal(automatic, 360, 'La comprobación automática debe estar programada cada seis horas')
    assert.ok(await evaluate('Boolean(globalThis.VeyrionUpdates?.verifyManifest)'), 'El inicio debe incluir verificación de firmas de actualización')
    assert.ok(await evaluate('typeof chrome.braveTheme?.setVeyrionColor === "function"'), 'El inicio debe poder cambiar el tema nativo')
    const color = await evaluate(`new Promise((resolve, reject) => chrome.braveTheme.setVeyrionColor(105,233,224, color => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve(color)))`)
    assert.equal(color, 0x69e9e0, 'El color debe aplicarse al servicio nativo de temas')
    const invalid = await evaluate(`new Promise(resolve => chrome.braveTheme.setVeyrionColor(-1,256,0, () => resolve(Boolean(chrome.runtime.lastError))))`)
    assert.equal(invalid, true, 'El puente nativo debe rechazar colores fuera de rango')
    for (const mode of ['light','system','dark']) {
      await evaluate(`new Promise((resolve,reject)=>chrome.braveTheme.setVeyrionChrome('${mode}',22,4,false,()=>chrome.runtime.lastError?reject(new Error(chrome.runtime.lastError.message)):resolve()))`)
      const appearance = JSON.parse(await evaluate(`new Promise(resolve=>chrome.braveTheme.getVeyrionChrome(resolve))`))
      assert.equal(appearance.mode,mode)
      assert.equal(appearance.size,22)
      assert.ok(!appearance.items.some(item=>item.id==='builtin:4'),'La lista de lectura no debe aparecer en la barra')
      assert.ok(!appearance.items.some(item=>item.id==='builtin:1'),'La barra no debe imponer el servicio de llamadas de Brave')
    }
    const appearance = JSON.parse(await evaluate(`new Promise(resolve=>chrome.braveTheme.getVeyrionChrome(resolve))`))
    const item = appearance.items[0]
    assert.ok(item,'La barra debe contener iconos configurables')
    for(const [action,value] of [['hide',''],['icon','star'],['show',''],['icon','default']]) {
      await evaluate(`new Promise((resolve,reject)=>chrome.braveTheme.manageVeyrionIcon('${action}',${item.index},'${value}',()=>chrome.runtime.lastError?reject(new Error(chrome.runtime.lastError.message)):resolve()))`)
      const updated=JSON.parse(await evaluate(`new Promise(resolve=>chrome.braveTheme.getVeyrionChrome(resolve))`)).items.find(icon=>icon.id===item.id)
      if(action==='hide'||action==='show')assert.equal(updated.visible,action==='show')
      else assert.equal(updated.icon,value)
    }
  }
  if (testExtensions) {
    let worker
    for (let i = 0; i < 100; i++) {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      worker = list.find(item => item.type === 'service_worker' && item.url.endsWith('/verification-worker.js'))
      if (worker) break
      await delay(100)
    }
    assert.ok(worker, 'Debe instalar y ejecutar una extensión MV3 independiente')
    const workerSocket = new WebSocket(worker.webSocketDebuggerUrl)
    try {
      await new Promise((resolve, reject) => { workerSocket.onopen = resolve; workerSocket.onerror = reject })
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('No respondió la extensión de prueba')), 10000)
        workerSocket.onmessage = event => { const message = JSON.parse(event.data); if (message.id === 1) { clearTimeout(timer); resolve(message) } }
        workerSocket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'chrome.runtime.getManifest().name + ":" + globalThis.veyrionVerification', returnByValue: true } }))
      })
      assert.equal(result.result?.result?.value, 'Veyrion Extension Verification:loaded')
    } finally { workerSocket.close() }
  }
  const url = await evaluate('location.href')
  assert.match(url, /^chrome-extension:\/\//)
  assert.equal(await evaluate('document.querySelectorAll(".shortcut").length'), 4)
  assert.equal(await evaluate('document.title'), 'Veyrion · Nueva pestaña')
  assert.ok(await evaluate('document.body.dataset.customizationReady === "true"'))
  await evaluate('document.querySelector("#customize").click(); document.querySelector("[data-panel=mods]").click(); document.querySelector("[data-preset=terminal]").click()')
  assert.equal(await evaluate('document.body.dataset.effect'), 'scanlines')
  assert.equal(await evaluate('document.querySelector("[data-setting=soundPack]").value'), 'arcade')
  if(process.env.VEYRION_VERIFY_TRACE==='1')console.log('NOTES BEFORE',await evaluate(`(()=>{window.noteEvents=[];const input=document.querySelector('[data-setting=showNotes]');for(const type of ['click','input','change'])input.addEventListener(type,event=>window.noteEvents.push({type,checked:input.checked,prevented:event.defaultPrevented}),true);return {checked:input.checked,disabled:input.disabled,open:document.querySelector('#settings-dialog').open}})()`))
  await evaluate('document.querySelector("[data-panel=layout]").click(); document.querySelector("[data-setting=showNotes]").click()')
  if(process.env.VEYRION_VERIFY_TRACE==='1')console.log('NOTES DEBUG',await evaluate(`import('./app.js').then(m=>({checked:document.querySelector('[data-setting=showNotes]').checked,preference:m.preferences().showNotes,hidden:document.querySelector('.notes-card').hidden,unified:document.body.dataset.unifiedReady,events:window.noteEvents}))`))
  assert.equal(await evaluate('document.querySelector(".notes-card").hidden'), true)
  await evaluate('document.querySelector("[data-setting=showNotes]").click(); document.querySelector("[data-setting=density]").value="compact"; document.querySelector("[data-setting=density]").dispatchEvent(new Event("change"))')
  assert.equal(await evaluate('document.body.dataset.density'), 'compact')
  await evaluate(`(() => { const transfer = new DataTransfer(); transfer.items.add(new File([JSON.stringify({format:'veyrion-mod',version:1,settings:{accent:'rose',effect:'vignette',customColor:'javascript:alert(1)',volume:900}})], 'test.json', {type:'application/json'})); const input=document.querySelector('#import-mod'); input.files=transfer.files; input.dispatchEvent(new Event('change')); })()`)
  await delay(200)
  assert.equal(await evaluate('document.body.dataset.effect'), 'vignette')
  assert.equal(await evaluate('document.querySelector("[data-setting=volume]").value'), '100')
  await evaluate('document.querySelector("#reset-look").click(); document.querySelector("[data-panel=visual]").click()')
  const panelShot = await cdp('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(path.join(root, 'artifacts/customization.png'), Buffer.from(panelShot.data, 'base64'))
  await evaluate('document.querySelector("#settings-dialog").close()')
  await evaluate('document.querySelector("#customize").click(); document.querySelector("[data-accent=cyan]").click()')
  assert.equal(await evaluate('document.querySelector("[data-accent=cyan]").getAttribute("aria-pressed")'), 'true')
  await evaluate('document.querySelector("#settings-dialog").close(); document.querySelector("#notes").value="Prueba de persistencia"; document.querySelector("#notes").dispatchEvent(new Event("input"))')
  await delay(650)
  if(process.env.VEYRION_VERIFY_TRACE==='1')console.log('COLOR BEFORE RELOAD',await evaluate(`Promise.all([import('./app.js').then(m=>({accent:m.preferences().accent,custom:m.preferences().useCustomColor,hex:m.preferences().customColor})),new Promise(resolve=>chrome.braveTheme.getVeyrionChrome(resolve))])`))
  const previousDocument=await evaluate('performance.timeOrigin')
  await cdp('Page.reload')
  for(let i=0;i<100;i++){
    try{if(await evaluate(`performance.timeOrigin !== ${previousDocument} && document.body?.dataset.ready === "true" && document.body?.dataset.customizationReady === "true" && document.body?.dataset.unifiedReady === "true"`))break}catch{}
    await delay(100)
  }
  if(process.env.VEYRION_VERIFY_TRACE==='1')console.log('COLOR AFTER RELOAD',await evaluate(`Promise.all([import('./app.js').then(m=>({accent:m.preferences().accent,custom:m.preferences().useCustomColor,hex:m.preferences().customColor})),new Promise(resolve=>chrome.braveTheme.getVeyrionChrome(resolve))])`))
  assert.equal(await evaluate('document.querySelector("#notes").value'), 'Prueba de persistencia')
  for(let i=0;i<100;i++){
    if(await evaluate('document.querySelector("[data-accent=cyan]").getAttribute("aria-pressed") === "true"'))break
    await delay(100)
  }
  assert.equal(await evaluate('document.querySelector("[data-accent=cyan]").getAttribute("aria-pressed")'), 'true')
  await evaluate('document.querySelector("#add-link").click(); document.querySelector("#link-title").value="Ejemplo"; document.querySelector("#link-url").value="https://example.com/"; document.querySelector("#link-form").requestSubmit()')
  assert.equal(await evaluate('document.querySelectorAll(".shortcut").length'), 5)
  await evaluate('document.querySelector(".shortcut:last-child .remove").click()')
  assert.equal(await evaluate('document.querySelectorAll(".shortcut").length'), 4)
  await evaluate('document.querySelector("#notes").value="Construir algo que valga la pena.\\nUna pestaña a la vez."; document.querySelector("[data-accent=violet]").click()')
  const screenshot = await cdp('Page.captureScreenshot', { format: 'png' })
  await fs.writeFile(path.join(root, 'artifacts/preview.png'), Buffer.from(screenshot.data, 'base64'))
  await new Promise(resolve => testServer.listen(0, '127.0.0.1', resolve))
  let testedPanelUrl
  if (native) {
    testedPanelUrl = `http://127.0.0.1:${testServer.address().port}/panel-check`
    const panelCall = (action, width, mobile) => evaluate(`new Promise((resolve,reject)=>chrome.braveTheme.setVeyrionPanel(${JSON.stringify(action)},${JSON.stringify(testedPanelUrl)},${width},${mobile},value=>chrome.runtime.lastError?reject(new Error(chrome.runtime.lastError.message)):resolve(value)))`)
    const rejected = await evaluate(`new Promise(resolve=>chrome.braveTheme.setVeyrionPanel('add','javascript:alert(1)',360,false,()=>resolve(Boolean(chrome.runtime.lastError))))`)
    assert.equal(rejected, true, 'Los paneles deben rechazar esquemas ejecutables')
    await panelCall('add',360,true)
    await panelCall('open',360,true)
    if(process.env.VEYRION_WINDOWED_VERIFY==='1'){
      await cdp('Page.bringToFront')
      await cdp('Page.captureScreenshot',{format:'png'})
    }
    let panelTarget
    for (let i=0;i<100;i++) {
      panelTarget=(await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(item=>item.type==='page' && item.url===testedPanelUrl)
      if(panelTarget)break
      await delay(100)
    }
    assert.ok(panelTarget,'Una página arbitraria debe abrirse en el panel nativo')
    if(process.env.VEYRION_VERIFY_TRACE==='1') console.log('PANEL TARGET',JSON.stringify(panelTarget))
    const panelSocket=new WebSocket(panelTarget.webSocketDebuggerUrl)
    await new Promise((resolve,reject)=>{panelSocket.onopen=resolve;panelSocket.onerror=reject})
    let panelSequence=0
    const panelRequests=new Map()
    panelSocket.onmessage=event=>{const message=JSON.parse(event.data);const resolve=panelRequests.get(message.id);if(resolve){panelRequests.delete(message.id);resolve(message)}}
    const panelCdp=(method,params={})=>new Promise((resolve,reject)=>{
      const id=++panelSequence
      const timer=setTimeout(()=>{panelRequests.delete(id);reject(new Error('Panel runtime timeout'))},15000)
      panelRequests.set(id,message=>{clearTimeout(timer);message.error||message.result?.exceptionDetails?reject(new Error(JSON.stringify(message))):resolve(message.result)})
      panelSocket.send(JSON.stringify({id,method,params}))
    })
    const panelEvaluate=async expression=>(await panelCdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value
    const panelPixelWidth=async()=>Buffer.from((await panelCdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64').readUInt32BE(16)
    try {
      let mobile=false
      for(let i=0;i<100;i++){
        try{mobile=await panelEvaluate('/Mobile/.test(navigator.userAgent) && document.body?.dataset.executed === "yes"')}catch{}
        if(mobile)break
        await delay(100)
      }
      assert.ok(mobile,'La vista móvil debe enviar un agente móvil y cargar la página')
      let adBlocked=false;
      for(let attempt=0;attempt<80;attempt++){adBlocked=await panelEvaluate("fetch('/veyrion-ad-fixture.js?attempt="+attempt+"',{cache:'no-store'}).then(()=>false,()=>true)");if(adBlocked)break;await delay(250)}
      assert.equal(adBlocked,true,'El motor de bloqueo debe proteger las solicitudes del panel lateral');
      assert.equal(await panelEvaluate("fetch('/allowed-panel-resource').then(r=>r.ok)"),true,'El panel debe permitir solicitudes normales');
      await panelEvaluate('globalThis.veyrionPanelContinuity = "kept"; document.querySelector("#test-input").value="Texto sin perder"; true')
      const temporaryTab=await evaluate('chrome.tabs.create({url:"about:blank",active:true}).then(tab=>tab.id)')
      await delay(350)
      await cdp('Page.bringToFront')
      await delay(350)
      assert.equal(await panelEvaluate('globalThis.veyrionPanelContinuity'), 'kept','Cambiar de pestaña debe conservar el mismo documento lateral')
      assert.equal(await panelEvaluate('document.querySelector("#test-input").value'),'Texto sin perder','El panel debe conservar el texto al cambiar de pestaña')
      assert.ok((await panelPixelWidth())>=240,'La superficie lateral debe seguir visible tras cambiar de pestaña')
      await evaluate(`chrome.tabs.remove(${temporaryTab})`)
      if(process.env.VEYRION_WINDOWED_VERIFY==='1')await new Promise((resolve,reject)=>{
        const id=++panelSequence
        const timer=setTimeout(()=>{panelRequests.delete(id);reject(new Error('Panel activation timeout'))},15000)
        panelRequests.set(id,message=>{clearTimeout(timer);message.error?reject(new Error(JSON.stringify(message.error))):resolve()})
        panelSocket.send(JSON.stringify({id,method:'Page.bringToFront'}))
      })
      await panelEvaluate('document.body.tabIndex=0;document.body.focus();true')
      if(process.env.VEYRION_GUI_HOLD==='1'){
        console.log('GUI PANEL READY: comprobar foco real y enviar Enter para continuar')
        await new Promise(resolve=>process.stdin.once('data',resolve))
      }
      let narrow=await panelEvaluate('window.innerWidth')
      for(let i=0;i<100&&(narrow<240||narrow>380);i++){await delay(100);narrow=await panelEvaluate('window.innerWidth')}
      assert.ok(narrow>=240 && narrow<=380,`Viewport móvil debe ajustarse al panel: ${narrow}`)
      const narrowPixels=await panelPixelWidth()
      await panelCall('resize',520,true)
      let widePixels=narrowPixels
      for(let i=0;i<50 && widePixels<=narrowPixels*1.2;i++){await delay(100);widePixels=await panelPixelWidth()}
      assert.ok(widePixels>narrowPixels*1.2,`La superficie visible del panel debe ensancharse: ${narrowPixels} → ${widePixels} píxeles`)
      await panelCall('mobile',520,false)
      let desktop=false
      for(let i=0;i<100;i++){try{desktop=await panelEvaluate('!/Mobile/.test(navigator.userAgent)')}catch{}if(desktop)break;await delay(100)}
      assert.ok(desktop,'Debe poder volver a la vista de escritorio')
      await panelCall('mobile',520,true)
      await delay(200)
      await panelEvaluate('window.focus(); document.body.tabIndex=0; document.body.focus(); true')
    } finally {panelSocket.close();await panelCall('close',520,true)}
    for(let cycle=0;cycle<10;cycle++){
      await panelCall('open',520,true)
      await delay(80)
      await panelCall('close',520,true)
    }
    await panelCall('open',360,true)
    await panelCall('favorites',360,false)
    assert.ok((await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).some(t=>t.id===panelTarget.id),'Favoritos debe ocultar el panel web y conservarlo en segundo plano')
    await panelCall('open',360,true)
    assert.ok((await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).some(t=>t.id===panelTarget.id),'Volver a un panel debe reutilizar el mismo documento')
    await panelCall('close',360,true)
    for(const toolUrl of ['chrome://downloads/','chrome://extensions/','chrome://settings/appearance?veyrionSidebar=1']){
      await evaluate(`new Promise((resolve,reject)=>chrome.braveTheme.setVeyrionPanel('open',${JSON.stringify(toolUrl)},360,false,()=>chrome.runtime.lastError?reject(Error(chrome.runtime.lastError.message)):resolve(true)))`)
      let toolTarget
      for(let i=0;i<100;i++){toolTarget=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.url===toolUrl);if(toolTarget)break;await delay(100)}
      assert.ok(toolTarget,'Debe abrir el panel '+toolUrl)
      const ws=new WebSocket(toolTarget.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
      let number=0;const waits=new Map();ws.onmessage=event=>{const message=JSON.parse(event.data);const resolve=waits.get(message.id);if(resolve){waits.delete(message.id);resolve(message)}}
      const rpc=(method,params={})=>new Promise((resolve,reject)=>{const key=++number;const timer=setTimeout(()=>{waits.delete(key);reject(Error('Internal panel timeout: '+toolUrl+' '+method))},15000);waits.set(key,message=>{clearTimeout(timer);message.error?reject(Error(JSON.stringify(message.error))):resolve(message.result)});ws.send(JSON.stringify({id:key,method,params}))})
      try{
        await rpc('Page.bringToFront')
        const expression=toolUrl.includes('veyrionSidebar')?`(()=>{const find=root=>root.querySelector('veyrion-native-appearance')||[...root.querySelectorAll('*')].map(e=>e.shadowRoot&&find(e.shadowRoot)).find(Boolean);const appearance=find(document);return !!appearance?.shadowRoot?.querySelector('#icons .row')})()`:'document.readyState === "complete"'
        let loaded=false
        for(let i=0;i<100;i++){const result=await rpc('Runtime.evaluate',{expression,returnByValue:true});if(result.result.value){loaded=true;break}await delay(100)}
        assert.ok(loaded,'Debe terminar de cargar '+toolUrl)
        const size=(await rpc('Runtime.evaluate',{expression:'({width:innerWidth,scroll:document.documentElement.scrollWidth})',returnByValue:true})).result.value
        assert.ok(size.scroll<=size.width+2,`El panel interno no debe desbordar: ${toolUrl} ${JSON.stringify(size)}`)
        if(toolUrl.includes('veyrionSidebar')){
          const content=(await rpc('Runtime.evaluate',{expression:`(()=>{const find=root=>root.querySelector('veyrion-native-appearance')||[...root.querySelectorAll('*')].map(e=>e.shadowRoot&&find(e.shadowRoot)).find(Boolean);const host=find(document);return {width:host.getBoundingClientRect().width,scroll:host.shadowRoot.querySelector('#workspace-name').getBoundingClientRect().right}})()`,returnByValue:true})).result.value
          assert.ok(content.width<=size.width&&content.scroll<=size.width,`El formulario lateral debe caber completamente: ${JSON.stringify(content)} / ${size.width}`)
        }
        const shot=await rpc('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
        await fs.writeFile(path.join(root,'artifacts/panel-'+(toolUrl.includes('downloads')?'downloads':toolUrl.includes('extensions')?'extensions':'options')+'-050.png'),Buffer.from(shot.data,'base64'))
      }finally{ws.close()}
      await evaluate(`new Promise(resolve=>chrome.braveTheme.setVeyrionPanel('close',${JSON.stringify(toolUrl)},360,false,resolve))`)
    }
    await cdp('Page.bringToFront')
    await evaluate(`import('./app.js').then(module=>module.updatePreferences({webEffect:'warm',frameStyle:'glass',tileSize:180,interfaceFont:'mono'}))`)
    assert.equal(await evaluate('document.body.dataset.frameStyle'),'glass')
    assert.equal(await evaluate('document.body.dataset.interfaceFont'),'mono')
  }
  const navigation = await cdp('Page.navigate', { url: `http://127.0.0.1:${testServer.address().port}/` })
  assert.ok(!navigation.errorText, navigation.errorText)
  let executed = false
  for (let i = 0; i < 100; i++) {
    try { executed = await evaluate('document.body?.dataset.executed === "yes"') } catch {}
    if (executed) break
    await delay(100)
  }
  assert.ok(executed, 'Debe navegar a una página y ejecutar su JavaScript')
  if(native){
    let filter=false
    for(let i=0;i<50;i++){filter=await evaluate('document.documentElement.dataset.veyrionEffect === "warm"');if(filter)break;await delay(100)}
    assert.ok(filter,'El filtro visual elegido debe aplicarse al navegar fuera del inicio')
  }
  assert.equal(await evaluate('typeof require'), 'undefined')
  assert.equal(await evaluate('typeof process'), 'undefined')
  assert.equal(await evaluate('Boolean(globalThis.chrome?.storage)'), false)
  assert.equal(await evaluate('Boolean(globalThis.chrome?.braveTheme)'), false)
  const testKey = path.join(profile, 'test-only.key')
  const testCertificate = path.join(profile, 'test-only.crt')
  execFileSync('C:/Program Files/Git/usr/bin/openssl.exe', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', testKey, '-out', testCertificate, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore', windowsHide: true })
  tlsServer = createTlsServer({ key: await fs.readFile(testKey), cert: await fs.readFile(testCertificate) }, (_, response) => response.end('Untrusted certificate test'))
  await new Promise(resolve => tlsServer.listen(0, '127.0.0.1', resolve))
  const invalidTls = await cdp('Page.navigate', { url: `https://127.0.0.1:${tlsServer.address().port}/` })
  assert.match(invalidTls.errorText || '', /ERR_CERT_/, 'Debe rechazar un certificado HTTPS no confiable')
  await cdp('Page.navigate', { url: 'brave://extensions/' })
  let manager = false
  for (let i = 0; i < 100; i++) {
    try { manager = await evaluate('Boolean(document.querySelector("extensions-manager"))') } catch {}
    if (manager) break
    await delay(100)
  }
  assert.ok(manager, 'Debe estar disponible el gestor nativo de extensiones')
  if (native) {
    await cdp('Page.navigate',{url:'chrome://settings/help'})
    let settingsReady=false
    for(let i=0;i<100;i++){
      try{settingsReady=await evaluate('Boolean(document.querySelector("settings-ui")?.shadowRoot)')}catch{}
      if(settingsReady)break
      await delay(100)
    }
    assert.ok(settingsReady,'Los ajustes deben cargar con los recursos nuevos')
    const defaultSearch=await evaluate("chrome.settingsPrivate.getPref('default_search_provider_data.template_url_data').then(pref=>pref.value)");
    assert.ok(defaultSearch.short_name==='Google' && /(?:\{google:baseURL\}|https:\/\/(?:www\.)?google\.)/.test(defaultSearch.url),'El buscador nativo normal debe ser Google');
    const privateSearch=await evaluate("import('chrome://resources/js/cr.js').then(({sendWithPromise})=>sendWithPromise('getPrivateSearchEnginesList'))");
    assert.ok(privateSearch.some(engine=>engine.default && /(?:\{google:baseURL\}|https:\/\/(?:www\.)?google\.)/.test(engine.url)),'El buscador privado debe ser Google');

    let ownHeader=false
    for(let i=0;i<50;i++){
      ownHeader=await evaluate('Boolean(document.querySelector("settings-ui")?.shadowRoot?.querySelector("cr-toolbar img[slot=product-logo][alt=Veyrion]")?.naturalWidth)')
      if(ownHeader)break
      await delay(100)
    }
    assert.ok(ownHeader,'La cabecera de ajustes debe usar el logo propio también en modo oscuro')
    assert.ok(await evaluate(`(() => {const texts=[];const scan=root=>{texts.push(root.textContent||'');for(const element of root.querySelectorAll('*'))if(element.shadowRoot)scan(element.shadowRoot)};scan(document);return texts.some(text=>text.includes('Acerca de Veyrion')||text.includes('About Veyrion'))})()`),'Los ajustes deben identificar el producto como Veyrion')
    await delay(300)
    const settingsShot=await cdp('Page.captureScreenshot',{format:'png'})
    await fs.writeFile(path.join(root,'artifacts/settings-030.png'),Buffer.from(settingsShot.data,'base64'))
    await cdp('Page.navigate',{url:'chrome://settings/appearance'})
    let nativeSettings=false
    for(let i=0;i<100;i++){
      try{nativeSettings=await evaluate(`(()=>{const find=root=>{if(root.querySelector('veyrion-native-appearance')?.shadowRoot?.querySelector('#icons .row'))return true;return [...root.querySelectorAll('*')].some(element=>element.shadowRoot&&find(element.shadowRoot))};return find(document)})()`)}catch{}
      if(nativeSettings)break
      await delay(100)
    }
    assert.ok(nativeSettings,'La apariencia debe estar implementada dentro de la configuración nativa')
    const localUpdate=await evaluate(`import('chrome://resources/js/cr.js').then(({sendWithPromise})=>sendWithPromise('veyrionAppearance',{updateAction:'status'}))`)
    assert.equal(typeof localUpdate.state,'string','Configuración debe consultar el estado del actualizador sin ejecutar una consola')
    for(const autoPip of [false,true]){
      const result=await evaluate(`import('chrome://resources/js/cr.js').then(({sendWithPromise})=>sendWithPromise('veyrionAppearance',{autoPip:${autoPip}}))`)
      assert.equal(result.autoPip,autoPip,'El minirreproductor automático debe poder desactivarse y activarse')
    }
    const spacesBefore=await evaluate(`import('chrome://resources/js/cr.js').then(({sendWithPromise})=>sendWithPromise('veyrionAppearance',{}))`)
    const visibleSpaceName=await evaluate(`(()=>{const find=root=>root.querySelector('veyrion-native-appearance')||[...root.querySelectorAll('*')].map(e=>e.shadowRoot&&find(e.shadowRoot)).find(Boolean);return find(document).shadowRoot.querySelector('#workspaces button[aria-pressed=true]')?.textContent||''})()`)
    assert.ok(visibleSpaceName&&!visibleSpaceName.includes(String(spacesBefore.workspaces.find(space=>space.current).id)),'Los tableros deben mostrar un nombre legible, sin identificadores internos')
    const spacesAfter=await evaluate(`import('chrome://resources/js/cr.js').then(({sendWithPromise})=>sendWithPromise('veyrionAppearance',{workspaceAction:'create',name:'Estudio de prueba'}))`)
    assert.equal(spacesAfter.workspaces.length,spacesBefore.workspaces.length+1,'Un tablero debe conservar sus pestañas en un espacio adicional')
    assert.ok(spacesAfter.workspaces.some(space=>space.name==='Estudio de prueba'&&space.tabs>=1))
    const originalSpace=spacesBefore.workspaces.find(space=>space.current)
    await evaluate(`import('chrome://resources/js/cr.js').then(({sendWithPromise})=>sendWithPromise('veyrionAppearance',{workspaceAction:'activate',id:${originalSpace.id}}))`)
    await cdp('Page.bringToFront')
    for (const enabled of [false, true, false]) {
      const dark = await evaluate(`import('chrome://resources/js/cr.js').then(({sendWithPromise})=>sendWithPromise('veyrionAppearance',{forceDark:${enabled}}))`)
      assert.equal(dark.forceDark, enabled, 'El modo oscuro web debe poder activarse y desactivarse')
      await cdp('Page.navigate',{url:`http://127.0.0.1:${testServer.address().port}/dark-mode-check`})
      for(let i=0;i<100;i++){try{if(await evaluate('document.body?.dataset.executed === "yes"'))break}catch{}await delay(100)}
      const png=Buffer.from((await cdp('Page.captureScreenshot',{format:'png',clip:{x:100,y:300,width:1,height:1,scale:1}})).data,'base64')
      assert.equal(png[25],2,'La captura de prueba debe ser RGB')
      const chunks=[]
      for(let offset=8;offset<png.length;){const length=png.readUInt32BE(offset);if(png.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(png.subarray(offset+8,offset+8+length));offset+=length+12}
      const pixel=inflateSync(Buffer.concat(chunks))
      assert.ok(enabled ? pixel[1]<100 : pixel[1]>180,`El fondo real debe cambiar al activar/desactivar el modo oscuro: ${pixel[1]}`)
      await fs.writeFile(path.join(root,`artifacts/web-dark-${enabled}.png`),png)
      await cdp('Page.navigate',{url:'chrome://settings/appearance'})
      for(let i=0;i<100;i++){try{if(await evaluate(`(()=>{const scan=root=>!!root.querySelector('veyrion-native-appearance')?.shadowRoot?.querySelector('#icons .row')||[...root.querySelectorAll('*')].some(e=>e.shadowRoot&&scan(e.shadowRoot));return scan(document)})()`))break}catch{}await delay(100)}
    }
    assert.ok(await evaluate(`import('chrome://resources/js/cr.js').then(({sendWithPromise})=>sendWithPromise('veyrionAppearance',{forceDark:'yes'}).then(()=>false,()=>true))`),'El modo oscuro web debe rechazar valores inválidos')
    const nativeAppearance=await evaluate(`import('chrome://resources/js/cr.js').then(({sendWithPromise})=>sendWithPromise('veyrionAppearance',{mode:'dark',size:20,spacing:3,colored:true,color:0xd2d2d2}))`)
    assert.equal(nativeAppearance.color,0xd2d2d2)
    assert.equal(nativeAppearance.mode,'dark')
    assert.ok(await evaluate(`import('chrome://resources/js/cr.js').then(({sendWithPromise})=>sendWithPromise('veyrionAppearance',{mode:'invalid',size:999,spacing:0,colored:true,color:0}).then(()=>false,()=>true))`),'La configuración nativa debe rechazar valores inválidos')
    await cdp('Page.reload')
    for(let i=0;i<100;i++){
      try{if(await evaluate(`(()=>{const find=root=>{if(root.querySelector('veyrion-native-appearance')?.shadowRoot?.querySelector('#icons .row'))return true;return [...root.querySelectorAll('*')].some(element=>element.shadowRoot&&find(element.shadowRoot))};return find(document)})()`))break}catch{}
      await delay(100)
    }
    const appearanceShot=await cdp('Page.captureScreenshot',{format:'png'})
    await fs.writeFile(path.join(root,'artifacts/native-settings-040.png'),Buffer.from(appearanceShot.data,'base64'))
    if(process.env.VEYRION_GUI_HOLD==='1'){
      console.log('GUI SETTINGS READY: inspeccionar la ventana y enviar Enter para continuar')
      await new Promise(resolve=>process.stdin.once('data',resolve))
    }
    await cdp('Page.navigate',{url:'chrome://settings/system'})
    let systemReady=false
    for(let i=0;i<100;i++){
      try{systemReady=await evaluate(`(()=>{const scan=root=>!!root.querySelector('settings-brave-system-page-index')||[...root.querySelectorAll('*')].some(e=>e.shadowRoot&&scan(e.shadowRoot));return scan(document)})()`)}catch{}
      if(systemReady)break
      await delay(100)
    }
    assert.ok(systemReady,'La configuración del sistema debe cargar')
    assert.ok(await evaluate(`(()=>{const scan=root=>!root.querySelector('settings-brave-origin-onboarding')&&[...root.querySelectorAll('*')].every(e=>!e.shadowRoot||scan(e.shadowRoot));return scan(document)})()`),'La promoción de Brave Origin debe estar retirada del sistema')
    if(process.env.VEYRION_DRAG_VERIFY==='1'){
      assert.equal(process.env.VEYRION_WINDOWED_VERIFY,'1','El arrastre se prueba en una ventana real');
      const before=await evaluate("import('chrome://resources/js/cr.js').then(({sendWithPromise})=>sendWithPromise('veyrionAppearance',{mode:'dark',size:20,spacing:10,colored:true,color:0xd2d2d2}))");
      assert.equal(before.spacing,10,'La prueba debe aplicar una separación amplia');
      const services=['WhatsApp','Telegram','Discord','Twitch','Spotify'];
      const serviceOrder=state=>state.items.map(item=>item.title).filter(title=>services.includes(title));
      await fs.writeFile(path.join(root,'artifacts/drag-ready.json'),JSON.stringify({profile,version:releaseVersion,before:serviceOrder(before)}));
      console.log('DRAG READY: '+path.join(profile,'continue-drag'));
      let completed=false;
      for(let i=0;i<960;i++){assert.equal(child.exitCode,null,'El navegador debe seguir abierto durante el arrastre');try{await fs.access(path.join(profile,'continue-drag'));completed=true;break}catch{}await delay(250)}
      assert.ok(completed,'La prueba de arrastre debe completarse');
      const after=await evaluate("import('chrome://resources/js/cr.js').then(({sendWithPromise})=>sendWithPromise('veyrionAppearance',{}))");
      dragServiceOrder=serviceOrder(after);
      assert.notDeepEqual(dragServiceOrder,serviceOrder(before),'El arrastre debe cambiar realmente el orden');
      await evaluate("import('chrome://resources/js/cr.js').then(({sendWithPromise})=>sendWithPromise('veyrionAppearance',{mode:'dark',size:20,spacing:3,colored:true,color:0xd2d2d2}))");
    }
    const stabilitySeconds=Number(process.env.VEYRION_STABILITY_SECONDS)||0
    if(stabilitySeconds>0){const deadline=Date.now()+stabilitySeconds*1000;console.log(`Estabilidad: ${stabilitySeconds}s de reposo con sandbox activo`);while(Date.now()<deadline){assert.equal(child.exitCode,null,'El navegador debe permanecer abierto en reposo');await evaluate('document.readyState');await delay(2000)}}
    try { await cdp('Browser.close') } catch {}
    for (let i = 0; i < 100 && child.exitCode === null; i++) await delay(100)
    assert.notEqual(child.exitCode, null, 'El perfil de prueba debe cerrarse para comprobar las preferencias persistidas')
    assert.equal(child.exitCode,0,'El navegador debe cerrarse limpiamente, sin una salida de fallo')
    const saved = JSON.parse(await fs.readFile(path.join(profile, 'Default/Preferences'), 'utf8'))
    assert.equal(saved.webkit?.webprefs?.force_dark_mode_enabled,false,'El modo oscuro web debe conservar su preferencia al cerrar')
    assert.equal(saved.side_panel?.is_right_aligned, false, 'La barra nativa debe estar alineada a la izquierda')
    assert.equal(saved.brave?.sidebar?.sidebar_show_option, 0, 'La barra nativa debe permanecer visible al navegar')
    assert.equal(saved.veyrion?.desktop_layout_version, 1, 'La migración de interfaz debe persistirse una sola vez')
    if(dragServiceOrder){
      const persisted=saved.brave.sidebar.sidebar_items.map(item=>item.title).filter(title=>dragServiceOrder.includes(title));
      assert.deepEqual(persisted,dragServiceOrder,'El orden arrastrado debe persistir al cerrar');
      await fs.writeFile(path.join(root,'artifacts/sidebar-drag-verification-'+releaseVersion.replaceAll('.','')+'.json'),JSON.stringify({passed:true,version:releaseVersion,customSpacing:10,reordered:true,persisted:true,cleanExit:true}));
    }
    const panelData = JSON.stringify(saved.brave?.sidebar?.sidebar_items)
    assert.equal(saved.veyrion?.panel_width,360,'El último ancho elegido para el panel debe persistir')
    assert.equal(saved.veyrion?.mobile_panels?.[testedPanelUrl],true,'La vista móvil debe guardarse por dirección')
    assert.ok(panelData.includes(testedPanelUrl),'La página personalizada debe guardarse en la barra')
    for (const host of ['web.whatsapp.com', 'web.telegram.org', 'discord.com', 'twitch.tv', 'open.spotify.com']) assert.ok(panelData.includes(host), 'Debe guardarse el panel de ' + host)
  }
  const report = { passed: true, browser: executable, extension_url: url, checks: [native ? 'Inicio integrado en binario propio sin extensión externa' : 'MV3 cargado en Brave', 'Nueva pestaña sustituida', 'Nombre Veyrion', 'Presets visuales y sonoros', 'Densidad y visibilidad', 'Importación de mod y validación de valores', 'Cambio de acento', 'Persistencia tras recarga', 'Añadir y quitar acceso', 'Navegación HTTP y JavaScript', 'APIs de extensión aisladas de páginas web', 'Gestor nativo de extensiones disponible'], native_build_verified: native }
  if (testExtensions) report.checks.push('Instalación y ejecución de extensión MV3 independiente sin permisos adicionales')
  if (native) report.checks.push('Google predeterminado normal y privado; bloqueo de solicitud publicitaria del panel sin impedir recursos normales; asistente de perfil cargado')
  if (native) report.checks.push('Color aplicado al tema nativo de pestañas y barra; valores fuera de rango rechazados')
  if (native) report.checks.push('Barra nativa izquierda persistente con paneles web; actualizador sin consola y estado consultable desde ajustes')
  if (native) report.checks.push('Página arbitraria en panel, ancho real y persistido, vista móvil/escritorio por página, filtros visuales fuera del inicio y estilo configurable')
  if (native) report.checks.push('Configuración de apariencia nativa, temas persistidos, iconos configurables, diez ciclos de panel y salida limpia')
  report.checks.push('Rechazo de certificado HTTPS no confiable')
  report.release_version=releaseVersion
  report.checks.push('Contenido centrado en pantalla ancha; promoción de Brave Origin retirada de Sistema')
  if(native)report.checks.push('Modo oscuro web nativo: cambio real de fondo claro/oscuro y reversión sin cambiar el tema de ventana')
  await fs.writeFile(path.join(root, 'artifacts/verification.json'), JSON.stringify(report, null, 2))
  if(process.env.VEYRION_WINDOWED_VERIFY==='1')await fs.writeFile(path.join(root,`artifacts/windowed-verification-${releaseVersion.replaceAll('.','')}.json`),JSON.stringify({...report,windowed_verified:true,stability_seconds:Number(process.env.VEYRION_STABILITY_SECONDS)||0},null,2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  if (testServer.listening) testServer.close()
  if (tlsServer?.listening) tlsServer.close()
  if (socket?.readyState === WebSocket.OPEN) { try { await cdp('Browser.close') } catch {} socket.close() }
  if (child.exitCode === null) child.kill()
}
