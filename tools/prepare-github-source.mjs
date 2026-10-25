import fs from 'node:fs'
import path from 'node:path'
import { root } from './paths.mjs'
const files = []
const directories = ['config', 'docs', 'extension', 'installer', 'native-ui', 'tests', 'theme', 'tools', 'updater']
function visit(relative) {
  const target = path.join(root, relative)
  const stat = fs.lstatSync(target)
  if (stat.isSymbolicLink()) throw new Error('No se publican enlaces simbólicos: ' + relative)
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(target).sort()) visit(path.posix.join(relative, name))
    return
  }
  if (relative === 'config/build-machine.json' || /\.(pem|key|lnk|exe)$/i.test(relative)) return
  if (stat.size > 200000) throw new Error('Archivo demasiado grande para el paquete de código: ' + relative)
  const data = fs.readFileSync(target)
  if (/\.(png|ico)$/i.test(relative)) files.push({ path: relative, encoding: 'base64', content: data.toString('base64') })
  else {
    const text = data.toString('utf8')
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) throw new Error('Se encontró una clave privada en ' + relative)
    files.push({ path: relative, encoding: 'utf-8', content: text })
  }
}
for (const directory of directories) visit(directory)
for (const file of ['.gitignore', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'package.json', 'Veyrion.ico', 'ABRIR VEYRION.cmd', 'REPARAR INICIO.cmd']) visit(file)
const destination = path.join(root, 'artifacts/github-source')
fs.mkdirSync(destination, { recursive: true })
const batches = []
let batch = [], length = 0
for (const file of files) {
  const size = JSON.stringify(file).length
  if (batch.length && length + size > 18000) { batches.push(batch); batch = []; length = 0 }
  batch.push(file); length += size
}
if (batch.length) batches.push(batch)
batches.forEach((items, index) => fs.writeFileSync(path.join(destination, `batch-${index}.json`), JSON.stringify(items)))
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(files.map(({ path, encoding }) => ({ path, encoding })), null, 2))
console.log(JSON.stringify({ files: files.length, batches: batches.length, excluded: ['profiles', 'artifacts', 'private keys', 'downloaded sources', 'installers', 'machine config'] }))
