import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { root } from './paths.mjs'
import { stabilizeIconBuild } from './stabilize-icon-build.mjs'
const source = path.resolve(process.argv[2] || path.join(root, 'src/brave'))
stabilizeIconBuild(source)
function edit(file, transform) {
  const target = path.join(source, file)
  const before = fs.readFileSync(target, 'utf8')
  const after = transform(before)
  fs.writeFileSync(target, after)
  console.log('Identidad:', file)
}
for (const variant of ['BRANDING', 'BRANDING.development']) {
edit('app/theme/brave/' + variant, text => text
  .replace(/^COMPANY_FULLNAME=.*$/m, 'COMPANY_FULLNAME=Veyrion Project')
  .replace(/^COMPANY_SHORTNAME=.*$/m, 'COMPANY_SHORTNAME=Veyrion')
  .replace(/^PRODUCT_FULLNAME=.*$/m, 'PRODUCT_FULLNAME=Veyrion')
  .replace(/^PRODUCT_SHORTNAME=.*$/m, 'PRODUCT_SHORTNAME=Veyrion')
  .replace(/^PRODUCT_INSTALLER_FULLNAME=.*$/m, 'PRODUCT_INSTALLER_FULLNAME=Veyrion Installer')
  .replace(/^PRODUCT_INSTALLER_SHORTNAME=.*$/m, 'PRODUCT_INSTALLER_SHORTNAME=Veyrion Installer'))
}
edit('chromium_src/chrome/common/chrome_constants.cc', text => text.replaceAll('FPL("brave.exe")', 'FPL("veyrion.exe")'))
edit('app/brave_exe.ver', text => text.replace('INTERNAL_NAME=brave_exe', 'INTERNAL_NAME=veyrion_exe').replace('ORIGINAL_FILENAME=brave.exe', 'ORIGINAL_FILENAME=veyrion.exe'))
for (const file of ['chromium_src/chrome/installer/util/util_constants.h', 'chromium_src/chrome/installer/launcher_support/chrome_launcher_support.cc']) {
  edit(file, text => text.replaceAll('L"brave.exe"', 'L"veyrion.exe"'))
}
// Sync applies Brave's installer manifest patch before this branding step.
const releaseManifest = path.resolve(source, '../chrome/installer/mini_installer/chrome.release')
if (!fs.existsSync(releaseManifest)) throw new Error('Sincroniza Chromium antes de aplicar la identidad nativa.')
fs.writeFileSync(releaseManifest, fs.readFileSync(releaseManifest, 'utf8').replace(/^brave\.exe:/m, 'veyrion.exe:'))
edit('app/brave_strings.grd', text => text.replace(/(<message name="IDS_(?:SHORT_)?PRODUCT_NAME"[^>]*>\s*)(?:Brave for Testing|Brave)(\s*<\/message>)/g, '$1Veyrion$2'))
edit('build/win/BUILD.gn', text => text.replaceAll('"$root_out_dir/brave.exe"', '"$root_out_dir/$brave_exe"').replaceAll('"$root_out_dir/brave.exe.pdb"', '"$root_out_dir/$brave_exe.pdb"'))
edit('chromium_src/chrome/install_static/chromium_install_modes.h', text => text
  .replaceAll('L"BraveSoftware"', 'L"Veyrion"')
  .replaceAll('L"Brave-Browser-Development"', 'L"Veyrion"')
  .replaceAll('L"Brave-Browser"', 'L"Veyrion"')
  .replaceAll('L"Brave Development"', 'L"Veyrion"')
  .replaceAll('L"BraveDevelopment"', 'L"Veyrion"')
  .replaceAll('L"BraveDevHTM"', 'L"VeyrionHTML"')
  .replaceAll('L"BraveDevPDF"', 'L"VeyrionPDF"')
  .replaceAll('L"Brave Development HTML Document"', 'L"Veyrion HTML Document"')
  .replaceAll('L"Brave Development PDF Document"', 'L"Veyrion PDF Document"')
  .replaceAll('"brave-browser-development"', '"veyrion"'))
for (const name of ['brave.ico', 'brave_development.ico']) fs.copyFileSync(path.join(root, 'Veyrion.ico'), path.join(source, 'app/theme/brave/win', name))
execFileSync('pwsh.exe', ['-NoProfile', '-File', path.join(root, 'tools/brand-images.ps1'), '-Source', source], { stdio: 'inherit', windowsHide: true })
const veyrionSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path fill="#100c1b" d="M0 0h256v256H0z"/><path d="M51 63l75 138 79-143" fill="none" stroke="#b491ff" stroke-width="22" stroke-linecap="round"/><path d="M127 139l39-71" stroke="#69e9e0" stroke-width="14" stroke-linecap="round"/><circle cx="192" cy="188" r="8" fill="#69e9e0"/></svg>'
const menuVector = `CANVAS_DIMENSIONS, 24,
MOVE_TO, 3, 4,
LINE_TO, 6, 4,
LINE_TO, 12, 17,
LINE_TO, 18, 4,
LINE_TO, 21, 4,
LINE_TO, 13, 22,
LINE_TO, 11, 22,
CLOSE,
MOVE_TO, 12, 11,
LINE_TO, 15, 4,
LINE_TO, 17, 4,
LINE_TO, 13, 14,
CLOSE,
`
for (const name of ['app_menu_outline.icon', 'app_menu_color.icon']) {
  fs.writeFileSync(path.join(source, 'components/vector_icons', name), menuVector)
}
for (const variant of ['brave','brave_origin']) {
  for (const name of ['product.icon','product_refresh.icon']) {
    const target=path.join(source,'components/vector_icons',variant,name)
    if(fs.existsSync(target)&&fs.readFileSync(target,'utf8')!==menuVector)fs.writeFileSync(target,menuVector)
  }
}
edit('chromium_src/chrome/browser/ui/tabs/tab_style.cc', text => text
  .replace(/int GetTopCornerRadius\(\) const override \{[\s\S]*?\n  \}/, 'int GetTopCornerRadius() const override {\n    return 4;  // Veyrion angular tabs.\n  }')
  .replace(/int GetBottomCornerRadius\(\) const override \{[\s\S]*?\n  \}/, 'int GetBottomCornerRadius() const override {\n    return 2;\n  }'))
for (const variant of ['brave', 'brave_origin']) {
  for (const name of ['product_logo.svg', 'product_logo_animation.svg', 'password_manager_logo.svg']) {
    const target = path.join(source, 'app/theme', variant, name)
    if (fs.existsSync(target)) fs.writeFileSync(target, veyrionSvg)
  }
}
console.log('Identidad nativa aplicada. Pendiente compilar y probar el binario.')
