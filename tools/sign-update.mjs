import fs from 'node:fs'
import path from 'node:path'
import { createHash, sign } from 'node:crypto'
import { root } from './paths.mjs'
const config = JSON.parse(fs.readFileSync(path.join(root, 'extension/update-config.json'), 'utf8'))
const installer = fs.readFileSync(path.join(root, 'dist/Veyrion-Setup-x64.exe'))
const receipt = JSON.parse(fs.readFileSync(path.join(root, 'dist/release-build.json'), 'utf8'))
if (receipt.version !== config.version || receipt.sha256 !== createHash('sha256').update(installer).digest('hex')) throw new Error('Compila el instalador de la versión actual antes de firmar la actualización.')
const manifest = { version: config.version, repository: config.repository, url: `https://github.com/${config.repository}/releases/download/v${config.version}/Veyrion-Setup-x64.exe`, size: installer.length, sha256: createHash('sha256').update(installer).digest('hex') }
const payload = Buffer.from(JSON.stringify(manifest))
const signature = sign('sha256', payload, fs.readFileSync(path.join(root, 'artifacts/update-signing/private.pem')))
fs.writeFileSync(path.join(root, 'dist/veyrion-update.json'), JSON.stringify({ payload: payload.toString('base64'), signature: signature.toString('base64') }, null, 2) + '\n')
console.log('Manifiesto firmado generado; publicar junto con el instalador de la misma versión.')
