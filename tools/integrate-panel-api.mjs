import fs from 'node:fs'
import path from 'node:path'

export function integratePanelApi(source) {
  const file = name => path.join(source, name)
  const schemaPath = file('common/extensions/api/brave_theme.json')
  const raw = fs.readFileSync(schemaPath, 'utf8')
  const schema = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ''))
  schema[0].functions = schema[0].functions.filter(item => item.name !== 'setVeyrionPanel')
  schema[0].functions.push({name:'setVeyrionPanel',type:'function',parameters:[
    {name:'action',type:'string'},
    {name:'url',type:'string'}, {name:'width',type:'integer'}, {name:'mobile',type:'boolean'}
  ],returns_async:{name:'callback',parameters:[{name:'width',type:'integer'}]}})
  fs.writeFileSync(schemaPath, (raw.match(/^(?:\/\/[^\n]*\n)+/)?.[0] || '') + '\n' + JSON.stringify(schema,null,2)+'\n')
  const headerPath = file('browser/extensions/api/brave_theme_api.h')
  let header=fs.readFileSync(headerPath,'utf8')
  if(!header.includes('class BraveThemeSetVeyrionPanelFunction')) {
    header=header.replace('}  // namespace api', `class BraveThemeSetVeyrionPanelFunction : public ExtensionFunction {
 public:
  DECLARE_EXTENSION_FUNCTION("braveTheme.setVeyrionPanel", UNKNOWN)
 protected:
  ~BraveThemeSetVeyrionPanelFunction() override = default;
  ResponseAction Run() override;
};

}  // namespace api`)
    fs.writeFileSync(headerPath,header)
  }
  const implementationPath=file('browser/extensions/api/brave_theme_api.cc')
  let implementation=fs.readFileSync(implementationPath,'utf8')
  if(implementation.includes('BraveThemeSetVeyrionPanelFunction::Run()'))return
  implementation=implementation.replace('#include "base/check.h"', `#include "base/check.h"
#include "base/strings/utf_string_conversions.h"
#include "brave/browser/ui/sidebar/sidebar_controller.h"
#include "brave/browser/ui/sidebar/sidebar_service_factory.h"
#include "brave/browser/ui/sidebar/sidebar_web_panel_controller.h"
#include "brave/browser/ui/views/frame/split_view/brave_multi_contents_view.h"
#include "brave/components/sidebar/browser/sidebar_service.h"
#include "brave/components/sidebar/browser/sidebar_item.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/browser_window_features.h"
#include "chrome/browser/ui/views/frame/browser_view.h"
#include "components/tabs/public/tab_interface.h"
#include "components/prefs/pref_service.h"
#include "components/prefs/scoped_user_pref_update.h"
#include "url/gurl.h"`)
  implementation=implementation.replace('}  // namespace extensions::api', `ExtensionFunction::ResponseAction BraveThemeSetVeyrionPanelFunction::Run() {
  auto params = brave_theme::SetVeyrionPanel::Params::Create(args());
  EXTENSION_FUNCTION_VALIDATE(params);
  if (params->action != "add" && params->action != "open" &&
      params->action != "resize" && params->action != "mobile" &&
      params->action != "close") return RespondNow(Error("Unknown panel action."));
  const GURL url(params->url);
  if (!url.is_valid() || !url.SchemeIsHTTPOrHTTPS() || url.host().empty() ||
      url.has_username() || url.has_password() || params->width < 240 ||
      params->width > 1000) {
    return RespondNow(Error("Use an HTTP/HTTPS address and a width from 240 to 1000."));
  }
  auto* sender = GetSenderWebContents();
  if (!sender) return RespondNow(Error("A Veyrion tab is required."));
  auto* tab = tabs::TabInterface::MaybeGetFromContents(sender);
  auto* window = tab ? tab->GetBrowserWindowInterface() : nullptr;
  if (!window) return RespondNow(Error("Open this control in a Veyrion tab."));
  auto* preferences = window->GetProfile()->GetPrefs();
  auto* controller = window->GetFeatures().sidebar_controller()->GetWebPanelController();
  auto* service = sidebar::SidebarServiceFactory::GetForProfile(window->GetProfile());
  if (params->action == "add" || params->action == "open") {
    bool exists = false;
    for (const auto& item : service->items()) exists |= item.url == url;
    if (!exists) service->AddItem(sidebar::SidebarItem::Create(url,
        base::UTF8ToUTF16(url.host()), sidebar::SidebarItem::Type::kTypeWeb,
        sidebar::SidebarItem::BuiltInItemType::kNone, true));
  }
  if (params->action == "resize" || params->action == "open") {
    preferences->SetInteger("veyrion.panel_width", params->width);
    auto* view = BrowserView::GetBrowserViewForBrowser(window);
    if (view) BraveMultiContentsView::From(view->multi_contents_view())
                  ->SetWebPanelWidth(params->width);
  }
  if (params->action == "mobile" || params->action == "open" || params->action == "add") {
    ScopedDictPrefUpdate update(preferences, "veyrion.mobile_panels");
    update->Set(url.spec(), params->mobile);
  }
  if (params->action == "open") {
    controller->ToggleWebPanel(sidebar::SidebarItem::Create(url,
        base::UTF8ToUTF16(url.host()), sidebar::SidebarItem::Type::kTypeWeb,
        sidebar::SidebarItem::BuiltInItemType::kNone, true));
  } else if (params->action == "mobile") {
    controller->ApplyVeyrionMobileView(true);
  } else if (params->action == "close" && controller->panel_contents()) {
    controller->ToggleWebPanel(sidebar::SidebarItem::Create(url,
        base::UTF8ToUTF16(url.host()), sidebar::SidebarItem::Type::kTypeWeb,
        sidebar::SidebarItem::BuiltInItemType::kNone, true));
  }
  return RespondNow(WithArguments(preferences->GetInteger("veyrion.panel_width")));
}

}  // namespace extensions::api`)
  fs.writeFileSync(implementationPath,implementation)
}
