import fs from 'node:fs'
import path from 'node:path'

export function integratePanelLifecycle(source){
  const feedbackFile=path.join(source,'browser/ui/views/sidebar/sidebar_items_contents_view.cc')
  const feedback=fs.readFileSync(feedbackFile,'utf8')
  const guardedFeedback=feedback.replace(
    '  DCHECK_EQ(browser_, GetLastActiveBrowserWindowInterfaceWithAnyProfile());\n  DCHECK(!observation_.IsObserving());',
    '  // Rapid sidebar additions can overlap the existing feedback bubble.\n  if (browser_ != GetLastActiveBrowserWindowInterfaceWithAnyProfile() ||\n      observation_.IsObserving()) return;')
  if(guardedFeedback!==feedback)fs.writeFileSync(feedbackFile,guardedFeedback)
  const buildFile=path.join(source,'browser/ui/sidebar/BUILD.gn')
  let build=fs.readFileSync(buildFile,'utf8')
  const start=build.indexOf('source_set("sidebar_impl")')
  const end=build.indexOf('\nsource_set(',start+1)
  const section=build.slice(start,end<0?undefined:end)
  if(!section.includes('"//components/performance_manager"'))fs.writeFileSync(buildFile,build.replace(section,section.replace('    "//base",','    "//base",\n    "//components/performance_manager",')))
  const registry=path.join(source,'browser/ui/sidebar/sidebar_service_factory.cc')
  const registered=fs.readFileSync(registry,'utf8')
  if(!registered.includes('"veyrion.suspend_panels"'))fs.writeFileSync(registry,registered.replace('  registry->RegisterBooleanPref("veyrion.auto_pip", true);','  registry->RegisterBooleanPref("veyrion.auto_pip", true);\n  registry->RegisterBooleanPref("veyrion.suspend_panels", true);'))
  const file=path.join(source,'browser/ui/sidebar/sidebar_web_panel_controller.cc')
  let s=fs.readFileSync(file,'utf8')
  const before=s
  const finish=()=>{
    // Closing native cached tabs during panel switches needs further diagnosis.
    // Keep documents and drafts; freezing hidden pages provides the CPU saving.
    s=s.replace(/  \/\/ Veyrion bounded inactive panel cache\.[\s\S]*?(?=  auto cached = veyrion_cached_panels_)/,
      '  // Veyrion bounded inactive panel cache: eviction deferred for stability.\n')
    s=s.replace('if (!veyrion_cached_panels_.contains(item.url.spec()) && veyrion_cached_panels_.size() >= 4)', 'if (profile->GetPrefs()->GetBoolean("veyrion.suspend_panels") &&\n      !veyrion_cached_panels_.contains(item.url.spec()) && veyrion_cached_panels_.size() >= 4)')
    s=s.replace('  if (panel_contents_ && panel_contents_->GetVisibility()', '  if (browser_view_->browser()->GetProfile()->GetPrefs()->GetBoolean("veyrion.suspend_panels") &&\n      panel_contents_ && panel_contents_->GetVisibility()')
    if(!s.includes('components/performance_manager/public/performance_manager.h'))s=s.replace('#include "base/types/to_address.h"','#include "base/types/to_address.h"\n#include "components/performance_manager/public/performance_manager.h"\n#include "components/performance_manager/public/graph/page_node.h"')
    if(!s.includes('// Protect edits and live calls from cache eviction.'))s=s.replace('      auto* contents = tab->GetContents();',`      auto* contents = tab->GetContents();
      // Protect edits and live calls from cache eviction.
      const auto page = performance_manager::PerformanceManager::GetPrimaryPageNodeForWebContents(contents);
      if (!page || page->HadUserEdits() || page->UsesWebRTC()) continue;`)
    if(!s.includes('veyrion_live_page'))s=s.replace('  if (browser_view_->browser()->GetProfile()->GetPrefs()->GetBoolean("veyrion.suspend_panels") &&',`  const auto veyrion_live_page = panel_contents_ ?
      performance_manager::PerformanceManager::GetPrimaryPageNodeForWebContents(panel_contents_) :
      base::WeakPtr<performance_manager::PageNode>();
  if (veyrion_live_page && !veyrion_live_page->UsesWebRTC() &&
      browser_view_->browser()->GetProfile()->GetPrefs()->GetBoolean("veyrion.suspend_panels") &&`)
    if(s!==before)fs.writeFileSync(file,s)
  }
  if(s.includes('// Veyrion bounded inactive panel cache')){finish();return}
  s=s.replace('  auto cached = veyrion_cached_panels_.find(item.url.spec());',`  // Veyrion bounded inactive panel cache. Never evict media/capture or a page
  // with unload handlers; those may contain a call or unsaved work.
  if (!veyrion_cached_panels_.contains(item.url.spec()) && veyrion_cached_panels_.size() >= 4) {
    content::WebContents* oldest = nullptr;
    for (const auto& [url, tab] : veyrion_cached_panels_) {
      auto* contents = tab->GetContents();
      if (contents->GetVisibility() == content::Visibility::VISIBLE ||
          contents->IsCurrentlyAudible() || contents->IsBeingCaptured() ||
          contents->NeedToFireBeforeUnloadOrUnloadEvents()) continue;
      if (!oldest || contents->GetLastActiveTimeTicks() < oldest->GetLastActiveTimeTicks())
        oldest = contents;
    }
    if (oldest) chrome::CloseWebContents(browser_view_->browser(), oldest, false);
  }
  auto cached = veyrion_cached_panels_.find(item.url.spec());`)
  s=s.replace('  panel_item_ = item;\n  Observe(panel_contents_);',`  // A suspended panel resumes without navigating or losing its document.
  if (reused) {
    if (panel_contents_->GetVisibility() != content::Visibility::VISIBLE)
      panel_contents_->SetPageFrozen(false);
    if (panel_contents_->IsCrashed())
      panel_contents_->GetController().Reload(content::ReloadType::NORMAL, false);
    else panel_contents_->GetController().LoadIfNecessary();
  }
  panel_item_ = item;
  Observe(panel_contents_);`)
  s=s.replace('  GetMultiContentsView()->SetWebPanelContents(nullptr);\n  panel_contents_ = nullptr;',`  GetMultiContentsView()->SetWebPanelContents(nullptr);
  if (panel_contents_ && panel_contents_->GetVisibility() != content::Visibility::VISIBLE &&
      !panel_contents_->IsCurrentlyAudible() && !panel_contents_->IsBeingCaptured())
    panel_contents_->SetPageFrozen(true);
  panel_contents_ = nullptr;`)
  s=s.replace('  if (panel_contents_ && selection.active_tab_changed())',`  // A discarded/replaced tab retains its TabInterface but not its WebContents.
  // Rebind the visible panel before restoring its view; never retain the old pointer.
  bool panel_replaced = false;
  if (change.type() == TabStripModelChange::kReplaced &&
      panel_contents_ == change.GetReplace()->old_contents) {
    panel_contents_ = change.GetReplace()->new_contents;
    Observe(panel_contents_);
    panel_replaced = true;
  }
  if (panel_contents_ && (panel_replaced || selection.active_tab_changed()))`)
  if(!s.includes('SetPageFrozen(true)')||!s.includes('bool panel_replaced = false;'))throw Error('Panel lifecycle integration failed')
  finish()
}
