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
