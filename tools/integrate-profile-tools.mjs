import fs from 'node:fs'
import path from 'node:path'
export function integrateProfileTools(source){
  const edit=(name,fn)=>{const file=path.resolve(source,name),before=fs.readFileSync(file,'utf8'),after=fn(before);if(before!==after)fs.writeFileSync(file,after)}
  edit('browser/resources/settings/brave_sync_page/brave_sync_setup.html',s=>{
    if(s.includes('veyrion-sync-pending'))return s
    s=s.replace('grid-template-columns: 30% auto;','grid-template-columns: 1fr;')
    s=s.replace('<div class="graphic">','<div class="graphic" hidden>')
    s=s.replace('<h1>$i18n{braveSyncSetupTitle}</h1>','<h1 id="veyrion-sync-pending">Sincronización entre equipos no disponible</h1>')
    s=s.replace('<p>$i18n{braveSyncSetupSubtitle}</p>','<p>Esta versión no tiene habilitado un servicio de sincronización. Crear un código no sincroniza tus datos. Puedes utilizar la importación local mientras se habilita un servicio autorizado.</p>')
    return s.replace(/    <div class="actions">[\s\S]*?\n    <\/div>/,`    <div class="actions">
      <a href="chrome://settings/importData">Importar favoritos y configuración</a>
      <a href="chrome://password-manager/settings">Importar contraseñas</a>
    </div>`)
  })
  edit('../chrome/browser/resources/settings/people_page/import_data_dialog.html.ts',s=>s.includes('veyrion-import-passwords')?s:s.replace('      <div slot="button-container">',`      <div slot="body" id="veyrion-import-passwords">
        <h3>Importar contraseñas</h3>
        <p>Si el navegador no permite importarlas directamente, exporta sus contraseñas a CSV y usa el administrador de contraseñas de Veyrion.</p>
        <a href="chrome://password-manager/settings" target="_blank">Importar contraseñas desde CSV</a>
        <p>Windows verificará tu identidad. No necesitas permisos de administrador. El archivo CSV contiene las contraseñas sin cifrar: elimínalo cuando termines de importarlo.</p>
      </div>
      <div slot="button-container">`))
  edit('../chrome/browser/extensions/api/passwords_private/passwords_private_delegate_impl.cc',s=>{
    if(s.includes('// Veyrion authenticate before selecting a password import file'))return s
    const before=`  password_import_controller_->Import(
      web_contents, store_to_use,
      base::BindOnce(&ConvertImportResults).Then(std::move(results_callback)));`
    const after=`#if BUILDFLAG(IS_WIN)
  // Veyrion authenticate before selecting a password import file. Reuse the
  // native identity check used by password export; never request elevation.
  AuthenticateUser(base::Seconds(0),
      l10n_util::GetStringUTF16(IDS_PASSWORDS_PAGE_IMPORT_AUTHENTICATION_PROMPT),
      base::BindOnce([](base::WeakPtr<PasswordsPrivateDelegateImpl> self,
                        base::WeakPtr<content::WebContents> contents,
                        password_manager::PasswordForm::Store store,
                        ImportResultsCallback callback, bool authenticated) {
        if (!self) return;
        if (!authenticated || !contents) {
          password_manager::ImportResults result;
          result.status = password_manager::ImportResults::DISMISSED;
          std::move(callback).Run(ConvertImportResults(result));
          return;
        }
        self->password_import_controller_->Import(contents.get(), store,
            base::BindOnce(&ConvertImportResults).Then(std::move(callback)));
      }, weak_ptr_factory_.GetWeakPtr(), web_contents->GetWeakPtr(),
         store_to_use, std::move(results_callback)));
#else
${before}
#endif`
    if(!s.includes(before))throw Error('Password importer entry changed; authentication was not patched')
    return s.replace(before,after)
  })
}
