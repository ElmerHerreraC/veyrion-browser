import {test} from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync,sign,createHash} from 'node:crypto'
import {mkdtempSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
test('Windows updater rejects tampering, foreign URLs and corrupt installers', {skip:process.platform!=='win32'},()=>{
  const folder=mkdtempSync(path.join(tmpdir(),'veyrion-update-test-'))
  const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048})
  const jwk=publicKey.export({format:'jwk'})
  const repository='ElmerHerreraC/veyrion-browser',version='0.4.2'
  const manifest={repository,version,url:`https://github.com/${repository}/releases/download/v${version}/Veyrion-Setup-x64.exe`,sha256:createHash('sha256').update('fixture').digest('hex'),size:7}
  const envelope=value=>{const bytes=Buffer.from(JSON.stringify(value));return {payload:bytes.toString('base64'),signature:sign('RSA-SHA256',bytes,privateKey).toString('base64')}}
  const config={repository,publicKeyXml:`<RSAKeyValue><Modulus>${Buffer.from(jwk.n,'base64url').toString('base64')}</Modulus><Exponent>${Buffer.from(jwk.e,'base64url').toString('base64')}</Exponent></RSAKeyValue>`}
  const tampered=envelope(manifest);tampered.payload=Buffer.from(JSON.stringify({...manifest,version:'9.9.9'})).toString('base64')
  writeFileSync(path.join(folder,'fixture.json'),JSON.stringify({config,valid:envelope(manifest),tampered,foreign:envelope({...manifest,url:'https://example.com/file.exe'}),badSize:envelope({...manifest,size:0}),badVersion:envelope({...manifest,version:'../evil'})}))
  writeFileSync(path.join(folder,'fixture.bin'),'fixture')
  writeFileSync(path.join(folder,'test.ps1'),`
$ErrorActionPreference='Stop'
. '${path.resolve('updater/policy.ps1').replaceAll("'","''")}'
$data=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fixture.json') -Raw | ConvertFrom-Json
$manifest=Read-UpdateManifest $data.valid $data.config
Test-UpdateInstaller (Join-Path $PSScriptRoot 'fixture.bin') $manifest
foreach($name in @('tampered','foreign','badSize','badVersion')) {
  $rejected=$false
  try { Read-UpdateManifest $data.$name $data.config | Out-Null } catch { $rejected=$true }
  if(!$rejected){throw ('Accepted '+$name)}
}
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'fixture.bin'),'changed')
$rejected=$false
try { Test-UpdateInstaller (Join-Path $PSScriptRoot 'fixture.bin') $manifest } catch { $rejected=$true }
if(!$rejected){throw 'Accepted corrupt installer'}
Write-Output 'PASS'
`)
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(folder,'test.ps1')],{encoding:'utf8',windowsHide:true})
  assert.equal(result.status,0,result.stdout+result.stderr)
  assert.match(result.stdout,/PASS/)
})
