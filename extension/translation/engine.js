import {BatchTranslator,TranslatorBacking} from './vendor/translator.js'

// Never use the library's remote registry or send page text to a service.
class LocalBacking extends TranslatorBacking {
  async loadModelRegistery(){
    const r=await fetch(new URL('registry.json',import.meta.url))
    if(!r.ok)throw Error('No se encontraron los modelos locales')
    return r.json()
  }
  async fetch(name,expectedHash){
    const url=new URL(name,import.meta.url)
    const base=new URL('./',import.meta.url)
    if(url.protocol!==base.protocol||url.host!==base.host||!url.pathname.startsWith(base.pathname))throw Error('Modelo fuera del paquete')
    const r=await fetch(url)
    if(!r.ok)throw Error('No se pudo cargar el modelo local')
    const bytes=await r.arrayBuffer()
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('')
    if(hash!==expectedHash)throw Error('El modelo local no supera la verificación de integridad')
    return bytes
  }
}
export function createLocalTranslator(){
  const options={workers:1,batchSize:8,cacheSize:512,pivotLanguage:null,useNativeIntGemm:false}
  return new BatchTranslator(options,new LocalBacking(options))
}
