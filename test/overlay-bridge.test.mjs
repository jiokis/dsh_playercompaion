import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveConfig } from '../lib/config.js'
import { OverlayActionBridge } from '../lib/overlay-bridge.js'

test('overlay bridge executes a screenshot command and reports back', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-overlay-bridge-'))
  try {
    const config = resolveConfig({ dataDir: dir })
    const feedback = []
    const overlay = { update: async (state) => { feedback.push(state); return state } }
    const runtime = {
      ensure: async () => ({
        request: async (_method, params) => {
          assert.equal(params.include_image, true)
          return { image: Buffer.from('png').toString('base64'), text: '测试台词', window: { width: 10, height: 10 } }
        }
      })
    }
    const bridge = new OverlayActionBridge({ config, dataDir: dir, runtime, capture: {}, vision: {}, query: {}, overlay })
    const commandPath = join(dir, 'overlay', 'command.json')
    mkdirSync(join(dir, 'overlay'), { recursive: true })
    writeFileSync(commandPath, JSON.stringify({ action: 'screenshot' }), 'utf8')
    await bridge.poll()
    assert.equal(feedback[0].status, '截图中')
    assert.equal(feedback[feedback.length - 1].status, '截图完成')
    assert.equal(readdirSync(join(dir, 'screenshots')).length, 1)
    await assert.rejects(async () => readFileSync(commandPath), /ENOENT/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('overlay bridge runs reading OCR with a wider region', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-overlay-read-'))
  try {
    const config = resolveConfig({ dataDir: dir })
    const feedback = []
    const overlay = { update: async (state) => { feedback.push(state); return state } }
    const runtime = {
      ensure: async () => ({
        request: async (method, params) => {
          assert.equal(method, 'capture')
          assert.equal(params.mode, 'read')
          assert.equal(params.ocr_max_side, 1600)
          assert.equal(params.region.w, 0.88)
          return { text: '这是书页上的阅读文本。' }
        }
      })
    }
    const bridge = new OverlayActionBridge({ config, dataDir: dir, runtime, capture: {}, vision: {}, query: {}, overlay })
    await bridge.execute({ action: 'read' })
    assert.equal(feedback[0].status, '阅读中')
    assert.equal(feedback[feedback.length - 1].status, '阅读文本')
    assert.match(feedback[feedback.length - 1].text, /书页/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
