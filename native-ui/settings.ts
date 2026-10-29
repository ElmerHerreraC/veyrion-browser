import {sendWithPromise as veyrionSend} from 'chrome://resources/js/cr.js'

interface VeyrionAppearance {
  cursorMode:string; cursorPng:string; cursorX:number; cursorY:number; aggressiveAds:boolean;
  mode: string; color: number; size: number; spacing: number; colored: boolean; forceDark: boolean; autoPip: boolean;
  items: Array<{index: number; title: string; visible: boolean; icon: string}>;
  workspaces: Array<{id:number; name:string; tabs:number; current:boolean}>;
}

class VeyrionNativeAppearance extends HTMLElement {
  private state_: VeyrionAppearance|null = null
  private timer_: number|undefined
  private root_ = this.attachShadow({mode:'open'})
  connectedCallback() {
    const sidebarOnly = new URLSearchParams(location.search).has('veyrionSidebar')
    if(sidebarOnly)document.documentElement.setAttribute('data-veyrion-sidebar','')
    this.root_.appendChild(braveHtml`<style>
      :host{display:block;color:var(--cr-primary-text-color);font:13px 'Segoe UI',sans-serif;margin:12px 0 32px}
      *{box-sizing:border-box}h2{font-size:11px;color:var(--cr-secondary-text-color);letter-spacing:.6px;margin:28px 0 12px}
      .card{background:var(--vey-card,#191919);border:1px solid var(--vey-border,#333);border-radius:7px;padding:16px;margin-bottom:20px}
      .themes{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}.theme{border:0;background:none;color:inherit;cursor:pointer;padding:0;text-align:left}
      .preview{height:82px;background:#101010;border-top:1px solid var(--accent);border-left:1px solid var(--accent);position:relative;clip-path:polygon(0 0,100% 0,100% 100%,4px 100%,4px 20px,0 16px);display:block;margin-bottom:12px}
      .preview:before{content:'';position:absolute;left:7px;top:12px;width:6px;height:6px;background:var(--accent);color:var(--accent);box-shadow:0 14px,0 28px}
      .theme[aria-pressed=true] .preview{box-shadow:inset 0 0 0 1px var(--accent)}.theme span:last-child{display:flex;justify-content:space-between;gap:6px}
      .modes{display:flex;margin-top:28px;border:1px solid var(--vey-border,#333);border-radius:4px;overflow:hidden}
      button,input,select{font:inherit}button{cursor:pointer}.modes button{flex:1;border:0;padding:12px;background:transparent;color:inherit}.modes button[aria-pressed=true]{background:#ccc;color:#101010}
      .row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 0;border-bottom:1px solid var(--vey-border,#333)}.row:last-child{border:0}
      input[type=range]{width:180px;accent-color:var(--cr-link-color)}input[type=checkbox]{accent-color:var(--cr-link-color)}
      input[type=color]{width:58px;height:30px;background:transparent;border:1px solid #555}select{max-width:130px;background:var(--vey-card,#191919);color:inherit;border:1px solid #555;border-radius:3px;padding:5px}
      .icons .row{justify-content:flex-start}.name{flex:1;overflow:hidden;text-overflow:ellipsis}.arrow{background:transparent;border:1px solid #555;color:inherit;border-radius:3px;padding:4px 9px}
      p{font-size:12px;color:var(--cr-secondary-text-color);line-height:1.6}#status{min-height:20px}.label{font-size:12px}.heading{font-size:22px;font-weight:700;letter-spacing:.5px;margin-bottom:8px}
      :host{min-width:0;max-width:100%;overflow-wrap:anywhere}.themes{grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:16px}.row{flex-wrap:wrap;gap:10px}.card{min-width:0}input,select{max-width:100%}.name{min-width:60px}:host(.sidebar-only) .general{display:none}:host(.sidebar-only) .heading{font-size:17px}#workspace-name{width:100%;padding:8px;background:transparent;color:inherit;border:1px solid #666}#workspaces button{background:transparent;color:inherit;border:1px solid #666;padding:7px;border-radius:4px}
      @media(max-width:380px){.themes{gap:10px}.card{padding:12px}.row{gap:8px}input[type=range]{width:140px}}
    </style><div class="heading">ASPECTO VISUAL</div><p>Personaliza las pestañas, la barra de direcciones, los menús y la barra lateral.</p>
    <h2 class="general">TEMAS</h2><div class="card general"><div class="themes">
      <button class="theme" data-color="4319155" style="--accent:#41e7b3"><span class="preview"></span><span>After Eight <b>○</b></span></button>
      <button class="theme" data-color="16240227" style="--accent:#f7ce63"><span class="preview"></span><span>Dorado <b>○</b></span></button>
      <button class="theme" data-color="13816530" style="--accent:#d2d2d2"><span class="preview"></span><span>White Wolf <b>○</b></span></button>
      <button class="theme" data-color="55741" style="--accent:#00d9bd"><span class="preview"></span><span>Personalizado <b>○</b></span></button>
    </div><div class="modes"><button data-mode="light">Claro</button><button data-mode="system">Auto</button><button data-mode="dark">Oscuro</button></div>
    <label class="row">Color de acento de la ventana<input type="color" id="accent" aria-label="Color de acento de la ventana"></label></div>
    <h2 class="general">PÁGINAS WEB</h2><div class="card general">
    <label class="row">Forzar modo oscuro en páginas web<input id="force-dark" type="checkbox"></label>
    <p>Oscurece las páginas que no ofrecen un tema oscuro mediante el motor del navegador. Es independiente del tema de la ventana. Si una página se ve mal, desactiva esta opción. Recarga las páginas abiertas si es necesario.</p></div>
    <h2>TABLEROS · ESPACIOS DE PESTAÑAS</h2><div class="card"><p>Cada tablero mantiene su propia ventana y sus pestañas abiertas. Cambiar de tablero no cierra los demás.</p><div id="workspaces"></div><input id="workspace-name" maxlength="60" placeholder="Nombre del tablero" aria-label="Nombre del tablero"><div class="row"><button class="arrow" id="workspace-create">Añadir tablero</button><button class="arrow" id="workspace-rename">Nombrar este tablero</button></div></div>
    <h2 id="veyrion-icons">BARRA LATERAL · ICONOS</h2><div class="card">
    <label class="row">Tamaño de los iconos<input id="size" type="range" min="14" max="26" aria-label="Tamaño de los iconos"></label>
    <label class="row">Separación<input id="spacing" type="range" min="0" max="10" aria-label="Separación de los iconos"></label>
    <label class="row">Iconos de aplicaciones a color<input id="colored" type="checkbox"></label>
    <div class="icons" id="icons"></div><p>Usa + en la barra izquierda para agregar una página. El borde del panel permite ajustar su ancho y su menú permite alternar la vista móvil.</p></div>
    <p id="status" role="status">Cargando preferencias del navegador…</p>`)
    this.root_.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button=>button.addEventListener('click',()=>{if(this.state_){this.state_.mode=button.dataset['mode']!;this.save_()}}))
    this.root_.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(button=>button.addEventListener('click',()=>{if(this.state_){this.state_.color=Number(button.dataset['color']);this.save_()}}))
    for(const id of ['accent','size','spacing','colored'])this.root_.getElementById(id)!.addEventListener('change',()=>{
      if(!this.state_)return
      const input=this.root_.getElementById(id) as HTMLInputElement
      if(id==='accent')this.state_.color=parseInt(input.value.slice(1),16)
      else if(id==='colored')this.state_.colored=input.checked
      else if(id==='size')this.state_.size=Number(input.value)
      else this.state_.spacing=Number(input.value)
      this.save_()
    })
    this.root_.getElementById('force-dark')!.addEventListener('change',()=>this.request_({forceDark:(this.root_.getElementById('force-dark') as HTMLInputElement).checked}))
    const pointers=document.createElement('div');pointers.className='card general';pointers.appendChild(braveHtml`<h2>PUNTERO DEL NAVEGADOR</h2><p>Se aplica a la flecha normal en la interfaz y las páginas. Conserva los indicadores de texto, enlaces y redimensionado.</p><label class="row">Estilo<select id="cursor-mode"><option value="default">Normal</option><option value="cross">Cruz</option><option value="up">Flecha vertical</option><option value="custom">Imagen propia</option></select></label><label class="row">PNG transparente, hasta 128 × 128 y 100 KB<input type="file" id="cursor-file" accept="image/png"></label><label class="row">Punto de clic X<input id="cursor-x" type="number" min="0" max="127" value="0"></label><label class="row">Punto de clic Y<input id="cursor-y" type="number" min="0" max="127" value="0"></label><button class="arrow" id="cursor-save">Aplicar puntero</button><p id="cursor-status" role="status"></p>`);this.root_.getElementById('status')!.before(pointers)
    this.root_.getElementById('cursor-save')!.addEventListener('click',async()=>{
      const message=this.root_.getElementById('cursor-status')!
      try{
        const mode=(this.root_.getElementById('cursor-mode') as HTMLSelectElement).value
        let png=this.state_?.cursorPng||''
        const file=(this.root_.getElementById('cursor-file') as HTMLInputElement).files?.[0]
        if(mode==='custom'&&file){if(file.type!=='image/png'||file.size>100000)throw Error('Elige un PNG de hasta 100 KB.');const bytes=new Uint8Array(await file.arrayBuffer());png=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''))}
        if(mode==='custom'&&!png)throw Error('Selecciona una imagen PNG.')
        await this.request_({cursorMode:mode,cursorPng:png,cursorX:Number((this.root_.getElementById('cursor-x') as HTMLInputElement).value),cursorY:Number((this.root_.getElementById('cursor-y') as HTMLInputElement).value)})
        message.textContent=this.state_?.cursorMode===mode?'Puntero guardado. Mueve el ratón para verlo.':'No se aplicó: comprueba tamaño y punto de clic.'
      }catch(error){message.textContent=String(error)}
    })
    const protection=document.createElement('label');protection.className='row';protection.textContent='Bloqueo agresivo de anuncios y rastreadores'
    const aggressive=document.createElement('input');aggressive.type='checkbox';aggressive.id='aggressive-ads';aggressive.addEventListener('change',()=>this.request_({aggressiveAds:aggressive.checked}));protection.append(aggressive);this.root_.getElementById('force-dark')!.closest('.card')!.append(protection)
    const video=document.createElement('label');video.className='row general';video.textContent='Minirreproductor automático al cambiar de pestaña'
    const autoPip=document.createElement('input');autoPip.type='checkbox';autoPip.id='auto-pip';autoPip.addEventListener('change',()=>this.request_({autoPip:autoPip.checked}));video.append(autoPip)
    this.root_.getElementById('force-dark')!.closest('.card')!.append(video)
    const updates=document.createElement('div');updates.className='card general';updates.id='updates';updates.appendChild(braveHtml`<h2>ACTUALIZACIONES DE VEYRION</h2><p id="update-state" role="status">Consultando estado local…</p><p>Las comprobaciones se realizan sin ventanas de consola. Pulsa Actualizar para descargar la versión firmada e instalarla cuando cierres Veyrion.</p><div class="row"><button class="arrow" id="update-check">Buscar actualizaciones</button><button class="arrow" id="update-apply" hidden>Actualizar al cerrar</button><a href="https://github.com/ElmerHerreraC/veyrion-browser/releases" target="_blank" rel="noreferrer">Ver novedades</a></div>`)
    this.root_.append(updates)
    for(const action of ['check','apply'])this.root_.getElementById('update-'+action)!.addEventListener('click',()=>this.updateStatus_(action))
    this.updateStatus_('status')
    this.updateTimer_=window.setInterval(()=>this.updateStatus_('status'),1000)
    if(new URLSearchParams(location.search).has('veyrionUpdates'))setTimeout(()=>updates.scrollIntoView({block:'start'}),400)
    if(sidebarOnly){this.classList.add('sidebar-only');this.root_.querySelector('.heading')!.textContent='CONFIGURACIÓN DE LA BARRA LATERAL';this.root_.querySelector('p')!.textContent='Elige accesos, ajusta iconos y cambia de tablero.'}
    for(const action of ['create','rename'])this.root_.getElementById('workspace-'+action)!.addEventListener('click',()=>{
      const name=(this.root_.getElementById('workspace-name') as HTMLInputElement).value.trim()
      if(!name){this.root_.getElementById('status')!.textContent='Escribe un nombre para el tablero.';return}
      this.request_({workspaceAction:action,name})
    })
    this.request_({})
  }
  private save_(){window.clearTimeout(this.timer_);this.timer_=window.setTimeout(()=>{if(this.state_)this.request_({mode:this.state_.mode,color:this.state_.color,size:this.state_.size,spacing:this.state_.spacing,colored:this.state_.colored})},150)}
  private updateTimer_: number|undefined
  disconnectedCallback(){window.clearInterval(this.updateTimer_);window.clearTimeout(this.timer_)}
  private async updateStatus_(action:string){
    try{
      const status=this.root_.getElementById('update-state')!
      if(action!=='status')status.textContent=action==='apply'?'Iniciando descarga de la actualización…':'Buscando actualizaciones…'
      const value=await veyrionSend<{state:string;detail?:string;installed?:string;checkedAt?:string;downloaded?:number;total?:number}>('veyrionAppearance',{updateAction:action})
      const messages:Record<string,string>={current:'Estás al día.',available:'Nueva versión '+(value.detail||'')+' disponible.',downloading:'Descargando y verificando la actualización…','ready-on-close':'Actualización lista. Cierra Veyrion cuando quieras instalarla.',installed:'Actualización instalada.',checking:'Buscando actualizaciones…',starting:'Preparando actualización…',error:'No se pudo completar la actualización. Puedes volver a intentarlo.',unchecked:'Todavía no hay una comprobación registrada.'}
      messages['verifying']='Verificando integridad y firma del instalador…'
      messages['installing']='Instalando actualización…'
      if(value.state==='downloading'&&value.total)messages['downloading']='Descargando: '+Math.min(100,Math.floor((value.downloaded||0)*100/value.total))+'% ('+((value.downloaded||0)/1048576).toFixed(1)+' / '+(value.total/1048576).toFixed(1)+' MB).'
      if(value.state==='error'&&value.detail)messages['error']+=' '+value.detail
      status.textContent='Versión instalada: '+(value.installed||'—')+'. '+(messages[value.state]||value.state)+(value.checkedAt?' Última comprobación: '+new Date(value.checkedAt).toLocaleString()+'.':'')
      ;(this.root_.getElementById('update-apply') as HTMLButtonElement).hidden=value.state!=='available'
      ;(this.root_.getElementById('update-check') as HTMLButtonElement).disabled=['checking','starting','downloading','verifying','installing','ready-on-close'].includes(value.state)
    }catch{this.root_.getElementById('update-state')!.textContent='No se pudo consultar el estado local. Abre una ventana normal del navegador.'}
  }
  private async request_(request: object){
    try{this.state_=await veyrionSend<VeyrionAppearance>('veyrionAppearance',request);this.render_();this.root_.getElementById('status')!.textContent='Guardado en el perfil. Aplicado a toda la ventana del navegador.'}
    catch{this.root_.getElementById('status')!.textContent='No se pudieron aplicar los cambios. Inténtalo de nuevo.'}
  }
  private render_(){
    const state=this.state_!
    ;(this.root_.getElementById('cursor-mode') as HTMLSelectElement).value=state.cursorMode
    ;(this.root_.getElementById('cursor-x') as HTMLInputElement).value=String(state.cursorX)
    ;(this.root_.getElementById('cursor-y') as HTMLInputElement).value=String(state.cursorY)
    ;(this.root_.getElementById('aggressive-ads') as HTMLInputElement).checked=state.aggressiveAds
    const workspaces=this.root_.getElementById('workspaces')!;workspaces.replaceChildren()
    for(const [position,space] of state.workspaces.entries()){const name=space.name===`Tablero ${space.id}`?(space.current?'Personal':'Tablero '+(position+1)):space.name;const button=document.createElement('button');button.textContent=(space.current?'● ':'○ ')+name;button.setAttribute('aria-pressed',String(space.current));button.addEventListener('click',()=>this.request_({workspaceAction:'activate',id:space.id}));const row=document.createElement('div');row.className='row';row.append(button);workspaces.append(row)}
    this.root_.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset['mode']===state.mode)))
    this.root_.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(button=>{const selected=Number(button.dataset['color'])===state.color;button.setAttribute('aria-pressed',String(selected));button.querySelector('b')!.textContent=selected?'◉':'○'})
    ;(this.root_.getElementById('accent') as HTMLInputElement).value='#'+state.color.toString(16).padStart(6,'0')
    for(const id of ['size','spacing'] as const)(this.root_.getElementById(id) as HTMLInputElement).value=String(state[id])
    ;(this.root_.getElementById('colored') as HTMLInputElement).checked=state.colored
    ;(this.root_.getElementById('force-dark') as HTMLInputElement).checked=state.forceDark
    ;(this.root_.getElementById('auto-pip') as HTMLInputElement).checked=state.autoPip
    const list=this.root_.getElementById('icons')!;list.replaceChildren()
    for(const item of state.items){
      const row=document.createElement('div');row.className='row'
      const check=document.createElement('input');check.type='checkbox';check.checked=item.visible;check.setAttribute('aria-label','Mostrar '+item.title);check.addEventListener('change',()=>this.request_({action:check.checked?'show':'hide',index:item.index}))
      const name=document.createElement('span');name.className='name';name.textContent=item.title
      const select=document.createElement('select');select.setAttribute('aria-label','Símbolo de '+item.title)
      for(const [value,label]of Object.entries({default:'Original',star:'Estrella',grid:'Cuadrícula',chat:'Chat',code:'Código',play:'Reproducción',settings:'Ajustes'})){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option)}
      select.value=item.icon;select.addEventListener('change',()=>this.request_({action:'icon',index:item.index,value:select.value}))
      row.append(check,name,select)
      for(const action of ['up','down']){const button=document.createElement('button');button.className='arrow';button.textContent=action==='up'?'↑':'↓';button.setAttribute('aria-label',(action==='up'?'Subir ':'Bajar ')+item.title);button.addEventListener('click',()=>this.request_({action,index:item.index}));row.append(button)}
      list.append(row)
    }
  }
}
customElements.define('veyrion-native-appearance',VeyrionNativeAppearance)

