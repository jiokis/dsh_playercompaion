import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConfig } from '../lib/config.js'
import { createQueryTool } from '../lib/tools/query.js'

test('lore_query defaults to all games and serializes wiki calls', async () => {
  const config = resolveConfig({})
  const calls = []
  const logStore = {
    query(game, options) {
      calls.push({ game, options })
      return { entries: [], total: 0, scanned: { files: [], corrupt: 0 } }
    }
  }
  const wikiSearch = { query: async () => ({ results: [], warnings: [] }) }
  const tool = createQueryTool({ config, logStore, wikiSearch })
  const result = await tool.execute({ query: '派蒙', scope: 'log' }, { signal: new AbortController().signal })
  assert.deepEqual(calls.map((call) => call.game), ['genshin', 'hsr'])
  assert.equal(result.log.total, 0)
})

test('lore_query respects an explicit game filter', async () => {
  const config = resolveConfig({})
  const calls = []
  const logStore = {
    query(game) {
      calls.push(game)
      return { entries: [], total: 0, scanned: { files: [], corrupt: 0 } }
    }
  }
  const wikiSearch = { query: async () => ({ results: [], warnings: [] }) }
  const tool = createQueryTool({ config, logStore, wikiSearch })
  await tool.execute({ query: '三月七', game: 'hsr', scope: 'log' }, { signal: new AbortController().signal })
  assert.deepEqual(calls, ['hsr'])
})
