#include "base/strings/string_number_conversions.h"
#include "base/strings/utf_string_conversions.h"
#include "brave/browser/ui/sidebar/sidebar_service_factory.h"
#include "brave/components/sidebar/browser/sidebar_service.h"
#include "chrome/browser/themes/theme_service.h"
#include "chrome/browser/themes/theme_service_factory.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/scoped_user_pref_update.h"
#include "third_party/skia/include/core/SkColor.h"
#include "chrome/browser/ui/browser_tabstrip.h"
#include "chrome/browser/ui/browser_window/public/create_browser_window.h"
#include "chrome/browser/ui/browser_window/public/profile_browser_collection.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/window_metadata/window_metadata_controller.h"
#include "components/tabs/public/tab_interface.h"
#include "content/public/browser/web_ui.h"
#include "ui/base/base_window.h"
#include "url/gurl.h"
#include "base/task/thread_pool.h"
#include "brave/browser/ui/webui/settings/veyrion_update_state.h"
#include "base/base64.h"
#include "base/containers/span.h"
#include "brave/browser/ui/webui/settings/veyrion_cursor_validation.h"
#include "ui/gfx/codec/png_codec.h"
#include "third_party/skia/include/core/SkBitmap.h"
#include "brave/components/brave_shields/core/browser/brave_shields_utils.h"
#include "chrome/browser/content_settings/host_content_settings_map_factory.h"

