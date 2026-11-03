import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConfig } from '../lib/config.js'
import { createStatusTool } from '../lib/tools/status.js'

test('lore_status returns a string previewError and watch status', async () => {
  const config = resolveConfig({})
  const runtime = {
    start() {},
    status() { return { status: 'ready' } },
    ensure: async () => ({
      request: async () => ({ games: {}, ocr: { ready: true }, warnings: [] })
    })
  }
  const logStore = { dataDir: 'D:/tmp', sessions: () => [] }
  const wikiSearch = { stats: () => [] }
  const overlay = { status: () => ({ running: false, state: { visible: false } }) }
  const frames = { list: () => [] }
  const watcher = { status: () => ({ enabled: true, running: false, intervalSec: 8, ticks: 0 }) }
  const tool = createStatusTool({ config, runtime, logStore, wikiSearch, ctx: {}, overlay, frames, watcher, version: '0.5.1' })
  const result = await tool.execute({ game: 'genshin' }, { signal: new AbortController().signal })
  assert.equal(typeof result.previewError, 'string')
  assert.equal(result.previewError, '')
  assert.equal(result.watch.running, false)
})
