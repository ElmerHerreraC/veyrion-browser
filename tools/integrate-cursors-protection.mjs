import fs from 'node:fs'
import path from 'node:path'
export function integrateCursorsProtection(source){
  const edit=(file,fn)=>{const target=path.resolve(source,file),before=fs.readFileSync(target,'utf8'),after=fn(before);if(before!==after)fs.writeFileSync(target,after)}
  const validation=fs.readFileSync(new URL('../native-ui/cursor-validation.h',import.meta.url),'utf8')
  fs.writeFileSync(path.join(source,'browser/ui/webui/settings/veyrion_cursor_validation.h'),validation)
  edit('browser/ui/sidebar/sidebar_service_factory.cc',s=>{
    if(!s.includes('veyrion.cursor_mode'))s=s.replace('  registry->RegisterStringPref("veyrion.theme_mode", "dark");',`  registry->RegisterStringPref("veyrion.cursor_mode", "default");
  registry->RegisterStringPref("veyrion.cursor_png", "");
  registry->RegisterIntegerPref("veyrion.cursor_x", 0);
  registry->RegisterIntegerPref("veyrion.cursor_y", 0);
  registry->RegisterBooleanPref("veyrion.aggressive_initialized", false);
  registry->RegisterStringPref("veyrion.theme_mode", "dark");`)
    if(!s.includes('// Veyrion aggressive default'))s=s.replace('#include "base/no_destructor.h"','#include "base/no_destructor.h"\n#include "brave/components/brave_shields/core/browser/brave_shields_utils.h"\n#include "chrome/browser/content_settings/host_content_settings_map_factory.h"').replace('  return service;',`  // Veyrion aggressive default is a one-time migration; later choices survive.
  if (!profile->IsOffTheRecord() && !preferences->GetBoolean("veyrion.aggressive_initialized")) {
    auto* map = HostContentSettingsMapFactory::GetForProfile(profile);
    brave_shields::SetCosmeticFilteringControlType(map, brave_shields::ControlType::BLOCK, GURL());
    preferences->SetBoolean("veyrion.aggressive_initialized", true);
  }
  return service;`)
    return s
  })
  edit('../chrome/browser/ui/views/frame/browser_desktop_window_tree_host_win.h',s=>s.includes('veyrion_cursor_key_')?s:s.replace('#include <shobjidl.h>','#include <shobjidl.h>\n#include "ui/base/win/win_cursor.h"').replace('  void Init(const views::Widget::InitParams& params) override;','  void SetCursorNative(gfx::NativeCursor cursor) override;\n  scoped_refptr<ui::WinCursor> veyrion_cursor_;\n  std::string veyrion_cursor_key_;\n  void Init(const views::Widget::InitParams& params) override;'))
  edit('../chrome/browser/ui/views/frame/browser_desktop_window_tree_host_win.cc',s=>{
    const mark='// BEGIN VEYRION CURSOR'
    if(s.includes(mark))s=s.slice(0,s.indexOf(mark))
    if(!s.includes('veyrion_cursor_validation.h'))s=s.replace('#include <windows.h>',`#include <windows.h>
#include "base/base64.h"
#include "base/containers/span.h"
#include "base/strings/string_number_conversions.h"
#include "brave/browser/ui/webui/settings/veyrion_cursor_validation.h"
#include "ui/base/cursor/cursor.h"
#include "ui/gfx/codec/png_codec.h"
#include "third_party/skia/include/core/SkBitmap.h"`)
    if(!s.includes('third_party/skia/include/core/SkBitmap.h'))s=s.replace('#include "ui/gfx/codec/png_codec.h"','#include "ui/gfx/codec/png_codec.h"\n#include "third_party/skia/include/core/SkBitmap.h"')
    return s+'\n'+mark+'\n'+fs.readFileSync(new URL('../native-ui/cursor-win.cc',import.meta.url),'utf8')
  })
}
