#ifndef VEYRION_UPDATE_NOTIFICATION_H_
#define VEYRION_UPDATE_NOTIFICATION_H_
#include "brave/browser/ui/webui/settings/veyrion_update_state.h"
#include <memory>
#include <utility>
#include "base/functional/bind.h"
#include "base/no_destructor.h"
#include "base/task/thread_pool.h"
#include "base/task/single_thread_task_runner.h"
#include "chrome/browser/infobars/confirm_infobar_creator.h"
#include "chrome/browser/lifetime/application_lifetime.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "components/infobars/content/content_infobar_manager.h"
#include "components/infobars/core/confirm_infobar_delegate.h"
#include "components/infobars/core/infobar.h"

class VeyrionUpdateNotification : public ConfirmInfoBarDelegate {
 public:
  explicit VeyrionUpdateNotification(std::string version, bool components = false)
      : version_(std::move(version)), components_(components) {}
  // Fork-local identifier, registered in browser/enums.xml after Brave's 512.
  InfoBarIdentifier GetIdentifier() const override;
  std::u16string GetMessageText() const override;
  int GetButtons() const override;
  std::u16string GetButtonLabel(InfoBarButton) const override;
  bool Accept() override;
  bool Cancel() override;
  bool ShouldExpire(const NavigationDetails& details) const override;
 private:
  std::string version_;
  bool components_;
};

inline infobars::InfoBarDelegate::InfoBarIdentifier VeyrionUpdateNotification::GetIdentifier() const {
  return static_cast<InfoBarIdentifier>(513);
}
inline std::u16string VeyrionUpdateNotification::GetMessageText() const {
  return (components_ ? u"Actualización de componentes de Veyrion " :
                        u"Actualización del navegador Veyrion ") +
      base::UTF8ToUTF16(version_) +
      u" disponible. Se descargará y verificará antes de reiniciar. Puedes posponerlo.";
}
inline int VeyrionUpdateNotification::GetButtons() const { return BUTTON_OK | BUTTON_CANCEL; }
inline std::u16string VeyrionUpdateNotification::GetButtonLabel(InfoBarButton button) const {
  return button == BUTTON_OK ? u"Actualizar y reiniciar" : u"Reiniciar después";
}
inline bool VeyrionUpdateNotification::Accept() {
  base::ThreadPool::PostTask(FROM_HERE, {base::MayBlock()},
      base::BindOnce([] { VeyrionUpdateState("apply-restart"); }));
  return true;
}
inline bool VeyrionUpdateNotification::Cancel() { return true; }
inline bool VeyrionUpdateNotification::ShouldExpire(const NavigationDetails&) const {
  return false;
}

inline void VeyrionHandleUpdateNotification(BrowserWindowInterface* browser,
                                           const base::DictValue& state) {
  const auto* status = state.FindString("state");
  const auto* version = state.FindString("detail");
  if (!status || !version) return;
  if (*status == "ready-on-close" && state.FindBool("restartRequested").value_or(false)) {
    static base::NoDestructor<std::string> restarting_storage;
    auto& restarting = *restarting_storage;
    if (restarting == *version) return;
    restarting = *version;
    base::ThreadPool::PostTaskAndReplyWithResult(FROM_HERE,
        {base::MayBlock(), base::TaskShutdownBehavior::BLOCK_SHUTDOWN},
        base::BindOnce(&VeyrionSaveRestartArguments, *version),
        base::BindOnce([](bool saved) {
          if (saved) chrome::AttemptExit();
          else restarting_storage->clear();
        }));
    return;
  }
  static base::NoDestructor<std::string> notified_storage;
  auto& notified = *notified_storage;
  if (*status != "available" || notified == *version) return;
  auto* contents = browser->GetTabStripModel()->GetActiveWebContents();
  if (!contents || contents->IsLoading() || contents->GetLastCommittedURL().is_empty()) return;
  auto* manager = contents ? infobars::ContentInfoBarManager::FromWebContents(contents) : nullptr;
  if (!manager) return;
  const auto* kind = state.FindString("kind");
  if (manager->AddInfoBar(CreateConfirmInfoBar(std::make_unique<VeyrionUpdateNotification>(
          *version, kind && *kind == "components"))))
    notified = *version;
}
#endif
