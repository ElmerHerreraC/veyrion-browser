// Isolated world: applies only the user's chosen effect; never reads page text.
(() => {
  let state = {}, audioContext
  let originalFilter, originalPriority
  const filters = {
    none: '', warm: 'sepia(.22) saturate(.88)',
    night: 'brightness(.78) saturate(.8)', mono: 'grayscale(1)'
  }
  function apply(value) {
    state = value && typeof value === 'object'
      ? {webEffect:value.webEffect,webSounds:value.webSounds,volume:value.volume,soundPack:value.soundPack} : {}
    const root = document.documentElement
    if (!root) return
    const filter = filters[state.webEffect] || ''
    if (filter) {
      if (originalFilter === undefined) {
        originalFilter = root.style.getPropertyValue('filter')
        originalPriority = root.style.getPropertyPriority('filter')
      }
      root.style.setProperty('filter', filter, 'important')
      root.dataset.veyrionEffect = state.webEffect
    } else if (originalFilter !== undefined) {
      if (originalFilter) root.style.setProperty('filter', originalFilter, originalPriority)
      else root.style.removeProperty('filter')
      delete root.dataset.veyrionEffect
      originalFilter = undefined
    }
  }
  chrome.storage.local.get('nebula', result => apply(result.nebula))
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.nebula) apply(changes.nebula.newValue)
  })
  function sound(event, typing) {
    if (!event.isTrusted || state.webSounds !== true || document.hidden) return
    if (typing && (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.repeat)) return
    const volume = Math.max(0, Math.min(100, Number(state.volume) || 0)) / 100
    if (!volume) return
    audioContext ??= new AudioContext()
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain()
    const packs = {glass:[typing ? 1100 : 740,'sine'],arcade:[typing ? 380 : 520,'square'],soft:[typing ? 220 : 330,'triangle']}
    const pack = packs[state.soundPack] || packs.glass
    oscillator.type = pack[1]; oscillator.frequency.value = pack[0]
    const now = audioContext.currentTime
    gain.gain.setValueAtTime(.00001, now)
    gain.gain.linearRampToValueAtTime(volume * .025, now + .008)
    gain.gain.exponentialRampToValueAtTime(.00001, now + .08)
    oscillator.connect(gain); gain.connect(audioContext.destination)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    oscillator.start(); oscillator.stop(now + .09)
  }
  document.addEventListener('click', event => sound(event, false), {passive:true})
  document.addEventListener('keydown', event => sound(event, true), {passive:true})
  window.addEventListener('pagehide', () => { audioContext?.close().catch(() => {}); audioContext = undefined })
})()
