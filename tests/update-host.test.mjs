import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {spawnSync} from 'node:child_process'

test('El host GUI no crea consola y libera su ejecutable durante la instalación',{skip:process.platform!=='win32'},async()=>{
  const compiled=spawnSync(process.execPath,['tools/prepare-updater.mjs'],{encoding:'utf8',windowsHide:true})
  assert.equal(compiled.status,0,compiled.stdout+compiled.stderr)
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'veyrion-host-'))
  const executable=path.join(directory,'VeyrionUpdate.exe')
  fs.copyFileSync('updater/VeyrionUpdate.exe',executable)
  const bytes=fs.readFileSync(executable),pe=bytes.readUInt32LE(0x3c)
  assert.equal(bytes.readUInt16LE(pe+24+68),2,'El ejecutable debe usar el subsistema Windows GUI')
  fs.writeFileSync(path.join(directory,'update.ps1'),`param([switch]$Apply)
Add-Type -Namespace Veyrion -Name ConsoleCheck -MemberDefinition '[System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern System.IntPtr GetConsoleWindow();'
if([Veyrion.ConsoleCheck]::GetConsoleWindow() -ne [IntPtr]::Zero){exit 7}
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'result.txt'),[string]$Apply)
`)
  for(const [action,expected]of [['check','False'],['apply','True']]){
    const output=path.join(directory,'result.txt')
    if(fs.existsSync(output))fs.unlinkSync(output)
    const result=spawnSync(executable,[action],{windowsHide:true,encoding:'utf8'})
    assert.equal(result.status,0,result.stderr)
    for(let attempt=0;attempt<100&&!fs.existsSync(output);attempt++)await new Promise(resolve=>setTimeout(resolve,50))
    assert.equal(fs.readFileSync(output,'utf8'),expected)
  }
  fs.writeFileSync(path.join(directory,'update.ps1'),`param([switch]$Apply)
$ErrorActionPreference='Stop'
$probe=[IO.File]::Open((Join-Path $PSScriptRoot 'VeyrionUpdate.exe'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
$probe.Dispose()
[IO.File]::Move((Join-Path $PSScriptRoot 'VeyrionUpdate.exe'),(Join-Path $PSScriptRoot 'VeyrionUpdate.old.exe'))
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'released.txt'),'yes')
`)
  assert.equal(spawnSync(executable,['apply'],{windowsHide:true}).status,0)
  for(let attempt=0;attempt<100&&!fs.existsSync(path.join(directory,'released.txt'));attempt++)await new Promise(resolve=>setTimeout(resolve,50))
  assert.ok(fs.existsSync(path.join(directory,'released.txt')),'El instalador debe poder reemplazar el lanzador mientras el worker sigue vivo')
  fs.renameSync(path.join(directory,'VeyrionUpdate.old.exe'),executable)
  assert.equal(spawnSync(executable,['arbitrary-command'],{windowsHide:true}).status,2)
})
