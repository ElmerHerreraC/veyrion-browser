import {preferences,updatePreferences} from './app.js'
import {safeUrl} from './model.js'

const section=document.createElement('section');section.className='recent-section'
section.innerHTML='<div class="section-heading"><h2>Páginas recientes</h2><label><input id="show-recent" type="checkbox"> Mostrar</label></div><div id="recent-pages" class="recent-pages"></div><p id="recent-status" class="help"></p>'
document.querySelector('.hero').after(section)
const toggle=section.querySelector('input'),list=section.querySelector('#recent-pages'),status=section.querySelector('#recent-status')
async function refresh(){
  if(document.hidden)return
  toggle.checked=preferences().showRecent
  list.hidden=status.hidden=!toggle.checked
  if(!toggle.checked){list.replaceChildren();return}
  if(globalThis.chrome?.extension?.inIncognitoContext){list.replaceChildren();status.textContent='El historial personal no se muestra en ventanas privadas.';return}
  if(!globalThis.chrome?.history){status.textContent='Tus páginas recientes aparecerán aquí al navegar con Veyrion.';return}
  try{
    const entries=await new Promise((resolve,reject)=>chrome.history.search({text:'',startTime:Date.now()-30*86400000,maxResults:100},items=>chrome.runtime.lastError?reject(Error(chrome.runtime.lastError.message)):resolve(items)))
    entries.sort((a,b)=>(b.lastVisitTime||0)-(a.lastVisitTime||0))
    const seen=new Set();list.replaceChildren()
    for(const item of entries){
      const url=safeUrl(item.url);if(!url)continue
      const parsed=new URL(url),key=parsed.origin+parsed.pathname
      if(seen.has(key))continue;seen.add(key)
      const anchor=document.createElement('a');anchor.href=url;anchor.title=item.title||parsed.hostname
      const glyph=document.createElement('span');glyph.className='recent-glyph';const image=document.createElement('img');image.alt='';image.width=32;image.height=32
      image.src=globalThis.chrome?.history?'chrome://favicon/size/64@1x/'+url:'site-icon.svg'
      image.addEventListener('error',()=>{image.src='site-icon.svg'},{once:true});glyph.append(image)
      const label=document.createElement('span');label.textContent=item.title||parsed.hostname
      anchor.append(glyph,label);list.append(anchor);if(list.children.length===8)break
    }
    status.textContent=list.children.length?'':'Todavía no hay páginas recientes. Se mostrarán cuando navegues.'
  }catch{status.textContent='No se pudo leer el historial local.'}
}
toggle.addEventListener('change',()=>updatePreferences({showRecent:toggle.checked}))
document.addEventListener('veyrion-appearance',refresh)
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()})
globalThis.chrome?.history?.onVisited?.addListener(refresh)
globalThis.chrome?.history?.onVisitRemoved?.addListener(refresh)
await refresh()

const names={mountains:'Cumbres al amanecer',coast:'Costa tranquila',planet:'Horizonte orbital',nebula:'Nebulosa violeta'}
const gallery=document.createElement('div');gallery.className='wallpaper-gallery built-in-gallery'
for(const [key,name]of Object.entries(names)){
  const button=document.createElement('button');button.type='button';button.dataset.wallpaperPreset=key
  const image=document.createElement('img');image.src='wallpapers/'+key+'.svg';image.alt='';image.loading='lazy'
  const label=document.createElement('span');label.textContent=name;button.append(image,label)
  button.addEventListener('click',()=>updatePreferences({wallpaperPreset:key,wallpaper:'',wallpaperEnabled:true,motion:false}))
  gallery.append(button)
}
document.querySelector('.wallpaper-gallery').after(gallery)
document.body.dataset.homeExtrasReady='true'
