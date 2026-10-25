const label = document.querySelector('#update-status')
const checkButton = document.querySelector('#check-updates')
const downloadButton = document.querySelector('#download-update')
const config = await (await fetch(new URL('update-config.json', import.meta.url))).json()
document.querySelector('[data-panel=updates]').addEventListener('click', () => {
  document.querySelector('#settings-dialog').append(document.querySelector('#update-card'))
  document.querySelector('#update-card').hidden = false
})
document.querySelectorAll('[data-panel]:not([data-panel=updates])').forEach(button => button.addEventListener('click', () => { document.querySelector('#update-card').hidden = true }))
document.querySelector('#veyrion-version').textContent = `Veyrion ${config.version}`
let available
function show(result) {
  available = result?.status === 'available' ? result.manifest : undefined
  downloadButton.hidden = !available
  const messages = { available: `Nueva versión ${available?.version} disponible. Abre Configuración → Aspecto visual → Actualizaciones para actualizar al cerrar.`, current: 'No hay una versión más reciente en el canal firmado.', unpublished: 'El canal de GitHub aún no tiene una versión firmada publicada.', error: result?.message || 'No se pudo consultar GitHub.' }
  label.textContent = messages[result?.status] || 'Comprobaciones sin consola cada 15 minutos y al iniciar sesión. Instalación desde Configuración.'
}
if (globalThis.chrome?.storage) {
  chrome.storage.local.get('veyrionUpdate', value => show(value.veyrionUpdate))
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.veyrionUpdate) show(changes.veyrionUpdate.newValue) })
}
checkButton.addEventListener('click', async () => {
  checkButton.disabled = true
  label.textContent = 'Consultando GitHub…'
  try {
    const result = await VeyrionUpdates.check(config)
    show(result)
    if (globalThis.chrome?.storage) chrome.storage.local.set({ veyrionUpdate: result })
  } catch (error) { show({ status: 'error', message: error.message }) }
  finally { checkButton.disabled = false }
})
downloadButton.addEventListener('click', async () => {
  downloadButton.disabled = true
  try {
    // Recheck the signature instead of trusting mutable extension storage.
    const result = await VeyrionUpdates.check(config)
    if (result.status !== 'available') { show(result); return }
    label.textContent = 'Descargando actualización firmada…'
    const response = await fetch(result.manifest.url, { credentials: 'omit', signal: AbortSignal.timeout(600000) })
    if (!response.ok) throw new Error('No se pudo descargar el instalador.')
    const bytes = await VeyrionUpdates.readBytes(response, result.manifest.size)
    await VeyrionUpdates.verifyInstaller(bytes, result.manifest)
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))
    try {
      await new Promise((resolve, reject) => chrome.downloads.download({ url, filename: `Veyrion-${result.manifest.version}-Setup-x64.exe`, saveAs: true }, id => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve(id)))
      label.textContent = 'Integridad verificada. Cuando termine la descarga guardada, ejecuta el instalador para actualizar conservando tu perfil.'
    } finally { setTimeout(() => URL.revokeObjectURL(url), 600000) }
  } catch (error) { label.textContent = error.message }
  finally { downloadButton.disabled = false }
})
