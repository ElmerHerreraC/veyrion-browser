import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createServer as createTlsServer } from 'node:https'
import { root, braveExecutable } from './paths.mjs'
const profile = path.join(root, '.verify-profile', String(Date.now()))
const executable = braveExecutable()
const native = process.env.VEYRION_NATIVE_VERIFY === '1' || path.basename(executable).toLowerCase() === 'veyrion.exe'
const testExtensions = process.env.VEYRION_TEST_EXTENSIONS === '1'
const releaseVersion = JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version
const loadExtensions = [...(!native ? [path.join(root, 'extension')] : []), ...(testExtensions ? [path.join(root, 'tests/fixture-extension')] : [])]
await fs.mkdir(profile, { recursive: true })
await fs.mkdir(path.join(root, 'artifacts'), { recursive: true })
const child = spawn(executable, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  ...(loadExtensions.length ? [`--load-extension=${loadExtensions.join(',')}`] : []), '--no-first-run', '--no-default-browser-check', 'brave://newtab/'
], { stdio: 'ignore', windowsHide: true })
child.on('error', error => console.error(error.message))
let socket
let tlsServer
let sequence = 0
const pending = new Map()
const testServer = createServer((request, response) => {
  if (request.url === '/check.js') {
    response.writeHead(200, { 'content-type': 'text/javascript' })
    response.end('document.body.dataset.executed="yes"')
  } else {
    response.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': "default-src 'self'; script-src 'self'" })
    response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veyrion navigation check</title><body>Navigation works<script src="/check.js"></script>')
  }
})
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)) }, 15000)
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value) }, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const response = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails))
  return response.result.value
}
try {
  let port
  for (let i = 0; i < 150; i++) {
    try { port = Number((await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break } catch { await delay(100) }
  }
  assert.ok(port, 'Brave debe iniciar el depurador con el perfil de pruebas')
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const target = targets.find(item => item.type === 'page')
  assert.ok(target, 'Debe existir una pestaña')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onmessage = event => {
    const result = JSON.parse(event.data)
    const request = pending.get(result.id)
    if (request) { pending.delete(result.id); result.error ? request.reject(new Error(JSON.stringify(result.error))) : request.resolve(result.result) }
  }
  await cdp('Page.enable')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  let ready = false
  for (let i = 0; i < 100; i++) {
    ready = await evaluate('document.body?.dataset.ready === "true"')
    if (ready) break
    await delay(100)
  }
  assert.ok(ready, 'La extensión debe reemplazar la nueva pestaña y cargar sus módulos')
  if (native) {
    assert.equal(await evaluate('fetch(new URL("update-config.json",location.href)).then(response=>response.json()).then(config=>config.version)'),releaseVersion,'El binario debe incorporar los recursos de la versión actual')
    const automatic = await evaluate(`new Promise(resolve => chrome.alarms.get('veyrion-updates', alarm => resolve(alarm?.periodInMinutes)))`)
    assert.equal(automatic, 360, 'La comprobación automática debe estar programada cada seis horas')
    assert.ok(await evaluate('Boolean(globalThis.VeyrionUpdates?.verifyManifest)'), 'El inicio debe incluir verificación de firmas de actualización')
    assert.ok(await evaluate('typeof chrome.braveTheme?.setVeyrionColor === "function"'), 'El inicio debe poder cambiar el tema nativo')
    const color = await evaluate(`new Promise((resolve, reject) => chrome.braveTheme.setVeyrionColor(105,233,224, color => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve(color)))`)
    assert.equal(color, 0x69e9e0, 'El color debe aplicarse al servicio nativo de temas')
    const invalid = await evaluate(`new Promise(resolve => chrome.braveTheme.setVeyrionColor(-1,256,0, () => resolve(Boolean(chrome.runtime.lastError))))`)
    assert.equal(invalid, true, 'El puente nativo debe rechazar colores fuera de rango')
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
  await evaluate('document.querySelector("[data-panel=layout]").click(); document.querySelector("[data-setting=showNotes]").click()')
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
  await cdp('Page.reload')
  await delay(650)
  assert.equal(await evaluate('document.querySelector("#notes").value'), 'Prueba de persistencia')
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
    let panelTarget
    for (let i=0;i<100;i++) {
      panelTarget=(await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(item=>item.type==='page' && item.url===testedPanelUrl)
      if(panelTarget)break
      await delay(100)
    }
    assert.ok(panelTarget,'Una página arbitraria debe abrirse en el panel nativo')
    const panelSocket=new WebSocket(panelTarget.webSocketDebuggerUrl)
    await new Promise((resolve,reject)=>{panelSocket.onopen=resolve;panelSocket.onerror=reject})
    let panelSequence=0
    const panelRequests=new Map()
    panelSocket.onmessage=event=>{const message=JSON.parse(event.data);const resolve=panelRequests.get(message.id);if(resolve){panelRequests.delete(message.id);resolve(message)}}
    const panelEvaluate=expression=>new Promise((resolve,reject)=>{
      const id=++panelSequence
      const timer=setTimeout(()=>{panelRequests.delete(id);reject(new Error('Panel runtime timeout'))},15000)
      panelRequests.set(id,message=>{clearTimeout(timer);message.error||message.result?.exceptionDetails?reject(new Error(JSON.stringify(message))):resolve(message.result.result.value)})
      panelSocket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}))
    })
    try {
      let mobile=false
      for(let i=0;i<100;i++){
        try{mobile=await panelEvaluate('/Mobile/.test(navigator.userAgent) && document.body?.dataset.executed === "yes"')}catch{}
        if(mobile)break
        await delay(100)
      }
      assert.ok(mobile,'La vista móvil debe enviar un agente móvil y cargar la página')
      const narrow=await panelEvaluate('window.innerWidth')
      assert.ok(narrow>=240 && narrow<=380,`Viewport móvil debe ajustarse al panel: ${narrow}`)
      await panelCall('resize',520,true)
      let wide=narrow
      for(let i=0;i<50 && wide<=narrow+80;i++){await delay(100);wide=await panelEvaluate('window.innerWidth')}
      assert.ok(wide>narrow+80,'El panel debe cambiar realmente su ancho')
      await panelCall('mobile',520,false)
      let desktop=false
      for(let i=0;i<100;i++){try{desktop=await panelEvaluate('!/Mobile/.test(navigator.userAgent)')}catch{}if(desktop)break;await delay(100)}
      assert.ok(desktop,'Debe poder volver a la vista de escritorio')
      await panelCall('mobile',520,true)
      await delay(200)
    } finally {panelSocket.close();await panelCall('close',520,true)}
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
    await delay(500)
    const settingsShot=await cdp('Page.captureScreenshot',{format:'png'})
    await fs.writeFile(path.join(root,'artifacts/settings-030.png'),Buffer.from(settingsShot.data,'base64'))
    try { await cdp('Browser.close') } catch {}
    for (let i = 0; i < 100 && child.exitCode === null; i++) await delay(100)
    assert.notEqual(child.exitCode, null, 'El perfil de prueba debe cerrarse para comprobar las preferencias persistidas')
    const saved = JSON.parse(await fs.readFile(path.join(profile, 'Default/Preferences'), 'utf8'))
    assert.equal(saved.side_panel?.is_right_aligned, false, 'La barra nativa debe estar alineada a la izquierda')
    assert.equal(saved.brave?.sidebar?.sidebar_show_option, 0, 'La barra nativa debe permanecer visible al navegar')
    assert.equal(saved.veyrion?.desktop_layout_version, 1, 'La migración de interfaz debe persistirse una sola vez')
    const panelData = JSON.stringify(saved.brave?.sidebar?.sidebar_items)
    assert.equal(saved.veyrion?.panel_width,520,'El ancho del panel debe persistir')
    assert.equal(saved.veyrion?.mobile_panels?.[testedPanelUrl],true,'La vista móvil debe guardarse por dirección')
    assert.ok(panelData.includes(testedPanelUrl),'La página personalizada debe guardarse en la barra')
    for (const host of ['web.whatsapp.com', 'web.telegram.org', 'discord.com', 'twitch.tv', 'open.spotify.com']) assert.ok(panelData.includes(host), 'Debe guardarse el panel de ' + host)
  }
  const report = { passed: true, browser: executable, extension_url: url, checks: [native ? 'Inicio integrado en binario propio sin extensión externa' : 'MV3 cargado en Brave', 'Nueva pestaña sustituida', 'Nombre Veyrion', 'Presets visuales y sonoros', 'Densidad y visibilidad', 'Importación de mod y validación de valores', 'Cambio de acento', 'Persistencia tras recarga', 'Añadir y quitar acceso', 'Navegación HTTP y JavaScript', 'APIs de extensión aisladas de páginas web', 'Gestor nativo de extensiones disponible'], native_build_verified: native }
  if (testExtensions) report.checks.push('Instalación y ejecución de extensión MV3 independiente sin permisos adicionales')
  if (native) report.checks.push('Color aplicado al tema nativo de pestañas y barra; valores fuera de rango rechazados')
  if (native) report.checks.push('Barra nativa izquierda persistente con paneles web; comprobación automática de actualizaciones cada seis horas')
  if (native) report.checks.push('Página arbitraria en panel, ancho real y persistido, vista móvil/escritorio por página, filtros visuales fuera del inicio y estilo configurable')
  report.checks.push('Rechazo de certificado HTTPS no confiable')
  await fs.writeFile(path.join(root, 'artifacts/verification.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  if (testServer.listening) testServer.close()
  if (tlsServer?.listening) tlsServer.close()
  if (socket?.readyState === WebSocket.OPEN) { try { await cdp('Browser.close') } catch {} socket.close() }
  if (child.exitCode === null) child.kill()
}
