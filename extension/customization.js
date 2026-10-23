import { preferences, updatePreferences } from './app.js'
import { defaults } from './model.js'
const keys = ['accent', 'ambient', 'motion', 'customColor', 'useCustomColor', 'brightness', 'blur', 'density', 'effect', 'sounds', 'soundPack', 'volume', 'music', 'showNotes', 'showClock', 'showSidebar', 'syncNativeTheme', 'frameStyle', 'tileSize', 'interfaceFont', 'panelOpacity', 'webEffect', 'webSounds']
const nativeColorButton = document.querySelector('#apply-browser-color')
const nativeColorStatus = document.querySelector('#browser-color-status')
nativeColorButton.disabled = !globalThis.chrome?.braveTheme?.setVeyrionColor
if (nativeColorButton.disabled) nativeColorStatus.textContent = 'El tema de pestañas y barra estará disponible en el navegador Veyrion compilado.'
function applyNativeColor() {
  const state = preferences()
  const accent = state.useCustomColor ? state.customColor : { violet: '#a48bff', cyan: '#69e9e0', rose: '#ff86b3', lime: '#b8ee80' }[state.accent]
  const rgb = [1, 3, 5].map(start => parseInt(accent.slice(start, start + 2), 16))
  chrome.braveTheme.setVeyrionColor(...rgb, color => {
    if (chrome.runtime.lastError) {
      nativeColorStatus.textContent = 'No se pudo aplicar el color: ' + chrome.runtime.lastError.message
      return
    }
    nativeColorStatus.dataset.appliedColor = String(color)
    nativeColorStatus.textContent = 'Color aplicado a las pestañas y a la barra. Se guardó en este perfil.'
  })
}
nativeColorButton.addEventListener('click', applyNativeColor)
let nativeThemeTimer, lastNativeTheme
function syncNativeTheme() {
  const state = preferences()
  if (!state.syncNativeTheme || nativeColorButton.disabled) return
  const current = JSON.stringify([state.accent, state.useCustomColor, state.customColor])
  if (current === lastNativeTheme) return
  clearTimeout(nativeThemeTimer)
  nativeThemeTimer = setTimeout(() => { lastNativeTheme = current; applyNativeColor() }, 250)
}
document.addEventListener('veyrion-appearance', syncNativeTheme)
syncNativeTheme()
const presets = {
  obsidian: { accent: 'violet', ambient: 'quiet', soundPack: 'glass', effect: 'none', motion: false },
  terminal: { accent: 'lime', ambient: 'grid', soundPack: 'arcade', effect: 'scanlines', motion: false },
  aurora: { accent: 'cyan', ambient: 'orbit', soundPack: 'soft', effect: 'vignette', motion: true },
  sakura: { accent: 'rose', ambient: 'orbit', soundPack: 'glass', effect: 'none', motion: true }
}
document.querySelectorAll('[data-panel]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-panel]').forEach(item => item.setAttribute('aria-pressed', String(item === button)))
  document.querySelectorAll('[data-section]').forEach(section => { section.hidden = section.dataset.section !== button.dataset.panel })
}))
document.querySelectorAll('[data-setting]').forEach(control => control.addEventListener(control.type === 'range' || control.type === 'color' ? 'input' : 'change', () => {
  const value = control.type === 'checkbox' ? control.checked : control.type === 'range' ? Number(control.value) : control.value
  updatePreferences({ [control.dataset.setting]: value })
}))
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => updatePreferences({ ...presets[button.dataset.preset], useCustomColor: false, wallpaper: '' })))
document.querySelector('#reset-look').addEventListener('click', () => updatePreferences(Object.fromEntries([...keys, 'wallpaper'].map(key => [key, defaults[key]]))))
document.querySelector('#export-mod').addEventListener('click', () => {
  const settings = preferences()
  const blob = new Blob([JSON.stringify({ format: 'veyrion-mod', version: 1, settings: Object.fromEntries(keys.map(key => [key, settings[key]])) }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = 'mi-ambiente.veyrion.json'; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
})
document.querySelector('#import-mod').addEventListener('change', async event => {
  try {
    const file = event.target.files[0]
    if (!file) return
    if (file.size > 20000) throw new Error('El mod supera el tamaño permitido.')
    const data = JSON.parse(await file.text())
    if (data.format !== 'veyrion-mod' || data.version !== 1 || !data.settings || typeof data.settings !== 'object') throw new Error('Elige un mod Veyrion válido.')
    await updatePreferences(Object.fromEntries(keys.filter(key => Object.hasOwn(data.settings, key)).map(key => [key, data.settings[key]])))
    event.target.value = ''
  } catch (error) { document.querySelector('#audio-status').textContent = error.message; alert(error.message) }
})
let context, musicTimer, active = false
const voices = new Set()
function audio() {
  context ??= new AudioContext()
  if (context.state === 'suspended') context.resume().catch(() => {})
  return context
}
function tone(frequency, seconds, volume, type = 'sine') {
  if (document.hidden) return
  const ctx = audio()
  const oscillator = ctx.createOscillator(), gain = ctx.createGain()
  oscillator.type = type; oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(Math.max(.00001, volume), ctx.currentTime + .015)
  gain.gain.exponentialRampToValueAtTime(.00001, ctx.currentTime + seconds)
  oscillator.connect(gain); gain.connect(ctx.destination)
  voices.add(oscillator)
  oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect() }
  oscillator.start(); oscillator.stop(ctx.currentTime + seconds)
}
function clickSound(force = false, typing = false) {
  const state = preferences()
  if ((!state.sounds && !force) || state.volume === 0) return
  const pack = { glass: [typing ? 1100 : 740, 'sine'], arcade: [typing ? 380 : 520, 'square'], soft: [typing ? 220 : 330, 'triangle'] }[state.soundPack]
  tone(pack[0], typing ? .04 : .12, state.volume / 100 * (typing ? .025 : .06), pack[1])
}
function stopMusic() {
  clearInterval(musicTimer); musicTimer = null
  for (const voice of voices) { try { voice.stop() } catch {} }
}
function syncAudio() {
  const state = preferences()
  const wanted = active && state.music && !document.hidden && state.volume > 0
  if (!wanted) stopMusic()
  if (wanted && !musicTimer) {
    let step = 0
    const play = () => {
      const current = preferences()
      const base = [130.81, 164.81, 196, 146.83][step++ % 4]
      tone(base, 3, current.volume / 100 * .04)
      tone(base * 1.5, 3, current.volume / 100 * .025)
    }
    play(); musicTimer = setInterval(play, 3000)
  }
  document.querySelector('#audio-status').textContent = wanted ? 'Música ambiental activa en esta pestaña.' : 'Música desactivada o en pausa.'
}
document.addEventListener('click', event => { active = true; if (event.target.closest('button,a,input,select')) clickSound(); syncAudio() })
document.addEventListener('keydown', event => { if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) { active = true; clickSound(false, true) } })
document.querySelector('#test-sound').addEventListener('click', () => clickSound(true))
document.addEventListener('veyrion-settings', () => { stopMusic(); syncAudio() })
document.addEventListener('visibilitychange', syncAudio)
window.addEventListener('pagehide', stopMusic)
document.body.dataset.customizationReady = 'true'

const panelForm = document.querySelector('#panel-form')
panelForm.addEventListener('submit', event => {
  event.preventDefault()
  const input = document.querySelector('#panel-url')
  let url
  try { url = new URL(input.value.includes('://') ? input.value : 'https://' + input.value) } catch {}
  const status = document.querySelector('#panel-status')
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) { status.textContent = 'Introduce una dirección HTTP o HTTPS válida.'; return }
  if (!chrome?.braveTheme?.setVeyrionPanel) { status.textContent = 'Disponible en Veyrion 0.3.0.'; return }
  chrome.braveTheme.setVeyrionPanel('add', url.href, Number(document.querySelector('#panel-width').value), document.querySelector('#panel-mobile').checked, () => {
    status.textContent = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Página agregada. Ábrela desde su icono en la barra izquierda.'
  })
})
document.querySelector('#panel-width').addEventListener('change', event => {
  if (!globalThis.chrome?.braveTheme?.setVeyrionPanel) return
  chrome.braveTheme.setVeyrionPanel('resize', 'https://example.com/', Number(event.target.value), false, () => {
    document.querySelector('#panel-status').textContent = chrome.runtime.lastError ? chrome.runtime.lastError.message : `Ancho guardado: ${event.target.value} px.`
  })
})
