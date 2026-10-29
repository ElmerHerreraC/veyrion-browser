import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'

test('El estado de actualización publica progreso y errores como JSON UTF-8 legible por el navegador',{skip:process.platform!=='win32'},()=>{
  const source=fs.readFileSync('updater/update.ps1','utf8')
  const statusFunction=source.slice(source.indexOf('function Write-UpdateStatus'),source.indexOf('function Save-BoundedDownload'))
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'veyrion-progress-'))
  const script=path.join(folder,'test.ps1')
  fs.writeFileSync(script,`\ufeff$ErrorActionPreference='Stop'
$cache=$PSScriptRoot
${statusFunction}
Write-UpdateStatus 'downloading' '0.8.0' 52428800 104857600
Copy-Item (Join-Path $cache 'status.json') (Join-Path $cache 'progress.json')
Write-UpdateStatus 'error' 'No se pudo conectar: conexión interrumpida'
`)
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{encoding:'utf8',windowsHide:true})
  assert.equal(result.status,0,result.stderr)
  const progress=JSON.parse(fs.readFileSync(path.join(folder,'progress.json'),'utf8'))
  assert.equal(progress.downloaded/progress.total,0.5)
  const error=JSON.parse(fs.readFileSync(path.join(folder,'status.json'),'utf8'))
  assert.equal(error.state,'error')
  assert.match(error.detail,/conexión/)
})
