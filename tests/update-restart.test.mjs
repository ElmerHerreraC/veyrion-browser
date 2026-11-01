import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
test('El reinicio conserva el perfil con espacios y rechaza argumentos ajenos',{skip:process.platform!=='win32'},()=>{
  const source=fs.readFileSync('updater/update.ps1','utf8')
  const helper=source.slice(source.indexOf('function Restart-Veyrion'),source.indexOf('function Save-BoundedDownload'))
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'veyrion-restart-'))
  const args=['--user-data-dir=C:\\Profiles\\Samsung Imported\\','--profile-directory=Default']
  for(const [id,value]of [[1,args],[2,args],[3,[]]])fs.writeFileSync(path.join(folder,`restart-0.8.2-${id}.json`),JSON.stringify(value))
  fs.writeFileSync(path.join(folder,'test.ps1'),`$ErrorActionPreference='Stop'
$cache=$PSScriptRoot
$installedExe='C:\\Veyrion\\veyrion.exe'
$script:calls=New-Object Collections.ArrayList
function Start-Process([string]$FilePath,[string]$ArgumentList,[string]$WindowStyle) { $script:calls.Add(@{file=$FilePath;args=$ArgumentList}) | Out-Null }
${helper}
Restart-Veyrion '0.8.2'
ConvertTo-Json -InputObject @($script:calls) | Set-Content (Join-Path $cache 'calls.json')
'["--disable-web-security"]' | Set-Content (Join-Path $cache 'restart-0.8.2-4.json')
$rejected=$false
try { Restart-Veyrion '0.8.2' } catch { $rejected=$true }
if(!$rejected){throw 'Accepted arbitrary restart switch'}
`)
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(folder,'test.ps1')],{encoding:'utf8',windowsHide:true})
  assert.equal(result.status,0,result.stderr)
  const calls=JSON.parse(fs.readFileSync(path.join(folder,'calls.json'),'utf8').replace(/^\uFEFF/,''))
  assert.equal(calls.length,2,'Cada raíz de perfil debe reiniciarse una sola vez')
  assert.ok(calls.every(call=>call.args.startsWith('--restore-last-session')))
  assert.ok(calls.some(call=>call.args.includes('"'+args[0]+'\\"')),'Preservar espacios y escapar la barra final')
})
