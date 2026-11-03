import fs from 'node:fs'
import path from 'node:path'
export function integrateImporters(source){
  const edit=(name,fn)=>{const file=path.resolve(source,name),before=fs.readFileSync(file,'utf8'),after=fn(before);if(before!==after)fs.writeFileSync(file,after)}
  fs.copyFileSync(new URL('../native-ui/import-source.h',import.meta.url),path.join(source,'browser/ui/webui/settings/veyrion_import_source.h'))
  edit('chromium_src/chrome/browser/importer/importer_list.cc',s=>{
    s=s.replace('#if BUILDFLAG(IS_BRAVE_ORIGIN_BRANDED)\n  AddChromeToProfiles(', '// Veyrion imports the original Brave profile in all builds.\n  AddChromeToProfiles(')
    s=s.replace('GetBraveUserDataFolder(), kBraveBrowser, user_data_importer::TYPE_BRAVE);\n#endif','GetBraveUserDataFolder(), kBraveBrowser, user_data_importer::TYPE_BRAVE);')
    if(!s.includes('"Opera GX"'))s=s.replace('  AddChromeToProfiles(\n      profiles,\n      GetChromeSourceProfiles(GetYandexUserDataFolder()',`#if BUILDFLAG(IS_WIN)
  const auto opera_gx = GetOperaUserDataFolder().DirName().AppendASCII("Opera GX Stable");
  AddChromeToProfiles(profiles, GetChromeSourceProfiles(opera_gx.AppendASCII("Local State")),
      opera_gx, "Opera GX", user_data_importer::TYPE_OPERA);
#endif
  AddChromeToProfiles(
      profiles,
      GetChromeSourceProfiles(GetYandexUserDataFolder()`)
    return s
  })
  edit('../chrome/browser/importer/importer_list.cc',s=>s.includes('// Veyrion manual source profiles')?s:s.replace('#include <stdint.h>','#include <stdint.h>\n#include <utility>').replace('  if (include_interactive_profiles) {',`  if (include_interactive_profiles) {
    // Veyrion manual source profiles: available even for portable installations.
    const std::pair<const char16_t*, user_data_importer::ImporterType> sources[] = {
      {u"Brave (seleccionar carpeta)", user_data_importer::TYPE_BRAVE},
      {u"Opera (seleccionar carpeta)", user_data_importer::TYPE_OPERA},
      {u"Opera GX (seleccionar carpeta)", user_data_importer::TYPE_OPERA},
      {u"Firefox (seleccionar carpeta)", user_data_importer::TYPE_FIREFOX}};
    for (const auto& [name, type] : sources) {
      user_data_importer::SourceProfile manual;
      manual.importer_name = name;
      manual.importer_type = type;
      manual.locale = locale;
      manual.services_supported = user_data_importer::FAVORITES | user_data_importer::HISTORY;
      if (type != user_data_importer::TYPE_FIREFOX)
        manual.services_supported |= user_data_importer::AUTOFILL_FORM_DATA;
      profiles.push_back(manual);
    }`))
  edit('../chrome/browser/ui/webui/settings/import_data_handler.h',s=>s.includes('veyrion_pending_import_')?s:s.replace('#include <memory>','#include <memory>\n#include <optional>\n#include "base/memory/weak_ptr.h"').replace('  scoped_refptr<ui::SelectFileDialog> select_file_dialog_;',`  scoped_refptr<ui::SelectFileDialog> select_file_dialog_;
  std::optional<user_data_importer::SourceProfile> veyrion_pending_import_;
  uint16_t veyrion_pending_items_ = 0;
  base::WeakPtrFactory<ImportDataHandler> veyrion_weak_factory_{this};`))
  edit('../chrome/browser/ui/webui/settings/import_data_handler.cc',s=>{
    if(s.includes('// Veyrion manual profile selection'))return s
    s=s.replace('#include "base/check.h"','#include "base/check.h"\n#include "base/task/thread_pool.h"\n#include "content/public/browser/web_contents.h"\n#include "brave/browser/ui/webui/settings/veyrion_import_source.h"')
    s=s.replace('void ImportDataHandler::OnJavascriptDisallowed() {','void ImportDataHandler::OnJavascriptDisallowed() {\n  veyrion_weak_factory_.InvalidateWeakPtrs();\n  veyrion_pending_import_.reset();')
    s=s.replace('  if (imported_items) {\n    StartImport(source_profile, imported_items);',`  if (imported_items) {
    // Veyrion manual profile selection uses the same native import pipeline.
    if (source_profile.source_path.empty() &&
        (source_profile.importer_type == user_data_importer::TYPE_BRAVE ||
         source_profile.importer_type == user_data_importer::TYPE_OPERA ||
         source_profile.importer_type == user_data_importer::TYPE_FIREFOX)) {
      if (select_file_dialog_) return;
      veyrion_pending_import_ = source_profile;
      veyrion_pending_items_ = imported_items;
      select_file_dialog_ = ui::SelectFileDialog::Create(this,
          std::make_unique<ChromeSelectFilePolicy>(web_ui()->GetWebContents()));
      select_file_dialog_->SelectFile(ui::SelectFileDialog::SELECT_FOLDER,
          u"Selecciona la carpeta del perfil (Default o el perfil de Firefox)",
          base::FilePath(), nullptr, 0, base::FilePath::StringType(),
          web_ui()->GetWebContents()->GetTopLevelNativeWindow(), nullptr);
      return;
    }
    StartImport(source_profile, imported_items);`)
    s=s.replace('  select_file_dialog_ = nullptr;\n\n  user_data_importer::SourceProfile source_profile;',`  select_file_dialog_ = nullptr;
  if (veyrion_pending_import_) {
    auto pending = *veyrion_pending_import_;
    const auto items = veyrion_pending_items_;
    veyrion_pending_import_.reset();
    base::ThreadPool::PostTaskAndReplyWithResult(FROM_HERE, {base::MayBlock()},
        base::BindOnce(&VeyrionPrepareImportSource, pending, file.path()),
        base::BindOnce([](base::WeakPtr<ImportDataHandler> self, uint16_t selected,
                         std::optional<user_data_importer::SourceProfile> prepared) {
          if (!self || !self->IsJavascriptAllowed()) return;
          if (prepared && (selected & prepared->services_supported))
            self->StartImport(*prepared, selected & prepared->services_supported);
          else self->FireWebUIListener("import-data-status-changed", base::Value("failed"));
        }, veyrion_weak_factory_.GetWeakPtr(), items));
    return;
  }
  user_data_importer::SourceProfile source_profile;`)
    s=s.replace('void ImportDataHandler::FileSelectionCanceled() {','void ImportDataHandler::FileSelectionCanceled() {\n  veyrion_pending_import_.reset();')
    return s
  })
}
