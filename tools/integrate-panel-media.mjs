import fs from 'node:fs'
import path from 'node:path'
export function integratePanelMedia(source){
  const file=path.resolve(source,'../chrome/browser/picture_in_picture/auto_picture_in_picture_tab_helper.cc')
  let text=fs.readFileSync(file,'utf8')
  if(text.includes('// Veyrion visible split panes are not background tabs.'))return
  text=text.replace('#include "chrome/browser/profiles/profile.h"','#include "chrome/browser/profiles/profile.h"\n#include "base/task/sequenced_task_runner.h"')
  const marker='void AutoPictureInPictureTabHelper::MaybeEnterAutoPictureInPicture() {'
  text=text.replace(marker,marker+`
  // Veyrion visible split panes are not background tabs.
  if (!tab_observer_helper_->IsTabActivated() &&
      web_contents()->GetVisibility() == content::Visibility::VISIBLE) return;`)
  const start=text.indexOf('void AutoPictureInPictureTabHelper::OnTabActivatedChanged(')
  const end=text.indexOf('void AutoPictureInPictureTabHelper::OnOcclusionStateChanged(',start)
  const section=text.slice(start,end)
  const old='    MaybeEnterAutoPictureInPicture();\n    MaybeScheduleAsyncTasks();'
  if(!section.includes(old))throw Error('Missing tab activation PiP hook')
  const replacement=`    // Wait until the tab switch has settled before checking visibility.
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(FROM_HERE,
        base::BindOnce([](base::WeakPtr<AutoPictureInPictureTabHelper> self) {
          if (!self || self->tab_observer_helper_->IsTabActivated() ||
              self->web_contents()->GetVisibility() == content::Visibility::VISIBLE)
            return;
          self->MaybeEnterAutoPictureInPicture();
          self->MaybeScheduleAsyncTasks();
        }, async_tasks_weak_factory_.GetWeakPtr()));`
  text=text.slice(0,start)+section.replace(old,replacement)+text.slice(end)
  fs.writeFileSync(file,text)
}
