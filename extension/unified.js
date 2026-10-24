import {preferences,updatePreferences} from './app.js'

const $=selector=>document.querySelector(selector)
const dialog=$('#settings-dialog')
$('#customize-top').textContent='☷ Configuración fácil'
if(globalThis.chrome?.braveTheme?.getVeyrionChrome){
  $('#customize-top').textContent='☷ Configuración del navegador'
  $('#customize-top').addEventListener('click',event=>{event.stopImmediatePropagation();chrome.tabs.create({url:'chrome://settings/appearance'})},{capture:true})
}
$('.dialog-header .eyebrow').textContent='PERSONALIZA VEYRION'
$('.dialog-header h2').textContent='CONFIGURACIÓN FÁCIL'
for(const control of [$('#apply-browser-color'),$('[data-setting=syncNativeTheme]')?.closest('label'), $('[data-page="settings/appearance"]')])if(control)control.hidden=true
$('#browser-color-status').textContent='Una misma configuración para las pestañas, la ventana, los iconos y el inicio.'

const visual=$('[data-section=visual]')
const advanced=document.createElement('details')
advanced.className='easy-advanced'
const summary=document.createElement('summary');summary.textContent='Más ajustes de apariencia';advanced.append(summary)
while(visual.firstChild)advanced.append(visual.firstChild)
visual.innerHTML=`
<div class="easy-heading"><h3>PREAJUSTES</h3><button class="show-all" data-show-section="mods">Mostrar todo</button></div>
<div class="easy-card preset-strip"><button id="preset-vey" class="preset-logo" aria-label="Veyrion original"><img src="icons/icon48.png" alt="Veyrion"></button><button id="preset-classic" class="preset-logo classic-logo">V / CLASSIC</button><span>Tu estilo, en toda la ventana.</span></div>
<div class="easy-heading"><h3>TEMAS</h3><button class="show-all" data-show-section="layout">Mostrar todo</button></div>
<div class="easy-card"><div class="theme-gallery"><button data-theme="gold" aria-label="Tema Dorado"><span class="theme-preview gold"><i></i></span><span>Dorado <b>○</b></span></button><button data-theme="wolf" aria-label="Tema White Wolf"><span class="theme-preview wolf"><i></i></span><span>White Wolf <b>○</b></span></button><button data-theme="custom" aria-label="Tema Personalizado"><span class="theme-preview mint"><i></i></span><span>Personalizado <b>○</b></span></button></div>
<div class="mode-switch" aria-label="Modo de toda la ventana"><button data-mode="light">Claro</button><button data-mode="system">Auto</button><button data-mode="dark">Oscuro</button></div>
<div class="easy-accent"><label for="unified-accent">Color de acento</label><input id="unified-accent" type="color" aria-label="Acento de todo el navegador"></div></div>
<div class="easy-heading"><h3>IMÁGENES DE FONDO</h3><label class="switch"><input id="wallpaper-enabled" type="checkbox" aria-label="Mostrar imagen de fondo"><span></span></label></div>
<div class="easy-card"><div class="wallpaper-gallery"><button data-wallpaper-preset="waves" aria-label="Fondo Ondas"><span class="wallpaper-thumb waves"></span>Ondas</button><button data-wallpaper-preset="orbit" aria-label="Fondo Órbita"><span class="wallpaper-thumb orbit"></span>Órbita</button><button data-wallpaper-preset="grid" aria-label="Fondo Retícula"><span class="wallpaper-thumb grid"></span>Retícula</button></div><button id="choose-own-wallpaper" class="outline">Elegir imagen personalizada</button></div>`
visual.append(advanced)

const icons=document.createElement('section');icons.dataset.section='icons';icons.hidden=true
icons.innerHTML=`<div class="easy-heading"><h3>ICONOS DE LA BARRA LATERAL</h3></div><div class="easy-card"><label class="toggle"><input type="checkbox" data-setting="sidebarColoredIcons"> Iconos de aplicaciones a color</label><label for="sidebar-size">Tamaño de los iconos</label><input id="sidebar-size" type="range" min="14" max="26" data-setting="sidebarIconSize"><label for="sidebar-spacing">Separación de los iconos</label><input id="sidebar-spacing" type="range" min="0" max="10" data-setting="sidebarSpacing"><p class="help">Elige qué iconos mostrar, su símbolo y su orden. La lista de lectura está retirada de esta barra.</p></div><div id="native-icon-list" class="native-icon-list"></div><p id="native-icon-status" class="help" role="status"></p><button id="configure-web-panels" class="outline">Agregar páginas y ajustar los paneles</button>`
const iconTab=document.createElement('button');iconTab.dataset.panel='icons';iconTab.textContent='Iconos';iconTab.setAttribute('aria-pressed','false')
$('.settings-tabs').insertBefore(iconTab,$('[data-panel=mods]'))
dialog.insertBefore(icons,$('#apply-browser-color'))

