import fs from 'node:fs'
import path from 'node:path'
export function integrateNativeSidebar(source) {
  const factoryPath = path.join(source, 'browser/ui/sidebar/sidebar_service_factory.cc')
  let factory = fs.readFileSync(factoryPath, 'utf8')
  if (!factory.includes('kVeyrionDesktopLayoutVersion')) {
    const original = `  return std::make_unique<SidebarService>(
      profile->GetPrefs(), GetBuiltInItemTypesForProfile(profile));`
    if (!factory.includes(original)) throw new Error('Cambió SidebarServiceFactory; revisar migración de interfaz.')
    factory = factory.replace('#include <memory>', '#include <algorithm>\n#include <memory>\n#include <string>')
      .replace('#include "brave/components/sidebar/browser/pref_names.h"', '#include "brave/components/sidebar/browser/pref_names.h"\n#include "brave/components/sidebar/browser/sidebar_item.h"')
      .replace('#include "components/version_info/channel.h"', '#include "components/version_info/channel.h"\n#include "url/gurl.h"')
      .replace('#include "chrome/common/channel_info.h"', '#include "chrome/common/channel_info.h"\n#include "chrome/common/pref_names.h"')
      .replace('namespace sidebar {', 'namespace sidebar {\nnamespace {\nconstexpr char kVeyrionDesktopLayoutVersion[] = "veyrion.desktop_layout_version";\n}  // namespace\n')
      .replace('  SidebarService::RegisterProfilePrefs(', '  registry->RegisterIntegerPref(kVeyrionDesktopLayoutVersion, 0);\n  SidebarService::RegisterProfilePrefs(')
      .replace(original, `  auto* preferences = profile->GetPrefs();
  const bool initialize_layout = !profile->IsOffTheRecord() &&
      preferences->GetInteger(kVeyrionDesktopLayoutVersion) < 1;
  if (initialize_layout) {
    preferences->SetBoolean(prefs::kSidePanelHorizontalAlignment, false);
    preferences->SetInteger(kSidebarShowOption,
        static_cast<int>(SidebarService::ShowSidebarOption::kShowAlways));
  }
  auto service = std::make_unique<SidebarService>(
      preferences, GetBuiltInItemTypesForProfile(profile));
  if (initialize_layout) {
    const auto add_panel = [&service](const char* url,
                                     const std::u16string& title) {
      const GURL panel_url(url);
      if (std::ranges::none_of(service->items(), [&panel_url](const auto& item) {
            return item.url == panel_url;
          })) {
        service->AddItem(SidebarItem::Create(panel_url, title,
            SidebarItem::Type::kTypeWeb, SidebarItem::BuiltInItemType::kNone,
            /*open_in_panel=*/true));
      }
    };
    add_panel("https://web.whatsapp.com/", u"WhatsApp");
    add_panel("https://web.telegram.org/", u"Telegram");
    add_panel("https://discord.com/app", u"Discord");
    add_panel("https://www.twitch.tv/", u"Twitch");
    add_panel("https://open.spotify.com/", u"Spotify");
    preferences->SetInteger(kVeyrionDesktopLayoutVersion, 1);
  }
  return service;`)
    fs.writeFileSync(factoryPath, factory)
  }
  const featuresPath = path.join(source, 'components/sidebar/common/features.cc')
  let features = fs.readFileSync(featuresPath, 'utf8')
  features = features.replace(/BASE_FEATURE\(kSidebarWebPanel,\s*base::FEATURE_DISABLED_BY_DEFAULT\);/, 'BASE_FEATURE(kSidebarWebPanel,\n             base::FEATURE_ENABLED_BY_DEFAULT);')
  fs.writeFileSync(featuresPath, features)
  const controlsPath = path.join(source, 'browser/ui/views/sidebar/sidebar_control_view.cc')
  let controls = fs.readFileSync(controlsPath, 'utf8')
  if (!controls.includes('// Veyrion: accent edge')) {
    controls = controls.replace('#include "ui/base/metadata/metadata_impl_macros.h"', '#include "ui/base/metadata/metadata_impl_macros.h"\n#include "ui/color/color_id.h"')
    const original = `  SetBorder(views::CreateEmptyBorder(gfx::Insets::TLBR(
      0, sidebar_on_left_ ? 0 : overlap, 0, sidebar_on_left_ ? overlap : 0)));`
    if (!controls.includes(original)) throw new Error('Cambió SidebarControlView; revisar borde lateral.')
    controls = controls.replace(original, `  // Veyrion: accent edge follows the current native theme.
  SetBorder(views::CreatePaddedBorder(
      views::CreateSolidSidedBorder(gfx::Insets::TLBR(
          0, sidebar_on_left_ ? 0 : 1, 0, sidebar_on_left_ ? 1 : 0),
          ui::kColorSysPrimary),
      gfx::Insets::TLBR(0, sidebar_on_left_ ? 0 : overlap,
                       0, sidebar_on_left_ ? overlap : 0)));`)
    fs.writeFileSync(controlsPath, controls)
  }
  console.log('Barra nativa persistente a la izquierda y paneles web preparados.')
}
