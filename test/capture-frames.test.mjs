import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConfig } from '../lib/config.js'
import { createCaptureTool } from '../lib/tools/capture.js'

test('lore_capture archives a window frame when enabled', async () => {
  const config = resolveConfig({ frames: { enabled: true, saveOnCapture: true } })
  let requestParams = null
  const runtime = {
    ensure: async () => ({
      request: async (_method, params) => {
        requestParams = params
        return {
          game: 'genshin',
          text: '凯瑟琳：你好。',
          speaker: '凯瑟琳',
          speakerTitle: '冒险家协会接待员',
          choices: [],
          lines: [],
          window: { width: 2560, height: 1440 },
          region: { x: 0.1, y: 0.6, w: 0.8, h: 0.3 },
          foreground: {},
          occluded: {},
          backend: 'dxcam',
          isForeground: true,
          dialogueLike: true,
          empty: false,
          score: 0.9,
          windowImage: Buffer.from('window').toString('base64')
        }
      }
    })
  }
  const appended = []
  const logStore = {
    recent: () => [],
    append: (record) => appended.push(record),
    appendSeen: () => {}
  }
  const overlay = { show: async () => ({ ok: true, running: true }), update: async () => ({}) }
  const savedFrames = []
  const frames = {
    enabled: true,
    save: (value) => { savedFrames.push(value); return { id: 'f_test' } }
  }
  const tool = createCaptureTool({ config, runtime, logStore, ctx: {}, overlay, frames })
  const result = await tool.execute({ game: 'genshin' }, { signal: new AbortController().signal })
  assert.equal(requestParams.include_window_image, true)
  assert.equal(savedFrames.length, 1)
  assert.equal(savedFrames[0].base64, Buffer.from('window').toString('base64'))
  assert.equal(result.frameId, 'f_test')
  assert.equal(appended.length, 1)
})
