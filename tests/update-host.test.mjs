import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {spawnSync} from 'node:child_process'

test('El host GUI ejecuta PowerShell sin consola y solo admite acciones fijas',{skip:process.platform!=='win32'},()=>{
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
    const result=spawnSync(executable,[action],{windowsHide:true,encoding:'utf8'})
    assert.equal(result.status,0,result.stderr)
    assert.equal(fs.readFileSync(path.join(directory,'result.txt'),'utf8'),expected)
  }
  assert.equal(spawnSync(executable,['arbitrary-command'],{windowsHide:true}).status,2)
})
