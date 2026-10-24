import { defaults, engines, destination, safeUrl, normalize } from './model.js'
const $ = (selector) => document.querySelector(selector)
const extension = Boolean(globalThis.chrome?.storage?.local)
let state = normalize()
let appearanceRevision = 0, lastAppearanceEdit = 0
let saveQueue = Promise.resolve()
function readExtensionState() {
  return new Promise((resolve, reject) => chrome.storage.local.get('nebula', data => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
    else resolve(data.nebula)
  }))
}
function writeExtensionState(snapshot) {
  return new Promise((resolve, reject) => chrome.storage.local.set({ nebula: snapshot }, () => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
    else resolve()
  }))
}
const colors = { violet: ['#a48bff', '164,139,255'], cyan: ['#6bdfe5', '107,223,229'], rose: ['#ff85af', '255,133,175'], lime: ['#c2eb79', '194,235,121'] }
function toast(message) {
  $('#toast').textContent = message
  $('#toast').classList.add('visible')
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 3500)
}
function save() {
  const snapshot = structuredClone(state)
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    if (extension) await writeExtensionState(snapshot)
    else localStorage.setItem('nebula', JSON.stringify(snapshot))
  }).catch(() => { toast('No se pudo guardar. Revisa el espacio disponible.'); throw new Error('Storage failed') })
  return saveQueue
}
function apply() {
  const [accent, rgb] = state.useCustomColor ? [state.customColor, [1, 3, 5].map(i => parseInt(state.customColor.slice(i, i + 2), 16)).join(',')] : colors[state.accent]
  document.documentElement.style.setProperty('--accent', accent)
  document.documentElement.style.setProperty('--rgb', rgb)
  document.body.dataset.ambient = state.ambient
  document.body.dataset.density = state.density
  document.body.dataset.effect = state.effect
  document.documentElement.dataset.mode = state.themeMode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : state.themeMode
  document.body.dataset.wallpaperPreset = state.wallpaperEnabled ? state.wallpaperPreset : 'none'
  document.body.dataset.frameStyle = state.frameStyle
  document.body.dataset.interfaceFont = state.interfaceFont
  document.documentElement.style.setProperty('--tile-size', `${state.tileSize}px`)
  document.documentElement.style.setProperty('--panel-opacity', `${state.panelOpacity}%`)
  document.body.classList.toggle('hide-sidebar', !state.showSidebar)
  $('.notes-card').hidden = !state.showNotes
  $('footer div').hidden = !state.showClock
  document.documentElement.style.setProperty('--wallpaper-dim', String(1 - state.brightness / 100))
  document.documentElement.style.setProperty('--wallpaper-blur', `${state.blur}px`)
  document.body.classList.toggle('motion', state.motion)
  document.documentElement.style.setProperty('--wallpaper', state.wallpaperEnabled && state.wallpaper ? `url("${state.wallpaper}")` : 'none')
  $('#engine').value = state.engine
  $('#ambient').value = state.ambient
  $('#motion').checked = state.motion
  $('#engine-label').textContent = engines[state.engine][0]
  document.querySelectorAll('[data-setting]').forEach(control => { const key = control.dataset.setting; if (control.type === 'checkbox') control.checked = state[key]; else control.value = state[key] })
  document.querySelectorAll('[data-accent]').forEach(button => button.setAttribute('aria-pressed', String(!state.useCustomColor && button.dataset.accent === state.accent)))
  document.dispatchEvent(new Event('veyrion-appearance'))
}
function renderLinks() {
  $('#shortcuts').replaceChildren()
  state.shortcuts.forEach((item, index) => {
    const card = document.createElement('div')
    card.className = 'shortcut'
    const anchor = document.createElement('a')
    anchor.href = safeUrl(item.url)
    anchor.rel = 'noreferrer'
    const icon = document.createElement('span')
    icon.className = 'letter'
    icon.textContent = item.title.slice(0, 1).toUpperCase()
    const label = document.createElement('span')
    label.textContent = item.title.slice(0, 30)
    anchor.append(icon, label)
    const remove = document.createElement('button')
    remove.className = 'remove'
    remove.textContent = '×'
    remove.setAttribute('aria-label', `Eliminar ${item.title}`)
    remove.addEventListener('click', () => { state.shortcuts.splice(index, 1); renderLinks(); save().catch(() => {}) })
    card.append(anchor, remove)
    $('#shortcuts').append(card)
  })
}
function clock() {
  const now = new Date()
  $('#clock').textContent = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
  $('#date').textContent = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' }).format(now).toUpperCase()
}
$('#search').addEventListener('submit', event => { event.preventDefault(); location.assign(destination($('#query').value, state.engine)) })
for (const id of ['customize', 'customize-top']) $(`#${id}`).addEventListener('click', () => $('#settings-dialog').showModal())
for (const property of ['engine', 'ambient', 'motion']) $(`#${property}`).addEventListener('change', event => {
  state[property] = property === 'motion' ? event.target.checked : event.target.value
  apply(); save().catch(() => {})
})
document.querySelectorAll('[data-accent]').forEach(button => button.addEventListener('click', () => { appearanceRevision++; lastAppearanceEdit=Date.now(); state.accent = button.dataset.accent; state.useCustomColor = false; apply(); document.dispatchEvent(new Event('veyrion-settings')); save().catch(() => {}) }))
document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', async () => {
  const url = `brave://${button.dataset.page}/`
  if (extension) {
    try { await chrome.tabs.create({ url }) } catch { toast('Abre esta dirección en la barra: ' + url) }
  } else toast('En la extensión puedes abrir ' + url)
}))
$('#add-link').addEventListener('click', () => state.shortcuts.length < 16 ? $('#link-dialog').showModal() : toast('Puedes guardar hasta 16 accesos.'))
$('#close-link').addEventListener('click', () => $('#link-dialog').close())
$('#link-form').addEventListener('submit', event => {
  event.preventDefault()
  const url = safeUrl($('#link-url').value)
  if (!url || !url.startsWith('https:')) return toast('Introduce una dirección HTTPS válida, sin credenciales.')
  state.shortcuts.push({ title: $('#link-title').value.trim() || new URL(url).hostname, url })
  renderLinks(); save().catch(() => {}); $('#link-dialog').close(); event.target.reset()
})
let noteTimer
$('#notes').addEventListener('input', () => {
  state.notes = $('#notes').value
  $('#note-status').textContent = 'GUARDANDO…'
  clearTimeout(noteTimer)
  noteTimer = setTimeout(() => save().then(() => { $('#note-status').textContent = 'GUARDADO' }).catch(() => { $('#note-status').textContent = 'ERROR' }), 250)
})
window.addEventListener('pagehide', () => { if (noteTimer) { clearTimeout(noteTimer); save().catch(() => {}) } })
$('#wallpaper').addEventListener('change', async event => {
  const file = event.target.files[0]
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) { event.target.value = ''; return toast('Elige una imagen PNG, JPG o WebP de hasta 3 MB.') }
  const reader = new FileReader()
  reader.onload = () => { state.wallpaper = reader.result; apply(); save().catch(() => {}) }
  reader.onerror = () => toast('No se pudo leer la imagen.')
  reader.readAsDataURL(file)
})
$('#clear-wallpaper').addEventListener('click', () => { state.wallpaper = ''; $('#wallpaper').value = ''; apply(); save().catch(() => {}) })
try {
  const data = extension ? await readExtensionState() : JSON.parse(localStorage.getItem('nebula') || 'null')
  state = normalize(data || defaults)
} catch { toast('No se pudieron cargar tus preferencias.') }
async function readNativeAppearance(initial = false) {
  if (!globalThis.chrome?.braveTheme?.getVeyrionChrome || (!initial && Date.now()-lastAppearanceEdit<1000)) return false
  const revision = appearanceRevision
  const native = await new Promise(resolve => chrome.braveTheme.getVeyrionChrome(json => {
    if (chrome.runtime.lastError) resolve(null)
    else { try { resolve(JSON.parse(json)) } catch { resolve(null) } }
  }))
  if (native?.initialized && revision===appearanceRevision) {
    const previous = JSON.stringify(state)
    const hex = '#'+native.color.toString(16).padStart(6,'0')
    const named = Object.entries(colors).find(([,value])=>value[0].toLowerCase()===hex)
    state = normalize({...state, themeMode:native.mode, sidebarIconSize:native.size,
      sidebarSpacing:native.spacing, sidebarColoredIcons:native.colored, useCustomColor:!named,
      accent:named?.[0] || state.accent, customColor:hex})
    return JSON.stringify(state)!==previous
  }
  return false
}
await readNativeAppearance(true)
globalThis.chrome?.runtime?.onMessage?.addListener(message=>{
  if(message?.type==='veyrion-appearance-applied')readNativeAppearance(true).then(changed=>{if(changed)apply()})
})
window.addEventListener('focus',()=>setTimeout(()=>readNativeAppearance().then(changed=>{if(changed)apply()}),100))
apply(); renderLinks(); $('#notes').value = state.notes; clock(); setInterval(clock, 30000)
document.body.dataset.ready = 'true'
export function preferences() { return structuredClone(state) }
export function updatePreferences(patch) {
  appearanceRevision++; lastAppearanceEdit=Date.now()
  state = normalize({ ...state, ...patch })
  apply()
  document.dispatchEvent(new Event('veyrion-settings'))
  return save().catch(() => {})
}
