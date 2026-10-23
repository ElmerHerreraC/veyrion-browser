import fs from 'node:fs'
import path from 'node:path'

export function integrateNativePanels(source) {
  function edit(file, marker, transform) {
    const target = path.join(source, file)
    const before = fs.readFileSync(target, 'utf8')
    if (before.includes(marker)) return
    const after = transform(before)
    if (after === before || !after.includes(marker)) throw new Error(`No se pudo integrar ${file}`)
    fs.writeFileSync(target, after)
  }
  edit('browser/ui/sidebar/sidebar_service_factory.cc', 'veyrion.panel_width', text => text.replace('  registry->RegisterIntegerPref(kVeyrionDesktopLayoutVersion, 0);', `  registry->RegisterIntegerPref(kVeyrionDesktopLayoutVersion, 0);
  registry->RegisterIntegerPref("veyrion.panel_width", 380);
  registry->RegisterDictionaryPref("veyrion.mobile_panels");`))

  edit('browser/ui/views/sidebar/sidebar_add_item_bubble_delegate_view.h', 'OnVeyrionAddPage', text => text.replace('class BraveBrowser;', 'namespace views { class Textfield; class Label; }\nclass BraveBrowser;').replace('  void AddChildViews();', `  void AddChildViews();
  void OnVeyrionAddPage();
  raw_ptr<views::Textfield> veyrion_url_ = nullptr;
  raw_ptr<views::Label> veyrion_error_ = nullptr;`))
  edit('browser/ui/views/sidebar/sidebar_add_item_bubble_delegate_view.cc', 'OnVeyrionAddPage', text => text.replace('#include "ui/views/controls/label.h"', '#include "ui/views/controls/label.h"\n#include "ui/views/controls/textfield/textfield.h"\n#include "base/strings/string_util.h"').replace('  // |site_part| includes', `  // Veyrion accepts an arbitrary web address without opening it first.
  auto* custom = AddChildView(std::make_unique<views::View>());
  custom->SetLayoutManager(std::make_unique<views::BoxLayout>(
      views::BoxLayout::Orientation::kVertical, gfx::Insets(12), 8));
  auto* caption = custom->AddChildView(
      std::make_unique<views::Label>(u"Agregar pagina al panel"));
  caption->SetHorizontalAlignment(gfx::ALIGN_LEFT);
  veyrion_url_ = custom->AddChildView(std::make_unique<views::Textfield>());
  veyrion_url_->SetAccessibleName(u"Direccion del panel lateral");
  veyrion_url_->SetPlaceholderText(u"https://ejemplo.com");
  veyrion_url_->SetPreferredSize(gfx::Size(280, 36));
  auto* add = custom->AddChildView(std::make_unique<views::LabelButton>(
      base::BindRepeating(&SidebarAddItemBubbleDelegateView::OnVeyrionAddPage,
                          base::Unretained(this)), u"Agregar pagina"));
  add->SetTooltipText(u"Abrir esta pagina dentro de la barra lateral");
  veyrion_error_ = custom->AddChildView(std::make_unique<views::Label>());
  veyrion_error_->SetMultiLine(true);

  // |site_part| includes`).replace('void SidebarAddItemBubbleDelegateView::OnDefaultItemsButtonPressed(', `void SidebarAddItemBubbleDelegateView::OnVeyrionAddPage() {
  std::u16string input;
  base::TrimWhitespace(veyrion_url_->GetText(), base::TRIM_ALL, &input);
  GURL url(input);
  if (!url.has_scheme()) {
    url = GURL(u"https://" + input);
  }
  if (input.empty() || !url.is_valid() || !url.SchemeIsHTTPOrHTTPS() ||
      url.has_username() || url.has_password() || url.host().empty()) {
    veyrion_error_->SetText(u"Introduce una direccion HTTP o HTTPS valida.");
    SizeToContents();
    return;
  }
  auto* service = GetSidebarService(browser_);
  for (const auto& existing : service->items()) {
    if (existing.url == url) {
      veyrion_error_->SetText(u"Esta pagina ya esta en tu barra lateral.");
      SizeToContents();
      return;
    }
  }
  service->AddItem(sidebar::SidebarItem::Create(
      url, base::UTF8ToUTF16(url.host()), sidebar::SidebarItem::Type::kTypeWeb,
      sidebar::SidebarItem::BuiltInItemType::kNone, true));
  GetWidget()->CloseWithReason(views::Widget::ClosedReason::kAcceptButtonClicked);
}

void SidebarAddItemBubbleDelegateView::OnDefaultItemsButtonPressed(`))

  edit('browser/ui/views/frame/split_view/brave_multi_contents_view.h', 'veyrion_resize_start_', text => text.replace('#include <memory>', '#include <memory>\n#include <optional>\n#include "ui/views/controls/resize_area_delegate.h"\n#include "ui/views/controls/resize_area.h"').replace('  void SetWebPanelWidth(int width);', '  void SetWebPanelWidth(int width);\n  void OnResize(int resize_amount, bool done_resizing) override;').replace('  int web_panel_width_ = 0;', `  raw_ptr<views::ResizeArea> veyrion_panel_resize_ = nullptr;
  std::optional<int> veyrion_resize_start_;
  int web_panel_width_ = 0;`))
  edit('browser/ui/views/frame/split_view/brave_multi_contents_view.cc', 'veyrion_panel_resize_', text => text.replace('#include <utility>', '#include <algorithm>\n#include <utility>\n#include "components/prefs/pref_service.h"\n#include "ui/views/background.h"\n#include "ui/color/color_id.h"').replace('    contents_container_view_for_web_panel_->SetVisible(false);', `    contents_container_view_for_web_panel_->SetVisible(false);
    veyrion_panel_resize_ = AddChildView(std::make_unique<views::ResizeArea>(this));
    veyrion_panel_resize_->SetTooltipText(u"Arrastra para ajustar el ancho del panel");
    veyrion_panel_resize_->SetBackground(
        views::CreateSolidBackground(ui::kColorSysPrimary));
    veyrion_panel_resize_->SetVisible(false);`).replace('  UpdateContentsBorderAndOverlay();\n}', '  if (veyrion_panel_resize_) veyrion_panel_resize_->SetVisible(web_contents);\n  InvalidateLayout();\n  UpdateContentsBorderAndOverlay();\n}').replace('  web_panel_width_ = width;', `  const int saved = browser_view_->browser()->GetProfile()->GetPrefs()
                        ->GetInteger("veyrion.panel_width");
  web_panel_width_ = std::clamp(saved > 0 ? saved : width, 240, 1000);`).replace('void BraveMultiContentsView::SetWebPanelOnLeft(bool left) {', `void BraveMultiContentsView::OnResize(int resize_amount, bool done_resizing) {
  if (!veyrion_resize_start_) veyrion_resize_start_ = web_panel_width_;
  const int direction = (web_panel_on_left_ != base::i18n::IsRTL()) ? 1 : -1;
  const int maximum = std::max(240, std::min(1000, width() - 320));
  web_panel_width_ = std::clamp(*veyrion_resize_start_ + direction * resize_amount,
                               240, maximum);
  InvalidateLayout();
  if (done_resizing) {
    browser_view_->browser()->GetProfile()->GetPrefs()->SetInteger(
        "veyrion.panel_width", web_panel_width_);
    veyrion_resize_start_.reset();
  }
}

void BraveMultiContentsView::SetWebPanelOnLeft(bool left) {`).replace('  const int web_panel_width = GetWebPanelWidth();', '  const int web_panel_width = std::min(GetWebPanelWidth(),\n      std::max(0, size_bounds.width().value() - 120));').replace('  layouts.host_size = gfx::Size(host_width, host_height);', `  if (veyrion_panel_resize_) {
    const int divider_x = web_panel_on_left_
        ? web_panel_width - 6 : host_width - web_panel_width;
    layouts.child_layouts.emplace_back(veyrion_panel_resize_.get(),
        contents_container_view_for_web_panel_->GetVisible(),
        gfx::Rect(std::max(0, divider_x), 0, 6, host_height));
  }
  layouts.host_size = gfx::Size(host_width, host_height);`))

  edit('browser/ui/views/frame/split_view/brave_multi_contents_view.h', 'veyrion_resize_delegate_', text => text.replace('class BraveContentsContainerView;', 'class BraveContentsContainerView;\nclass VeyrionPanelResizeDelegate;').replace('  void OnResize(int resize_amount, bool done_resizing) override;', '  void OnVeyrionPanelResize(int resize_amount, bool done_resizing);').replace('  raw_ptr<views::ResizeArea> veyrion_panel_resize_', '  std::unique_ptr<VeyrionPanelResizeDelegate> veyrion_resize_delegate_;\n  raw_ptr<views::ResizeArea> veyrion_panel_resize_'))
  edit('browser/ui/views/frame/split_view/brave_multi_contents_view.cc', 'class VeyrionPanelResizeDelegate', text => text.replace('namespace {', `class VeyrionPanelResizeDelegate : public views::ResizeAreaDelegate {
 public:
  explicit VeyrionPanelResizeDelegate(BraveMultiContentsView* view) : view_(view) {}
  void OnResize(int amount, bool done) override {
    view_->OnVeyrionPanelResize(amount, done);
  }
 private:
  raw_ptr<BraveMultiContentsView> view_;
};

namespace {
`).replace('    veyrion_panel_resize_ = AddChildView(std::make_unique<views::ResizeArea>(this));', `    veyrion_resize_delegate_ = std::make_unique<VeyrionPanelResizeDelegate>(this);
    veyrion_panel_resize_ = AddChildView(
        std::make_unique<views::ResizeArea>(veyrion_resize_delegate_.get()));`).replace('void BraveMultiContentsView::OnResize(', 'void BraveMultiContentsView::OnVeyrionPanelResize('))
  edit('browser/ui/views/frame/split_view/brave_multi_contents_view.cc', '// Veyrion: release the resize view', text => text.replace('BraveMultiContentsView::~BraveMultiContentsView() = default;', `BraveMultiContentsView::~BraveMultiContentsView() {
  // Veyrion: release the resize view while its delegate is still alive.
  if (veyrion_panel_resize_) {
    auto area = RemoveChildViewT(veyrion_panel_resize_.get());
    veyrion_panel_resize_ = nullptr;
    area.reset();
  }
  veyrion_resize_delegate_.reset();
}`))

  edit('browser/ui/sidebar/sidebar_web_panel_controller.h', 'ToggleVeyrionMobileView', text => text.replace('#include "base/memory/raw_ref.h"', '#include "base/memory/raw_ref.h"\n#include "content/public/browser/web_contents_observer.h"').replace('class SidebarWebPanelController : public TabStripModelObserver {', 'class SidebarWebPanelController : public TabStripModelObserver,\n                                  public content::WebContentsObserver {').replace('  void ToggleWebPanel(const SidebarItem& item);', `  void ToggleWebPanel(const SidebarItem& item);
  void ToggleVeyrionMobileView();
  bool IsVeyrionMobileView() const;
  void ApplyVeyrionMobileView(bool reload);
  void DidFinishNavigation(content::NavigationHandle* navigation) override;`))
  edit('browser/ui/sidebar/sidebar_web_panel_controller.cc', 'ToggleVeyrionMobileView', text => text.replace('#include "base/types/to_address.h"', `#include "base/types/to_address.h"
#include "base/values.h"
#include "components/prefs/scoped_user_pref_update.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/navigation_handle.h"
#include "content/public/browser/web_contents.h"
#include "chrome/browser/profiles/profile.h"
#include "third_party/blink/public/common/user_agent/user_agent_metadata.h"
#include "third_party/blink/public/common/web_preferences/web_preferences.h"`).replace('  panel_item_ = item;\n', '  panel_item_ = item;\n  Observe(panel_contents_);\n  ApplyVeyrionMobileView(true);\n').replace('void SidebarWebPanelController::CloseWebPanel() {', `bool SidebarWebPanelController::IsVeyrionMobileView() const {
  if (!panel_item_.IsValidItem()) return false;
  return browser_view_->browser()->GetProfile()->GetPrefs()
      ->GetDict("veyrion.mobile_panels").FindBool(panel_item_.url.spec()).value_or(false);
}

void SidebarWebPanelController::ToggleVeyrionMobileView() {
  if (!panel_contents_) return;
  const bool mobile = !IsVeyrionMobileView();
  {
    ScopedDictPrefUpdate update(browser_view_->browser()->GetProfile()->GetPrefs(),
                                "veyrion.mobile_panels");
    update->Set(panel_item_.url.spec(), mobile);
  }
  ApplyVeyrionMobileView(true);
}

void SidebarWebPanelController::ApplyVeyrionMobileView(bool reload) {
  if (!panel_contents_) return;
  const bool mobile = IsVeyrionMobileView();
  auto preferences = panel_contents_->GetOrCreateWebPreferences();
  preferences.viewport_enabled = mobile;
  preferences.viewport_meta_enabled = mobile;
  preferences.shrinks_viewport_contents_to_fit = mobile;
  panel_contents_->SetWebPreferences(preferences);
  if (!reload) return;
  blink::UserAgentOverride agent;
  if (mobile) {
    agent = blink::UserAgentOverride::UserAgentOnly(
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36");
    blink::UserAgentMetadata metadata;
    metadata.brand_version_list = {{"Chromium", "155"}};
    metadata.brand_full_version_list = {{"Chromium", "155.0.0.0"}};
    metadata.full_version = "155.0.0.0";
    metadata.platform = "Android";
    metadata.platform_version = "10.0.0";
    metadata.mobile = true;
    metadata.form_factors = {"Mobile"};
    agent.ua_metadata_override = metadata;
  }
  panel_contents_->SetUserAgentOverride(agent, false);
  content::NavigationController::LoadURLParams params(panel_item_.url);
  params.override_user_agent = mobile
      ? content::NavigationController::UA_OVERRIDE_TRUE
      : content::NavigationController::UA_OVERRIDE_FALSE;
  panel_contents_->GetController().LoadURLWithParams(params);
}

void SidebarWebPanelController::DidFinishNavigation(
    content::NavigationHandle* navigation) {
  if (navigation->IsInPrimaryMainFrame() && navigation->HasCommitted()) {
    ApplyVeyrionMobileView(false);
  }
}

void SidebarWebPanelController::CloseWebPanel() {
  Observe(nullptr);`))

  edit('browser/ui/views/frame/split_view/brave_multi_contents_view_mini_toolbar.h', 'veyrion_mobile_button_', text => text.replace('  bool is_active_ = false;', '  raw_ptr<views::LabelButton> veyrion_mobile_button_ = nullptr;\n  bool is_active_ = false;').replace('#include "ui/color/color_id.h"', '#include "ui/color/color_id.h"\n#include "ui/views/controls/button/label_button.h"'))
  edit('browser/ui/views/frame/split_view/brave_contents_container_view.cc', '// Veyrion: keep panel controls visible', text => text.replace('mini_toolbar->SetAlwaysShowDomain(show_domain);', 'mini_toolbar->SetAlwaysShowDomain(for_web_panel_ || show_domain);').replace('    mini_toolbar_->SetVisible(!IsActive());', '    // Veyrion: keep panel controls visible while typing or navigating.\n    mini_toolbar_->SetVisible(true);'))
  edit('browser/ui/views/frame/split_view/brave_multi_contents_view_mini_toolbar.cc', 'veyrion_mobile_button_', text => text.replace('#include "base/i18n/rtl.h"', `#include "base/i18n/rtl.h"
#include "base/functional/bind.h"
#include "brave/browser/ui/sidebar/sidebar_web_panel_controller.h"
#include "brave/browser/ui/sidebar/sidebar_controller.h"
#include "chrome/browser/ui/browser_window/public/browser_window_features.h"
#include "chrome/browser/ui/views/frame/browser_view.h"`).replace('  close_button_->SetVisible(style_ == Style::kSplit);', `  close_button_->SetVisible(style_ == Style::kSplit);
  if (style_ == Style::kWebPanel && !veyrion_mobile_button_) {
    veyrion_mobile_button_ = AddChildView(std::make_unique<views::LabelButton>(
        base::BindRepeating([](BraveMultiContentsViewMiniToolbar* toolbar) {
          auto* controller = toolbar->browser_view_->browser()->GetFeatures()
                                 .sidebar_controller()->GetWebPanelController();
          if (controller) {
            controller->ToggleVeyrionMobileView();
            toolbar->UpdateState(toolbar->is_active_, false);
          }
        }, base::Unretained(this)), u"Celular"));
  }
  if (veyrion_mobile_button_) {
    veyrion_mobile_button_->SetVisible(style_ == Style::kWebPanel);
    auto* controller = browser_view_->browser()->GetFeatures()
                           .sidebar_controller()->GetWebPanelController();
    const bool mobile = controller && controller->IsVeyrionMobileView();
    veyrion_mobile_button_->SetText(mobile ? u"Escritorio" : u"Celular");
    veyrion_mobile_button_->SetTooltipText(mobile
        ? u"Cambiar este panel a vista de escritorio"
        : u"Cambiar este panel a vista de celular");
  }`))
  console.log('Paneles Veyrion: direccion libre, ancho arrastrable y vista movil integrados.')
  edit('browser/ui/color/material_brave_color_mixer.cc', '// Veyrion desktop surfaces', text => text.replace('#include "ui/color/color_provider.h"', '#include "ui/color/color_provider.h"\n#include "ui/color/color_id.h"').replace('  // Use leo color when', `  // Veyrion desktop surfaces keep the accent separate from the dark frame.
  if (is_dark) {
    mixer[ui::kColorFrameActive] = {SkColorSetRGB(0x10, 0x0d, 0x18)};
    mixer[ui::kColorFrameInactive] = {SkColorSetRGB(0x13, 0x10, 0x1d)};
    mixer[kColorToolbar] = {SkColorSetRGB(0x19, 0x14, 0x24)};
    mixer[kColorTabBackgroundActiveFrameActive] = {kColorToolbar};
    mixer[kColorTabBackgroundActiveFrameInactive] = {kColorToolbar};
    mixer[kColorToolbarContentAreaSeparator] = {ui::kColorSysPrimary};
  }

  // Use leo color when`))
  edit('browser/resources/settings/br/settings_ui.ts', '/* Veyrion settings */', text => text.replace('      /** Styling tweaks', `      /* Veyrion settings */
      :host {
        --leo-radius-xl: 6px;
        --leo-radius-m: 4px;
      }
      @media (prefers-color-scheme: dark) {
        :host { background: #100d18; --leo-color-container-background: #100d18;
          --leo-color-page-background: #191424; }
        #main { border: 1px solid color-mix(in srgb, var(--cr-link-color) 45%, transparent);
          box-shadow: 0 0 30px #0004; }
      }
      /** Styling tweaks`))
  edit('browser/ui/views/brave_actions/brave_shields_action_controller.cc', '// Veyrion protection icon', text => text.replace(/(gfx::ImageSkia BraveShieldsActionController::GetIconImage\(\s*bool is_enabled\) const \{)[\s\S]*?\n\}/, `$1
  // Veyrion protection icon preserves enabled/disabled feedback.
  const ui::ColorProvider* provider =
      GetColorProviderForWebContents(tab_strip_model_->GetActiveWebContents());
  return gfx::CreateVectorIcon(is_enabled ? kLeoShieldDoneIcon
                                         : kLeoShieldDisableFilledIcon,
      IconDimensionForLayout(), provider->GetColor(kColorOmniboxResultsIcon));
}`))
}
