import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {root} from './paths.mjs'

// Refresh deliberately, never execute a changing remote script in the browser.
const revision = '6da9b247c3368baa8b4f24cd02046e18702a6527'
const directory = path.join(root, 'native-ui/open-components')
await fs.mkdir(directory, {recursive:true})
const hashes = {}
const ublockRevision = '4dfbb048607ec4fd19c1c252fd255df6cc653720'
const ublock = path.resolve(process.argv[2] || path.join(root,'artifacts/open-component-sources/uBlock-'+ublockRevision))
const {builtinScriptlets} = await import(pathToFileURL(path.join(ublock,'src/js/resources/scriptlets.js')))
const {default:redirects} = await import(pathToFileURL(path.join(ublock,'src/js/redirect-resources.js')))
const extras = builtinScriptlets.map(s=>({name:s.name,aliases:s.aliases||[],kind:{mime:'application/javascript'},content:Buffer.from(s.fn.toString()).toString('base64'),dependencies:s.dependencies||[],permission:(s.requiresTrust||s.name.startsWith('trusted-'))?1:0}))
const mime={js:'application/javascript',gif:'image/gif',html:'text/html',xml:'text/xml',mp3:'audio/mp3',mp4:'video/mp4',png:'image/png',txt:'text/plain',css:'text/css',json:'application/json'}
for(const [name,properties] of redirects){
  if(name==='google-ima-dai.js')continue // Not supplied by the matching Brave pipeline.
  assert.equal(path.basename(name),name)
  const type=name==='empty'?'application/octet-stream':mime[name.split('.').at(-1)]
  assert.ok(type,`Unsupported MIME type: ${name}`)
  const bytes=await fs.readFile(path.join(ublock,'src/web_accessible_resources',name))
  extras.push({name,aliases:typeof properties.alias==='string'?[properties.alias]:properties.alias||[],kind:{mime:type},content:bytes.toString('base64')})
}
for (const [remote,local] of [['dist/resources.json','resources.json'],['LICENSE','LICENSE-MPL-2.0.txt']]) {
  const response = await fetch(`https://raw.githubusercontent.com/brave/adblock-resources/${revision}/${remote}`, {signal:AbortSignal.timeout(30000)})
  assert.ok(response.ok, `Download failed: ${remote}`)
  let bytes = Buffer.from(await response.arrayBuffer())
  assert.ok(bytes.length < 2_000_000)
  if (local === 'resources.json') {
    const resources = [...JSON.parse(bytes).map(r=>({...r,permission:r.permission??2})),...extras]
    bytes = Buffer.from(JSON.stringify(resources))
    assert.ok(Array.isArray(resources) && resources.length > 150)
    const names = new Set()
    for (const resource of resources) {
      assert.equal(typeof resource.name, 'string')
      assert.ok(!names.has(resource.name)); names.add(resource.name)
      assert.equal(typeof resource.content, 'string')
      assert.ok(resource.kind && Array.isArray(resource.aliases))
    }
    console.log(`Validated ${resources.length} native resources`)
  }
  hashes[local] = createHash('sha256').update(bytes).digest('hex')
  await fs.writeFile(path.join(directory,local),bytes)
}
await fs.copyFile(path.join(ublock,'LICENSE.txt'),path.join(directory,'LICENSE-GPL-3.0.txt'))
await fs.writeFile(path.join(directory,'provenance.json'), JSON.stringify({version:1,repository:'brave/adblock-resources',revision,license:'MPL-2.0',ublock:{repository:'brave/uBlock',revision:ublockRevision,license:'GPL-3.0-or-later'},hashes},null,2)+'\n')

