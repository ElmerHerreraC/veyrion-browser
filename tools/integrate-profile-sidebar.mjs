import fs from 'node:fs'
import path from 'node:path'

export function integrateProfileSidebar(source){
  const edit=(file,change)=>{const target=path.resolve(source,file),before=fs.readFileSync(target,'utf8'),after=change(before);if(after!==before)fs.writeFileSync(target,after)}
  edit('browser/ui/sidebar/sidebar_service_factory.cc',s=>s.includes('veyrion.workspace_revision')?s:s.replace('  registry->RegisterBooleanPref("veyrion.auto_pip", true);','  registry->RegisterIntegerPref("veyrion.workspace_revision", 0);\n  registry->RegisterBooleanPref("veyrion.auto_pip", true);'))
  edit('browser/ui/views/sidebar/sidebar_control_view.h',s=>s.includes('QueueVeyrionWorkspaces')?s:s.replace('#include "base/scoped_observation.h"','#include "base/scoped_observation.h"\n#include "chrome/browser/ui/browser_window/public/profile_browser_collection.h"\n#include "chrome/browser/ui/browser_window/public/browser_collection_observer.h"\n#include "components/prefs/pref_change_registrar.h"').replace('public sidebar::SidebarModel::Observer {','public sidebar::SidebarModel::Observer,\n                           public BrowserCollectionObserver {').replace('  void Update();',`  void OnBrowserCreated(BrowserWindowInterface*) override;
  void OnBrowserClosed(BrowserWindowInterface*) override;
  void OnBrowserActivated(BrowserWindowInterface*) override;
  void Update();`).replace('  void RefreshVeyrionUpdate();',`  void QueueVeyrionWorkspaces();
  void RefreshVeyrionWorkspaces();
  void RefreshVeyrionDark();
  raw_ptr<views::View> veyrion_workspaces_ = nullptr;
  raw_ptr<SidebarButtonView> veyrion_dark_button_ = nullptr;
  bool veyrion_workspace_refresh_pending_ = false;
  std::string veyrion_workspace_fingerprint_;
  PrefChangeRegistrar veyrion_pref_changes_;
  base::ScopedObservation<ProfileBrowserCollection, BrowserCollectionObserver>
      veyrion_windows_observed_{this};
  void RefreshVeyrionUpdate();`))
  edit('browser/ui/views/sidebar/sidebar_control_view.cc',s=>{
    if(!s.includes('// Veyrion visible workspace rail')){
      s=s.replace('#include "base/check.h"',`#include "base/check.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/utf_string_conversions.h"
#include "base/task/single_thread_task_runner.h"
#include "chrome/browser/ui/window_metadata/window_metadata_controller.h"
#include "ui/base/base_window.h"
#include "ui/views/layout/box_layout.h"
#include "ui/views/controls/scroll_view.h"`)
      s=s.replace('  AddChildViews();',`  AddChildViews();
  veyrion_windows_observed_.Observe(ProfileBrowserCollection::GetForProfile(browser_->GetProfile()));
  veyrion_pref_changes_.Init(browser_->GetProfile()->GetPrefs());
  veyrion_pref_changes_.Add("veyrion.workspace_revision", base::BindRepeating(
      &SidebarControlView::QueueVeyrionWorkspaces, base::Unretained(this)));
  veyrion_pref_changes_.Add(prefs::kWebKitForceDarkModeEnabled, base::BindRepeating(
      &SidebarControlView::RefreshVeyrionDark, base::Unretained(this)));
  QueueVeyrionWorkspaces();
  RefreshVeyrionDark();`)
      s=s.replace(/  sidebar_items_view_ =\s*AddChildView\(/,`  // Veyrion visible workspace rail: buttons activate existing named windows.
  auto* workspace_scroll = AddChildView(std::make_unique<views::ScrollView>());
  workspace_scroll->ClipHeightTo(0, 192);
  workspace_scroll->SetHorizontalScrollBarMode(views::ScrollView::ScrollBarMode::kDisabled);
  auto workspace_contents = std::make_unique<views::View>();
  workspace_contents->SetLayoutManager(std::make_unique<views::BoxLayout>(views::BoxLayout::Orientation::kVertical));
  veyrion_workspaces_ = workspace_scroll->SetContents(std::move(workspace_contents));
  workspace_scroll->SetVisible(!browser_->GetProfile()->IsOffTheRecord());
  auto* manage_workspaces = AddChildView(std::make_unique<SidebarButtonView>(u"Añadir o administrar tableros"));
  manage_workspaces->SetImageModel(views::Button::STATE_NORMAL,
      ui::ImageModel::FromVectorIcon(kLeoGrid04Icon, kColorSidebarButtonBase, SidebarButtonView::kDefaultIconSize));
  manage_workspaces->SetCallback(base::BindRepeating(&SidebarControlView::OnButtonPressed,
      base::Unretained(this), manage_workspaces));
  manage_workspaces->SetVisible(!browser_->GetProfile()->IsOffTheRecord());
  sidebar_items_view_ = AddChildView(`)
      s=s.replace('  veyrion_update_button_ = AddChildView(std::make_unique<views::LabelButton>(',`  veyrion_dark_button_ = AddChildView(std::make_unique<SidebarButtonView>(u"Forzar modo oscuro en páginas web"));
  veyrion_dark_button_->SetText(u"◐");
  veyrion_dark_button_->SetCallback(base::BindRepeating([](SidebarControlView* self) {
    auto* prefs = self->browser_->GetProfile()->GetPrefs();
    prefs->SetBoolean(prefs::kWebKitForceDarkModeEnabled,
        !prefs->GetBoolean(prefs::kWebKitForceDarkModeEnabled));
  }, base::Unretained(this)));
  veyrion_update_button_ = AddChildView(std::make_unique<SidebarButtonView>(u"Actualizar Veyrion"));
  veyrion_update_button_->SetImageModel(views::Button::STATE_NORMAL,
      ui::ImageModel::FromVectorIcon(kLeoDownloadIcon, ui::kColorSysPrimary, SidebarButtonView::kDefaultIconSize));
  veyrion_update_button_->SetBackground(views::CreateRoundedRectBackground(ui::kColorSysPrimaryContainer, 6));
  veyrion_update_button_->SetVisible(false);
  veyrion_update_button_->SetCallback(`)
      s=s.replace('}, base::Unretained(this)), u"↑"));','}, base::Unretained(this)));')
    }
    s=s.replace(/^.*veyrion_dark_button_->label\(\)->SetFontList.*\r?\n/gm,'').replaceAll('const auto tooltip =','const char16_t* tooltip =')
    if(!s.includes('#include "ui/views/controls/label.h"'))s=s.replace('#include "base/check.h"','#include "base/check.h"\n#include "ui/views/controls/label.h"')
    s=s.replace('self->veyrion_update_button_->SetText(available ? u"↑ •" : u"↑");',`self->veyrion_update_button_->SetVisible(available);
        if (!available) { self->InvalidateLayout(); return; }
        const auto* version = state.FindString("detail");
        const char16_t* tooltip = *status == "ready-on-close" ? u"Actualización lista: cierra Veyrion para instalarla"
            : *status == "downloading" ? u"Descargando actualización de Veyrion"
            : u"Nueva versión de Veyrion disponible. Pulsa para actualizar";
        self->veyrion_update_button_->SetAccessibleName(tooltip);
        self->veyrion_update_button_->SetTooltipText(available && version
            ? std::u16string(tooltip) + u" (" + base::UTF8ToUTF16(*version) + u")" : tooltip);
        self->InvalidateLayout();`)
    s=s.replace('        self->veyrion_update_button_->SetTooltipText(available ? u"Hay una actualización de Veyrion" : u"Ver actualizaciones de Veyrion");','')
    const mark='// BEGIN VEYRION WORKSPACE TOOLS'
    if(s.includes(mark))s=s.slice(0,s.indexOf(mark))
    if(!s.includes('// Veyrion visible workspace rail'))throw Error('No se pudo insertar la barra de tableros')
    return s+'\n'+mark+'\n'+fs.readFileSync(new URL('../native-ui/sidebar-tools.cc',import.meta.url),'utf8')
  })
  edit('browser/search_engines/search_engine_provider_service_factory.cc',s=>s.includes('veyrion.google_search_initialized')?s:s.replace('  registry->RegisterBooleanPref(kMigratedSearchDefaultInJP, false);','  registry->RegisterBooleanPref(kMigratedSearchDefaultInJP, false);\n  registry->RegisterBooleanPref("veyrion.google_search_initialized", false);'))
  edit('browser/search_engines/normal_window_search_engine_provider_service.cc',s=>s.includes('// Veyrion Google defaults')?s:s.replace('  MigrateSearchEnginePrefsInJP();',`  MigrateSearchEnginePrefsInJP();
  // Veyrion Google defaults are applied once, preserving subsequent choices.
  auto* prefs = profile_->GetPrefs();
  if (!prefs->GetBoolean("veyrion.google_search_initialized")) {
    auto* service = TemplateURLServiceFactory::GetForProfile(profile_);
    for (const auto& engine : service->GetTemplateURLs()) {
      if (engine->GetEngineType(service->search_terms_data()) != SEARCH_ENGINE_GOOGLE) continue;
      service->SetUserSelectedDefaultSearchProvider(engine);
      prefs->SetString(prefs::kSyncedDefaultPrivateSearchProviderGUID, engine->sync_guid());
      prefs->SetBoolean("veyrion.google_search_initialized", true);
      break;
    }
  }`))
  edit('browser/search_engines/normal_window_search_engine_provider_service.cc',s=>s.replace('for (auto* engine : service->GetTemplateURLs())','for (const auto& engine : service->GetTemplateURLs())').replace('if (engine->GetEngineType(service->search_terms_data())','if (engine->prepopulate_id() <= 0 || engine->GetEngineType(service->search_terms_data())'))
  // Without a downloaded catalog, the DAT startup gate blocks custom filters too.
  edit('components/brave_shields/core/common/features.cc',s=>s.includes('BASE_FEATURE(kAdblockDATCache, base::FEATURE_DISABLED_BY_DEFAULT);')?s:s.replace(/BASE_FEATURE\(kAdblockDATCache,[\s\S]*?#endif/,'BASE_FEATURE(kAdblockDATCache, base::FEATURE_DISABLED_BY_DEFAULT);'))
  edit('browser/ui/sidebar/sidebar_service_factory.cc',s=>s.includes('veyrion.panel_protection')?s:s.replace('  registry->RegisterDictionaryPref("veyrion.mobile_panels");','  registry->RegisterDictionaryPref("veyrion.mobile_panels");\n  registry->RegisterDictionaryPref("veyrion.panel_protection");'))
  edit('browser/ui/sidebar/sidebar_web_panel_controller.cc',s=>s.includes('// Veyrion panel ad protection')?s:s.replace('#include "base/values.h"','#include "base/values.h"\n#include "chrome/browser/content_settings/host_content_settings_map_factory.h"\n#include "brave/components/brave_shields/core/browser/brave_shields_utils.h"').replace('  auto cached = veyrion_cached_panels_.find(item.url.spec());',`  // Veyrion panel ad protection: configure the shared native engine once per site.
  auto* profile = browser_view_->browser()->GetProfile();
  const auto origin = item.url.GetWithEmptyPath().spec();
  if (item.url.SchemeIsHTTPOrHTTPS() &&
      !profile->GetPrefs()->GetDict("veyrion.panel_protection").FindBool(origin).value_or(false)) {
    auto* settings = HostContentSettingsMapFactory::GetForProfile(profile);
    brave_shields::SetBraveShieldsEnabled(settings, true, item.url);
    brave_shields::SetCosmeticFilteringControlType(settings, brave_shields::ControlType::BLOCK, item.url);
    ScopedDictPrefUpdate configured(profile->GetPrefs(), "veyrion.panel_protection");
    configured->Set(origin, true);
  }
  auto cached = veyrion_cached_panels_.find(item.url.spec());`))
  // Veyrion drag insertion boundaries include custom spacing and empty space.
  edit('browser/ui/views/sidebar/sidebar_items_contents_view.cc',s=>{
    const name=s.indexOf('SidebarItemsContentsView::CalculateTargetDragIndicatorIndex(');
    const start=s.lastIndexOf('std::optional<size_t>',name);
    const end=s.indexOf('std::optional<size_t> SidebarItemsContentsView::DrawDragIndicator(',name);
    if(name<0||start<0||end<0)throw Error('No se encontró el cálculo nativo del destino de arrastre');
    return s.slice(0,start)+`std::optional<size_t>
SidebarItemsContentsView::CalculateTargetDragIndicatorIndex(
    const gfx::Point& screen_position) {
  // Insertion positions cover gaps, hidden items and space after the last icon.
  if (children().empty()) return std::nullopt;
  for (size_t i = 0; i < children().size(); ++i) {
    views::View* child = children()[i];
    if (!child->GetVisible()) continue;
    auto bounds = child->GetLocalBounds();
    views::View::ConvertRectToScreen(child, &bounds);
    if (screen_position.y() < bounds.CenterPoint().y()) return i;
  }
  return children().size();
}

`+s.slice(end);
  })

}
