import fs from 'node:fs'
import path from 'node:path'

export function integrateWebstoreTransport(source) {
  integrateStoreUpdater(source)
  const file=path.join(source,'common/extensions/brave_extensions_client.cc')
  let text=fs.readFileSync(file,'utf8')
  if(text.includes('// Veyrion Chrome Web Store transport'))return
  const helper=/namespace \{\r?\n\r?\nstd::string ParseUpdateUrlHost\([\s\S]*?\r?\n\}  \/\/ namespace\r?\n/
  if(!helper.test(text))throw Error('Unexpected extension update URL helper')
  text=text.replace(helper,'')
  const initialize=/void BraveExtensionsClient::InitializeWebStoreUrls\(\r?\n    base::CommandLine\* command_line\) \{[\s\S]*?\r?\n\}/
  if(!initialize.test(text))throw Error('Extension URL initialization not found')
  text=text.replace(initialize,`void BraveExtensionsClient::InitializeWebStoreUrls(
    base::CommandLine* command_line) {
  // Veyrion Chrome Web Store transport. Component updater configuration must
  // not redirect store installs/updates to a service requiring a Brave key.
  webstore_update_url_ = extension_urls::GetDefaultWebstoreUpdateUrl();
  ChromeExtensionsClient::InitializeWebStoreUrls(command_line);
}`)
  for(const header of ['base/strings/string_split.h','base/strings/string_util.h','components/component_updater/component_updater_switches.h'])text=text.replace(new RegExp('#include "'+header+'"\\r?\\n'),'')
  fs.writeFileSync(file,text)
}

function integrateStoreUpdater(source) {
  const file=path.resolve(source,'../chrome/browser/extensions/updater/chrome_update_client_config.cc')
  let text=fs.readFileSync(file,'utf8')
  if(text.includes('// Veyrion extension update transport'))return
  if(!text.includes('  return impl_.UpdateUrl();')||!text.includes('  return impl_.PingUrl();'))throw Error('Unexpected extension updater configuration')
  if(!text.includes('#include "extensions/common/extension_urls.h"'))text=text.replace('#include <algorithm>','#include <algorithm>\n#include "extensions/common/extension_urls.h"')
  text=text.replace('  return impl_.UpdateUrl();',`  // Veyrion extension update transport: keep store updates independent from
  // the component updater's Brave service override. Explicit overrides above
  // remain available for enterprise configuration and browser tests.
  return {extension_urls::GetDefaultWebstoreUpdateUrl()};`)
  text=text.replace('  return impl_.PingUrl();','  return {extension_urls::GetDefaultWebstoreUpdateUrl()};')
  fs.writeFileSync(file,text)
}
