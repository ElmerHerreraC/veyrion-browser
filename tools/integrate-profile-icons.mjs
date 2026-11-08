import fs from 'node:fs'
import path from 'node:path'

export function integrateProfileIcons(source) {
  const edit = (file, marker, transform) => {
    const target = path.join(source, file)
    const before = fs.readFileSync(target, 'utf8')
    if (before.includes(marker)) return
    const after = transform(before)
    if (after === before || !after.includes(marker)) throw Error('Integration failed: ' + file)
    fs.writeFileSync(target, after)
  }
  edit('browser/ui/views/toolbar/brave_toolbar_view.cc', '// Veyrion always exposes local profiles', text => text.replace(
    '        !IsAvatarButtonHideable(profile) || HasMultipleUserProfiles();',
    `        // Veyrion always exposes local profiles, including the first one.
        profile->IsRegularProfile() || !IsAvatarButtonHideable(profile) ||
        HasMultipleUserProfiles();`))
  edit('browser/ui/views/sidebar/sidebar_items_contents_view.cc', '// Veyrion preserve monochrome icon detail', text => text
    .replace('#include "base/check.h"', '#include "base/check.h"\n#include "ui/gfx/color_utils.h"')
    .replace(`    resized = gfx::ImageSkiaOperations::CreateColorMask(resized,
        GetColorProvider()->GetColor(kColorSidebarButtonBase));`, `    // Veyrion preserve monochrome icon detail instead of flattening alpha.
    resized = gfx::ImageSkiaOperations::CreateHSLShiftedImage(
        resized, color_utils::HSL{-1, 0, 0.5});`))
  edit('browser/ui/views/sidebar/sidebar_item_view.cc', '// Veyrion active panel indicator', text => text
    .replace('#include "base/check.h"', '#include "base/check.h"\n#include "ui/color/color_id.h"')
    .replace('  SetHighlighted(active_);\n}', '  SetHighlighted(active_);\n  SchedulePaint();\n}')
    .replace('  const ui::ColorProvider* color_provider = GetColorProvider();', `  const ui::ColorProvider* color_provider = GetColorProvider();
  // Veyrion active panel indicator remains distinct from hover and favicon.
  if (active_ && color_provider && height() > 12) {
    canvas->FillRect(gfx::Rect(2, 6, 3, height() - 12),
                    color_provider->GetColor(ui::kColorSysPrimary));
  }`))
}
