import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {root} from './paths.mjs'
const revision='2d6e0c1501b9a5bb4879217d8cf27facb58aedb9'
const directory=path.join(root,'native-ui/open-components')
const files=['webcompat-exceptions.json','debounce.json','request-otr.json','clean-urls.json','clean-urls-permissions.json','https-upgrade-exceptions-list.txt','query-filter.json','brave-checks.txt']
const hashes={}
for(const file of [...files,'LICENSE']){
  const source=file==='LICENSE'?'LICENSE':'brave-lists/'+file
  const relative=file==='LICENSE'?'LICENSE-ADBLOCK-LISTS.txt':file==='query-filter.json'||file==='brave-checks.txt'?file:'local-data/1/'+file
  const response=await fetch(`https://raw.githubusercontent.com/brave/adblock-lists/${revision}/${source}`,{signal:AbortSignal.timeout(30000)})
  assert.ok(response.ok,source)
  const bytes=Buffer.from(await response.arrayBuffer())
  assert.ok(bytes.length>2&&bytes.length<5_000_000)
  if(file.endsWith('.json'))JSON.parse(bytes)
  const target=path.join(directory,relative)
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes)
  hashes[relative]=createHash('sha256').update(bytes).digest('hex')
}
await fs.writeFile(path.join(directory,'browser-data-provenance.json'),JSON.stringify({repository:'brave/adblock-lists',revision,hashes},null,2)+'\n')
console.log(JSON.stringify({prepared:true,files:files.length,revision}))