RegisterStyleOverride('settings-ui',html`<style>
  :host{--vey-card:#191919;--vey-border:#333;--leo-color-container-background:#101010;--leo-color-page-background:#101010;--cr-card-background-color:#191919;--cr-centered-card-max-width:760px;--settings-menu-width:264px;background:#101010;background-image:linear-gradient(150deg,transparent 60%,#ffffff05 60.1%,transparent 60.2%),linear-gradient(30deg,transparent 60%,#ffffff05 60.1%,transparent 60.2%)}
  #main{background:transparent!important;border:0!important;box-shadow:none!important;margin:0 36px 0 28px!important}
  #container{max-width:1250px;width:100%;align-self:center}cr-toolbar{max-width:1160px;width:100%;align-self:center;--cr-toolbar-background-color:transparent}
  #veyrion-settings-nav{display:flex;align-items:center;justify-content:center;gap:28px;min-height:62px;font:10px 'Segoe UI',sans-serif}#veyrion-settings-nav a{color:var(--cr-secondary-text-color);text-decoration:none}#veyrion-settings-nav strong{font-size:22px;letter-spacing:.6px}#veyrion-settings-nav a:hover{color:var(--cr-link-color)}
  @media(prefers-color-scheme:light){:host{--vey-card:#fafafa;--vey-border:#ccc;--leo-color-container-background:#eee;--leo-color-page-background:#eee;--cr-card-background-color:#fafafa;background:#eee}}
  :host{display:flex!important;width:100%;max-width:100%;min-width:0;box-sizing:border-box}#container{min-width:0}#main{flex:1 1 0!important;min-width:0!important}#veyrion-settings-nav{flex-wrap:wrap}
  :host-context([data-veyrion-sidebar]) #veyrion-settings-nav,:host-context([data-veyrion-sidebar]) cr-toolbar,:host-context([data-veyrion-sidebar]) #left{display:none!important}
  :host-context([data-veyrion-sidebar]) #main{margin:0 10px!important}
  @media(max-width:980px){#main{margin:0 12px!important}}
  @media(max-width:600px){#veyrion-settings-nav{display:none}#main{margin:0 8px!important}.card{max-width:100%}cr-toolbar{--cr-toolbar-left-spacer-width:0}}
</style>`)
RegisterStyleOverride('settings-main',html`<style>:host{min-width:0!important;max-width:100%;box-sizing:border-box}#basicPage,#advancedPage{min-width:0!important}</style>`)
RegisterStyleOverride('settings-appearance-page',html`<style>:host{min-width:0!important;max-width:100%;--cr-section-padding:12px;--cr-centered-card-width-percentage:1} .cr-row{flex-wrap:wrap;min-width:0}veyrion-native-appearance{max-width:100%}:host-context([data-veyrion-sidebar]) > :not(veyrion-native-appearance):not(style){display:none!important}</style>`)
RegisterStyleOverride('settings-menu',html`<style>
  :host{background:var(--vey-card,#191919);border:1px solid var(--vey-border,#333);border-radius:7px;padding:16px!important;margin-top:12px!important}
  a[href]{font-size:11px!important;text-transform:uppercase;letter-spacing:.2px;min-height:32px!important;margin:0!important;padding:5px 12px!important;border-radius:4px!important}
  .cr-nav-menu-item[selected]{background:#ffffff0c!important;color:var(--cr-primary-text-color)!important}.cr-nav-menu-item:hover{background:#ffffff08!important}
</style>`)
