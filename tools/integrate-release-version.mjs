import fs from 'node:fs'
import path from 'node:path'
import {root} from './paths.mjs'
import {integrateSettingsBranding} from './integrate-settings-branding.mjs'

const source=path.resolve(process.argv[2])
integrateSettingsBranding(source)
const target=path.join(source,'components/brave_extension/extension/brave_extension/veyrion_start/update-config.json')
const content=fs.readFileSync(path.join(root,'extension/update-config.json'),'utf8')
if(fs.readFileSync(target,'utf8')!==content)fs.writeFileSync(target,content)
console.log('Versión integrada en ajustes y actualizador interno.')
