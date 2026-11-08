import fs from 'node:fs'
import path from 'node:path'
import {root} from './paths.mjs'

export function integrateLocalTranslation(source){
  const edit=(file,fn)=>{const p=path.resolve(source,file),s=fs.readFileSync(p,'utf8'),t=fn(s);if(t!==s)fs.writeFileSync(p,t)}
  edit('../components/translate/core/browser/translate_client.h',s=>{
    if(s.includes('TranslateLocally('))return s
    return s.replace('#include <string>','#include <string>\n#include <string_view>').replace('  // Triggers PDF translation.',`  // The embedder may provide an on-device translation engine.
  virtual bool TranslateLocally(std::string_view source, std::string_view target);
  virtual bool RevertLocalTranslation();

  // Triggers PDF translation.`).replace('}  // namespace translate',`inline bool TranslateClient::TranslateLocally(std::string_view, std::string_view) {
  return false;
}
inline bool TranslateClient::RevertLocalTranslation() { return false; }

}  // namespace translate`)
  })
  edit('../components/translate/core/browser/translate_manager.cc',s=>{
    if(s.includes('// Veyrion on-device translation path'))return s
    return s.replace('  TranslateScript* script = TranslateDownloadManager::GetInstance()->script();',`  // Veyrion on-device translation path does not request a remote script.
  if (translate_client_->TranslateLocally(source_lang, target_lang)) {
    language_state_.set_translation_pending(true);
    return;
  }
  TranslateScript* script = TranslateDownloadManager::GetInstance()->script();`).replace('  translate_driver_->RevertTranslation(page_seq_no_);','  if (!translate_client_->RevertLocalTranslation())\n    translate_driver_->RevertTranslation(page_seq_no_);')
  })
  edit('../chrome/browser/translate/chrome_translate_client.h',s=>{
    if(s.includes('HandleVeyrionTranslationReply'))return s
    return s.replace('#include "base/memory/weak_ptr.h"','#include "base/memory/weak_ptr.h"\n#include "base/timer/timer.h"').replace('  bool ShowTranslateUI(',`  bool TranslateLocally(std::string_view source, std::string_view target) override;
  bool RevertLocalTranslation() override;
  bool HandleVeyrionTranslationReply(std::string_view request,
      std::string_view document, std::string_view action);
  bool ShowTranslateUI(`).replace('  base::WeakPtrFactory<ChromeTranslateClient>',`  std::string veyrion_translation_request_;
  std::string veyrion_translation_document_;
  std::string veyrion_translation_from_;
  std::string veyrion_translation_to_;
  base::OneShotTimer veyrion_translation_timer_;
  base::WeakPtrFactory<ChromeTranslateClient>`)
  })
  fs.copyFileSync(path.join(root,'native-ui/local-translation-native.inc'),path.resolve(source,'../chrome/browser/translate/veyrion_local_translation.inc'))
  edit('../chrome/browser/translate/chrome_translate_client.cc',s=>{
    if(s.includes('veyrion_local_translation.inc'))return s
    return s.replace('#include <memory>',`#include <memory>
#include "base/unguessable_token.h"
#include "base/values.h"
#include "base/task/single_thread_task_runner.h"
#include "components/sessions/content/session_tab_helper.h"
#include "content/public/browser/render_frame_host.h"
#include "extensions/browser/event_router.h"
#include "extensions/browser/extension_api_frame_id_map.h"`)+ '\n#include "chrome/browser/translate/veyrion_local_translation.inc"\n'
  })
  edit('../chrome/browser/translate/BUILD.gn',s=>s.includes('"//extensions/browser",')?s:s.replace('  deps = [\n    ":translate",','  deps = [\n    "//extensions/browser",\n    "//components/sessions",\n    ":translate",'))
  edit('../components/translate/core/browser/translate_language_list.cc',s=>{
    if(s.includes('// Veyrion bundled language pairs'))return s
    const from='  for (const LanguageTag& tag : supported_languages_) {'
    const start=s.indexOf(from,s.indexOf('void TranslateLanguageList::GetSupportedLanguages(')),end=s.indexOf('\n}',start)
    if(start<0||end<0)throw Error('Missing supported language UI')
    return s.slice(0,start)+'  // Veyrion bundled language pairs; no remote catalogue request.\n  languages->assign({"en", "es"});\n'+s.slice(end)
  })
  const schemaPath=path.join(source,'common/extensions/api/brave_theme.json')
  const schema=JSON.parse(fs.readFileSync(schemaPath,'utf8').replace(/^\s*\/\/.*$/gm,''))
  const properties={tabId:{type:'integer'},requestId:{type:'string'},documentId:{type:'string'},from:{type:'string'},to:{type:'string'},action:{type:'string'}}
  schema[0].events=(schema[0].events||[]).filter(e=>e.name!=='onVeyrionTranslate')
  schema[0].events.push({name:'onVeyrionTranslate',type:'function',parameters:[{name:'request',type:'object',properties}]})
  schema[0].functions=schema[0].functions.filter(f=>f.name!=='confirmVeyrionTranslation')
  schema[0].functions.push({name:'confirmVeyrionTranslation',type:'function',parameters:[{name:'tabId',type:'integer'},{name:'requestId',type:'string'},{name:'documentId',type:'string'},{name:'action',type:'string'}],returns_async:{name:'callback',parameters:[{name:'valid',type:'boolean'}]}})
  fs.writeFileSync(schemaPath,JSON.stringify(schema,null,2)+'\n')
  edit('browser/extensions/api/brave_theme_api.h',s=>s.includes('class BraveThemeConfirmVeyrionTranslationFunction')?s:s.replace('}  // namespace api',`class BraveThemeConfirmVeyrionTranslationFunction : public ExtensionFunction {
 public:
  DECLARE_EXTENSION_FUNCTION("braveTheme.confirmVeyrionTranslation", UNKNOWN)
 protected:
  ~BraveThemeConfirmVeyrionTranslationFunction() override = default;
  ResponseAction Run() override;
};
}  // namespace api`))
  edit('browser/extensions/api/brave_theme_api.cc',s=>{
    s=s.replaceAll('OneArgument(base::Value(false))','WithArguments(false)').replaceAll('OneArgument(base::Value(valid))','WithArguments(valid)').replace(/:*tabs::TabInterface::MaybeGetFromContents\(sender\)/g,'::tabs::TabInterface::MaybeGetFromContents(sender)')
    if(s.includes('BraveThemeConfirmVeyrionTranslationFunction::Run'))return s
    return s.replace('#include "base/check.h"','#include "base/check.h"\n#include "chrome/browser/extensions/extension_tab_util.h"\n#include "chrome/browser/translate/chrome_translate_client.h"').replace('}  // namespace extensions::api',`ExtensionFunction::ResponseAction BraveThemeConfirmVeyrionTranslationFunction::Run() {
  auto params = brave_theme::ConfirmVeyrionTranslation::Params::Create(args());
  EXTENSION_FUNCTION_VALIDATE(params);
  if (extension_id() != "mnojpmjdmbbfmejpflffifhffcmidifd")
    return RespondNow(Error("Built-in translation component only"));
  content::WebContents* contents = nullptr;
  if (!extensions::ExtensionTabUtil::GetTabById(params->tab_id, browser_context(),
                                              false, &contents))
    return RespondNow(WithArguments(false));
  auto* client = ChromeTranslateClient::FromWebContents(contents);
  const bool valid = client && client->HandleVeyrionTranslationReply(
      params->request_id, params->document_id, params->action);
  return RespondNow(WithArguments(valid));
}

}  // namespace extensions::api`)
  })
  edit('browser/extensions/BUILD.gn',s=>s.includes('"//chrome/browser/translate",')?s:s.replace('  deps = [','  deps = [\n    "//chrome/browser/translate",'))
  const destination=path.join(source,'components/brave_extension/extension/brave_extension/veyrion_start/translation')
  fs.mkdirSync(destination,{recursive:true})
  fs.cpSync(path.join(root,'extension/translation'),destination,{recursive:true})
  const manifestPath=path.join(source,'components/brave_extension/extension/brave_extension/manifest.json')
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'))
  for(const name of ['background','MAYBE_background'])if(manifest[name]){
    const script='veyrion_start/translation/background.js'
    if(!manifest[name].scripts.includes(script))manifest[name].scripts.push(script)
  }
  const content='veyrion_start/translation/content.js'
  if(!manifest.content_scripts.some(c=>c.js.includes(content)))manifest.content_scripts.push({matches:['http://*/*','https://*/*'],js:[content],run_at:'document_idle',all_frames:false})
  manifest.content_security_policy=manifest.content_security_policy.replaceAll("'wasm-eval'","'wasm-unsafe-eval'")
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n')
  const grdPath=path.join(source,'components/brave_extension/extension/resources.grd')
  let grd=fs.readFileSync(grdPath,'utf8').replace(/\s*<include name="IDR_VEYRION_TRANSLATION_[^\n]+\n/g,'\n')
  function files(dir,prefix=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name),prefix+e.name+'/'):[prefix+e.name])}
  const includes=files(destination).map(f=>`      <include name="IDR_VEYRION_TRANSLATION_${f.replace(/[^a-z0-9]/gi,'_').toUpperCase()}" file="brave_extension/veyrion_start/translation/${f}" type="BINDATA" />`).join('\n')
  grd=grd.replace('    </includes>',includes+'\n    </includes>');fs.writeFileSync(grdPath,grd)
}
