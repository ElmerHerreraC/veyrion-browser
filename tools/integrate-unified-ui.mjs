import fs from 'node:fs'
import path from 'node:path'

export function integrateUnifiedUi(source) {
  const coreUrl='chrome-extension://mnojpmjdmbbfmejpflffifhffcmidifd/veyrion_start/index.html'
  function edit(relative, marker, transform) {
    const target=path.resolve(source,relative), before=fs.readFileSync(target,'utf8')
    if(before.includes(marker))return
    const after=transform(before)
    if(after===before || !after.includes(marker))throw new Error('Revisar integración: '+relative)
    fs.writeFileSync(target,after)
  }
  edit('browser/ui/views/frame/split_view/brave_multi_contents_view.cc','// Veyrion: detach focused panels safely',text=>text.replace('  CHECK(contents_container_view_for_web_panel_);\n  contents_container_view_for_web_panel_->contents_view()->SetWebContents(', `  CHECK(contents_container_view_for_web_panel_);
  // Veyrion: detach focused panels safely before layout queries active contents.
  if (!web_contents) is_web_panel_active_ = false;
  contents_container_view_for_web_panel_->contents_view()->SetWebContents(`).replaceAll('  if (is_web_panel_active_) {', `  if (is_web_panel_active_ && contents_container_view_for_web_panel_ &&
      contents_container_view_for_web_panel_->contents_view()->web_contents()) {`).replace('  if (is_web_panel_active_ &&\n      contents_container_view_for_web_panel_->contents_view()->web_contents() ==', '  if (web_contents && contents_container_view_for_web_panel_ &&\n      contents_container_view_for_web_panel_->contents_view()->web_contents() =='))
  edit('browser/ui/views/sidebar/sidebar_add_item_bubble_delegate_view.cc','// Veyrion: clear editors before rebuilding',text=>text.replace('  RemoveAllChildViews();', '  // Veyrion: clear editors before rebuilding their owned views.\n  veyrion_url_ = nullptr;\n  veyrion_error_ = nullptr;\n  RemoveAllChildViews();'))
  edit('browser/ui/sidebar/sidebar_service_factory.cc','veyrion.icon_size',text=>text.replace('  registry->RegisterIntegerPref(kVeyrionDesktopLayoutVersion, 0);', `  registry->RegisterIntegerPref(kVeyrionDesktopLayoutVersion, 0);
  registry->RegisterStringPref("veyrion.theme_mode", "dark");
  registry->RegisterIntegerPref("veyrion.icon_size", 20);
  registry->RegisterIntegerPref("veyrion.icon_spacing", 3);
  registry->RegisterBooleanPref("veyrion.colored_icons", true);
  registry->RegisterDictionaryPref("veyrion.hidden_icons");
  registry->RegisterDictionaryPref("veyrion.custom_icons");`).replace('  for (const auto& type : kDefaultBuiltInItemTypes) {', '  for (const auto& type : kDefaultBuiltInItemTypes) {\n    if (type == SidebarItem::BuiltInItemType::kReadingList) continue;').replace('  return service;', `  // Remove only the sidebar shortcut; reading-list data remains intact.
  for (int index = static_cast<int>(service->items().size()) - 1; index >= 0; --index) {
    if (service->items()[index].built_in_item_type == SidebarItem::BuiltInItemType::kReadingList)
      service->RemoveItemAt(index);
  }
  return service;`))
  edit('browser/ui/toolbar/brave_location_bar_model_delegate.cc','// Veyrion internal-page identity',text=>text.replace('    const {\n#if BUILDFLAG(IS_BRAVE_ORIGIN_BRANDED)', `    const {
  // Veyrion internal-page identity uses the same V as the main menu.
  GURL internal_url;
  if (GetURL(&internal_url) && internal_url.SchemeIs(content::kChromeUIScheme))
    return &kAppMenuOutlineIcon;
#if BUILDFLAG(IS_BRAVE_ORIGIN_BRANDED)`))
  edit('../ui/base/resource/resource_bundle.cc','// Veyrion product labels',text=>text.replace('  return GetLocalizedStringImpl(resource_id);', `  // Veyrion product labels retain translations and upstream legal attribution.
  auto label = GetLocalizedStringImpl(resource_id);
  if (label.find(u"Brave") != std::u16string::npos &&
      label.find(u"Brave Search") == std::u16string::npos &&
      label.find(u"Brave Talk") == std::u16string::npos &&
      label.find(u"Brave Software") == std::u16string::npos &&
      label.find(u"BraveSoftware") == std::u16string::npos &&
      label.find(u"Authors") == std::u16string::npos &&
      label.find(u"Mozilla") == std::u16string::npos &&
      label.find(u"Copyright") == std::u16string::npos &&
      label.find(u"copyright") == std::u16string::npos &&
      label.find(u"©") == std::u16string::npos &&
      label.find(u"trademark") == std::u16string::npos &&
      label.find(u"http") == std::u16string::npos) {
    base::ReplaceSubstringsAfterOffset(&label, 0, u"Brave", u"Veyrion");
  }
  return label;`))
  edit('../chrome/browser/ui/views/new_tab_footer/footer_controller.cc','// Veyrion owns its customization entry',text=>text.replace('    ShouldShowExtensionFooter(const GURL& url) {', `    ShouldShowExtensionFooter(const GURL& url) {
  // Veyrion owns its customization entry; keep enterprise notices untouched.
  if (url.SchemeIs("chrome-extension") &&
      url.host() == "mnojpmjdmbbfmejpflffifhffcmidifd") return false;`))
  edit('../chrome/browser/ui/views/side_panel/customize_chrome/side_panel_controller_views.cc','// Veyrion unified customization',text=>text.replace('#include "content/public/browser/web_contents.h"', '#include "content/public/browser/web_contents.h"\n#include "content/public/browser/open_url_params.h"\n#include "ui/base/page_transition_types.h"\n#include "ui/base/window_open_disposition.h"').replace(/(void SidePanelControllerViews::OpenSidePanel\(\s*SidePanelOpenTrigger trigger,\s*std::optional<CustomizeChromeSection> section\) \{)[\s\S]*?\n\}/, `$1
  // Veyrion unified customization replaces the competing native theme panel.
  tab_->GetContents()->OpenURL(content::OpenURLParams(
      GURL("${coreUrl}?customize=1"), content::Referrer(),
      WindowOpenDisposition::NEW_FOREGROUND_TAB, ui::PAGE_TRANSITION_AUTO_TOPLEVEL,
      false), {});
}`))
  edit('browser/ui/views/sidebar/sidebar_control_view.cc','// Veyrion unified settings shortcut',text=>text.replace(/    ShowSingletonTabOverwritingNTP\(\s*browser_,\s*GURL\("brave:\/\/settings\?search=" \+\s*l10n_util::GetStringUTF8\(\s*IDS_SETTINGS_APPEARNCE_SETTINGS_SIDEBAR_PART_TITLE\)\)\);/, `    // Veyrion unified settings shortcut.
    ShowSingletonTabOverwritingNTP(browser_, GURL("${coreUrl}?customize=1&section=icons"));`))
  edit('browser/extensions/api/brave_theme_api.cc','// Veyrion applies the mode after generating',text=>text.replace('  theme_service->SetBrowserColorScheme(ThemeService::BrowserColorScheme::kDark);\n  theme_service->BuildAutogeneratedThemeFromColor(', '  theme_service->BuildAutogeneratedThemeFromColor(').replace('  return RespondNow(WithArguments(static_cast<int>(', `  // Veyrion applies the mode after generating the palette to avoid light resets.
  const auto mode = Profile::FromBrowserContext(browser_context())->GetPrefs()
                        ->GetString("veyrion.theme_mode");
  theme_service->SetBrowserColorScheme(mode == "light"
      ? ThemeService::BrowserColorScheme::kLight : mode == "system"
      ? ThemeService::BrowserColorScheme::kSystem : ThemeService::BrowserColorScheme::kDark);
  return RespondNow(WithArguments(static_cast<int>(`))
  edit('browser/ui/color/material_brave_color_mixer.cc','// Veyrion unified neutral surfaces',text=>text.replace(/  \/\/ Veyrion desktop surfaces[\s\S]*?\n  \/\/ Use leo color/, `  // Veyrion unified neutral surfaces share the user-selected accent.
  const SkColor frame = is_dark ? SkColorSetRGB(11,11,11) : SkColorSetRGB(238,238,238);
  const SkColor surface = is_dark ? SkColorSetRGB(23,23,23) : SkColorSetRGB(250,250,250);
  mixer[ui::kColorFrameActive] = {frame};
  mixer[ui::kColorFrameInactive] = {frame};
  mixer[kColorToolbar] = {surface};
  mixer[kColorTabBackgroundActiveFrameActive] = {surface};
  mixer[kColorTabBackgroundActiveFrameInactive] = {surface};
  mixer[ui::kColorSysPrimary] = {key.user_color.value_or(SkColorSetRGB(0,217,189))};
  mixer[kColorToolbarContentAreaSeparator] = {ui::kColorSysPrimary};

  // Use leo color`))
  edit('browser/resources/settings/br/settings_ui.ts','/* Veyrion unified system settings */',text=>text.replace('      /* Veyrion settings */','      /* Veyrion unified system settings */').replaceAll('#100d18','#0b0b0b').replaceAll('#191424','#171717').replace('      /** Styling tweaks', `      @media (prefers-color-scheme: light) {
        :host { background: #eee; --leo-color-container-background: #eee;
          --leo-color-page-background: #fafafa; }
      }
      /** Styling tweaks`))
  console.log('Estabilidad de paneles, marca y entrada única de personalización integradas.')
}
