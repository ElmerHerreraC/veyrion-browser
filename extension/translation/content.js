// Runs in the built-in component's isolated world, never in a page's JS world.
(()=>{
  let active=null,serial=0
  const excluded='script,style,noscript,textarea,input,select,option,code,pre,svg,math,[contenteditable], [translate="no"]'
  const send=message=>new Promise((resolve,reject)=>chrome.runtime.sendMessage(message,response=>{
    if(chrome.runtime.lastError||response?.error)reject(Error('No se pudo completar la traducción local'))
    else resolve(response)
  }))
  function restore(){
    serial++;const state=active;active=null
    if(!state)return
    state.observer?.disconnect()
    for(const [node,record] of state.records)if(node.isConnected&&node.data===record.translated)node.data=record.original
    if(document.documentElement.lang===state.to){if(state.lang===null)document.documentElement.removeAttribute('lang');else document.documentElement.lang=state.lang}
  }
  function collect(root=document.body){
    const nodes=[],walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node,total=0
    while((node=walker.nextNode())){
      const parent=node.parentElement
      if(!parent||!node.data.trim()||parent.closest(excluded))continue
      const style=getComputedStyle(parent)
      if(style.display==='none'||style.visibility==='hidden')continue
      if(node.data.length>12000)throw Error('Bloque de texto demasiado grande')
      total+=node.data.length
      if(nodes.length>=10000||total>500000)throw Error('Página demasiado grande')
      nodes.push({node,text:node.data})
    }
    return nodes
  }
  async function translate(request){
    restore()
    const generation=serial,state={...request,lang:document.documentElement.getAttribute('lang'),records:new Map()};active=state
    try{
      const nodes=collect()
      for(let offset=0;offset<nodes.length;offset+=8){
        if(active!==state||generation!==serial)return
        const batch=nodes.slice(offset,offset+8)
        const response=await send({type:'veyrion-translate-batch',requestId:state.requestId,texts:batch.map(n=>n.text)})
        if(active!==state||generation!==serial)return
        if(!Array.isArray(response.texts)||response.texts.length!==batch.length||response.texts.some(t=>typeof t!=='string'||t.length>60000))throw Error('Respuesta incompleta')
        batch.forEach(({node,text},i)=>{if(node.isConnected&&node.data===text){const translated=text.match(/^\s*/)[0]+response.texts[i].trim()+text.match(/\s*$/)[0];node.data=translated;state.records.set(node,{original:text,translated})}})
      }
      if(active===state){document.documentElement.lang=state.to;await send({type:'veyrion-translate-finish',requestId:state.requestId,success:true})}
    }catch{
      if(active===state){restore();await send({type:'veyrion-translate-finish',requestId:state.requestId,success:false}).catch(()=>{})}
    }
  }
  chrome.runtime.onMessage.addListener((message,sender,respond)=>{
    if(sender.id!==chrome.runtime.id||message?.type!=='veyrion-native-translate')return
    if(message.action==='revert'){if(active?.requestId===message.requestId)restore();respond({ok:true});return}
    if(message.action==='translate'&&['en','es'].includes(message.from)&&['en','es'].includes(message.to)){
      respond({ok:true});translate(message)
    }
  })
})()
