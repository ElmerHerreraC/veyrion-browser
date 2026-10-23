import { test } from 'node:test'
import assert from 'node:assert/strict'
import { destination, safeUrl, normalize } from '../extension/model.js'
test('La búsqueda codifica entradas y las direcciones conservan HTTP/HTTPS', () => {
  assert.equal(destination('brave.com'), 'https://brave.com/')
  assert.equal(destination('https://example.com/a?q=2'), 'https://example.com/a?q=2')
  assert.equal(destination('gatos & perros'), 'https://duckduckgo.com/?q=gatos%20%26%20perros')
  assert.equal(destination('hola', 'brave'), 'https://search.brave.com/search?q=hola')
})
test('Esquemas ejecutables y credenciales nunca se convierten en accesos', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,hello', 'file:///C:/secret', 'https://user:password@example.com']) assert.equal(safeUrl(value), null)
  assert.ok(destination('javascript:alert(1)').startsWith('https://duckduckgo.com/?q='))
})
test('Las preferencias corruptas se normalizan y no aceptan fondos externos', () => {
  const state = normalize({ accent: 'x', engine: 'x', wallpaper: 'https://tracker.example/a', shortcuts: [{ title: 'x', url: 'javascript:alert(1)' }] })
  assert.equal(state.accent, 'violet'); assert.equal(state.engine, 'duckduckgo')
  assert.equal(state.wallpaper, ''); assert.deepEqual(state.shortcuts, [])
})
test('Los mods limitan valores y no admiten CSS ni colores ejecutables', () => {
  const state = normalize({ customColor: 'url(https://example.com)', effect: 'javascript', volume: 1000, blur: -3, brightness: 'roto' })
  assert.equal(state.customColor, '#a48bff'); assert.equal(state.effect, 'none')
  assert.equal(state.volume, 100); assert.equal(state.blur, 0); assert.equal(state.brightness, 70)
})

test('La apariencia ampliada usa listas de valores y límites seguros', () => {
  const valid = normalize({frameStyle:'glass',tileSize:180,interfaceFont:'mono',panelOpacity:60,webEffect:'warm',webSounds:true})
  assert.equal(valid.frameStyle,'glass'); assert.equal(valid.tileSize,180)
  assert.equal(valid.interfaceFont,'mono'); assert.equal(valid.webEffect,'warm'); assert.equal(valid.webSounds,true)
  const invalid = normalize({frameStyle:'<script>',tileSize:999,interfaceFont:'url(x)',panelOpacity:-10,webEffect:'url(https://tracker.test)',webSounds:'true'})
  assert.equal(invalid.frameStyle,'angular'); assert.equal(invalid.tileSize,210)
  assert.equal(invalid.interfaceFont,'system'); assert.equal(invalid.panelOpacity,35)
  assert.equal(invalid.webEffect,'none'); assert.equal(invalid.webSounds,false)
})
