import fs from 'node:fs'
import path from 'node:path'
import { root } from './paths.mjs'
import { integrateNativeTheme } from './integrate-native-theme.mjs'
import { integrateNativeSidebar } from './integrate-native-sidebar.mjs'
import { integrateNativePanels } from './integrate-native-panels.mjs'
import { integratePanelApi } from './integrate-panel-api.mjs'
import { integrateSettingsBranding } from './integrate-settings-branding.mjs'
import { integrateUnifiedUi } from './integrate-unified-ui.mjs'
import { integrateAppearanceApi } from './integrate-appearance-api.mjs'
import { integrateSidebarIcons } from './integrate-sidebar-icons.mjs'
import { integrateNativeSettings } from './integrate-native-settings.mjs'
import { integrateSidebarLayout } from './integrate-sidebar-layout.mjs'
import { integrateExperience } from './integrate-experience.mjs'
import { integrateProfileSidebar } from './integrate-profile-sidebar.mjs'
import { integrateCursorsProtection } from './integrate-cursors-protection.mjs'
const source = path.resolve(process.argv[2] || path.join(root, 'src/brave'))
const component = path.join(source, 'components/brave_extension/extension')
const destination = path.join(component, 'brave_extension/veyrion_start')
fs.mkdirSync(destination, { recursive: true })
const files = ['index.html', 'style.css', 'customization.css', 'unified.css', 'home.css', 'live-wallpaper.js', 'unified.js', 'app.js', 'customization.js', 'model.js', 'web-appearance.js', 'update-core.js', 'updates.js', 'updates-background.js', 'update-config.json', ...[16, 32, 48, 128, 256].map(size => `icons/icon${size}.png`)]
files.push('home-extras.js','onboarding.js',...['mountains','coast','planet','nebula'].map(name=>'wallpapers/'+name+'.svg'))
files.push('google-mark.svg','site-icon.svg')
for (const file of files) {
  const target = path.join(destination, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(path.join(root, 'extension', file), target)
}
const manifestPath = path.join(component, 'brave_extension/manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
manifest.name = 'Veyrion Core'
manifest.description = 'Integración de navegación y página de inicio de Veyrion.'
manifest.icons = Object.fromEntries([16,32,48,128,256].map(size => [size, `veyrion_start/icons/icon${size}.png`]))
manifest.content_scripts = [...(manifest.content_scripts || []).filter(item => !item.js?.includes('veyrion_start/web-appearance.js')), {matches:['http://*/*','https://*/*'],js:['veyrion_start/web-appearance.js'],run_at:'document_idle',all_frames:false}]
manifest.permissions = [...new Set([...manifest.permissions, 'downloads'])]
const updateScripts = ['veyrion_start/update-core.js', 'veyrion_start/updates-background.js']
manifest.background = { scripts: updateScripts, persistent: true }
if (manifest.MAYBE_background) manifest.MAYBE_background.scripts = [...new Set([...manifest.MAYBE_background.scripts, ...updateScripts])]
manifest.chrome_url_overrides = { ...manifest.chrome_url_overrides, newtab: 'veyrion_start/index.html' }
manifest.content_security_policy = manifest.content_security_policy.replace("style-src 'unsafe-inline'", "style-src 'self' 'unsafe-inline'")
manifest.content_security_policy = manifest.content_security_policy.replace("img-src 'self' data:", "img-src 'self' blob: data:")
if(!manifest.content_security_policy.includes('media-src'))manifest.content_security_policy += " media-src 'self' blob:;"
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
const grdPath = path.join(component, 'resources.grd')
let grd = fs.readFileSync(grdPath, 'utf8').replace(/\s*<include name="IDR_VEYRION_[^\n]+\n/g, '\n')
const includes = files.map(file => `      <include name="IDR_VEYRION_${file.replace(/[^a-z0-9]/gi, '_').toUpperCase()}" file="brave_extension/veyrion_start/${file}" type="BINDATA" />`).join('\n')
grd = grd.replace('    </includes>', includes + '\n    </includes>')
fs.writeFileSync(grdPath, grd)
// This static group has grown beyond its original 20-resource allocation.
const idsPath = path.join(source, 'resources/resource_ids.spec')
const resourceKey = 'brave/components/brave_extension/extension/resources.grd'
let ids = fs.readFileSync(idsPath, 'utf8').replace(/^[ \t]*"brave\/components\/brave_extension\/extension\/resources.grd":\s*\{\s*"includes":\s*\[\d+\],?\s*\},[ \t]*\r?\n?/gm, '')
const marker = /^[ \t]*# WARNING: The IDs range/m
if (!marker.test(ids)) throw new Error('No se encontró el punto de inserción de recursos; no se modificará resource_ids.spec.')
ids = ids.replace(marker, '  "' + resourceKey + '": {\n    "includes": [54250],\n  },\n  # WARNING: The IDs range')
if (ids.split('"' + resourceKey + '"').length !== 2) throw new Error('La tabla debe contener exactamente una asignación para el inicio de Veyrion.')
fs.writeFileSync(idsPath, ids)
integrateNativeTheme(source)
integrateNativeSidebar(source)
integrateNativePanels(source)
integratePanelApi(source)
integrateSettingsBranding(source)
integrateUnifiedUi(source)
integrateAppearanceApi(source)
integrateSidebarIcons(source)
integrateNativeSettings(source)
integrateSidebarLayout(source)
integrateExperience(source)
integrateProfileSidebar(source)
integrateCursorsProtection(source)
console.log('Inicio integrado en los recursos internos. No requiere --load-extension. Pendiente compilación y prueba nativa.')
