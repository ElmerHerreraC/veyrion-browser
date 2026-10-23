import fs from 'node:fs'
import path from 'node:path'
import { generateKeyPairSync, createPublicKey } from 'node:crypto'
import { root } from './paths.mjs'
const privatePath = path.join(root, 'artifacts/update-signing/private.pem')
fs.mkdirSync(path.dirname(privatePath), { recursive: true })
if (!fs.existsSync(privatePath)) {
  const pair = generateKeyPairSync('rsa', { modulusLength: 3072, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  fs.writeFileSync(privatePath, pair.privateKey, { mode: 0o600, flag: 'wx' })
}
const publicKey = createPublicKey(fs.readFileSync(privatePath)).export({ type: 'spki', format: 'der' }).toString('base64')
const config = { version: '0.2.0', repository: 'ElmerHerreraC/veyrion-browser', publicKey, manifestUrl: 'https://github.com/ElmerHerreraC/veyrion-browser/releases/latest/download/veyrion-update.json' }
const target = path.join(root, 'extension/update-config.json')
if (fs.existsSync(target) && JSON.parse(fs.readFileSync(target, 'utf8')).publicKey !== publicKey) throw new Error('La clave pública existente es distinta. No se rotará automáticamente.')
fs.writeFileSync(target, JSON.stringify(config, null, 2) + '\n')
console.log('Clave de publicación preparada en artifacts/update-signing. Solo la clave pública se incorpora al navegador.')
