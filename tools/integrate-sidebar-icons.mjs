import fs from 'node:fs'
import path from 'node:path'

export function integrateSidebarIcons(source) {
  const headerPath=path.join(source,'browser/ui/views/sidebar/sidebar_items_contents_view.h')
  let header=fs.readFileSync(headerPath,'utf8')
  if(!header.includes('veyrion_icon_preferences_')) {
    header=header.replace('#include <optional>','#include <optional>\n#include "components/prefs/pref_change_registrar.h"')
      .replace('  void AddItemView(', '  void UpdateVeyrionIcons();\n  PrefChangeRegistrar veyrion_icon_preferences_;\n  void AddItemView(')
    fs.writeFileSync(headerPath,header)
  }
  const ccPath=path.join(source,'browser/ui/views/sidebar/sidebar_items_contents_view.cc')
  let cc=fs.readFileSync(ccPath,'utf8')
  if(cc.includes('void SidebarItemsContentsView::UpdateVeyrionIcons()'))return
  cc=cc.replace('#include "base/check.h"','#include "base/check.h"\n#include "base/strings/string_number_conversions.h"\n#include "ui/views/view_class_properties.h"')
    .replace('constexpr gfx::Size kIconSize', `std::string VeyrionIconId(const sidebar::SidebarItem& item) {
  return item.is_built_in_type() ? "builtin:" +
      base::NumberToString(static_cast<int>(item.built_in_item_type)) : item.url.spec();
}
const gfx::VectorIcon* VeyrionSymbol(const std::string* symbol) {
  if (!symbol) return nullptr;
  if (*symbol == "grid") return &kLeoGrid04Icon;
  if (*symbol == "code") return &kLeoCodeIcon;
  if (*symbol == "star") return &kLeoContainerStarIcon;
  if (*symbol == "chat") return &kLeoMessageBubbleAskIcon;
  if (*symbol == "play") return &kLeoPlayFilledIcon;
  if (*symbol == "settings") return &kLeoSettingsIcon;
  return nullptr;
}

constexpr gfx::Size kIconSize`)
    .replace('  set_context_menu_controller(this);', `  veyrion_icon_preferences_.Init(browser_->GetProfile()->GetPrefs());
  for (const auto* pref : {"veyrion.icon_size", "veyrion.icon_spacing", "veyrion.colored_icons",
                           "veyrion.hidden_icons", "veyrion.custom_icons"}) {
    veyrion_icon_preferences_.Add(pref, base::BindRepeating(
        &SidebarItemsContentsView::UpdateVeyrionIcons, base::Unretained(this)));
  }
  set_context_menu_controller(this);`)
    .replace('  const int scale = GetWidget()->GetCompositor()->device_scale_factor();', '  if (!GetWidget() || !GetWidget()->GetCompositor()) return;\n  const float scale = GetWidget()->GetCompositor()->device_scale_factor();')
    .replace('  UpdateItemViewStateAt(index, false);\n}', '  UpdateItemViewStateAt(index, false);\n  UpdateVeyrionIcons();\n}')
    .replace('  const auto resized = gfx::ImageSkiaOperations::CreateResizedImage(\n      image, skia::ImageOperations::RESIZE_BEST, kIconSize);', `  auto* prefs = browser_->GetProfile()->GetPrefs();
  const int size = prefs->GetInteger("veyrion.icon_size");
  const auto* symbol = VeyrionSymbol(prefs->GetDict("veyrion.custom_icons")
                                       .FindString(VeyrionIconId(item)));
  if (symbol) {
    item_view->SetImageModel(views::Button::STATE_NORMAL,
        ui::ImageModel::FromVectorIcon(*symbol, kColorSidebarButtonBase, size));
    return;
  }
  auto resized = gfx::ImageSkiaOperations::CreateResizedImage(
      image, skia::ImageOperations::RESIZE_BEST, gfx::Size(size, size));
  if (!prefs->GetBoolean("veyrion.colored_icons") && GetColorProvider())
    resized = gfx::ImageSkiaOperations::CreateColorMask(resized,
        GetColorProvider()->GetColor(kColorSidebarButtonBase));`)
    .replace('  const auto get_image_model = [](', '  const auto get_image_model = [this](')
    .replace('                                          SidebarButtonView::kDefaultIconSize);', '                                          browser_->GetProfile()->GetPrefs()->GetInteger("veyrion.icon_size"));')
    .replace('  switch (type) {', `  auto* prefs = browser_->GetProfile()->GetPrefs();
  const auto id = "builtin:" + base::NumberToString(static_cast<int>(type));
  if (const auto* symbol = VeyrionSymbol(prefs->GetDict("veyrion.custom_icons").FindString(id)))
    return get_image_model(*symbol, state);
  switch (type) {`)
    .replace('BEGIN_METADATA(SidebarItemsContentsView)', `void SidebarItemsContentsView::UpdateVeyrionIcons() {
  const auto& items = sidebar_model_->GetAllSidebarItems();
  if (items.size() != children().size()) return;
  auto* prefs = browser_->GetProfile()->GetPrefs();
  for (size_t index = 0; index < items.size(); ++index) {
    auto* view = GetItemViewAt(index);
    view->SetVisible(!prefs->GetDict("veyrion.hidden_icons")
                          .FindBool(VeyrionIconId(items[index])).value_or(false));
    view->SetProperty(views::kMarginsKey, gfx::Insets::VH(
        prefs->GetInteger("veyrion.icon_spacing"), 0));
    view->SetPreferredSize(gfx::Size(40, prefs->GetInteger("veyrion.icon_size") + 12));
    if (items[index].is_web_type()) {
      SetDefaultImageFor(items[index]);
      sidebar_model_->FetchFavicon(items[index]);
    }
  }
  UpdateAllBuiltInItemsViewState();
  InvalidateLayout();
}

BEGIN_METADATA(SidebarItemsContentsView)`)
  fs.writeFileSync(ccPath,cc)
}
