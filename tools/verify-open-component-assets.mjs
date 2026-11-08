import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {root} from './paths.mjs'
const directory=path.join(root,'native-ui/open-components')
const provenance=JSON.parse(fs.readFileSync(path.join(directory,'provenance.json'),'utf8'))
for(const [file,hash] of Object.entries(provenance.hashes))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex'),hash)
const resources=JSON.parse(fs.readFileSync(path.join(directory,'resources.json'),'utf8'))
const names=new Set(resources.map(r=>r.name))
assert.equal(names.size,resources.length)
assert.ok(resources.length>150)
for(const resource of resources)for(const dependency of resource.dependencies||[])assert.ok(names.has(dependency),`Missing dependency ${dependency}`)
assert.ok(resources.some(r=>r.name==='set-constant.js'))
assert.ok(resources.some(r=>r.name==='noop.js'))
assert.ok(resources.filter(r=>r.name.startsWith('trusted-')).every(r=>r.permission===1))
assert.ok(fs.readFileSync(path.join(directory,'LICENSE-GPL-3.0.txt'),'utf8').includes('GNU GENERAL PUBLIC LICENSE'))
console.log(JSON.stringify({passed:true,resources:resources.length,hashesVerified:true,dependenciesVerified:true,trustedResourcesRestricted:true}))
const browserData=JSON.parse(fs.readFileSync(path.join(directory,'browser-data-provenance.json'),'utf8'))
for(const [file,hash] of Object.entries(browserData.hashes)){
  const bytes=fs.readFileSync(path.join(directory,file))
  assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,file)
  if(file.endsWith('.json'))JSON.parse(bytes.toString('utf8'))
}
assert.equal(Object.keys(browserData.hashes).length,9)
console.log(JSON.stringify({browserDataHashesVerified:true,files:9,revision:browserData.revision}))
