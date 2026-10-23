import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { root } from './paths.mjs'
const machinePath = path.join(root, 'config/build-machine.json')
const machine = fs.existsSync(machinePath) ? JSON.parse(fs.readFileSync(machinePath, 'utf8')) : {}
const buildRoot = process.env.VEYRION_BUILD_ROOT || machine.buildRoot || root
const source = path.join(buildRoot, 'src/brave')
const flags = JSON.parse(fs.readFileSync(path.join(root, 'config/build-flags.json'), 'utf8'))
const checks = []
const check = (name, ok, detail) => checks.push({ name, ok, detail })
check('Sistema', process.platform === 'win32', process.platform)
check('Node', Number(process.versions.node.split('.')[0]) >= 24, process.versions.node)
check('Ruta sin espacios', !/\s/.test(buildRoot), buildRoot)
check('Brave core', fs.existsSync(path.join(source, 'package.json')), source)
const pnpm = spawnSync('cmd.exe', ['/d', '/c', 'pnpm --version'], { encoding: 'utf8', windowsHide: true })
check('pnpm', pnpm.status === 0, pnpm.stdout?.trim() || 'No instalado')
const vswhere = path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft Visual Studio/Installer/vswhere.exe')
const vs = fs.existsSync(vswhere) ? spawnSync(vswhere, ['-latest', '-products', '*', '-version', '[18.0,19.0)', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', 'Microsoft.VisualStudio.Component.VC.ATLMFC', '-property', 'installationPath'], { encoding: 'utf8', windowsHide: true }).stdout?.trim() : ''
check('Visual Studio 2026 con C++ y ATL/MFC', Boolean(vs), vs || 'No se encontraron los componentes requeridos')
const include = path.join(process.env['ProgramFiles(x86)'] || '', 'Windows Kits/10/Include')
check('Windows SDK 28000', fs.existsSync(path.join(include, '10.0.28000.0')), include)
const dev = spawnSync('reg.exe', ['query', String.raw`HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock`, '/v', 'AllowDevelopmentWithoutDevLicense'], { encoding: 'utf8', windowsHide: true })
check('Modo de desarrollador', /REG_DWORD\s+0x1\b/i.test(dev.stdout || ''), 'Requerido para enlaces simbólicos')
for (const item of checks) console.log(`${item.ok ? 'OK' : 'FALTA'} ${item.name}: ${item.detail}`)
console.log('Opciones nativas:', JSON.stringify(flags))
console.log('La versión exacta de VS/SDK debe coincidir con src/build/vs_toolchain.py tras sincronizar Chromium.')
const command = process.argv[2] || 'check'
if (!['check', 'init', 'build'].includes(command)) throw new Error('Usa check, init o build')
if (command === 'check') process.exit(checks.every(x => x.ok) ? 0 : 1)
if (checks.some(item => !item.ok)) { console.error('Compilación detenida por los requisitos indicados.'); process.exit(1) }
process.env.DEPOT_TOOLS_WIN_TOOLCHAIN = '0'
process.env.vs2026_install = vs
const args = command === 'init' ? ['run', 'init'] : ['run', 'build', 'Static', '--skip_signing', ...Object.entries(flags).flatMap(([key, value]) => ['--gn', `${key}:${value}`])]
// cmd launches the trusted pnpm shim; arguments contain no paths or user input.
const result = spawnSync('cmd.exe', ['/d', '/c', 'pnpm', ...args], { cwd: source, stdio: 'inherit', env: process.env })
process.exit(result.status ?? 1)
