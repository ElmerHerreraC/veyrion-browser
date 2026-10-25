import fs from 'node:fs'
import {createPublicKey} from 'node:crypto'
import {root} from './paths.mjs'
const config = JSON.parse(fs.readFileSync(root+'/extension/update-config.json'))
const key = createPublicKey({key:Buffer.from(config.publicKey,'base64'),format:'der',type:'spki'}).export({format:'jwk'})
const xml = `<RSAKeyValue><Modulus>${Buffer.from(key.n,'base64url').toString('base64')}</Modulus><Exponent>${Buffer.from(key.e,'base64url').toString('base64')}</Exponent></RSAKeyValue>`
fs.mkdirSync(root+'/updater',{recursive:true})
fs.writeFileSync(root+'/updater/config.json',JSON.stringify({version:config.version,repository:config.repository,manifestUrl:config.manifestUrl,publicKeyXml:xml},null,2)+'\n')
