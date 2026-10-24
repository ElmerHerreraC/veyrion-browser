// No account tokens or browsing data are sent to GitHub.
async function checkVeyrionUpdates() {
  try {
    const config = await (await fetch(chrome.runtime.getURL('veyrion_start/update-config.json'))).json()
    const result = await VeyrionUpdates.check(config)
    chrome.storage.local.set({ veyrionUpdate: result })
  } catch (error) {
    chrome.storage.local.set({ veyrionUpdate: { status: 'error', message: error.message, checkedAt: Date.now() } })
  }
}
chrome.alarms.create('veyrion-updates', { delayInMinutes: 1, periodInMinutes: 360 })
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'veyrion-updates') checkVeyrionUpdates() })
chrome.runtime.onInstalled.addListener(checkVeyrionUpdates)
chrome.runtime.onStartup.addListener(checkVeyrionUpdates)

// Apply the same appearance even when startup restores a website instead of NTP.
let appearanceFingerprint = ''
let appearanceInitializing = false
function syncVeyrionAppearance() {
  if (!chrome.braveTheme?.setVeyrionChrome || appearanceInitializing) return
  appearanceInitializing = true
  chrome.braveTheme.getVeyrionChrome(json => {
    if (chrome.runtime.lastError) { appearanceInitializing=false; return }
    try { if (JSON.parse(json).initialized) { appearanceInitializing=false; return } } catch { appearanceInitializing=false; return }
  chrome.storage.local.get('nebula', ({ nebula = {} }) => {
    const mode = ['dark', 'light', 'system'].includes(nebula.themeMode) ? nebula.themeMode : 'dark'
    const size = Math.max(14, Math.min(26, Number(nebula.sidebarIconSize) || 20))
    const spacing = Math.max(0, Math.min(10, Number(nebula.sidebarSpacing) || 0))
    const colored = nebula.sidebarColoredIcons !== false
    const palette = { violet:'#a48bff', cyan:'#6bdfe5', rose:'#ff85af', lime:'#c2eb79' }
    const color = nebula.useCustomColor && /^#[0-9a-f]{6}$/i.test(nebula.customColor) ? nebula.customColor : palette[nebula.accent] || palette.violet
    const fingerprint = JSON.stringify([mode,size,spacing,colored,color])
    if (fingerprint === appearanceFingerprint) { appearanceInitializing=false; return }
    chrome.braveTheme.setVeyrionChrome(mode, size, spacing, colored, () => {
      if (chrome.runtime.lastError) { appearanceInitializing=false; return }
      chrome.braveTheme.setVeyrionColor(...[1,3,5].map(offset => parseInt(color.slice(offset,offset+2),16)), () => {
        if (!chrome.runtime.lastError) appearanceFingerprint = fingerprint
        appearanceInitializing=false
      })
    })
  })
  })
}
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.nebula) syncVeyrionAppearance() })
chrome.runtime.onStartup.addListener(syncVeyrionAppearance)
syncVeyrionAppearance()

// The persistent component finishes appearance changes even if NTP navigates away.
let queuedAppearance, applyingAppearance=false, appearanceTimer
let appearanceResponses=[]
function drainAppearance(){
  if(applyingAppearance||!queuedAppearance)return
  const value=queuedAppearance, responses=appearanceResponses.splice(0)
  queuedAppearance=null;applyingAppearance=true
  const finish=(error,color)=>{
    applyingAppearance=false
    for(const respond of responses){try{respond({ok:!error,color,error})}catch{}}
    if(queuedAppearance)drainAppearance()
    else if(!error)chrome.runtime.sendMessage({type:'veyrion-appearance-applied'},()=>{void chrome.runtime.lastError})
  }
  chrome.braveTheme.setVeyrionChrome(value.mode,value.size,value.spacing,value.colored,()=>{
    if(chrome.runtime.lastError){finish(chrome.runtime.lastError.message);return}
    chrome.braveTheme.setVeyrionColor((value.color>>16)&255,(value.color>>8)&255,value.color&255,color=>finish(chrome.runtime.lastError?.message,color))
  })
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.type!=='veyrion-appearance'||sender.id!==chrome.runtime.id)return false
  const value=message.appearance
  if(!value||!['dark','light','system'].includes(value.mode)||!Number.isInteger(value.size)||value.size<14||value.size>26||!Number.isInteger(value.spacing)||value.spacing<0||value.spacing>10||typeof value.colored!=='boolean'||!Number.isInteger(value.color)||value.color<0||value.color>0xffffff){respond({ok:false,error:'Invalid appearance'});return false}
  queuedAppearance=value;appearanceResponses.push(respond)
  clearTimeout(appearanceTimer);appearanceTimer=setTimeout(drainAppearance,50)
  return true
})
