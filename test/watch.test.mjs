import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConfig } from '../lib/config.js'
import { LoreWatcher } from '../lib/watcher.js'

function fakeTimer() {
  const timer = { unref() {} }
  let cleared = null
  return {
    timer,
    setIntervalFn: () => timer,
    clearIntervalFn: (value) => { cleared = value },
    get cleared() { return cleared }
  }
}

function fakeCapture(results) {
  const calls = []
  return {
    calls,
    execute: async (args, exec) => {
      calls.push({ args, hasSignal: Boolean(exec?.signal) })
      const next = results.length > 1 ? results.shift() : results[0]
      if (next instanceof Error) throw next
      return next
    }
  }
}

test('lore_watch starts explicitly, counts captures, and stops', async () => {
  const config = resolveConfig({ watch: { enabled: true, intervalSec: 8 } })
  const timer = fakeTimer()
  const capture = fakeCapture([{ captured: true, game: 'genshin', persisted: true, entries: [{ speaker: '凯瑟琳', text: '你好' }] }])
  const watcher = new LoreWatcher({ config, capture, setIntervalFn: timer.setIntervalFn, clearIntervalFn: timer.clearIntervalFn })
  const before = watcher.status()
  assert.equal(before.running, false)
  const started = await watcher.start({ game: 'genshin', note: 'test' })
  assert.equal(started.running, true)
  assert.equal(started.ticks, 1)
  assert.equal(started.captured, 1)
  assert.equal(started.session.startsWith('watch-'), true)
  assert.equal(capture.calls[0].args.includeImage, false)
  assert.equal(capture.calls[0].args.mode, 'dialogue')
  assert.equal(capture.calls[0].args.fast, true)
  assert.equal(capture.calls[0].args.region.x, 0.05)
  assert.equal('window' in capture.calls[0].args, false)
  assert.equal(capture.calls[0].hasSignal, true)
  assert.equal(timer.cleared, null)
  const stopped = watcher.stop()
  assert.equal(stopped.running, false)
  assert.equal(timer.cleared, timer.timer)
  await watcher.tick()
  assert.equal(watcher.status().ticks, 1)
})

test('lore_watch classifies duplicate, skipped, empty and errors', async () => {
  const config = resolveConfig({ watch: { enabled: true, intervalSec: 2 } })
  const results = [
    { duplicate: true, entries: [{ text: 'same' }] },
    { skipped: true },
    { empty: true },
    new Error('window not found'),
    { captured: true, entries: [{ text: 'new' }] }
  ]
  const capture = fakeCapture(results)
  const timer = fakeTimer()
  const watcher = new LoreWatcher({ config, capture, setIntervalFn: timer.setIntervalFn, clearIntervalFn: timer.clearIntervalFn })
  await watcher.start({ intervalSec: 1 })
  assert.equal(watcher.status().intervalSec, 1)
  await watcher.tick()
  await watcher.tick()
  await watcher.tick()
  assert.equal(watcher.status().duplicates, 1)
  assert.equal(watcher.status().skipped, 1)
  assert.equal(watcher.status().empty, 1)
  assert.equal(watcher.status().errors, 1)
  assert.match(watcher.status().lastError, /window not found/)
  await watcher.tick()
  assert.equal(watcher.status().captured, 1)
  assert.equal(watcher.status().lastError, null)
  assert.notEqual(capture.calls[1].args.region.y, capture.calls[2].args.region.y)
  watcher.stop()
})

test('lore_watch refuses disabled config and double start', async () => {
  const disabled = new LoreWatcher({ config: resolveConfig({ watch: { enabled: false } }), capture: fakeCapture([{ captured: true }]) })
  await assert.rejects(() => disabled.start({}), /disabled/)
  const enabled = new LoreWatcher({ config: resolveConfig({ watch: { enabled: true } }), capture: fakeCapture([{ captured: true }]), setIntervalFn: () => ({ unref() {} }), clearIntervalFn: () => {} })
  await enabled.start({})
  await assert.rejects(() => enabled.start({}), /already running/)
  enabled.stop()
})
