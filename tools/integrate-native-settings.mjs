import fs from 'node:fs'
import path from 'node:path'
import {root} from './paths.mjs'

export function integrateNativeSettings(source) {
  const edit=(relative,change)=>{const file=path.resolve(source,relative);const before=fs.readFileSync(file,'utf8');const after=change(before);if(after!==before)fs.writeFileSync(file,after)}
  for(const relative of ['browser/resources/settings/brave_system_page/brave_system_page_index.html','browser/resources/settings/brave_origin_page/brave_origin_page.html'])edit(relative,s=>s.replace(/<settings-brave-origin-onboarding\b[^>]*>[\s\S]*?<\/settings-brave-origin-onboarding>/g,''))
  edit('browser/resources/settings/br/page_visibility.ts',s=>s.replace(/origin: loadTimeData\.getBoolean\('isBraveOriginPurchased'\) &&\s*!loadTimeData\.getBoolean\('isBraveOriginBrandedBuild'\),/,'origin: false,'))
  edit('browser/resources/settings/brave_system_page/brave_system_page_index.ts',s=>s.replace(/value: \(\) => loadTimeData\.getBoolean\('isBraveOriginFeatureEnabled'\) &&\s*!loadTimeData\.getBoolean\('isBraveOriginBrandedBuild'\),/,'value: false,'))
  edit('../chrome/browser/ui/views/new_tab_footer/footer_controller.cc',s=>s.includes('// Veyrion standard new-tab aliases')?s:s.replace('  // Veyrion owns its customization entry;',`  // Veyrion standard new-tab aliases also omit extension attribution.
  if (url.SchemeIs("chrome") && (url.host() == "newtab" ||
      url.host() == "new-tab-page" || url.host() == "new-tab-page-third-party")) return false;
  // Veyrion owns its customization entry;`))
  edit('../chrome/browser/resources/settings/appearance_page/appearance_page.html.ts',s=>s.includes('<veyrion-native-appearance>')?s:s.replace('return html`','return html`\n<veyrion-native-appearance></veyrion-native-appearance>'))
  edit('../chrome/browser/resources/settings/appearance_page/appearance_page.css',s=>(s.includes('/* Veyrion appearance owner */')?s:s+'\n/* Veyrion appearance owner */\n#themeRow,\n#colorSchemeModeRow {\n  display: none !important;\n}\n').replace('#themeRow, #colorSchemeModeRow { display: none !important; }','#themeRow,\n#colorSchemeModeRow {\n  display: none !important;\n}'))
  edit('browser/ui/toolbar/brave_location_bar_model_delegate.cc',s=>s.replace('  brave_utils::ReplaceChromeToBraveScheme(*new_formatted_url);','  // Veyrion keeps standard chrome:// internal URLs without upstream branding.'))
  edit('browser/ui/views/location_bar/brave_location_bar_view.cc',s=>s.replace(/int BraveLocationBarView::GetBorderRadius\(\) const \{[\s\S]*?\n\}/,'int BraveLocationBarView::GetBorderRadius() const {\n  return 6;  // Veyrion angular address bar.\n}'))
  edit('browser/ui/sidebar/sidebar_service_factory.cc',s=>s.includes('// Veyrion hides the upstream calling shortcut')?s:s.replace('    if (type == SidebarItem::BuiltInItemType::kReadingList) continue;',`    if (type == SidebarItem::BuiltInItemType::kReadingList) continue;
    // Veyrion hides the upstream calling shortcut.
#if BUILDFLAG(ENABLE_BRAVE_TALK)
    if (type == SidebarItem::BuiltInItemType::kBraveTalk) continue;
#endif`).replace('    if (service->items()[index].built_in_item_type == SidebarItem::BuiltInItemType::kReadingList)',`    if (service->items()[index].built_in_item_type == SidebarItem::BuiltInItemType::kReadingList
#if BUILDFLAG(ENABLE_BRAVE_TALK)
        || service->items()[index].built_in_item_type == SidebarItem::BuiltInItemType::kBraveTalk
#endif
        )`))
  edit('../chrome/browser/ui/views/side_panel/customize_chrome/side_panel_controller_views.cc',s=>s.replace('content/public/browser/open_url_params.h','content/public/browser/page_navigator.h').replace(/GURL\("chrome-extension:\/\/mnojpmjdmbbfmejpflffifhffcmidifd\/veyrion_start\/index.html\?customize=1"\)/g,'GURL("chrome://settings/appearance")'))
  edit('browser/ui/views/sidebar/sidebar_control_view.cc',s=>s.replace(/GURL\("chrome-extension:\/\/mnojpmjdmbbfmejpflffifhffcmidifd\/veyrion_start\/index.html\?customize=1&section=icons"\)/g,'GURL("chrome://settings/appearance#veyrion-icons")'))
  edit('browser/ui/color/material_brave_color_mixer.cc',s=>s.replace(/  \/\/ Veyrion desktop surfaces[\s\S]*?\n  \/\/ Use leo color/,'  // Use leo color'))
  edit('browser/resources/settings/br/settings_ui.ts',s=>{
    s=s.replace(/      \/\* Veyrion settings \*\/[\s\S]*?      \/\*\* Styling tweaks/,'      /** Styling tweaks')
    if(!s.includes('id="veyrion-settings-nav"'))s=s.replace('    templateContent.prepend(braveHtml`', `    toolbar?.setAttribute('page-name', 'CONFIGURACIÓN')
    toolbar?.before(braveHtml\`<nav id="veyrion-settings-nav" aria-label="Navegador">
      <a href="chrome://history/">HISTORIAL</a><a href="chrome://downloads/">DESCARGAS</a>
      <strong>CONFIGURACIÓN</strong><a href="chrome://bookmarks/">MARCADORES</a>
      <a href="chrome://extensions/">EXTENSIONES</a></nav>\`)
    templateContent.prepend(braveHtml\``)
    const start='// BEGIN VEYRION NATIVE SETTINGS',end='// END VEYRION NATIVE SETTINGS'
    if(s.includes(start))s=s.slice(0,s.indexOf(start))+s.slice(s.indexOf(end)+end.length)
    return s+'\n'+start+'\n'+fs.readFileSync(path.join(root,'native-ui/settings.ts'),'utf8')+'\n'+end+'\n'
  })
  edit('browser/ui/webui/settings/brave_appearance_handler.h',s=>s.includes('HandleVeyrionAppearance')?s:s.replace('  void OnPreferenceChanged(', '  void HandleVeyrionAppearance(const base::ListValue& args);\n  void OnPreferenceChanged('))
  edit('browser/ui/webui/settings/brave_appearance_handler.cc',s=>{
    if(!s.includes('"veyrionAppearance"'))s=s.replace('  profile_ = Profile::FromWebUI(web_ui());','  profile_ = Profile::FromWebUI(web_ui());\n  web_ui()->RegisterMessageCallback("veyrionAppearance", base::BindRepeating(\n      &BraveAppearanceHandler::HandleVeyrionAppearance, base::Unretained(this)));')
    const mark='// BEGIN VEYRION APPEARANCE HANDLER'
    if(s.includes(mark))s=s.slice(0,s.indexOf(mark))
    return s+'\n'+mark+'\n'+fs.readFileSync(path.join(root,'native-ui/appearance-handler.cc'),'utf8')
  })
  edit('browser/ui/sidebar/sidebar_service_factory.cc',s=>s.includes('veyrion.appearance_initialized')?s:s.replace('  registry->RegisterStringPref("veyrion.theme_mode", "dark");','  registry->RegisterStringPref("veyrion.theme_mode", "dark");\n  registry->RegisterBooleanPref("veyrion.appearance_initialized", false);'))
  edit('browser/extensions/api/brave_theme_api.cc',s=>s.includes('state.Set("initialized"')?s:s.replace('  base::DictValue state;','  base::DictValue state;\n  state.Set("initialized", prefs->GetBoolean("veyrion.appearance_initialized"));\n  state.Set("color", static_cast<int>(ThemeServiceFactory::GetForProfile(profile)->GetAutogeneratedThemeColor() & 0x00FFFFFF));').replace('  theme_service->BuildAutogeneratedThemeFromColor(', '  Profile::FromBrowserContext(browser_context())->GetPrefs()->SetBoolean("veyrion.appearance_initialized", true);\n  theme_service->BuildAutogeneratedThemeFromColor('))
  edit('browser/extensions/api/brave_theme_api.cc',s=>s.includes('// Veyrion modern native color')?s:s.replace('  theme_service->BuildAutogeneratedThemeFromColor(', '  // Veyrion modern native color respects the selected light/dark scheme.\n  theme_service->SetUserColor(').replace('theme_service->GetAutogeneratedThemeColor() &','theme_service->GetUserColor().value_or(theme_service->GetAutogeneratedThemeColor()) &').replace('ThemeServiceFactory::GetForProfile(profile)->GetAutogeneratedThemeColor() &','ThemeServiceFactory::GetForProfile(profile)->GetUserColor().value_or(ThemeServiceFactory::GetForProfile(profile)->GetAutogeneratedThemeColor()) &'))
  console.log('Configuración de apariencia integrada en chrome://settings/appearance con preferencias nativas.')
}
