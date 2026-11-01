import fs from 'node:fs'
import path from 'node:path'
export function integrateUpdateNotifications(source){
  const edit=(file,fn)=>{const target=path.resolve(source,file),before=fs.readFileSync(target,'utf8'),after=fn(before);if(after!==before)fs.writeFileSync(target,after)}
  fs.copyFileSync(new URL('../native-ui/update-notification.h',import.meta.url),path.join(source,'browser/ui/webui/settings/veyrion_update_notification.h'))
  edit('../tools/metrics/histograms/metadata/browser/enums.xml',s=>s.includes('label="VeyrionUpdate"')?s:s.replace(/(<enum name="InfoBarIdentifier">[\s\S]*?)(<\/enum>)/,'$1  <int value="513" label="VeyrionUpdate"/>\n$2'))
  edit('browser/ui/views/sidebar/sidebar_control_view.cc',s=>{
    const start=s.indexOf('  veyrion_dark_button_ = AddChildView('),end=s.indexOf('  veyrion_update_button_ = AddChildView(',start)
    if(start>=0&&end>start)s=s.slice(0,start)+s.slice(end)
    if(!s.includes('veyrion_update_notification.h'))s=s.replace('#include "base/check.h"','#include "base/check.h"\n#include "brave/browser/ui/webui/settings/veyrion_update_notification.h"')
    if(!s.includes('VeyrionHandleUpdateNotification(self->browser_, state)'))s=s.replace('        if (!self || !self->veyrion_update_button_) return;','        if (!self || !self->veyrion_update_button_) return;\n        VeyrionHandleUpdateNotification(self->browser_, state);')
    return s.replace('veyrion_update_timer_.Start(FROM_HERE, base::Seconds(30)','veyrion_update_timer_.Start(FROM_HERE, base::Seconds(5)')
  })
}