function section(name){
  document.querySelectorAll('[data-panel]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.panel===name)))
  document.querySelectorAll('[data-section]').forEach(panel=>panel.hidden=panel.dataset.section!==name)
  $('#update-card').hidden=name!=='updates'
  if(name==='icons')refreshIcons()
}
iconTab.addEventListener('click',()=>section('icons'))
document.querySelectorAll('[data-show-section]').forEach(button=>button.addEventListener('click',()=>section(button.dataset.showSection)))
$('#configure-web-panels').addEventListener('click',()=>section('layout'))
document.querySelectorAll('button[data-mode]').forEach(button=>button.addEventListener('click',()=>updatePreferences({themeMode:button.dataset.mode})))
const themes={gold:'#f7ce63',wolf:'#d2d2d2',custom:'#00d9bd'}
document.querySelectorAll('[data-theme]').forEach(button=>button.addEventListener('click',()=>updatePreferences({useCustomColor:true,customColor:themes[button.dataset.theme]})))
$('#preset-classic').addEventListener('click',()=>updatePreferences({themeMode:'dark',useCustomColor:true,customColor:'#ff1d55',frameStyle:'angular',effect:'none',wallpaperPreset:'waves'}))
$('#preset-vey').addEventListener('click',()=>updatePreferences({themeMode:'dark',useCustomColor:true,customColor:'#00d9bd',frameStyle:'angular',effect:'none'}))
$('#unified-accent').addEventListener('input',event=>updatePreferences({useCustomColor:true,customColor:event.target.value}))
$('#wallpaper-enabled').addEventListener('change',event=>updatePreferences({wallpaperEnabled:event.target.checked}))
document.querySelectorAll('button[data-wallpaper-preset]').forEach(button=>button.addEventListener('click',()=>updatePreferences({wallpaperPreset:button.dataset.wallpaperPreset,wallpaper:'',wallpaperEnabled:true})))
$('#choose-own-wallpaper').addEventListener('click',()=>{advanced.open=true;$('#wallpaper').click()})
icons.querySelectorAll('[data-setting]').forEach(control=>control.addEventListener(control.type==='range'?'input':'change',()=>updatePreferences({[control.dataset.setting]:control.type==='checkbox'?control.checked:Number(control.value)})))

function sync(){
  const state=preferences()
  document.querySelectorAll('button[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(state.themeMode===button.dataset.mode)))
  const accent=state.useCustomColor?state.customColor:{violet:'#a48bff',cyan:'#6bdfe5',rose:'#ff85af',lime:'#c2eb79'}[state.accent]
  $('#unified-accent').value=accent
  $('#wallpaper-enabled').checked=state.wallpaperEnabled
  document.querySelectorAll('[data-theme]').forEach(button=>button.setAttribute('aria-pressed',String(accent.toLowerCase()===themes[button.dataset.theme])))
  icons.querySelectorAll('[data-setting]').forEach(control=>{if(control.type==='checkbox')control.checked=state[control.dataset.setting];else control.value=state[control.dataset.setting]})
}
document.addEventListener('veyrion-appearance',sync)
sync()
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(preferences().themeMode==='system')document.documentElement.dataset.mode=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})

const native=globalThis.chrome?.braveTheme
function call(method,...args){return new Promise((resolve,reject)=>native[method](...args,value=>chrome.runtime.lastError?reject(new Error(chrome.runtime.lastError.message)):resolve(value)))}
async function refreshIcons(){
  if(!native?.getVeyrionChrome){$('#native-icon-status').textContent='Los controles nativos estarán disponibles en Veyrion 0.4.0.';return}
  try{
    const data=JSON.parse(await call('getVeyrionChrome'))
    $('#panel-width').value=data.panelWidth
    $('#native-icon-list').replaceChildren()
    for(const item of data.items){
      const row=document.createElement('div');row.className='native-icon-row'
      const visible=document.createElement('input');visible.type='checkbox';visible.checked=item.visible;visible.setAttribute('aria-label','Mostrar '+item.title)
      const name=document.createElement('span');name.textContent=item.title
      const symbols=document.createElement('select');symbols.setAttribute('aria-label','Símbolo de '+item.title)
      for(const [value,label]of Object.entries({default:'Original',grid:'Cuadrícula',code:'Código',star:'Estrella',chat:'Chat',play:'Reproducción',settings:'Ajustes'})){const option=document.createElement('option');option.value=value;option.textContent=label;symbols.append(option)}
      symbols.value=item.icon
      const change=async(action,value='')=>{try{await call('manageVeyrionIcon',action,item.index,value);await refreshIcons()}catch(error){$('#native-icon-status').textContent=error.message}}
      visible.addEventListener('change',()=>change(visible.checked?'show':'hide'))
      symbols.addEventListener('change',()=>change('icon',symbols.value))
      row.append(visible,name,symbols)
      for(const [action,label]of [['up','↑'],['down','↓']]){const button=document.createElement('button');button.textContent=label;button.setAttribute('aria-label',(action==='up'?'Subir ':'Bajar ')+item.title);button.addEventListener('click',()=>change(action));row.append(button)}
      $('#native-icon-list').append(row)
    }
    $('#native-icon-status').textContent='Cambios guardados en este perfil y aplicados a toda la ventana.'
  }catch(error){$('#native-icon-status').textContent=error.message}
}
for(const id of ['customize-top','customize'])$('#'+id).addEventListener('click',()=>refreshIcons())
if(new URLSearchParams(location.search).has('customize')){
  document.body.classList.add('customization-hub')
  dialog.showModal()
  section(new URLSearchParams(location.search).get('section')||'visual')
}
document.body.dataset.unifiedReady='true'
dialog.addEventListener('close',()=>document.body.classList.remove('customization-hub'))

