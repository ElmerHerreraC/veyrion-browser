import fs from 'node:fs'
import path from 'node:path'

export function integrateAppearanceApi(source) {
  const file=relative=>path.join(source,relative)
  const schemaPath=file('common/extensions/api/brave_theme.json')
  const raw=fs.readFileSync(schemaPath,'utf8')
  const schema=JSON.parse(raw.replace(/^\s*\/\/.*$/gm,''))
  const names=['setVeyrionChrome','getVeyrionChrome','manageVeyrionIcon']
  schema[0].functions=schema[0].functions.filter(item=>!names.includes(item.name))
  schema[0].functions.push(
    {name:names[0],type:'function',parameters:[{name:'mode',type:'string'},{name:'size',type:'integer'},{name:'spacing',type:'integer'},{name:'colored',type:'boolean'}],returns_async:{name:'callback',parameters:[]}},
    {name:names[1],type:'function',parameters:[],returns_async:{name:'callback',parameters:[{name:'json',type:'string'}]}},
    {name:names[2],type:'function',parameters:[{name:'action',type:'string'},{name:'index',type:'integer'},{name:'value',type:'string'}],returns_async:{name:'callback',parameters:[]}}
  )
  fs.writeFileSync(schemaPath,(raw.match(/^(?:\/\/[^\n]*\n)+/)?.[0]||'')+'\n'+JSON.stringify(schema,null,2)+'\n')
  const classes=['SetVeyrionChrome','GetVeyrionChrome','ManageVeyrionIcon']
  let header=fs.readFileSync(file('browser/extensions/api/brave_theme_api.h'),'utf8')
  for(let i=0;i<classes.length;i++)if(!header.includes(`class BraveTheme${classes[i]}Function`))header=header.replace('}  // namespace api',`class BraveTheme${classes[i]}Function : public ExtensionFunction {
 public:
  DECLARE_EXTENSION_FUNCTION("braveTheme.${names[i]}", UNKNOWN)
 protected:
  ~BraveTheme${classes[i]}Function() override = default;
  ResponseAction Run() override;
};
}  // namespace api`)
  fs.writeFileSync(file('browser/extensions/api/brave_theme_api.h'),header)
  const ccPath=file('browser/extensions/api/brave_theme_api.cc')
  let cc=fs.readFileSync(ccPath,'utf8')
  if(cc.includes('BraveThemeSetVeyrionChromeFunction::Run()'))return
  cc=cc.replace('#include "base/check.h"', '#include "base/check.h"\n#include "base/json/json_writer.h"\n#include "base/values.h"\n#include "base/strings/string_number_conversions.h"')
  cc=cc.replace('}  // namespace extensions::api',`ExtensionFunction::ResponseAction BraveThemeSetVeyrionChromeFunction::Run() {
  auto params = brave_theme::SetVeyrionChrome::Params::Create(args());
  EXTENSION_FUNCTION_VALIDATE(params);
  if ((params->mode != "dark" && params->mode != "light" && params->mode != "system") ||
      params->size < 14 || params->size > 26 || params->spacing < 0 || params->spacing > 10)
    return RespondNow(Error("Invalid appearance settings."));
  auto* profile = Profile::FromBrowserContext(browser_context());
  auto* prefs = profile->GetPrefs();
  prefs->SetString("veyrion.theme_mode", params->mode);
  prefs->SetInteger("veyrion.icon_size", params->size);
  prefs->SetInteger("veyrion.icon_spacing", params->spacing);
  prefs->SetBoolean("veyrion.colored_icons", params->colored);
  ThemeServiceFactory::GetForProfile(profile)->SetBrowserColorScheme(
      params->mode == "light" ? ThemeService::BrowserColorScheme::kLight :
      params->mode == "system" ? ThemeService::BrowserColorScheme::kSystem :
                                ThemeService::BrowserColorScheme::kDark);
  return RespondNow(NoArguments());
}

ExtensionFunction::ResponseAction BraveThemeGetVeyrionChromeFunction::Run() {
  auto* profile = Profile::FromBrowserContext(browser_context());
  auto* prefs = profile->GetPrefs();
  base::DictValue state;
  state.Set("mode", prefs->GetString("veyrion.theme_mode"));
  state.Set("size", prefs->GetInteger("veyrion.icon_size"));
  state.Set("spacing", prefs->GetInteger("veyrion.icon_spacing"));
  state.Set("colored", prefs->GetBoolean("veyrion.colored_icons"));
  state.Set("panelWidth", prefs->GetInteger("veyrion.panel_width"));
  base::ListValue icons;
  const auto& items = sidebar::SidebarServiceFactory::GetForProfile(profile)->items();
  for (size_t index = 0; index < items.size(); ++index) {
    const auto& item = items[index];
    const auto id = item.is_built_in_type() ? "builtin:" +
        base::NumberToString(static_cast<int>(item.built_in_item_type)) : item.url.spec();
    base::DictValue icon;
    icon.Set("index", static_cast<int>(index)); icon.Set("id", id);
    icon.Set("title", base::UTF16ToUTF8(item.title)); icon.Set("url", item.url.spec());
    icon.Set("builtin", item.is_built_in_type());
    icon.Set("visible", !prefs->GetDict("veyrion.hidden_icons").FindBool(id).value_or(false));
    const auto* selected = prefs->GetDict("veyrion.custom_icons").FindString(id);
    icon.Set("icon", selected ? *selected : "default");
    icons.Append(std::move(icon));
  }
  state.Set("items", std::move(icons));
  return RespondNow(WithArguments(base::WriteJson(state).value_or("{}")));
}

ExtensionFunction::ResponseAction BraveThemeManageVeyrionIconFunction::Run() {
  auto params = brave_theme::ManageVeyrionIcon::Params::Create(args());
  EXTENSION_FUNCTION_VALIDATE(params);
  auto* profile = Profile::FromBrowserContext(browser_context());
  auto* service = sidebar::SidebarServiceFactory::GetForProfile(profile);
  if (params->index < 0 || static_cast<size_t>(params->index) >= service->items().size())
    return RespondNow(Error("Sidebar item no longer exists."));
  const auto item = service->items()[params->index];
  const auto id = item.is_built_in_type() ? "builtin:" +
      base::NumberToString(static_cast<int>(item.built_in_item_type)) : item.url.spec();
  if (params->action == "hide" || params->action == "show") {
    ScopedDictPrefUpdate update(profile->GetPrefs(), "veyrion.hidden_icons");
    update->Set(id, params->action == "hide");
  } else if (params->action == "up" || params->action == "down") {
    const int to = params->index + (params->action == "up" ? -1 : 1);
    if (to >= 0 && static_cast<size_t>(to) < service->items().size())
      service->MoveItem(params->index, to);
  } else if (params->action == "icon") {
    if (params->value != "default" && params->value != "grid" &&
        params->value != "code" && params->value != "star" && params->value != "chat" &&
        params->value != "play" && params->value != "settings")
      return RespondNow(Error("Unsupported sidebar symbol."));
    ScopedDictPrefUpdate update(profile->GetPrefs(), "veyrion.custom_icons");
    update->Set(id, params->value);
  } else if (params->action == "rename" && item.is_web_type() &&
             !params->value.empty() && params->value.size() <= 128) {
    service->UpdateItem(item.url, item.url, item.title, base::UTF8ToUTF16(params->value));
  } else {
    return RespondNow(Error("Unsupported sidebar action."));
  }
  return RespondNow(NoArguments());
}

}  // namespace extensions::api`)
  fs.writeFileSync(ccPath,cc)
}
