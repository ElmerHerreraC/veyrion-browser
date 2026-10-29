import {updatePreferences} from './app.js'

// This assistant only opens native tools; it never reads or uploads passwords.
const dialog=document.createElement('dialog');dialog.id='profile-onboarding'
dialog.innerHTML='<div class="dialog-header"><h2>Haz tuyo Veyrion</h2><button id="onboarding-close" aria-label="Cerrar asistente">✕</button></div><p>Configura este perfil o continúa con tus datos locales. Puedes volver a este asistente cuando quieras.</p><h3>Tus favoritos y contraseñas</h3><p>Importa lo que permita tu navegador anterior. La sincronización cifrada entre equipos está pendiente de habilitación en esta compilación. Puedes importar datos y usar tu perfil local. No se solicita una cuenta de Google.</p><div class="onboarding-actions"><button id="onboarding-import" class="outline">Importar de otro navegador</button><button id="onboarding-sync" class="outline">Configuración de sincronización</button><button id="onboarding-profile" class="outline">Nombre y foto del perfil</button><button id="onboarding-passwords" class="outline">Importar o gestionar contraseñas</button><button id="onboarding-done" class="primary">Continuar con este perfil</button></div><p id="onboarding-status" class="help" role="status"></p>'
document.body.append(dialog)
const native=Boolean(globalThis.chrome?.braveTheme?.getVeyrionChrome)
const tools={'onboarding-import':'chrome://settings/importData','onboarding-sync':'chrome://settings/braveSync','onboarding-profile':'chrome://settings/manageProfile','onboarding-passwords':'chrome://password-manager/settings'}
for(const [id,url]of Object.entries(tools))dialog.querySelector('#'+id).addEventListener('click',()=>{
  if(native)chrome.tabs.create({url},()=>{if(chrome.runtime.lastError)dialog.querySelector('#onboarding-status').textContent='No se pudo abrir la herramienta del navegador.'})
  else dialog.querySelector('#onboarding-status').textContent='Esta herramienta se abre dentro de Veyrion.'
})
const storage=globalThis.chrome?.storage?.local
async function finish(){
  if(storage)await new Promise(resolve=>storage.set({veyrionProfileSetupDone:true},resolve))
  else localStorage.setItem('veyrionProfileSetupDone','true')
  dialog.close()
}
for(const id of ['onboarding-close','onboarding-done'])dialog.querySelector('#'+id).addEventListener('click',finish)
dialog.addEventListener('cancel',event=>{event.preventDefault();finish()})
const button=document.createElement('button');button.id='configure-profile';button.className='outline';button.textContent='Perfil y sincronización';button.addEventListener('click',()=>dialog.showModal());document.querySelector('.settings-destinations').append(button)
const saved=storage?await new Promise(resolve=>storage.get(['veyrionProfileSetupDone','veyrionGoogleHomeDefault'],resolve)):{veyrionProfileSetupDone:localStorage.getItem('veyrionProfileSetupDone')==='true',veyrionGoogleHomeDefault:localStorage.getItem('veyrionGoogleHomeDefault')==='true'}
if(!saved.veyrionGoogleHomeDefault){await updatePreferences({engine:'google'});if(storage)storage.set({veyrionGoogleHomeDefault:true});else localStorage.setItem('veyrionGoogleHomeDefault','true')}
if(native&&!globalThis.chrome?.extension?.inIncognitoContext&&!saved.veyrionProfileSetupDone)dialog.showModal()
document.body.dataset.onboardingReady='true'
