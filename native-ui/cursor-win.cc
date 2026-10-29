// Profile-scoped native cursors. Never changes the Windows cursor scheme.
void BrowserDesktopWindowTreeHostWin::SetCursorNative(gfx::NativeCursor cursor) {
  auto* prefs = browser_view_->GetProfile()->GetPrefs();
  if (prefs->FindPreference("veyrion.cursor_mode") &&
      cursor.type() == ui::mojom::CursorType::kPointer) {
    const auto& mode = prefs->GetString("veyrion.cursor_mode");
    const auto& image = prefs->GetString("veyrion.cursor_png");
    const int x = prefs->GetInteger("veyrion.cursor_x");
    const int y = prefs->GetInteger("veyrion.cursor_y");
    const std::string key = mode + ":" + base::NumberToString(x) + ":" +
        base::NumberToString(y) + ":" + image;
    if (key != veyrion_cursor_key_) {
      veyrion_cursor_key_ = key;
      veyrion_cursor_ = nullptr;
      if (mode == "cross" || mode == "up") {
        veyrion_cursor_ = base::MakeRefCounted<ui::WinCursor>(
            LoadCursor(nullptr, mode == "cross" ? IDC_CROSS : IDC_UPARROW));
      } else if (mode == "custom") {
        std::string bytes;
        if (base::Base64Decode(image, &bytes) && VeyrionValidCursorPng(bytes)) {
          auto bitmap = gfx::PNGCodec::Decode(base::as_byte_span(bytes));
          if (!bitmap.isNull() && x >= 0 && y >= 0 && x < bitmap.width() && y < bitmap.height()) {
            auto handle = IconUtil::CreateCursorFromSkBitmap(bitmap, gfx::Point(x, y));
            if (handle.is_valid())
              veyrion_cursor_ = base::MakeRefCounted<ui::WinCursor>(
                  reinterpret_cast<HCURSOR>(handle.release()), true);
          }
        }
      }
    }
    if (veyrion_cursor_) cursor.SetPlatformCursor(veyrion_cursor_);
  }
  views::DesktopWindowTreeHostWin::SetCursorNative(cursor);
}
