(()=>{
  const requests=new Map();let engine=null,idle=null,pending=0
  const confirm=(r,action)=>new Promise(resolve=>chrome.braveTheme.confirmVeyrionTranslation(r.tabId,r.requestId,r.documentId,action,valid=>{void chrome.runtime.lastError;resolve(Boolean(valid))}))
  const message=(r,action)=>new Promise((resolve,reject)=>chrome.tabs.sendMessage(r.tabId,{...r,type:'veyrion-native-translate',action},{documentId:r.documentId},response=>{if(chrome.runtime.lastError||!response?.ok)reject(Error('Documento no disponible'));else resolve()}))
  function release(){clearTimeout(idle);if(pending===0)idle=setTimeout(()=>{engine?.delete();engine=null},60000)}
  async function getEngine(){
    if(!engine){const module=await import(chrome.runtime.getURL('veyrion_start/translation/engine.js'));if(!engine)engine=module.createLocalTranslator()}
    return engine
  }
  chrome.braveTheme.onVeyrionTranslate.addListener(async request=>{
    if(request.action==='revert'){
      requests.delete(request.tabId);await message(request,'revert').catch(()=>{});release();return
    }
    if(request.action!=='translate'||!await confirm(request,'check'))return
    requests.set(request.tabId,request)
    try{await message(request,'translate')}catch{requests.delete(request.tabId);await confirm(request,'fail')}
  })
  chrome.runtime.onMessage.addListener((message,sender,respond)=>{
    if(sender.id!==chrome.runtime.id||!sender.tab||!['veyrion-translate-batch','veyrion-translate-finish'].includes(message?.type))return
    const request=requests.get(sender.tab.id)
    if(!request||request.requestId!==message.requestId||request.documentId!==sender.documentId){respond({error:true});return}
    ;(async()=>{
      if(!await confirm(request,'check'))throw Error('Documento cambiado')
      if(message.type==='veyrion-translate-finish'){
        await confirm(request,message.success===true?'finish':'fail');requests.delete(request.tabId);respond({ok:true});release();return
      }
      if(!Array.isArray(message.texts)||message.texts.length>8||message.texts.some(t=>typeof t!=='string'||t.length>12000))throw Error('Lote inválido')
      clearTimeout(idle);pending++
      try{
        const translator=await getEngine()
        const translated=await Promise.all(message.texts.map(text=>translator.translate({from:request.from,to:request.to,text,html:false})))
        if(requests.get(request.tabId)!==request||!await confirm(request,'check'))throw Error('Documento cambiado')
        respond({texts:translated.map(r=>r.target.text)})
      }finally{pending--;release()}
    })().catch(()=>respond({error:true}))
    return true
  })
  chrome.tabs.onRemoved.addListener(tabId=>requests.delete(tabId))
  chrome.webNavigation.onCommitted.addListener(details=>{if(details.frameId===0)requests.delete(details.tabId)})
})()
