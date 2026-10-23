export const defaults = {
  accent: 'violet', ambient: 'orbit', engine: 'duckduckgo', motion: false,
  notes: '', wallpaper: '', customColor: '#a48bff', useCustomColor: false,
  brightness: 70, blur: 0, density: 'comfortable', effect: 'none',
  sounds: false, soundPack: 'glass', volume: 25, music: false,
  showNotes: true, showClock: true, showSidebar: false, syncNativeTheme: true,
  frameStyle: 'angular', tileSize: 140, interfaceFont: 'system', panelOpacity: 85,
  webEffect: 'none', webSounds: false,
  shortcuts: [
    { title: 'YouTube', url: 'https://www.youtube.com/' },
    { title: 'GitHub', url: 'https://github.com/' },
    { title: 'Twitch', url: 'https://www.twitch.tv/' },
    { title: 'Discord', url: 'https://discord.com/app' }
  ]
}
export const engines = {
  duckduckgo: ['DuckDuckGo', 'https://duckduckgo.com/?q='],
  brave: ['Brave Search', 'https://search.brave.com/search?q='],
  google: ['Google', 'https://www.google.com/search?q=']
}
export function safeUrl(value) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}
export function destination(value, engine = 'duckduckgo') {
  const input = value.trim()
  if (/^[a-z][a-z0-9+.-]*:/i.test(input)) {
    const direct = safeUrl(input)
    if (direct) return direct
    // Ports on hostnames are handled below; other schemes stay search text.
    if (!/^[\w.-]+:\d+(\/|$)/.test(input)) return (engines[engine] || engines.duckduckgo)[1] + encodeURIComponent(input)
  }
  if (!/\s/.test(input) && /^(localhost|[\w-]+(?:\.[\w-]+)+)(:\d+)?([/?#]|$)/i.test(input)) {
    const url = safeUrl('https://' + input)
    if (url) return url
  }
  return (engines[engine] || engines.duckduckgo)[1] + encodeURIComponent(input)
}
export function normalize(raw = {}) {
  const value = { ...structuredClone(defaults), ...raw }
  if (!['violet', 'cyan', 'rose', 'lime'].includes(value.accent)) value.accent = defaults.accent
  if (!['orbit', 'grid', 'quiet'].includes(value.ambient)) value.ambient = defaults.ambient
  if (!Object.hasOwn(engines, value.engine)) value.engine = defaults.engine
  value.notes = typeof value.notes === 'string' ? value.notes.slice(0, 12000) : ''
  value.motion = value.motion === true
  for (const key of ['sounds', 'music', 'useCustomColor']) value[key] = value[key] === true
  for (const key of ['showNotes', 'showClock', 'showSidebar']) value[key] = value[key] !== false
  value.syncNativeTheme = value.syncNativeTheme !== false
  value.webSounds = value.webSounds === true
  if (!['none', 'warm', 'night', 'mono'].includes(value.webEffect)) value.webEffect = defaults.webEffect
  if (!['angular', 'glass', 'classic'].includes(value.frameStyle)) value.frameStyle = defaults.frameStyle
  if (!['system', 'mono', 'rounded'].includes(value.interfaceFont)) value.interfaceFont = defaults.interfaceFont
  for (const [key, min, max] of [['tileSize', 100, 210], ['panelOpacity', 35, 100]]) value[key] = Number.isFinite(Number(value[key])) ? Math.min(max, Math.max(min, Number(value[key]))) : defaults[key]
  for (const [key, min, max] of [['brightness', 20, 100], ['blur', 0, 20], ['volume', 0, 100]]) value[key] = Number.isFinite(Number(value[key])) ? Math.min(max, Math.max(min, Number(value[key]))) : defaults[key]
  if (!/^#[a-f0-9]{6}$/i.test(value.customColor)) value.customColor = defaults.customColor
  if (!['comfortable', 'compact'].includes(value.density)) value.density = defaults.density
  if (!['none', 'scanlines', 'vignette'].includes(value.effect)) value.effect = defaults.effect
  if (!['glass', 'arcade', 'soft'].includes(value.soundPack)) value.soundPack = defaults.soundPack
  value.wallpaper = typeof value.wallpaper === 'string' && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value.wallpaper) && value.wallpaper.length < 4300000 ? value.wallpaper : ''
  value.shortcuts = Array.isArray(value.shortcuts) ? value.shortcuts.filter(item => item && typeof item.title === 'string' && safeUrl(item.url)).slice(0, 16) : structuredClone(defaults.shortcuts)
  return value
}
