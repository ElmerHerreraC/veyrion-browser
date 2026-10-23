import fs from 'node:fs'
import path from 'node:path'
import { root } from './paths.mjs'

export function integrateSettingsBranding(source) {
  const version = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version
  if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Versión inválida de ajustes.')
  const toolbarPath=path.resolve(source,'../ui/webui/resources/cr_elements/cr_toolbar/cr_toolbar.html.ts')
  const toolbarBefore=fs.readFileSync(toolbarPath,'utf8')
  const toolbarAfter=toolbarBefore.replace('//resources/images/chrome_logo_dark.svg','chrome://theme/current-channel-logo@1x')
  if(toolbarAfter!==toolbarBefore)fs.writeFileSync(toolbarPath,toolbarAfter)
  function edit(relative, transform) {
    const target=path.join(source,relative)
    const before=fs.readFileSync(target,'utf8')
    const after=transform(before)
    if(after!==before)fs.writeFileSync(target,after)
  }
  edit('browser/resources/settings/br/settings_ui.ts', text=>text.includes('// Veyrion toolbar logo')?text:text.replace('    templateContent.prepend(braveHtml`', `    // Veyrion toolbar logo also replaces the dark-mode fallback image.
    const toolbar = templateContent.querySelector('cr-toolbar')
    if (toolbar) {
      const logo = document.createElement('img')
      logo.slot = 'product-logo'
      logo.src = 'chrome://theme/current-channel-logo@1x'
      logo.alt = 'Veyrion'
      logo.width = 24
      logo.height = 24
      logo.style.margin = '0 18px 0 24px'
      toolbar.appendChild(logo)
    }
    templateContent.prepend(braveHtml\``))
  edit('browser/resources/settings/br/settings_menu.ts', text=>text.replace(/versionEl\.textContent = `[^\n]+`/, `versionEl.textContent = 'v ${version}'`).replace(/versionEl\.textContent = 'v \d+\.\d+\.\d+'/,`versionEl.textContent = 'v ${version}'`))
  edit('browser/resources/settings/br/about_page.ts', text=>{
    text=text.replaceAll('https://brave.com/latest/','https://github.com/ElmerHerreraC/veyrion-browser/releases/latest')
      .replace(/wrapper\.textContent = `(?:Brave|Veyrion)[^\n]+`/, 'wrapper.textContent = `Veyrion '+version+' (Core ${braveVersion}) ${build}`')
    if(!text.includes('// Veyrion help destination'))text=text.replace('const modifyAboutPage = (root: ShadowRoot) => {', `const modifyAboutPage = (root: ShadowRoot) => {
  // Veyrion help destination; keep upstream license and copyright attribution.
  root.querySelector('#help')?.addEventListener('click', event => {
    event.stopImmediatePropagation()
    window.open('https://github.com/ElmerHerreraC/veyrion-browser/issues', '_blank', 'noopener')
  }, {capture: true})`)
    return text
  })
  edit('browser/ui/webui/settings/brave_settings_localized_strings_provider.cc', text=>text.includes('// Veyrion localized product labels')?text:text.replace('  html_source->AddString("aboutProductLicense", license);', `  html_source->AddString("aboutProductLicense", license);
  // Veyrion localized product labels preserve the selected UI language.
  auto about_title = l10n_util::GetStringUTF16(IDS_SETTINGS_ABOUT_PROGRAM);
  base::ReplaceSubstringsAfterOffset(&about_title, 0, u"Brave", u"Veyrion");
  html_source->AddString("aboutPageTitle", about_title);
  auto help_title = l10n_util::GetStringUTF16(IDS_SETTINGS_GET_HELP_USING_CHROME);
  base::ReplaceSubstringsAfterOffset(&help_title, 0, u"Brave", u"Veyrion");
  html_source->AddString("aboutGetHelpUsingChrome", help_title);
  html_source->AddString("aboutProductLogoAlt", "Veyrion");`))
  console.log('Marca propia en cabecera oscura, etiquetas y ayuda de ajustes.')
}

