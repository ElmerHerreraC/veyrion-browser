import fs from 'node:fs'
import path from 'node:path'

// Use the existing subscription downloader, cache, parser and update scheduler.
// Never replace a user's disabled lists or recreate lists they removed later.
export function integrateBlocking(source) {
  const edit = (file, transform) => {
    const target = path.join(source, file)
    const before = fs.readFileSync(target, 'utf8')
    const after = transform(before)
    if (before !== after) fs.writeFileSync(target, after)
  }
  edit('components/brave_shields/content/browser/ad_block_service.cc', text => {
    if (text.includes('veyrion.blocklists_initialized')) return text
    const anchor = '  registry->RegisterDictionaryPref(prefs::kAdBlockListSubscriptions);'
    if (!text.includes(anchor)) throw new Error('Missing adblock preference registration')
    return text.replace(anchor, anchor + '\n  registry->RegisterBooleanPref("veyrion.blocklists_initialized", false);')
  })
  edit('components/brave_shields/content/browser/ad_block_subscription_service_manager.cc', text => {
    if (text.includes('// Veyrion direct filter subscriptions')) return text
    const anchor = '  LoadSubscriptionServices();'
    if (!text.includes(anchor)) throw new Error('Missing subscription startup')
    return text.replace(anchor, anchor + `
  // Veyrion direct filter subscriptions: independent of component catalog delivery.
  // Only initialize once; subsequent user opt-outs remain authoritative.
  if (local_state_ &&
      !local_state_->GetBoolean("veyrion.blocklists_initialized")) {
    constexpr const char* kVeyrionLists[] = {
        "https://easylist.to/easylist/easylist.txt",
        "https://easylist.to/easylist/easyprivacy.txt",
        "https://easylist-downloads.adblockplus.org/easylistspanish.txt",
        "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/quick-fixes.txt",
    };
    for (const char* address : kVeyrionLists) {
      const GURL url(address);
      if (!subscriptions_.FindDict(url.spec())) {
        CreateSubscription(url);
      }
    }
    local_state_->SetBoolean("veyrion.blocklists_initialized", true);
  }
`)
  })
}
