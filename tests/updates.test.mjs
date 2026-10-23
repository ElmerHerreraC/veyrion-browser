import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign, createHash } from 'node:crypto'
import '../extension/update-core.js'
const updates = globalThis.VeyrionUpdates
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
const config = { repository: 'ElmerHerreraC/veyrion-browser', version: '0.2.0', publicKey: keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'), manifestUrl: 'https://github.com/ElmerHerreraC/veyrion-browser/releases/latest/download/veyrion-update.json' }
const file = Buffer.from('An installer fixture, not executable code.')
const manifest = { version: '0.2.1', repository: config.repository, url: 'https://github.com/ElmerHerreraC/veyrion-browser/releases/download/v0.2.1/Veyrion-Setup-x64.exe', sha256: createHash('sha256').update(file).digest('hex'), size: file.length }
function envelope(value, privateKey = keys.privateKey) {
  const bytes = Buffer.from(JSON.stringify(value))
  return { payload: bytes.toString('base64'), signature: sign('sha256', bytes, privateKey).toString('base64') }
}
test('Solo una firma válida del editor autoriza un manifiesto', async () => {
  assert.deepEqual(await updates.verifyManifest(envelope(manifest), config), manifest)
  const altered = envelope(manifest)
  altered.payload = Buffer.from(JSON.stringify({ ...manifest, sha256: '0'.repeat(64) })).toString('base64')
  await assert.rejects(updates.verifyManifest(altered, config), /firma/)
  const foreign = generateKeyPairSync('rsa', { modulusLength: 2048 })
  await assert.rejects(updates.verifyManifest(envelope(manifest, foreign.privateKey), config), /firma/)
})
test('Se rechazan repositorios ajenos, esquemas ejecutables y versiones ambiguas', () => {
  for (const url of ['javascript:alert(1)', 'http://github.com/test.exe', manifest.url.replace('ElmerHerreraC', 'attacker'), manifest.url + '?redirect=1']) assert.throws(() => updates.validateManifest({ ...manifest, url }, config))
  for (const version of ['0.2.1-rc1', '01.2.3', '../2.0', 'Infinity.2.0']) assert.throws(() => updates.compareVersions(version, '0.2.0'))
  assert.equal(updates.compareVersions('0.2.10', '0.2.9'), 1)
  assert.equal(updates.compareVersions('0.1.0', '0.2.0'), -1)
})
test('La descarga debe coincidir en tamaño y SHA-256', async () => {
  assert.equal(await updates.verifyInstaller(file, manifest), true)
  await assert.rejects(updates.verifyInstaller(Buffer.alloc(file.length, 1), manifest), /no coincide/)
  await assert.rejects(updates.verifyInstaller(file.subarray(1), manifest), /tamaño/)
  await assert.rejects(updates.readBytes(new Response(file), file.length - 1), /tamaño/)
  assert.deepEqual(Buffer.from(await updates.readBytes(new Response(file), file.length)), file)
})
test('GitHub sin publicación no se anuncia como actualizado; no se ofrecen retrocesos', async () => {
  const pending = await updates.check(config, async () => new Response('', { status: 404 }))
  assert.equal(pending.status, 'unpublished')
  const available = await updates.check(config, async () => new Response(JSON.stringify(envelope(manifest))))
  assert.equal(available.status, 'available')
  const old = { ...manifest, version: '0.1.0', url: manifest.url.replace('v0.2.1', 'v0.1.0') }
  const result = await updates.check(config, async () => new Response(JSON.stringify(envelope(old))))
  assert.equal(result.status, 'current')
})
