// Shared by the component background page, the start page and policy tests.
globalThis.VeyrionUpdates = (() => {
  const decode = value => Uint8Array.from(atob(value), character => character.charCodeAt(0))
  function versionParts(value) {
    if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) throw new Error('Versión de actualización inválida.')
    const parts = value.split('.').map(Number)
    if (!parts.every(Number.isSafeInteger)) throw new Error('Versión fuera de rango.')
    return parts
  }
  function compareVersions(a, b) {
    const left = versionParts(a), right = versionParts(b)
    for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1
    return 0
  }
  function validateManifest(value, config) {
    if (!value || typeof value !== 'object') throw new Error('Manifiesto inválido.')
    versionParts(value.version)
    const expected = `https://github.com/${config.repository}/releases/download/v${value.version}/Veyrion-Setup-x64.exe`
    if (value.url !== expected || value.repository !== config.repository) throw new Error('La actualización no pertenece al repositorio de Veyrion.')
    if (!/^[a-f0-9]{64}$/.test(value.sha256) || !Number.isSafeInteger(value.size) || value.size < 1 || value.size > 1024 ** 3) throw new Error('Huella o tamaño inválido.')
    return { version: value.version, url: value.url, sha256: value.sha256, size: value.size, repository: value.repository }
  }
  async function verifyManifest(envelope, config) {
    if (!envelope || typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string' || envelope.payload.length > 16000 || envelope.signature.length > 2000) throw new Error('Respuesta de actualización inválida.')
    const payload = decode(envelope.payload)
    const key = await crypto.subtle.importKey('spki', decode(config.publicKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(envelope.signature), payload)) throw new Error('La firma de la actualización no es válida.')
    return validateManifest(JSON.parse(new TextDecoder().decode(payload)), config)
  }
  async function verifyInstaller(bytes, manifest) {
    if (bytes.byteLength !== manifest.size) throw new Error('La descarga está incompleta o tiene otro tamaño.')
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
    if (hash !== manifest.sha256) throw new Error('La descarga no coincide con la actualización firmada.')
    return true
  }
  async function readBytes(response, limit) {
    const declared = Number(response.headers.get('content-length'))
    if (declared > limit) throw new Error('La descarga supera el tamaño permitido.')
    const reader = response.body?.getReader()
    if (!reader) throw new Error('La respuesta está vacía.')
    const chunks = []
    let length = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        length += value.byteLength
        if (length > limit) { await reader.cancel(); throw new Error('La descarga supera el tamaño permitido.') }
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return bytes
  }
  async function check(config, fetcher = fetch) {
    const response = await fetcher(config.manifestUrl, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(20000) })
    if (response.status === 404) return { status: 'unpublished', checkedAt: Date.now() }
    if (!response.ok) throw new Error('No se pudo consultar GitHub. Inténtalo más tarde.')
    const text = new TextDecoder().decode(await readBytes(response, 20000))
    const manifest = await verifyManifest(JSON.parse(text), config)
    return { status: compareVersions(manifest.version, config.version) > 0 ? 'available' : 'current', checkedAt: Date.now(), manifest }
  }
  return Object.freeze({ compareVersions, validateManifest, verifyManifest, verifyInstaller, readBytes, check })
})()
