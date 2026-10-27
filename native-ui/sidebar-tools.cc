void SidebarControlView::QueueVeyrionWorkspaces() {
  if (veyrion_workspace_refresh_pending_) return;
  veyrion_workspace_refresh_pending_ = true;
  base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(FROM_HERE,
      base::BindOnce(&SidebarControlView::RefreshVeyrionWorkspaces,
                     veyrion_weak_factory_.GetWeakPtr()));
}

void SidebarControlView::RefreshVeyrionWorkspaces() {
  veyrion_workspace_refresh_pending_ = false;
  if (!veyrion_workspaces_ || browser_->GetProfile()->IsOffTheRecord()) return;
  std::string fingerprint;
  auto* collection = ProfileBrowserCollection::GetForProfile(browser_->GetProfile());
  collection->ForEach([&](BrowserWindowInterface* window) {
    if (window->GetType() == BrowserWindowInterface::TYPE_NORMAL)
      fingerprint += base::NumberToString(window->GetSessionID().id()) + ":" +
          WindowMetadataController::From(window)->user_title() + "\n";
    return true;
  });
  if (fingerprint == veyrion_workspace_fingerprint_) return;
  veyrion_workspace_fingerprint_ = fingerprint;
  veyrion_workspaces_->RemoveAllChildViews();
  size_t position = 0;
  collection->ForEach([&](BrowserWindowInterface* window) {
    if (window->GetType() != BrowserWindowInterface::TYPE_NORMAL) return true;
    ++position;
    const int id = window->GetSessionID().id();
    const auto& title = WindowMetadataController::From(window)->user_title();
    const auto name = title.empty() ? (position == 1 ? "Personal" : "Tablero " + base::NumberToString(position)) : title;
    auto* button = veyrion_workspaces_->AddChildView(
        std::make_unique<SidebarButtonView>(u"Tablero: " + base::UTF8ToUTF16(name)));
    button->SetText(base::NumberToString16(position));
    button->SetAccessibleName(u"Tablero: " + base::UTF8ToUTF16(name));
    if (window == browser_)
      button->SetBackground(views::CreateRoundedRectBackground(ui::kColorSysPrimaryContainer, 6));
    button->SetCallback(base::BindRepeating([](SidebarControlView* self, int workspace_id) {
      auto* target = ProfileBrowserCollection::GetForProfile(self->browser_->GetProfile())
          ->FindBrowserWithID(SessionID::FromSerializedValue(workspace_id));
      if (target) { target->GetWindow()->Show(); target->GetWindow()->Activate(); }
    }, base::Unretained(this), id));
    return true;
  });
  InvalidateLayout();
}

void SidebarControlView::RefreshVeyrionDark() {
  if (!veyrion_dark_button_) return;
  const bool enabled = browser_->GetProfile()->GetPrefs()->GetBoolean(prefs::kWebKitForceDarkModeEnabled);
  const char16_t* tooltip = enabled
      ? u"Modo oscuro forzado en páginas web: activado. Pulsa para desactivar."
      : u"Forzar modo oscuro en páginas web. Pulsa para activar.";
  veyrion_dark_button_->SetTooltipText(tooltip);
  veyrion_dark_button_->SetAccessibleName(tooltip);
  veyrion_dark_button_->SetBackground(enabled
      ? views::CreateRoundedRectBackground(ui::kColorSysPrimaryContainer, 6) : nullptr);
}

void SidebarControlView::OnBrowserCreated(BrowserWindowInterface*) { QueueVeyrionWorkspaces(); }
void SidebarControlView::OnBrowserClosed(BrowserWindowInterface*) { QueueVeyrionWorkspaces(); }
void SidebarControlView::OnBrowserActivated(BrowserWindowInterface*) { QueueVeyrionWorkspaces(); }
