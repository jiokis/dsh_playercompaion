import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConfig } from '../lib/config.js'
import { createVisionTool } from '../lib/tools/vision.js'

const ANALYSIS = {
  mode: 'all',
  findings: [{ kind: 'composition', label: '涓讳綋鍖哄煙', short: 'subject', score: 0.8, box: { x: 0.2, y: 0.2, w: 0.4, h: 0.5 } }],
  metrics: { balance: 0.8, panelCount: 1, poiCandidates: 2, mapLikelihood: 0.4 },
  warnings: ['map likelihood is low']
}

test('lore_vision analyzes a local image and attaches the annotated frame', async () => {
  const config = resolveConfig({})
  const calls = []
  const runtime = {
    request: async (method, params) => {
      calls.push({ method, params })
      return { analysis: ANALYSIS, image: 'YWJj', warnings: ['low confidence'] }
    }
  }
  const ctx = { attachments: { saveImage: async ({ data, mediaType }) => ({ attachmentId: 'a1', bytes: data.length, mediaType }) } }
  const tool = createVisionTool({ config, runtime, ctx })
  const result = await tool.execute({ mode: 'composition', imagePath: 'icon.png', includeImage: true }, { signal: new AbortController().signal })
  assert.equal(calls[0].method, 'analyze_image')
  assert.equal(calls[0].params.vision_mode, 'composition')
  assert.ok(calls[0].params.image_b64.length > 100)
  assert.equal(result.source, 'image')
  assert.equal(result.analysis.mode, 'all')
  assert.equal(result.attachment.attachmentId, 'a1')
  assert.ok(result.warnings.includes('low confidence'))
})

test('lore_vision can analyze an archived frame by frameId', async () => {
  const config = resolveConfig({})
  const calls = []
  const runtime = {
    request: async (method, params) => {
      calls.push({ method, params })
      return { width: 640, height: 360, analysis: ANALYSIS, image: null, warnings: [] }
    }
  }
  const frames = {
    read: (id) => id === 'f_20261102-120000-abcdef' ? { id, metadata: { game: 'genshin' }, path: 'D:/frames/f.png', base64: Buffer.from('frame').toString('base64') } : null
  }
  const tool = createVisionTool({ config, runtime, ctx: {}, frames })
  const result = await tool.execute({ frameId: 'f_20261102-120000-abcdef', mode: 'ui' }, { signal: new AbortController().signal })
  assert.equal(result.source, 'frame')
  assert.equal(result.frameId, 'f_20261102-120000-abcdef')
  assert.equal(result.game, 'genshin')
  assert.equal(calls[0].method, 'analyze_image')
  assert.equal(calls[0].params.vision_mode, 'ui')
  await assert.rejects(() => tool.execute({ frameId: 'missing' }, {}), /not found/)
})

test('lore_vision live mode forwards capture/foreground parameters', async () => {
  const config = resolveConfig({})
  const calls = []
  const runtime = {
    request: async (method, params) => {
      calls.push({ method, params })
      return { game: 'genshin', analysis: ANALYSIS, image: null, warnings: [] }
    }
  }
  const ctx = { attachments: { saveImage: async () => ({ attachmentId: 'x' }) } }
  const tool = createVisionTool({ config, runtime, ctx })
  const result = await tool.execute({ mode: 'ui', game: 'genshin' }, { signal: new AbortController().signal })
  assert.equal(calls[0].method, 'vision')
  assert.equal(calls[0].params.vision_mode, 'ui')
  assert.equal(calls[0].params.require_foreground, true)
  assert.equal(result.source, 'screen')
  assert.equal(result.game, 'genshin')
  assert.equal(result.attachment, null)
})

test('lore_vision semantic mode requests OCR text', async () => {
  const config = resolveConfig({})
  let params = null
  const runtime = { request: async (method, value) => { params = value; return { analysis: { ...ANALYSIS, metrics: { ...ANALYSIS.metrics, scene: 'dialogue', textBlocks: 2 } }, image: null, warnings: [] } } }
  const tool = createVisionTool({ config, runtime, ctx: {} })
  const result = await tool.execute({ mode: 'semantic', imagePath: 'icon.png' }, { signal: new AbortController().signal })
  assert.equal(params.include_text, true)
  assert.equal(result.analysis.metrics.scene, 'dialogue')
})

test('lore_vision rejects disabled mode and invalid image path', async () => {
  const config = resolveConfig({ vision: { enabled: false } })
  const tool = createVisionTool({ config, runtime: { request: async () => { throw new Error('should not call') } }, ctx: {} })
  await assert.rejects(() => tool.execute({ mode: 'composition' }, {}), /disabled/)
  const enabled = createVisionTool({ config: resolveConfig({}), runtime: { request: async () => { throw new Error('should not call') } }, ctx: {} })
  await assert.rejects(() => enabled.execute({ imagePath: 'D:/nope.txt' }, {}), /png/)
})
