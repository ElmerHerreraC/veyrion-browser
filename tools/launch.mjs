import { spawn } from 'node:child_process'
import { braveExecutable } from './paths.mjs'
try {
  const exe = braveExecutable()
  console.log('Veyrion independiente:', exe)
  const child = spawn(exe, ['--no-first-run', '--no-default-browser-check', 'chrome://newtab/'], {
    detached: true, stdio: 'ignore', windowsHide: false
  })
  child.on('error', error => { console.error(error.message); process.exitCode = 1 })
  child.unref()
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