void BraveAppearanceHandler::HandleVeyrionAppearance(const base::ListValue& args) {
  if (args.size() != 2 || !args[0].is_string() || !args[1].is_dict()) return;
  AllowJavascript();
  const auto& request = args[1].GetDict();
  if (const auto* action = request.FindString("updateAction")) {
    if (profile_->IsOffTheRecord() || (*action != "status" && *action != "check" && *action != "apply")) {
      RejectJavascriptCallback(args[0], base::Value("Acción no disponible")); return;
    }
    base::ThreadPool::PostTaskAndReplyWithResult(FROM_HERE, {base::MayBlock()},
        base::BindOnce(&VeyrionUpdateState, *action),
        base::BindOnce([](base::WeakPtr<BraveAppearanceHandler> handler,
                          base::Value callback, base::DictValue state) {
          if (handler && handler->IsJavascriptAllowed())
            handler->ResolveJavascriptCallback(callback, state);
        }, veyrion_weak_factory_.GetWeakPtr(), args[0].Clone()));
    return;
  }
  auto* prefs = profile_->GetPrefs();
  if (auto enabled = request.FindBool("autoPip")) prefs->SetBoolean("veyrion.auto_pip", *enabled);
  auto* theme = ThemeServiceFactory::GetForProfile(profile_);
  auto* service = sidebar::SidebarServiceFactory::GetForProfile(profile_);
  auto fail = [&]() { RejectJavascriptCallback(args[0], base::Value("Configuración inválida")); };
  if (const auto* mode = request.FindString("cursorMode")) {
    if (*mode != "default" && *mode != "cross" && *mode != "up" && *mode != "custom") { fail(); return; }
    if (*mode == "custom") {
      const auto* image = request.FindString("cursorPng");
      const auto x = request.FindInt("cursorX"), y = request.FindInt("cursorY");
      std::string bytes;
      if (!image || image->size() > 134000 || !x || !y ||
          !base::Base64Decode(*image, &bytes) || !VeyrionValidCursorPng(bytes)) { fail(); return; }
      auto bitmap = gfx::PNGCodec::Decode(base::as_byte_span(bytes));
      if (bitmap.isNull() || *x < 0 || *y < 0 || *x >= bitmap.width() || *y >= bitmap.height()) { fail(); return; }
      prefs->SetString("veyrion.cursor_png", *image);
      prefs->SetInteger("veyrion.cursor_x", *x);
      prefs->SetInteger("veyrion.cursor_y", *y);
    }
    prefs->SetString("veyrion.cursor_mode", *mode);
  }
  auto* protection = HostContentSettingsMapFactory::GetForProfile(profile_);
  if (auto aggressive = request.FindBool("aggressiveAds"))
    brave_shields::SetCosmeticFilteringControlType(protection,
        *aggressive ? brave_shields::ControlType::BLOCK : brave_shields::ControlType::BLOCK_THIRD_PARTY, GURL());
  auto* tab = tabs::TabInterface::MaybeGetFromContents(web_ui()->GetWebContents());
  auto* current_window = tab ? tab->GetBrowserWindowInterface() : nullptr;
  if (const auto* action = request.FindString("workspaceAction")) {
    if (!current_window || profile_->IsOffTheRecord()) { fail(); return; }
    if (*action == "create") {
      const auto* name = request.FindString("name");
      if (!name || name->empty() || name->size() > 180) { fail(); return; }
      BrowserWindowCreateParams params(profile_, true);
      params.user_title = *name;
      CreateBrowserWindow(std::move(params), base::BindOnce(
          [](base::WeakPtr<BraveAppearanceHandler> handler, base::Value callback,
             BrowserWindowInterface* window) {
            if (window) {
              chrome::AddTabAt(window, GURL("chrome://newtab/"), -1, true);
              window->GetWindow()->Show();
            }
            if (handler && handler->IsJavascriptAllowed()) {
              if (!window) handler->RejectJavascriptCallback(callback, base::Value("No se pudo crear el tablero"));
              else handler->HandleVeyrionAppearance(base::ListValue().Append(std::move(callback)).Append(base::DictValue()));
            }
          }, veyrion_weak_factory_.GetWeakPtr(), args[0].Clone()));
      return;
    } else if (*action == "rename") {
      const auto* name = request.FindString("name");
      if (!name || name->empty() || name->size() > 180) { fail(); return; }
      WindowMetadataController::From(current_window)->SetWindowUserTitle(*name);
      prefs->SetInteger("veyrion.workspace_revision", prefs->GetInteger("veyrion.workspace_revision") + 1);
    } else if (*action == "activate") {
      const auto id = request.FindInt("id");
      bool found = false;
      if (!id) { fail(); return; }
      ProfileBrowserCollection::GetForProfile(profile_)->ForEach([&](BrowserWindowInterface* window) {
        if (window->GetType() == BrowserWindowInterface::TYPE_NORMAL && window->GetSessionID().id() == *id) {
          window->GetWindow()->Show(); window->GetWindow()->Activate(); found = true;
        }
        return true;
      });
      if (!found) { fail(); return; }
    } else { fail(); return; }
  }
  if (request.contains("forceDark") && !request.FindBool("forceDark").has_value()) { fail(); return; }
  if (const auto* mode = request.FindString("mode")) {
    const auto size = request.FindInt("size");
    const auto spacing = request.FindInt("spacing");
    const auto colored = request.FindBool("colored");
    const auto color = request.FindInt("color");
    if ((*mode != "light" && *mode != "dark" && *mode != "system") ||
        !size || *size < 14 || *size > 26 || !spacing || *spacing < 0 || *spacing > 10 ||
        !colored || !color || *color < 0 || *color > 0xFFFFFF) { fail(); return; }
    prefs->SetString("veyrion.theme_mode", *mode);
    prefs->SetInteger("veyrion.icon_size", *size);
    prefs->SetInteger("veyrion.icon_spacing", *spacing);
    prefs->SetBoolean("veyrion.colored_icons", *colored);
    prefs->SetBoolean("veyrion.appearance_initialized", true);
    if (!theme->GetUserColor() || (theme->GetUserColor().value() & 0x00FFFFFF) != static_cast<unsigned>(*color))
      theme->SetUserColor(SkColorSetRGB((*color >> 16) & 255, (*color >> 8) & 255, *color & 255));
    theme->SetBrowserColorScheme(*mode == "light" ? ThemeService::BrowserColorScheme::kLight :
        *mode == "system" ? ThemeService::BrowserColorScheme::kSystem : ThemeService::BrowserColorScheme::kDark);
  }
  if (const auto* action = request.FindString("action")) {
    const auto index = request.FindInt("index");
    if (!index || *index < 0 || static_cast<size_t>(*index) >= service->items().size()) { fail(); return; }
    const auto item = service->items()[*index];
    const auto id = item.is_built_in_type() ? "builtin:" + base::NumberToString(static_cast<int>(item.built_in_item_type)) : item.url.spec();
    if (*action == "hide" || *action == "show") {
      ScopedDictPrefUpdate update(prefs, "veyrion.hidden_icons"); update->Set(id, *action == "hide");
    } else if (*action == "up" || *action == "down") {
      const int to = *index + (*action == "up" ? -1 : 1);
      if (to >= 0 && static_cast<size_t>(to) < service->items().size()) service->MoveItem(*index, to);
    } else if (*action == "icon") {
      const auto* value = request.FindString("value");
      if (!value || (*value != "default" && *value != "star" && *value != "grid" &&
          *value != "chat" && *value != "code" && *value != "play" && *value != "settings")) { fail(); return; }
      ScopedDictPrefUpdate update(prefs, "veyrion.custom_icons"); update->Set(id, *value);
    } else { fail(); return; }
  }
  if (const auto force_dark = request.FindBool("forceDark"))
    prefs->SetBoolean(prefs::kWebKitForceDarkModeEnabled, *force_dark);
  base::DictValue state;
  state.Set("cursorMode", prefs->GetString("veyrion.cursor_mode"));
  state.Set("cursorPng", prefs->GetString("veyrion.cursor_png"));
  state.Set("cursorX", prefs->GetInteger("veyrion.cursor_x"));
  state.Set("cursorY", prefs->GetInteger("veyrion.cursor_y"));
  state.Set("aggressiveAds", brave_shields::GetCosmeticFilteringControlType(protection, GURL()) == brave_shields::ControlType::BLOCK);
  base::ListValue workspaces;
  if (!profile_->IsOffTheRecord()) ProfileBrowserCollection::GetForProfile(profile_)->ForEach([&](BrowserWindowInterface* window) {
    if (window->GetType() != BrowserWindowInterface::TYPE_NORMAL) return true;
    auto* metadata = WindowMetadataController::From(window);
    base::DictValue space;
    space.Set("id", window->GetSessionID().id());
    space.Set("name", metadata->user_title().empty() ? "Tablero " + base::NumberToString(window->GetSessionID().id()) : metadata->user_title());
    space.Set("tabs", window->GetTabStripModel()->count());
    space.Set("current", window == current_window);
    workspaces.Append(std::move(space));
    return true;
  });
  state.Set("workspaces", std::move(workspaces));
  state.Set("forceDark", prefs->GetBoolean(prefs::kWebKitForceDarkModeEnabled));
  state.Set("autoPip", prefs->GetBoolean("veyrion.auto_pip"));
  state.Set("mode", prefs->GetString("veyrion.theme_mode"));
  state.Set("color", static_cast<int>(theme->GetUserColor().value_or(theme->GetAutogeneratedThemeColor()) & 0x00FFFFFF));
  state.Set("size", prefs->GetInteger("veyrion.icon_size"));
  state.Set("spacing", prefs->GetInteger("veyrion.icon_spacing"));
  state.Set("colored", prefs->GetBoolean("veyrion.colored_icons"));
  base::ListValue icons;
  for (size_t index = 0; index < service->items().size(); ++index) {
    const auto& item = service->items()[index];
    const auto id = item.is_built_in_type() ? "builtin:" + base::NumberToString(static_cast<int>(item.built_in_item_type)) : item.url.spec();
    base::DictValue icon;
    icon.Set("index", static_cast<int>(index)); icon.Set("title", base::UTF16ToUTF8(item.title));
    icon.Set("visible", !prefs->GetDict("veyrion.hidden_icons").FindBool(id).value_or(false));
    const auto* symbol = prefs->GetDict("veyrion.custom_icons").FindString(id);
    icon.Set("icon", symbol ? *symbol : "default"); icons.Append(std::move(icon));
  }
  state.Set("items", std::move(icons));
  ResolveJavascriptCallback(args[0], state);
}
