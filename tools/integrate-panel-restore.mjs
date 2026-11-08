import fs from 'node:fs'
import path from 'node:path'

export function integratePanelRestore(source) {
  const file=path.join(source,'browser/ui/sidebar/sidebar_web_panel_controller.cc')
  let text=fs.readFileSync(file,'utf8')
  const anchor='  auto cached = veyrion_cached_panels_.find(item.url.spec());'
  if(!text.includes(anchor))throw Error('Unexpected sidebar cache lookup')
  if(!text.includes('// Veyrion reconnect restored sidebar tabs'))text=text.replace(anchor,`${anchor}
  // Veyrion reconnect restored sidebar tabs before allocating a new document.
  // Only reuse pinned tabs in this window; never take an unrelated normal tab.
  if (cached == veyrion_cached_panels_.end()) {
    auto* model = browser_view_->browser()->GetTabStripModel();
    const bool site_root = item.url.SchemeIsHTTPOrHTTPS() &&
        item.url.path() == "/" && !item.url.has_query();
    for (int index = 0; index < model->count(); ++index) {
      if (!model->IsTabPinned(index)) continue;
      auto* contents = model->GetWebContentsAt(index);
      const GURL& restored = contents->GetVisibleURL();
      const bool matches = restored.GetWithoutRef() == item.url.GetWithoutRef() ||
          (site_root && restored.SchemeIsHTTPOrHTTPS() &&
           restored.GetWithEmptyPath() == item.url.GetWithEmptyPath());
      auto* tab = tabs::TabInterface::MaybeGetFromContents(contents);
      if (!matches || !tab) continue;
      cached = veyrion_cached_panels_.emplace(item.url.spec(), tab).first;
      break;
    }
  }`)
  if(!text.includes('// Veyrion detach the restored panel from the main view')) {
    const assign='  panel_contents_ = reused ? cached->second->GetContents() : chrome::AddAndReturnTabAt('
    if(!text.includes(assign))throw Error('Unexpected sidebar document assignment')
    text=text.replace(assign,`  // Veyrion detach the restored panel from the main view before reparenting.
  if (reused) {
    auto* model = browser_view_->browser()->GetTabStripModel();
    if (model->GetActiveWebContents() == cached->second->GetContents()) {
      int main_index = -1;
      for (int index = 0; index < model->count(); ++index) {
        if (!model->IsTabPinned(index)) { main_index = index; break; }
      }
      if (main_index >= 0)
        model->ActivateTabAt(main_index);
      else
        chrome::AddAndReturnTabAt(browser_view_->browser(), GURL("about:blank"),
                                 -1, true);
    }
  }
${assign}`)
  }
  fs.writeFileSync(file,text)
}
