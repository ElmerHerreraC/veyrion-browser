import {preferences} from './app.js'
const $=selector=>document.querySelector(selector)
const dialog=$('#settings-dialog')
$('.dialog-header .eyebrow').textContent='INICIO'
$('.dialog-header h2').textContent='Personalizar inicio'
$('#customize-top').hidden=true
for(const control of [$('#apply-browser-color'),$('[data-setting=syncNativeTheme]')?.closest('label'),$('[data-page="settings/appearance"]'),$('#browser-color-status'),$('[data-panel=updates]')])if(control)control.hidden=true
const destinations=document.createElement('div');destinations.className='settings-destinations'
for(const [label,url] of [['Ventana y colores','chrome://settings/appearance'],['Barra lateral e iconos','chrome://settings/appearance#veyrion-icons'],['Punteros','chrome://settings/appearance#veyrion-cursor'],['Actualizaciones','chrome://settings/appearance?veyrionUpdates=1']]){
 const button=document.createElement('button');button.className='outline';button.textContent=label;button.addEventListener('click',()=>{if(globalThis.chrome?.tabs)chrome.tabs.create({url});else alert('Abre esta dirección en Veyrion: '+url)});destinations.append(button)
}
dialog.querySelector('.dialog-header').after(destinations)
$('[data-panel=visual]').textContent='Fondo y colores'
$('[data-panel=layout]').textContent='Diseño'
const gallery=document.createElement('div');gallery.className='wallpaper-gallery';$('[data-section=visual]').prepend(gallery)
for(const key of ['showNotes','showSidebar','tileSize','density','panelOpacity']){const control=$('[data-setting='+key+']');if(control){control.hidden=true;if(control.id)$('label[for="'+control.id+'"]')?.remove();else control.closest('label')?.remove()}}
const panelForm=$('#panel-form');panelForm.hidden=true;panelForm.previousElementSibling.hidden=true;panelForm.previousElementSibling.previousElementSibling.hidden=true
$('#panel-width').hidden=true;$('label[for=panel-width]').hidden=true;$('#panel-status').hidden=true
const colorLabel=$('label[for=custom-color]');if(colorLabel)colorLabel.textContent='Color de acento'
function sync(){document.documentElement.dataset.mode=preferences().themeMode==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):preferences().themeMode}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',sync)
if(new URLSearchParams(location.search).has('customize'))dialog.showModal()
document.body.dataset.unifiedReady='true'
