import {sendWithPromise as veyrionSend} from 'chrome://resources/js/cr.js'

interface VeyrionAppearance {
  mode: string; color: number; size: number; spacing: number; colored: boolean;
  items: Array<{index: number; title: string; visible: boolean; icon: string}>;
}

class VeyrionNativeAppearance extends HTMLElement {
  private state_: VeyrionAppearance|null = null
  private timer_: number|undefined
  private root_ = this.attachShadow({mode:'open'})
  connectedCallback() {
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
      @media(max-width:640px){.themes{gap:12px;grid-template-columns:repeat(2,1fr)}.icons .row{flex-wrap:wrap}}
    </style><div class="heading">ASPECTO VISUAL</div><p>Personaliza las pestañas, la barra de direcciones, los menús y la barra lateral.</p>
    <h2>TEMAS</h2><div class="card"><div class="themes">
      <button class="theme" data-color="4319155" style="--accent:#41e7b3"><span class="preview"></span><span>After Eight <b>○</b></span></button>
      <button class="theme" data-color="16240227" style="--accent:#f7ce63"><span class="preview"></span><span>Dorado <b>○</b></span></button>
      <button class="theme" data-color="13816530" style="--accent:#d2d2d2"><span class="preview"></span><span>White Wolf <b>○</b></span></button>
      <button class="theme" data-color="55741" style="--accent:#00d9bd"><span class="preview"></span><span>Personalizado <b>○</b></span></button>
    </div><div class="modes"><button data-mode="light">Claro</button><button data-mode="system">Auto</button><button data-mode="dark">Oscuro</button></div>
    <label class="row">Color de acento de la ventana<input type="color" id="accent" aria-label="Color de acento de la ventana"></label></div>
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
    this.request_({})
  }
  private save_(){window.clearTimeout(this.timer_);this.timer_=window.setTimeout(()=>{if(this.state_)this.request_({mode:this.state_.mode,color:this.state_.color,size:this.state_.size,spacing:this.state_.spacing,colored:this.state_.colored})},150)}
  private async request_(request: object){
    try{this.state_=await veyrionSend<VeyrionAppearance>('veyrionAppearance',request);this.render_();this.root_.getElementById('status')!.textContent='Guardado en el perfil. Aplicado a toda la ventana del navegador.'}
    catch{this.root_.getElementById('status')!.textContent='No se pudieron aplicar los cambios. Inténtalo de nuevo.'}
  }
  private render_(){
    const state=this.state_!
    this.root_.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset['mode']===state.mode)))
    this.root_.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(button=>{const selected=Number(button.dataset['color'])===state.color;button.setAttribute('aria-pressed',String(selected));button.querySelector('b')!.textContent=selected?'◉':'○'})
    ;(this.root_.getElementById('accent') as HTMLInputElement).value='#'+state.color.toString(16).padStart(6,'0')
    for(const id of ['size','spacing'] as const)(this.root_.getElementById(id) as HTMLInputElement).value=String(state[id])
    ;(this.root_.getElementById('colored') as HTMLInputElement).checked=state.colored
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
  @media(max-width:980px){#main{margin:0 12px!important}}
</style>`)
RegisterStyleOverride('settings-menu',html`<style>
  :host{background:var(--vey-card,#191919);border:1px solid var(--vey-border,#333);border-radius:7px;padding:16px!important;margin-top:12px!important}
  a[href]{font-size:11px!important;text-transform:uppercase;letter-spacing:.2px;min-height:32px!important;margin:0!important;padding:5px 12px!important;border-radius:4px!important}
  .cr-nav-menu-item[selected]{background:#ffffff0c!important;color:var(--cr-primary-text-color)!important}.cr-nav-menu-item:hover{background:#ffffff08!important}
</style>`)
