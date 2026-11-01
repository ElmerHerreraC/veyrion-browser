#ifndef VEYRION_UPDATE_NOTIFICATION_H_
#define VEYRION_UPDATE_NOTIFICATION_H_
#include "brave/browser/ui/webui/settings/veyrion_update_state.h"
#include <memory>
#include <utility>
#include "base/functional/bind.h"
#include "base/task/thread_pool.h"
#include "base/task/single_thread_task_runner.h"
#include "chrome/browser/infobars/confirm_infobar_creator.h"
#include "chrome/browser/lifetime/application_lifetime.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "components/infobars/content/content_infobar_manager.h"
#include "components/infobars/core/confirm_infobar_delegate.h"

class VeyrionUpdateNotification : public ConfirmInfoBarDelegate {
 public:
  explicit VeyrionUpdateNotification(std::string version) : version_(std::move(version)) {}
  // Fork-local identifier, registered in browser/enums.xml after Brave's 512.
  InfoBarIdentifier GetIdentifier() const override {
    return static_cast<InfoBarIdentifier>(513);
  }
  std::u16string GetMessageText() const override {
    return u"Nueva versión de Veyrion " + base::UTF8ToUTF16(version_) +
        u" disponible. Se descargará y verificará antes de reiniciar.";
  }
  int GetButtons() const override { return BUTTON_OK; }
  std::u16string GetButtonLabel(InfoBarButton) const override { return u"Actualizar y reiniciar"; }
  bool Accept() override {
    base::ThreadPool::PostTask(FROM_HERE, {base::MayBlock()},
        base::BindOnce([] { VeyrionUpdateState("apply-restart"); }));
    return true;
  }
 private:
  std::string version_;
};

inline void VeyrionHandleUpdateNotification(BrowserWindowInterface* browser,
                                           const base::DictValue& state) {
  const auto* status = state.FindString("state");
  const auto* version = state.FindString("detail");
  if (!status || !version) return;
  if (*status == "ready-on-close" && state.FindBool("restartRequested").value_or(false)) {
    static std::string restarting;
    if (restarting == *version) return;
    restarting = *version;
    base::ThreadPool::PostTaskAndReplyWithResult(FROM_HERE,
        {base::MayBlock(), base::TaskShutdownBehavior::BLOCK_SHUTDOWN},
        base::BindOnce(&VeyrionSaveRestartArguments, *version),
        base::BindOnce([](bool saved) {
          if (saved) chrome::AttemptExit();
          else restarting.clear();
        }));
    return;
  }
  static std::string notified;
  if (*status != "available" || notified == *version) return;
  auto* contents = browser->GetTabStripModel()->GetActiveWebContents();
  auto* manager = contents ? infobars::ContentInfoBarManager::FromWebContents(contents) : nullptr;
  if (!manager) return;
  notified = *version;
  manager->AddInfoBar(CreateConfirmInfoBar(std::make_unique<VeyrionUpdateNotification>(*version)));
}
#endif
