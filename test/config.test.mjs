import test from 'node:test'
import assert from 'node:assert/strict'
import { Config, DEFAULTS, resolveConfig } from '../lib/config.js'
import { resolveDataDir } from '../lib/paths.js'

test('resolveConfig fills defaults', () => {
  const config = resolveConfig({})
  assert.equal(config.capture.settleMs, 350)
  assert.equal(config.regions.genshin.w, 0.84)
  assert.equal(config.wiki.sources.hsr.api, 'https://wiki.biligame.com/sr/api.php')
  assert.equal(config.narrate.defaultStyle, '陪玩解说')
  assert.equal(config.watch.enabled, true)
  assert.equal(config.watch.intervalSec, 8)
})

test('resolveConfig deep-merges overrides', () => {
  const config = resolveConfig({ capture: { occlusionThreshold: 0.5 }, wiki: { enabled: false }, watch: { intervalSec: 1 } })
  assert.equal(config.capture.occlusionThreshold, 0.5)
  assert.equal(config.watch.intervalSec, 2)
  assert.equal(config.capture.settleMs, 350)
  assert.equal(config.wiki.enabled, false)
})

test('resolveConfig rejects invalid regions', () => {
  assert.throws(() => resolveConfig({ regions: { genshin: { x: 0.9, y: 0.1, w: 0.5, h: 0.2 } } }), /invalid capture region/)
  assert.throws(() => resolveConfig({ regions: { hsr: { x: 0, y: 0, w: 0, h: 0.2 } } }), /invalid capture region/)
})

test('env overrides data and engine paths', () => {
  const config = resolveConfig({}, { DSH_LORE_DATA_DIR: 'D:/lore-data', DSH_LORE_UV: 'C:/uv.exe' })
  assert.equal(config.engine.uv, 'C:/uv.exe')
  assert.equal(resolveDataDir(config, { DSH_LORE_DATA_DIR: 'D:/lore-data' }), 'D:\\lore-data')
})

test('schemastery Config validates and fills defaults', () => {
  const value = Config({})
  const plain = value && typeof value.get === 'function' ? value.get() : value
  assert.equal(plain.capture.settleMs, DEFAULTS.capture.settleMs)
  assert.equal(plain.wiki.enabled, true)
  assert.equal(plain.vision.maxFindings, DEFAULTS.vision.maxFindings)
  assert.equal(plain.frames.enabled, false)
  assert.equal(plain.watch.enabled, true)
  assert.equal(typeof value.get, 'function')
})
