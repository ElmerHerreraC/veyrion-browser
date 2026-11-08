import fs from 'node:fs'
import path from 'node:path'

export function integrateComponentTransport(source) {
  const redirects = path.join(source, 'components/static_redirect_helper/static_redirect_helper.cc')
  let redirectsText = fs.readFileSync(redirects, 'utf8')
  if (!redirectsText.includes('// Veyrion direct signed component downloads')) {
    const anchor = '  GURL::Replacements replacements;'
    if (!redirectsText.includes(anchor)) throw Error('Unexpected static redirect helper')
    redirectsText = redirectsText.replace(anchor, `${anchor}
  // Veyrion direct signed component downloads: keep Google's package URLs
  // independent of Brave's download proxy. CRX verification remains unchanged.
  if ((request_url.DomainIs("gvt1.com") ||
       request_url.host() == "dl.google.com" ||
       request_url.host() == "www.google.com") &&
      (request_url.path().starts_with("/release2/chrome_component/") ||
       request_url.path().starts_with("/edgedl/release2/chrome_component/") ||
       request_url.path().starts_with("/dl/release2/chrome_component/"))) {
    if (!request_url.SchemeIs("https")) {
      replacements.SetSchemeStr("https");
      *new_url = request_url.ReplaceComponents(replacements);
    }
    return;
  }
`)
    fs.writeFileSync(redirects, redirectsText)
  }
  const file = path.join(source, 'app/brave_main_delegate.cc')
  let text = fs.readFileSync(file, 'utf8')
  if (!text.includes('// Veyrion public component transport')) {
    const from = '    return BUILDFLAG(UPDATER_PROD_ENDPOINT);'
    if (!text.includes(from)) throw Error('Unexpected component endpoint configuration')
    text = text.replace(from, `    // Veyrion public component transport: use Chromium defaults unless an
    // authorized service is explicitly selected. Never borrow Brave keys.
    return std::string();`)
    fs.writeFileSync(file, text)
  }
  const config = path.join(source, 'browser/component_updater/brave_component_updater_configurator.cc')
  text = fs.readFileSync(config, 'utf8')
  if (!text.includes('/*require_encryption=*/true')) {
    const from = '                         false),'
    if (!text.includes(from)) throw Error('Unexpected component encryption configuration')
    text = text.replace(from, '                         /*require_encryption=*/true),')
    fs.writeFileSync(config, text)
  }
}
