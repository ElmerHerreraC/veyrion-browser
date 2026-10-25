import {preferences,updatePreferences} from './app.js'

const input=document.querySelector('#live-wallpaper-input')
const status=document.querySelector('#wallpaper-media-status')
const button=document.querySelector('#pause-wallpaper')
const reduced=matchMedia('(prefers-reduced-motion: reduce)')
let asset,container,media,url,paused=false,allowMotion=false
function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open('veyrion-wallpapers',1);request.onupgradeneeded=()=>request.result.createObjectStore('assets');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function storage(action,value){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('assets',action==='get'?'readonly':'readwrite');const store=tx.objectStore('assets');const request=action==='get'?store.get('background'):action==='put'?store.put(value,'background'):store.delete('background');tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}}
function release(){if(media?.tagName==='VIDEO'){media.pause();media.removeAttribute('src');media.load()}else if(media)media.removeAttribute('src');container?.remove();container=media=undefined;if(url)URL.revokeObjectURL(url);url=undefined;document.body.classList.remove('media-wallpaper-active')}
function sync(){
  const state=preferences()
  const enabled=asset&&state.wallpaperEnabled&&!state.wallpaper&&state.wallpaperPreset==='none'
  if(!enabled){release();button.disabled=true;return}
  button.disabled=false
  if(!container){container=document.createElement('div');container.id='media-wallpaper';container.setAttribute('aria-hidden','true');media=document.createElement(asset.kind==='video'?'video':'img');if(asset.kind==='video'){media.muted=true;media.loop=true;media.playsInline=true;media.preload='metadata';media.poster=asset.poster}else media.alt='';container.append(media);document.body.prepend(container);document.body.classList.add('media-wallpaper-active')}
  const running=!document.hidden&&!paused&&(!reduced.matches||allowMotion)
  button.textContent=paused||(reduced.matches&&!allowMotion)?'Reproducir fondo':'Pausar fondo'
  if(asset.kind==='video'){
    if(!url){url=URL.createObjectURL(asset.blob);media.src=url}
    if(running)media.play().catch(()=>{status.textContent='Pulsa Reproducir fondo para iniciar la animación.'})
    else media.pause()
  }else if(running){if(!url){url=URL.createObjectURL(asset.blob);media.src=url}}
  else{media.src=asset.poster;if(url)URL.revokeObjectURL(url);url=undefined}
}
async function inspect(file){
  const kind=file.type.startsWith('video/')?'video':'image'
  if(!['video/webm','video/mp4','image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw Error('Usa una imagen PNG, JPG, WebP o GIF, o un vídeo WebM/MP4.')
  if(file.size===0||file.size>(kind==='video'?25:12)*1024*1024)throw Error(kind==='video'?'El vídeo debe ocupar como máximo 25 MB.':'La imagen debe ocupar como máximo 12 MB.')
  const source=URL.createObjectURL(file),node=document.createElement(kind==='video'?'video':'img')
  try{
    if(kind==='video'){node.muted=true;node.preload='auto'}
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('No se pudo leer el fondo. Prueba otro archivo.')),15000);const finish=error=>{clearTimeout(timer);error?reject(Error('El archivo no se puede reproducir en este navegador.')):resolve()};node.addEventListener(kind==='video'?'loadeddata':'load',()=>finish(),{once:true});node.addEventListener('error',()=>finish(true),{once:true});node.src=source})
    const width=kind==='video'?node.videoWidth:node.naturalWidth,height=kind==='video'?node.videoHeight:node.naturalHeight
    if(!width||!height||width*height>(kind==='video'?1920*1080:3840*2160))throw Error(kind==='video'?'Reduce la resolución del vídeo a 1080p o menos.':'Reduce la imagen a 4K o menos.')
    const scale=Math.min(1,1280/width,720/height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));canvas.getContext('2d').drawImage(node,0,0,canvas.width,canvas.height)
    return {blob:file,kind,poster:canvas.toDataURL('image/jpeg',.8),name:file.name}
  }finally{if(kind==='video'){node.pause();node.removeAttribute('src');node.load()}else node.removeAttribute('src');URL.revokeObjectURL(source)}
}
input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;input.disabled=true;status.textContent='Preparando el fondo local…';try{const next=await inspect(file);await storage('put',next);release();asset=next;paused=false;allowMotion=false;await updatePreferences({wallpaper:'',wallpaperPreset:'none',wallpaperEnabled:true,motion:false});sync();status.textContent=reduced.matches?'Fondo guardado. Movimiento reducido: se muestra una vista estática.':'Fondo guardado en este equipo. La reproducción se pausa al cambiar de pestaña.'}catch(error){status.textContent=error.message}finally{input.disabled=false;input.value=''}})
button.addEventListener('click',()=>{if(reduced.matches&&!allowMotion){allowMotion=true;paused=false}else paused=!paused;sync()})
document.querySelector('#clear-wallpaper').addEventListener('click',async()=>{release();asset=undefined;try{await storage('delete');status.textContent='Fondo eliminado.'}catch{status.textContent='No se pudo borrar el archivo local.'}})
document.querySelector('#start-customize').addEventListener('click',()=>document.querySelector('#settings-dialog').showModal())
document.addEventListener('veyrion-appearance',sync)
document.addEventListener('visibilitychange',sync)
reduced.addEventListener('change',sync)
window.addEventListener('pagehide',release)
window.addEventListener('pageshow',sync)
try{asset=await storage('get');sync()}catch{status.textContent='No se pudo acceder al almacenamiento local del fondo.'}
document.body.dataset.wallpaperReady='true'
