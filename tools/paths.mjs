import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
export const root = fileURLToPath(new URL('../', import.meta.url))
export function braveExecutable() {
  if (process.env.NEBULA_BROWSER_EXE && !existsSync(process.env.NEBULA_BROWSER_EXE)) throw new Error('No existe el ejecutable solicitado: ' + process.env.NEBULA_BROWSER_EXE)
  if (process.env.NEBULA_BROWSER_EXE && path.basename(process.env.NEBULA_BROWSER_EXE).toLowerCase() !== 'veyrion.exe') throw new Error('Veyrion solo puede abrir su ejecutable nativo veyrion.exe.')
  let verifiedNative
  try {
    const report = JSON.parse(readFileSync(path.join(root, 'artifacts/verification.json'), 'utf8'))
    if (report.passed && report.native_build_verified && path.basename(report.browser).toLowerCase() === 'veyrion.exe') verifiedNative = report.browser
  } catch {}
  const candidates = [process.env.NEBULA_BROWSER_EXE,
    path.join(process.env.USERPROFILE || '', 'AppData/Local/Programs/Veyrion/veyrion.exe'),
    verifiedNative]
  const result = candidates.find(item => item && existsSync(item))
  if (!result) throw new Error('Veyrion todavía no está instalado. Espera a que termine la compilación e instala Veyrion-Setup-x64.exe. Este acceso no abrirá Brave.')
  return result
}
