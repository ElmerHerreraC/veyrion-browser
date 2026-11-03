import fs from 'node:fs'
import path from 'node:path'

export function integrateTranslateFallback(source) {
  const file=path.resolve(source,'../chrome/browser/ui/views/translate/translate_bubble_view.cc')
  let text=fs.readFileSync(file,'utf8')
  if(text.includes('// Veyrion explicit Google Translate fallback'))return
  text=text.replace('#include <algorithm>',`#include <algorithm>
#include "chrome/browser/browser_process.h"
#include "chrome/browser/ui/navigator/browser_navigator.h"
#include "chrome/browser/ui/navigator/browser_navigator_params.h"
#include "base/strings/escape.h"`)
  const anchor='  button_row->AddChildView(std::move(try_again_button));'
  if(!text.includes(anchor))throw Error('Translate error view not found')
  text=text.replace(anchor,anchor+`
  // Veyrion explicit Google Translate fallback. No automatic URL transmission.
  if (web_contents()) {
    auto google_button = std::make_unique<views::MdTextButton>(
        base::BindRepeating([](base::WeakPtr<content::WebContents> contents) {
          if (!contents) return;
          const GURL page = contents->GetLastCommittedURL();
          if (!page.SchemeIsHTTPOrHTTPS() || page.HostIsIPAddress() ||
              page.host().find('.') == std::string::npos ||
              page.host().ends_with(".local") ||
              page.host().ends_with(".localhost") ||
              page.has_username() || page.has_password()) return;
          std::string language = g_browser_process->GetApplicationLocale();
          language = language.substr(0, language.find('-'));
          GURL::Replacements clean;
          clean.ClearRef();
          const GURL destination("https://translate.google.com/translate?sl=auto&tl=" +
              base::EscapeQueryParamValue(language, true) + "&u=" +
              base::EscapeQueryParamValue(page.ReplaceComponents(clean).spec(), true));
          NavigateParams params(Profile::FromBrowserContext(contents->GetBrowserContext()),
                                destination, ui::PAGE_TRANSITION_LINK);
          params.disposition = WindowOpenDisposition::NEW_FOREGROUND_TAB;
          Navigate(&params);
        }, web_contents()->GetWeakPtr()), u"Traducir con Google");
    google_button->SetTooltipText(u"Abre una página pública en Google Translate y comparte su dirección con Google. No admite páginas privadas ni sesiones iniciadas.");
    view->AddChildView(std::move(google_button));
  }
`)
  fs.writeFileSync(file,text)
}

