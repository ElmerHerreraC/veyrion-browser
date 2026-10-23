import fs from 'node:fs'
import path from 'node:path'
import { root } from './paths.mjs'
const source = path.resolve(process.argv[2])
const excluded = JSON.parse(fs.readFileSync(path.join(root, 'config/chromium-custom-deps.json'), 'utf8'))
// Brave's EnvConfig reads dotenv files, not shell environment variables.
fs.writeFileSync(path.join(source, '.veyrion-build.env'), `# Veyrion: unused updater integration-test fixtures.\nprojects_chrome_custom_deps='${JSON.stringify(excluded)}'\n`)
const envPath = path.join(source, '.env')
const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
if (!/^include_env=\.veyrion-build\.env\s*$/m.test(existing)) {
  fs.writeFileSync(envPath, existing.trimEnd() + '\ninclude_env=.veyrion-build.env\n')
}
// This depot_tools revision registers CIPD packages before applying custom_deps
// URL overrides. Honor explicit None exclusions before package registration.
const gclientPath = path.join(source, 'vendor/depot_tools/gclient.py')
const gclient = fs.readFileSync(gclientPath, 'utf8')
const anchor = '            if dep_type == "cipd":\n'
const guard = '            # Veyrion: honor custom_deps exclusions for CIPD packages.\n' +
  '            if dep_type == "cipd" and self.get_custom_deps(name, True) is None:\n' +
  '                continue\n\n'
if (!gclient.includes('# Veyrion: honor custom_deps exclusions')) {
  if (gclient.split(anchor).length !== 2) throw new Error('Cambió gclient; revisar exclusiones CIPD antes de continuar.')
  fs.writeFileSync(gclientPath, gclient.replace(anchor, guard + anchor))
}
// Windows cannot spawn a single checkout command listing every patched file.
const patcherPath = path.join(source, 'build/commands/lib/gitPatcher.js')
const patcher = fs.readFileSync(patcherPath, 'utf8')
const originalReset = "  resetRepoFiles(filePaths) {\n    return util.runGitAsync(this.repoPath, ['checkout', ...filePaths])\n  }"
const batchedReset = "  async resetRepoFiles(filePaths) {\n" +
  "    // Veyrion: bound Windows command-line length; writes remain sequential.\n" +
  "    let batch = []\n    let length = 0\n" +
  "    for (const filePath of filePaths) {\n" +
  "      if (batch.length && length + filePath.length > 12000) {\n" +
  "        await util.runGitAsync(this.repoPath, ['checkout', '--', ...batch])\n" +
  "        batch = []\n        length = 0\n      }\n" +
  "      batch.push(filePath)\n      length += filePath.length + 3\n    }\n" +
  "    if (batch.length) await util.runGitAsync(this.repoPath, ['checkout', '--', ...batch])\n  }"
if (!patcher.includes('// Veyrion: bound Windows command-line length')) {
  if (!patcher.includes(originalReset)) throw new Error('Cambió gitPatcher; revisar límite de rutas de Windows.')
  fs.writeFileSync(patcherPath, patcher.replace(originalReset, batchedReset))
}
console.log('Configuración local: pruebas del actualizador excluidas; protección de Windows sin cambios.')
