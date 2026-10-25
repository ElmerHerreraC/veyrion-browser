import fs from 'node:fs'
import path from 'node:path'

export function integrateExperience(source){
  fs.copyFileSync(new URL('../native-ui/update-state.h',import.meta.url),path.join(source,'browser/ui/webui/settings/veyrion_update_state.h'))
  const edit=(file,fn)=>{const target=path.resolve(source,file),before=fs.readFileSync(target,'utf8'),after=fn(before);if(after!==before)fs.writeFileSync(target,after)}
  edit('browser/resources/settings/br/settings_ui.ts',s=>s.includes('>ACTUALIZACIONES</a>')?s:s.replace('<a href="chrome://extensions/">EXTENSIONES</a></nav>','<a href="chrome://extensions/">EXTENSIONES</a><a href="chrome://settings/appearance?veyrionUpdates=1">ACTUALIZACIONES</a></nav>'))
  edit('browser/ui/views/sidebar/sidebar_control_view.h',s=>s.includes('RefreshVeyrionUpdate')?s:s.replace('#include "base/memory/raw_ptr.h"','#include "base/memory/raw_ptr.h"\n#include "base/memory/weak_ptr.h"\n#include "base/timer/timer.h"').replace('class MenuRunner;','class MenuRunner;\nclass LabelButton;').replace('  bool sidebar_on_left_ = true;',`  void RefreshVeyrionUpdate();
  raw_ptr<views::LabelButton> veyrion_update_button_ = nullptr;
  base::RepeatingTimer veyrion_update_timer_;
  bool sidebar_on_left_ = true;`).replace('      sidebar_model_observed_{this};','      sidebar_model_observed_{this};\n  base::WeakPtrFactory<SidebarControlView> veyrion_weak_factory_{this};'))
  edit('browser/ui/views/sidebar/sidebar_control_view.cc',s=>s.includes('RefreshVeyrionUpdate')?s:s.replace('#include "base/check.h"','#include "base/check.h"\n#include "base/task/thread_pool.h"\n#include "brave/browser/ui/webui/settings/veyrion_update_state.h"\n#include "ui/views/controls/button/label_button.h"').replace('  sidebar_settings_view_ = AddChildView(',`  veyrion_update_button_ = AddChildView(std::make_unique<views::LabelButton>(
      base::BindRepeating([](SidebarControlView* self) {
        ShowSingletonTabOverwritingNTP(self->browser_, GURL("chrome://settings/appearance?veyrionUpdates=1"));
      }, base::Unretained(this)), u"↑"));
  veyrion_update_button_->SetAccessibleName(u"Actualizaciones de Veyrion");
  veyrion_update_button_->SetTooltipText(u"Ver actualizaciones de Veyrion");
  RefreshVeyrionUpdate();
  veyrion_update_timer_.Start(FROM_HERE, base::Seconds(30), this,
      &SidebarControlView::RefreshVeyrionUpdate);
  sidebar_settings_view_ = AddChildView(`)+`
void SidebarControlView::RefreshVeyrionUpdate() {
  if (browser_->GetProfile()->IsOffTheRecord()) return;
  base::ThreadPool::PostTaskAndReplyWithResult(FROM_HERE, {base::MayBlock()},
      base::BindOnce(&VeyrionUpdateState, std::string("status")),
      base::BindOnce([](base::WeakPtr<SidebarControlView> self, base::DictValue state) {
        if (!self || !self->veyrion_update_button_) return;
        const auto* status = state.FindString("state");
        bool available = status && (*status == "available" || *status == "downloading" || *status == "ready-on-close");
        self->veyrion_update_button_->SetText(available ? u"↑ •" : u"↑");
        self->veyrion_update_button_->SetTooltipText(available ? u"Hay una actualización de Veyrion" : u"Ver actualizaciones de Veyrion");
      }, veyrion_weak_factory_.GetWeakPtr()));
}
`)
  edit('browser/ui/sidebar/sidebar_service_factory.cc',s=>s.includes('veyrion.auto_pip')?s:s.replace('  registry->RegisterIntegerPref("veyrion.panel_width", 380);','  registry->RegisterBooleanPref("veyrion.auto_pip", true);\n  registry->RegisterIntegerPref("veyrion.panel_width", 380);'))
  edit('browser/ui/sidebar/sidebar_web_panel_controller.h',s=>s.includes('RestoreVeyrionPanel')?s:s.replace('#include "base/memory/raw_ref.h"','#include "base/memory/raw_ref.h"\n#include "base/memory/weak_ptr.h"').replace('  void OnTabWillBeRemoved(',`  void RestoreVeyrionPanel();
  void OnTabStripModelChanged(TabStripModel* model,
      const TabStripModelChange& change,
      const TabStripSelectionChange& selection) override;
  void OnTabWillBeRemoved(`).replace('  sidebar::SidebarItem panel_item_;','  sidebar::SidebarItem panel_item_;\n  base::WeakPtrFactory<SidebarWebPanelController> veyrion_weak_factory_{this};'))
  edit('browser/ui/sidebar/sidebar_web_panel_controller.cc',s=>s.includes('RestoreVeyrionPanel')?s:s.replace('#include "base/types/to_address.h"','#include "base/types/to_address.h"\n#include "base/task/single_thread_task_runner.h"').replace('void SidebarWebPanelController::OnTabWillBeRemoved(',`// A normal tab change may detach/reparent the active WebView. Restore the
// existing panel after the browser view finishes; never navigate it again.
void SidebarWebPanelController::RestoreVeyrionPanel() {
  if (panel_contents_ && panel_item_.IsValidItem())
    GetMultiContentsView()->SetWebPanelContents(panel_contents_);
}
void SidebarWebPanelController::OnTabStripModelChanged(
    TabStripModel* model, const TabStripModelChange& change,
    const TabStripSelectionChange& selection) {
  if (panel_contents_ && selection.active_tab_changed())
    base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(FROM_HERE,
        base::BindOnce(&SidebarWebPanelController::RestoreVeyrionPanel,
                       veyrion_weak_factory_.GetWeakPtr()));
}

void SidebarWebPanelController::OnTabWillBeRemoved(`))
  edit('browser/ui/sidebar/sidebar_web_panel_controller.h',s=>s.includes('veyrion_cached_panels_')?s:s.replace('#include "base/memory/raw_ref.h"','#include <map>\n#include <string>\n#include "base/memory/raw_ref.h"').replace('  sidebar::SidebarItem panel_item_;','  sidebar::SidebarItem panel_item_;\n  std::map<std::string, raw_ptr<content::WebContents>> veyrion_cached_panels_;'))
  edit('browser/ui/sidebar/sidebar_web_panel_controller.cc',s=>{
    if(s.includes('// Veyrion cached panel documents'))return s
    s=s.replace(/void SidebarWebPanelController::ToggleWebPanel\(const SidebarItem& item\) \{[\s\S]*?\n\}/,`void SidebarWebPanelController::ToggleWebPanel(const SidebarItem& item) {
  // Veyrion cached panel documents survive switching to another sidebar app.
  const bool same = panel_item_.IsValidItem() && panel_item_.url == item.url;
  CloseWebPanel();
  if (!same) OpenWebPanel(item);
  BraveBrowserView::From(base::to_address(browser_view_))->UpdateRoundedCornersUI();
}`)
    s=s.replace(/void SidebarWebPanelController::OpenWebPanel\(const SidebarItem& item\) \{[\s\S]*?\n\}/,`void SidebarWebPanelController::OpenWebPanel(const SidebarItem& item) {
  CHECK(!panel_item_.IsValidItem());
  if (auto* side_panel = SidePanelUI::From(browser_view_->browser())) side_panel->Close();
  auto cached = veyrion_cached_panels_.find(item.url.spec());
  const bool reused = cached != veyrion_cached_panels_.end();
  panel_contents_ = reused ? cached->second.get() : chrome::AddAndReturnTabAt(
      browser_view_->browser(), GURL("about:blank"), 0, false, std::nullopt, true);
  if (!reused) veyrion_cached_panels_[item.url.spec()] = panel_contents_;
  panel_item_ = item;
  Observe(panel_contents_);
  ApplyVeyrionMobileView(!reused);
  GetMultiContentsView()->SetWebPanelContents(panel_contents_);
}`)
    s=s.replace('  if (panel_contents_) chrome::CloseWebContents(browser_view_->browser(), panel_contents_, false);','  CloseWebPanel();')
    s=s.replace('  if (panel_contents_ == tab->GetContents()) {',`  for (auto it = veyrion_cached_panels_.begin(); it != veyrion_cached_panels_.end();) {
    if (it->second == tab->GetContents()) it = veyrion_cached_panels_.erase(it);
    else ++it;
  }
  if (panel_contents_ == tab->GetContents()) {`)
    return s
  })
  // Tabs survive memory-saver WebContents replacement; raw WebContents do not.
  edit('browser/ui/sidebar/sidebar_web_panel_controller.h',s=>s.replace('std::map<std::string, raw_ptr<content::WebContents>> veyrion_cached_panels_;','std::map<std::string, raw_ptr<tabs::TabInterface>> veyrion_cached_panels_;'))
  edit('browser/ui/sidebar/sidebar_web_panel_controller.cc',s=>s.replace('reused ? cached->second.get() : chrome::AddAndReturnTabAt(', 'reused ? cached->second->GetContents() : chrome::AddAndReturnTabAt(').replace('if (!reused) veyrion_cached_panels_[item.url.spec()] = panel_contents_;','if (!reused) veyrion_cached_panels_[item.url.spec()] =\n      tabs::TabInterface::MaybeGetFromContents(panel_contents_);').replace('if (it->second == tab->GetContents())','if (it->second == tab)'))
  edit('app/brave_main_delegate.cc',s=>s.includes('// Veyrion native automatic video pop-out')?s:s.replace('  BraveMainDelegate::AppendCommandLineOptions();',`  BraveMainDelegate::AppendCommandLineOptions();
  // Veyrion native automatic video pop-out. The site permission and the
  // profile preference still control whether a window can actually open.
  auto* veyrion_command = base::CommandLine::ForCurrentProcess();
  std::string veyrion_features = veyrion_command->GetSwitchValueASCII("enable-features");
  if (!veyrion_features.empty()) veyrion_features += ",";
  veyrion_features += "BrowserInitiatedAutomaticPictureInPicture";
  veyrion_command->AppendSwitchASCII("enable-features", veyrion_features);`))
  edit('../chrome/browser/picture_in_picture/auto_picture_in_picture_tab_helper.cc',s=>s.includes('// Veyrion optional automatic mini-player')?s:s.replace('#include "chrome/browser/profiles/profile.h"','#include "chrome/browser/profiles/profile.h"\n#include "components/prefs/pref_service.h"').replace('void AutoPictureInPictureTabHelper::MaybeEnterAutoPictureInPicture() {',`void AutoPictureInPictureTabHelper::MaybeEnterAutoPictureInPicture() {
  // Veyrion optional automatic mini-player; manual PiP remains available.
  if (!Profile::FromBrowserContext(web_contents()->GetBrowserContext())
           ->GetPrefs()->GetBoolean("veyrion.auto_pip")) return;`))
  edit('../chrome/browser/picture_in_picture/auto_picture_in_picture_tab_helper.cc',s=>s.includes('// Veyrion global opt-in replaces')?s:s.replace('bool AutoPictureInPictureTabHelper::MeetsMediaEngagementConditions() const {',`bool AutoPictureInPictureTabHelper::MeetsMediaEngagementConditions() const {
  // Veyrion global opt-in replaces the frequent-visitor threshold only.
  // Per-site blocking, private-mode rules and URL safety still apply.
  if (Profile::FromBrowserContext(web_contents()->GetBrowserContext())
          ->GetPrefs()->GetBoolean("veyrion.auto_pip")) return true;`))
}
