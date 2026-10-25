import fs from 'node:fs'
import path from 'node:path'

export function integrateSidebarLayout(source) {
  const edit=(relative,change)=>{const target=path.resolve(source,relative),before=fs.readFileSync(target,'utf8'),after=change(before);if(after!==before)fs.writeFileSync(target,after)}
  for(const file of ['cr_shared_style_lit.css','cr_shared_style.css'])edit('../ui/webui/resources/cr_elements/'+file,s=>s.includes('/* Veyrion narrow centered cards */')?s:s+'\n/* Veyrion narrow centered cards */\n@media (max-width: 600px) {\n  .cr-centered-card-container {\n    max-width: 100%;\n    min-width: 0;\n    width: 100%;\n  }\n}\n')
  const css=(file,rules)=>edit('../chrome/browser/resources/'+file,s=>s.split('/* Veyrion compact panels */')[0].trimEnd()+'\n\n/* Veyrion compact panels */\n@media (max-width: 600px) {\n'+rules.replace(/([^{}]+)\{([^{}]+)\}/g,(_,selectors,body)=>selectors.trim().split(',').map(value=>'  '+value.trim()).join(',\n')+' {\n'+body.split(';').map(value=>value.trim()).filter(Boolean).map(value=>'    '+value+';').join('\n')+'\n  }\n')+'}\n')
  css('downloads/manager.css',`:host { min-width: 0; max-width: 100%; }\n#downloadsList, managed-footnote { min-width: 0; }\ndownloads-item, #downloadsList, cr-toast-manager { --downloads-card-width: calc(100% - 24px); --downloads-card-margin: 12px; }`)
  css('downloads/item.css',`:host { min-width: 0; max-width: 100%; }\n#file-link, #file-name { overflow-wrap: anywhere; }`)
  css('extensions/manager.css',`:host, #container, #viewManager { min-width: 0; max-width: 100%; }\n#left, #right { display: none; }\n#viewManager { flex: 1 1 0 !important; width: 100%; }`)
  css('extensions/item_list.css',`#content-wrapper { min-width: 0; padding: 16px 12px; }\n.items-container { grid-template-columns: minmax(0, 1fr); max-width: 100%; --extensions-card-width: 100%; }`)
  css('extensions/item.css',`:host { min-width: 0; width: 100%; max-width: 100%; box-sizing: border-box; }`)
  edit('../chrome/browser/resources/settings/appearance_page/appearance_page.css',s=>s.includes('/* Veyrion sidebar-only sections */')?s:s+'\n/* Veyrion sidebar-only sections */\n:host-context([data-veyrion-sidebar]) settings-section {\n  display: none;\n}\n')
  css('extensions/toolbar.css',`.more-actions { flex-direction: column; align-items: flex-end; gap: 4px; max-width: 100px; }\n#devModeLabel { font-size: 10px; white-space: normal; overflow-wrap: anywhere; max-width: 100px; margin: 0; text-align: end; }\n#buttonStrip { position: static; width: auto; margin: 0 8px; display: flex; flex-wrap: wrap; gap: 8px; }\n#devDrawer[expanded] { height: auto; }`)
  edit('../chrome/browser/resources/extensions/toolbar.html.ts',s=>s.replace('<cr-toggle id="devMode" @change=','<cr-toggle id="devMode" title="$i18n{toolbarDevMode}" @change='))
  edit('browser/ui/webui/settings/brave_appearance_handler.h',s=>s.includes('veyrion_weak_factory_')?s:s.replace('#include "base/memory/raw_ptr.h"','#include "base/memory/raw_ptr.h"\n#include "base/memory/weak_ptr.h"').replace('  base::CallbackListSubscription fullscreen_subscription_;','  base::CallbackListSubscription fullscreen_subscription_;\n  base::WeakPtrFactory<BraveAppearanceHandler> veyrion_weak_factory_{this};'))
  edit('browser/ui/sidebar/sidebar_controller.cc',s=>s.includes('// Veyrion: one lateral surface')?s:s.replace('  // Only an item for panel can get activated.',`  // Veyrion: one lateral surface at a time, including native Favorites.
  if (web_panel_controller_ && web_panel_controller_->panel_contents())
    chrome::CloseWebContents(browser_, web_panel_controller_->panel_contents(), false);
  // Only an item for panel can get activated.`).replace('  // For panel item activation, SidePanelUI is the single source of truth.',`  if (panel_item != SidebarItem::BuiltInItemType::kNone &&
      web_panel_controller_ && web_panel_controller_->panel_contents())
    chrome::CloseWebContents(browser_, web_panel_controller_->panel_contents(), false);
  // For panel item activation, SidePanelUI is the single source of truth.`))
  edit('browser/ui/sidebar/sidebar_controller.cc',s=>s.replaceAll('chrome::CloseWebContents(browser_, web_panel_controller_->panel_contents(), false);','web_panel_controller_->DismissVeyrionPanel();'))
  edit('browser/ui/views/sidebar/sidebar_items_scroll_view.cc',s=>{
    s=s.replace('  DCHECK(up_arrow_->GetVisible() && down_arrow_->GetVisible());',`  // Veyrion: an animation callback may arrive after layout hides the arrows.
  if (!up_arrow_->GetVisible() || !down_arrow_->GetVisible()) {
    up_arrow_->SetEnabled(false);
    down_arrow_->SetEnabled(false);
    return;
  }`)
    if(!s.includes('// Veyrion: stop offsets'))s=s.replace('    // Scroll view has enough space for contents view.',`    // Veyrion: stop offsets belonging to the previous overflow layout.
    scroll_animator_for_item_->Cancel();
    scroll_animator_for_smooth_->Cancel();
    // Scroll view has enough space for contents view.`)
    return s
  })
  edit('browser/ui/sidebar/sidebar_web_panel_controller.h',s=>s.includes('DismissVeyrionPanel')?s:s.replace('  void ToggleWebPanel(const SidebarItem& item);','  void ToggleWebPanel(const SidebarItem& item);\n  void DismissVeyrionPanel();'))
  edit('browser/ui/sidebar/sidebar_web_panel_controller.cc',s=>{
    if(!s.includes('// Veyrion: native and web panels are exclusive'))s=s.replace('#include "chrome/browser/ui/browser_tabstrip.h"','#include "chrome/browser/ui/browser_tabstrip.h"\n#include "chrome/browser/ui/side_panel/side_panel_ui.h"').replace('  CHECK(!panel_item_.IsValidItem());',`  CHECK(!panel_item_.IsValidItem());
  // Veyrion: native and web panels are exclusive.
  if (auto* side_panel = SidePanelUI::From(browser_view_->browser())) side_panel->Close();`)
    s=s.replace('  if (!panel_item_.IsValidItem()) return false;','  if (!panel_item_.IsValidItem() || !panel_item_.url.SchemeIsHTTPOrHTTPS()) return false;')
      .replace('browser_view_->browser(), item.url, 0, false, std::nullopt, true);','browser_view_->browser(), GURL("about:blank"), 0, false, std::nullopt, true);')
      .replace('->GetDict("veyrion.mobile_panels").FindBool(panel_item_.url.spec()).value_or(false);','->GetDict("veyrion.mobile_panels").FindBool(panel_item_.url.spec()).value_or(true);')
      .replace('  if (!panel_contents_) return;\n  const bool mobile = !IsVeyrionMobileView();','  if (!panel_contents_ || !panel_item_.url.SchemeIsHTTPOrHTTPS()) return;\n  const bool mobile = !IsVeyrionMobileView();')
    if(!s.includes('void SidebarWebPanelController::DismissVeyrionPanel()'))s=s.replace('void SidebarWebPanelController::CloseWebPanel() {',`void SidebarWebPanelController::DismissVeyrionPanel() {
  if (panel_contents_) chrome::CloseWebContents(browser_view_->browser(), panel_contents_, false);
}

void SidebarWebPanelController::CloseWebPanel() {`)
    return s
  })
  edit('browser/ui/views/sidebar/sidebar_control_view.cc',s=>{
    if(!s.includes('// Veyrion: dedicated sidebar-only options'))s=s.replace('#include "brave/browser/ui/sidebar/sidebar_controller.h"',`#include "brave/browser/ui/sidebar/sidebar_controller.h"
#include "brave/browser/ui/sidebar/sidebar_web_panel_controller.h"
#include "brave/components/sidebar/browser/sidebar_item.h"
#include "chrome/browser/ui/browser_tabstrip.h"`).replace('  sidebar_settings_view_ = AddChildView(',`  // Veyrion: dedicated sidebar-only options, separate from browser appearance.
  auto* options = AddChildView(std::make_unique<SidebarButtonView>(u"Configurar barra lateral y tableros"));
  options->SetImageModel(views::Button::STATE_NORMAL,
      ui::ImageModel::FromVectorIcon(kLeoMoreVerticalIcon, kColorSidebarButtonBase,
                                    SidebarButtonView::kDefaultIconSize));
  options->SetCallback(base::BindRepeating(&SidebarControlView::OnButtonPressed,
                                         base::Unretained(this), options));
  sidebar_settings_view_ = AddChildView(`)
    const start=s.indexOf('void SidebarControlView::OnButtonPressed('),end=s.indexOf('\nvoid SidebarControlView::Update()',start)
    if(start<0||end<0)throw Error('Sidebar controls changed upstream')
    return s.slice(0,start)+`void SidebarControlView::OnButtonPressed(views::View* view) {
  // Veyrion unified settings shortcut.
  auto* controller = browser_->GetFeatures().sidebar_controller()->GetWebPanelController();
  if (view != sidebar_settings_view_) {
    controller->ToggleWebPanel(sidebar::SidebarItem::Create(
        GURL("chrome://settings/appearance?veyrionSidebar=1"), u"Barra lateral y tableros",
        sidebar::SidebarItem::Type::kTypeWeb, sidebar::SidebarItem::BuiltInItemType::kNone, true));
    return;
  }
  controller->DismissVeyrionPanel();
  ShowSingletonTabOverwritingNTP(browser_, GURL("chrome://settings/appearance"));
}
`+s.slice(end)
  })
  edit('browser/ui/views/frame/split_view/brave_multi_contents_view_mini_toolbar.cc',s=>{
    s=s.replace(/  \/\/ Display as brave scheme\.[\s\S]*?\n\}/,'  // Veyrion keeps standard chrome:// labels.\n}')
    if(!s.includes('// Veyrion mobile controls are for websites'))s=s.replace('    const bool mobile = controller && controller->IsVeyrionMobileView();',`    // Veyrion mobile controls are for websites, not internal WebUI.
    veyrion_mobile_button_->SetVisible(style_ == Style::kWebPanel && controller &&
        controller->panel_contents() && controller->panel_contents()->GetLastCommittedURL().SchemeIsHTTPOrHTTPS());
    const bool mobile = controller && controller->IsVeyrionMobileView();`)
    return s
  })
  edit('browser/extensions/api/brave_theme_api.cc',s=>{
    if(!s.includes('// Veyrion trusted internal panel tools'))s=s.replace('      params->action != "close") return RespondNow(Error("Unknown panel action."));','      params->action != "close" && params->action != "favorites") return RespondNow(Error("Unknown panel action."));')
      .replace('  if (!url.is_valid() || !url.SchemeIsHTTPOrHTTPS() || url.host().empty() ||',`  // Veyrion trusted internal panel tools; arbitrary internal URLs remain rejected.
  const bool internal_tool = url == GURL("chrome://downloads/") ||
      url == GURL("chrome://extensions/") ||
      url == GURL("chrome://settings/appearance") ||
      url == GURL("chrome://settings/appearance?veyrionSidebar=1");
  if (!url.is_valid() || (!url.SchemeIsHTTPOrHTTPS() && !internal_tool) || url.host().empty() ||`)
      .replace('  auto* service = sidebar::SidebarServiceFactory::GetForProfile(window->GetProfile());',`  auto* service = sidebar::SidebarServiceFactory::GetForProfile(window->GetProfile());
  if (params->action == "favorites") {
    window->GetFeatures().sidebar_controller()->ActivatePanelItem(sidebar::SidebarItem::BuiltInItemType::kBookmarks);
    return RespondNow(WithArguments(preferences->GetInteger("veyrion.panel_width")));
  }`)
    return s
  })
  edit('browser/ui/views/sidebar/sidebar_items_contents_view.cc',s=>s.includes('// Veyrion internal tool icons')?s:s.replace('  SkColor text_color = SK_ColorWHITE;',`  // Veyrion internal tool icons do not depend on site favicons.
  if (item.url.SchemeIs("chrome")) {
    SetImageForItem(item, gfx::CreateVectorIcon(
        item.url.host() == "downloads" ? kLeoDownloadIcon : kLeoBrowserExtensionsIcon,
        browser_->GetProfile()->GetPrefs()->GetInteger("veyrion.icon_size"),
        GetColorProvider() ? GetColorProvider()->GetColor(kColorSidebarButtonBase) : SK_ColorWHITE));
    return;
  }
  SkColor text_color = SK_ColorWHITE;`))
  edit('browser/ui/sidebar/sidebar_service_factory.cc',s=>{
    if(!s.includes('veyrion.sidebar_tools_version'))s=s.replace('  return service;',`  if (preferences->GetInteger("veyrion.sidebar_tools_version") < 1) {
    for (const auto* address : {"chrome://downloads/", "chrome://extensions/"}) {
      const GURL url(address);
      if (std::ranges::none_of(service->items(), [&url](const auto& item) { return item.url == url; }))
        service->AddItem(SidebarItem::Create(url,
            url.host() == "downloads" ? u"Descargas" : u"Extensiones",
            SidebarItem::Type::kTypeWeb, SidebarItem::BuiltInItemType::kNone, true));
    }
    preferences->SetInteger("veyrion.sidebar_tools_version", 1);
  }
  return service;`).replace('  registry->RegisterIntegerPref(kVeyrionDesktopLayoutVersion, 0);','  registry->RegisterIntegerPref(kVeyrionDesktopLayoutVersion, 0);\n  registry->RegisterIntegerPref("veyrion.sidebar_tools_version", 0);')
    return s
  })
  edit('components/brave_private_new_tab_ui/resources/page/components/search-box/index.tsx',s=>s.replace(/function BraveSearchLogo \(\) \{[\s\S]*?\nfunction Search /,`function BraveSearchLogo () {
  return <svg xmlns="http://www.w3.org/2000/svg" width="260" height="64" viewBox="0 0 260 64" role="img" aria-label="Veyrion">
    <path d="M6 8h12l14 36L46 8h12L34 60h-4Z" fill="#a48bff" />
    <text x="72" y="47" fill="currentColor" fontFamily="Segoe UI, sans-serif" fontSize="36" fontWeight="600">Veyrion</text>
  </svg>
}

interface Props { onSubmit?: (value: string, openNewTab: boolean) => void }

function Search `).replace('role="search" aria-label="Brave"','role="search" aria-label="Veyrion"'))
  const privateIcon=path.join(source,'app/vector_icons/incognito_profile.icon')
  const icon='CANVAS_DIMENSIONS, 40,\nMOVE_TO, 6, 8,\nLINE_TO, 11, 8,\nLINE_TO, 20, 29,\nLINE_TO, 29, 8,\nLINE_TO, 34, 8,\nLINE_TO, 22, 35,\nLINE_TO, 18, 35,\nCLOSE,\n'
  if(fs.readFileSync(privateIcon,'utf8')!==icon)fs.writeFileSync(privateIcon,icon)
}
