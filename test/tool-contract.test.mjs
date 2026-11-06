import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConfig } from '../lib/config.js'
import { createStatusTool } from '../lib/tools/status.js'
import { createCaptureTool } from '../lib/tools/capture.js'
import { createQueryTool } from '../lib/tools/query.js'
import { createNarrateTool } from '../lib/tools/narrate.js'
import { createOverlayTool } from '../lib/tools/overlay.js'
import { createVisionTool } from '../lib/tools/vision.js'
import { createWatchTool } from '../lib/tools/watch.js'
import { createStoryTool } from '../lib/tools/story.js'

const config = resolveConfig({})
const runtime = {
  start() {},
  status() { return { status: 'ready' } },
  ensure: async () => ({ request: async () => ({}) }),
  request: async () => ({ analysis: {}, warnings: [] })
}
const logStore = {
  dataDir: 'D:/tmp',
  sessions: () => [],
  recent: () => [],
  query: () => ({ entries: [], total: 0 })
}
const wikiSearch = { stats: () => [], query: async () => ({ results: [], warnings: [] }) }
const overlay = {
  statePath: 'D:/tmp/overlay/state.json',
  logPath: 'D:/tmp/overlay/overlay.log',
  show: async () => ({ ok: true, running: true, pid: 1 }),
  hide: async () => ({ ok: true, running: false, state: { visible: false } }),
  status: () => ({ running: false, pid: null, state: { visible: false } })
}
const ctx = { attachments: { saveImage: async () => ({ attachmentId: 'a' }) } }
const watcher = {
  status: () => ({ enabled: true, running: false, intervalSec: 8, ticks: 0 }),
  start: async () => ({ enabled: true, running: true, intervalSec: 8, ticks: 1 }),
  stop: () => ({ enabled: true, running: false, intervalSec: 8, ticks: 1 })
}

test('tool definitions satisfy the host defineTool contract', () => {
  const tools = [
    createStatusTool({ config, runtime, logStore, wikiSearch, ctx, overlay, watcher, version: '0.14.0' }),
    createCaptureTool({ config, runtime, logStore, ctx, overlay }),
    createQueryTool({ config, logStore, wikiSearch }),
    createNarrateTool({ config, logStore, wikiSearch }),
    createOverlayTool({ config, overlay }),
    createVisionTool({ config, runtime, ctx }),
    createWatchTool({ config, watcher }),
    createStoryTool({ config, logStore, dataDir: 'D:/tmp' })
  ]
  for (const tool of tools) {
    assert.equal(typeof tool.name, 'string')
    assert.equal(typeof tool.description, 'string')
    assert.equal(typeof tool.execute, 'function')
    assert.ok(tool.parameters && typeof tool.parameters === 'object')
    assert.ok(tool.output && tool.output.schema && typeof tool.output.render === 'function')
  }
  assert.deepEqual(tools.map((tool) => tool.name), ['lore_status', 'lore_capture', 'lore_query', 'lore_narrate', 'lore_overlay', 'lore_vision', 'lore_watch', 'lore_story'])
})
