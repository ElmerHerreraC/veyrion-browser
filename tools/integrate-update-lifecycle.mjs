import fs from 'node:fs'
import path from 'node:path'
export function integrateUpdateLifecycle(source){
  const edit=(file,fn)=>{const p=path.resolve(source,file),s=fs.readFileSync(p,'utf8'),t=fn(s);if(s!==t)fs.writeFileSync(p,t)}
  fs.copyFileSync(new URL('../native-ui/update-state.h',import.meta.url),path.join(source,'browser/ui/webui/settings/veyrion_update_state.h'))
  edit('../chrome/browser/ui/views/frame/browser_desktop_window_tree_host_win.h',s=>s.includes('veyrion_update_timer_')?s:s.replace('#include "base/memory/weak_ptr.h"','#include "base/memory/weak_ptr.h"\n#include "base/timer/timer.h"').replace('  base::WeakPtrFactory<BrowserDesktopWindowTreeHostWin>', '  base::RepeatingTimer veyrion_update_timer_;\n  base::WeakPtrFactory<BrowserDesktopWindowTreeHostWin>'))
  edit('../chrome/browser/ui/views/frame/browser_desktop_window_tree_host_win.cc',s=>{
    if(s.includes('veyrion_update_timer_.Start'))return s
    s=s.replace('#include "base/task/thread_pool.h"','#include "base/task/thread_pool.h"\n#include "brave/browser/ui/webui/settings/veyrion_update_notification.h"')
    const marker='  virtual_desktop_helper_->Init(GetHWND());'
    if(!s.includes(marker))throw Error('Window initialization hook missing')
    return s.replace(marker,marker+`
  veyrion_update_timer_.Start(FROM_HERE, base::Seconds(5), base::BindRepeating(
      [](base::WeakPtr<BrowserDesktopWindowTreeHostWin> self) {
        if (!self || !self->browser_view_ || !self->browser_view_->browser() ||
            !self->browser_view_->GetIsNormalType()) return;
        base::ThreadPool::PostTaskAndReplyWithResult(FROM_HERE, {base::MayBlock()},
            base::BindOnce(&VeyrionUpdateState, std::string("status")),
            base::BindOnce([](base::WeakPtr<BrowserDesktopWindowTreeHostWin> host,
                              base::DictValue state) {
              if (host && host->browser_view_ && host->browser_view_->browser())
                VeyrionHandleUpdateNotification(host->browser_view_->browser(), state);
            }, self));
      }, weak_factory_.GetWeakPtr()));`)
  })
  edit('browser/ui/views/sidebar/sidebar_control_view.cc',s=>s.replace('        VeyrionHandleUpdateNotification(self->browser_, state);\n',''))
}
