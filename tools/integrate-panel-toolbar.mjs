import fs from 'node:fs'
import path from 'node:path'
export function integratePanelToolbar(source){
  const edit=(file,fn)=>{const p=path.resolve(source,file),s=fs.readFileSync(p,'utf8'),t=fn(s);if(t!==s)fs.writeFileSync(p,t)}
  edit('browser/ui/sidebar/sidebar_service_factory.cc',s=>s.includes('"veyrion.panel_toolbar"')?s:s.replace('  registry->RegisterBooleanPref("veyrion.auto_pip", true);','  registry->RegisterBooleanPref("veyrion.auto_pip", true);\n  registry->RegisterBooleanPref("veyrion.panel_toolbar", true);'))
  edit('browser/ui/webui/settings/brave_appearance_handler.cc',s=>{
    if(s.includes('state.Set("panelToolbar"'))return s
    return s.replace('  if (auto enabled = request.FindBool("autoPip"))',`  if (request.contains("panelToolbar") && !request.FindBool("panelToolbar").has_value()) {
    RejectJavascriptCallback(args[0], base::Value("Invalid panel toolbar value"));
    return;
  }
  if (auto enabled = request.FindBool("panelToolbar")) prefs->SetBoolean("veyrion.panel_toolbar", *enabled);
  if (auto enabled = request.FindBool("autoPip"))`).replace('  state.Set("autoPip",','  state.Set("panelToolbar", prefs->GetBoolean("veyrion.panel_toolbar"));\n  state.Set("autoPip",')
  })
  edit('browser/ui/views/frame/split_view/brave_multi_contents_view_mini_toolbar.h',s=>s.includes('veyrion_toolbar_prefs_')?s:s.replace('#include "ui/color/color_id.h"','#include "ui/color/color_id.h"\n#include "components/prefs/pref_change_registrar.h"').replace('  bool is_active_ = false;','  PrefChangeRegistrar veyrion_toolbar_prefs_;\n  bool veyrion_toolbar_observed_ = false;\n  bool is_active_ = false;'))
  edit('browser/ui/views/frame/split_view/brave_multi_contents_view_mini_toolbar.cc',s=>{
    if(s.includes('// Veyrion optional panel toolbar'))return s
    return s.replace('#include "base/i18n/rtl.h"','#include "base/i18n/rtl.h"\n#include "chrome/browser/profiles/profile.h"\n#include "components/prefs/pref_service.h"').replace('  if (!GetVisible()) {',`  // Veyrion optional panel toolbar, persisted per profile and updated live.
  if (!veyrion_toolbar_observed_) {
    veyrion_toolbar_observed_ = true;
    veyrion_toolbar_prefs_.Init(browser_view_->browser()->GetProfile()->GetPrefs());
    veyrion_toolbar_prefs_.Add("veyrion.panel_toolbar", base::BindRepeating(
        [](BraveMultiContentsViewMiniToolbar* self) { self->UpdateState(self->is_active_, false); },
        base::Unretained(this)));
  }
  if (style_ == Style::kWebPanel &&
      !browser_view_->browser()->GetProfile()->GetPrefs()->GetBoolean("veyrion.panel_toolbar")) {
    SetVisible(false);
    return;
  }
  if (!GetVisible()) {`)
  })
}

