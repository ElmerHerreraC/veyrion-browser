import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createPublicKey} from 'node:crypto'
import {root} from './paths.mjs'
const config = JSON.parse(fs.readFileSync(root+'/extension/update-config.json'))
const key = createPublicKey({key:Buffer.from(config.publicKey,'base64'),format:'der',type:'spki'}).export({format:'jwk'})
const xml = `<RSAKeyValue><Modulus>${Buffer.from(key.n,'base64url').toString('base64')}</Modulus><Exponent>${Buffer.from(key.e,'base64url').toString('base64')}</Exponent></RSAKeyValue>`
fs.mkdirSync(root+'/updater',{recursive:true})
fs.writeFileSync(root+'/updater/config.json',JSON.stringify({version:config.version,repository:config.repository,manifestUrl:config.manifestUrl,publicKeyXml:xml},null,2)+'\n')
const compiler=path.join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe')
const result=spawnSync(compiler,['/nologo','/target:winexe','/optimize+','/out:'+path.join(root,'updater/VeyrionUpdate.exe'),path.join(root,'updater/host.cs')],{encoding:'utf8',windowsHide:true})
if(result.status!==0)throw Error('No se pudo compilar el actualizador sin consola: '+result.stdout+result.stderr)
