import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {root} from './paths.mjs'

const config=JSON.parse(await fs.readFile(path.join(root,'config/local-translation.json'),'utf8'))
const directory=path.join(root,'extension/translation')
const archive=path.join(root,'artifacts/bergamot-049/package.tgz')
const hashes={}
async function download(url,size,hash,algorithm='sha256'){
  assert.equal(new URL(url).protocol,'https:')
  const r=await fetch(url,{signal:AbortSignal.timeout(120000)})
  assert.ok(r.ok,`Download failed: ${url}`)
  const bytes=Buffer.from(await r.arrayBuffer())
  assert.ok(bytes.length<=30_000_000)
  if(size)assert.equal(bytes.length,size)
  const actual=createHash(algorithm).update(bytes).digest(algorithm==='sha512'?'base64':'hex')
  assert.equal(actual,hash,`Hash mismatch: ${url}`)
  return bytes
}
await fs.mkdir(path.dirname(archive),{recursive:true})
const archiveBytes=await download(config.library.url,0,config.library.integrity.slice(7),'sha512')
await fs.writeFile(archive,archiveBytes)
const extracted=path.join(root,'artifacts/bergamot-049')
execFileSync('tar',['-xf',archive,'-C',extracted],{windowsHide:true})
for(const name of ['translator.js','worker/translator-worker.js','worker/bergamot-translator-worker.js','worker/bergamot-translator-worker.wasm']){
  const target=path.join(directory,'vendor',name)
  await fs.mkdir(path.dirname(target),{recursive:true})
  const bytes=await fs.readFile(path.join(extracted,'package',name))
  hashes['vendor/'+name]=createHash('sha256').update(bytes).digest('hex')
  await fs.writeFile(target,bytes)
}
const registry=[]
for(const [pair,files] of Object.entries(config.models)){
  const local={}
  await Promise.all(Object.entries(files).map(async([part,file])=>{
    const relative=`models/${pair}/${path.basename(new URL(file.name).pathname)}`
    const target=path.join(directory,relative)
    await fs.mkdir(path.dirname(target),{recursive:true})
    let bytes
    try{bytes=await fs.readFile(target);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.expectedSha256Hash)}catch{bytes=await download(file.name,file.size,file.expectedSha256Hash);await fs.writeFile(target,bytes)}
    hashes[relative]=file.expectedSha256Hash
    local[part]={...file,name:relative}
  }))
  registry.push({from:pair.slice(0,2),to:pair.slice(2),files:local})
  console.log('Verified local model '+pair)
}
await fs.writeFile(path.join(directory,'registry.json'),JSON.stringify(registry,null,2)+'\n')
await fs.writeFile(path.join(directory,'provenance.json'),JSON.stringify({library:config.library,hashes},null,2)+'\n')
await fs.copyFile(path.join(root,'native-ui/open-components/LICENSE-MPL-2.0.txt'),path.join(directory,'LICENSE-MPL-2.0.txt'))
