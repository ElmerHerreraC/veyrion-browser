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
