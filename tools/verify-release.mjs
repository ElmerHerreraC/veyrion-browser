import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { root } from './paths.mjs'
import '../extension/update-core.js'

const config = JSON.parse(await fs.readFile(path.join(root,'extension/update-config.json'),'utf8'))
const result = await VeyrionUpdates.check(config)
assert.equal(result.manifest?.version,config.version,'La última Release debe ser la versión comprobada localmente')
const response = await fetch(`https://api.github.com/repos/${config.repository}/releases/tags/v${config.version}`,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/vnd.github+json'}})
assert.ok(response.ok,'La Release pública debe estar disponible')
const release = await response.json()
assert.equal(release.draft,false)
assert.equal(release.prerelease,false)
const installer = release.assets.find(asset=>asset.name==='Veyrion-Setup-x64.exe')
assert.ok(installer,'Debe existir el instalador publicado')
assert.equal(installer.size,result.manifest.size)
assert.equal(installer.digest,`sha256:${result.manifest.sha256}`,'El archivo servido por GitHub debe coincidir con el manifiesto firmado')
assert.ok(release.assets.some(asset=>asset.name==='veyrion-update.json'))
assert.ok(release.assets.some(asset=>asset.name==='Veyrion-Setup-x64.exe.sha256'))
await VeyrionUpdates.verifyInstaller(await fs.readFile(path.join(root,'dist/Veyrion-Setup-x64.exe')),result.manifest)
const download = await fetch(result.manifest.url,{method:'HEAD',signal:AbortSignal.timeout(20000)})
assert.ok(download.ok,'El instalador debe poder descargarse públicamente')
assert.equal(Number(download.headers.get('content-length')),installer.size)
const report={passed:true,version:config.version,signatureVerified:true,publicDigestVerified:true,installerAvailable:true,installerSize:installer.size,verifiedAt:new Date().toISOString()}
await fs.writeFile(path.join(root,'artifacts/github-release-verification.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report))

