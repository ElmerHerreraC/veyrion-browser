import fs from 'node:fs'
import path from 'node:path'

export function integrateOpenComponents(source) {
  const edit=(file,fn)=>{const target=path.join(source,file),before=fs.readFileSync(target,'utf8'),after=fn(before);if(before!==after)fs.writeFileSync(target,after)}
  const disable=(file,signature)=>edit(file,s=>{
    const start=s.indexOf(signature)
    const body=s.indexOf('{',start),end=s.indexOf('\n}',body)
    if(start<0||body<0||end<0)throw Error('Missing unused service: '+signature)
    return s.slice(0,body+1)+'\n  // Veyrion does not provide this advertising/telemetry component.\n'+s.slice(end)
  })
  disable('components/brave_ads/browser/ads_service_impl.cc','void AdsServiceImpl::RegisterResourceComponents()')
  disable('components/brave_ads/browser/ads_service_impl.cc','void AdsServiceImpl::RegisterCountryResourceComponent()')
  disable('components/brave_ads/browser/ads_service_impl.cc','void AdsServiceImpl::RegisterLanguageResourceComponent()')
  disable('components/ntp_background_images/browser/ntp_background_images_service.cc','void NTPBackgroundImagesService::RegisterBackgroundImagesComponent()')
  disable('components/ntp_background_images/browser/ntp_background_images_service.cc','void NTPBackgroundImagesService::RegisterSponsoredImagesComponent()')
  disable('components/p3a/component_installer.cc','void MaybeToggleP3AComponent(')
  edit('components/p3a/component_installer.cc',s=>s.replace(/constexpr char kP3AComponentId\[\] = "[a-p]+";\r?\n/,''))
  const includes='#include "base/base_paths.h"\n#include "base/path_service.h"'
  edit('components/brave_shields/core/browser/ad_block_default_resource_provider.cc',s=>{
    if(s.includes('// Veyrion signed bundled resources'))return s
    const from=`  RegisterAdBlockDefaultResourceComponent(
      cus,
      base::BindRepeating(&AdBlockDefaultResourceProvider::OnComponentReady,
                          weak_factory_.GetWeakPtr()));`
    if(!s.includes(from))throw Error('Unexpected default resource registration')
    return s.replace('#include <string>','#include <string>\n'+includes).replace(from,`  // Veyrion signed bundled resources: updated only through verified releases.
  base::FilePath install_dir;
  if (base::PathService::Get(base::DIR_EXE, &install_dir)) {
    OnComponentReady(install_dir.AppendASCII("veyrion-components"));
  }`)
  })
  edit('components/brave_shields/core/browser/ad_block_filter_list_catalog_provider.cc',s=>{
    if(s.includes('// Veyrion uses direct subscriptions'))return s
    const start=s.indexOf('  TRACE_EVENT("brave.adblock", "RegisterAdBlockFilterListCatalogComponent",')
    const end=s.indexOf('\n}\n',start)
    if(start<0||end<0)throw Error('Unexpected catalog registration')
    // The supported catalogue is the existing subscription UI; no fake CRX IDs.
    s=s.slice(0,start)+`  // Veyrion uses direct subscriptions from its own supported catalogue.
  base::FilePath install_dir;
  if (cus && base::PathService::Get(base::DIR_EXE, &install_dir)) {
    OnComponentReady(install_dir.AppendASCII("veyrion-components"));
  }`+s.slice(end)
    return s.replace('#include <string>','#include <string>\n'+includes)
  })
  const catalog=JSON.parse(fs.readFileSync(new URL('../config/open-filter-catalog.json',import.meta.url),'utf8'))
  for(const entry of catalog)if(new URL(entry.url).protocol!=='https:')throw Error('Filter sources must use HTTPS')
  edit('components/brave_shields/content/browser/ad_block_subscription_service_manager.cc',s=>{
    const from=s.indexOf('    constexpr const char* kVeyrionLists[] = {')
    const end=s.indexOf('    };',from)
    if(from<0||end<0)throw Error('Missing direct subscription catalogue')
    return s.slice(0,from)+'    constexpr const char* kVeyrionLists[] = {\n'+catalog.map(e=>'        '+JSON.stringify(e.url)+',').join('\n')+'\n'+s.slice(end)
  })
}
