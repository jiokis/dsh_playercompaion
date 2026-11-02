import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConfig } from '../lib/config.js'
import { AkashaClient, parseAkashaSearch } from '../lib/sources/akasha.js'
import { WebSource } from '../lib/sources/web.js'
import { createQueryTool } from '../lib/tools/query.js'

const SEARCH_TEXT = [
  '[akasha_search]',
  '查询: 凯瑟琳',
  '命中 2 个文件',
  '书名命中 1 条',
  '- npc-6401908-凯瑟琳 | doc_88a420d646ec | 6行 | 来源=游戏内文本（中文） | [17-大世界对话/08-自由对白]',
  '内容命中 1 条',
  '- 第三章-第二幕-千朵玫瑰带来的黎明 | doc_4caccc1b78f5 | 3123行 | 来源=米游社Wiki | [任务/魔神任务]',
  '  L2925: - **触发条件**: 无 - **起始NPC**: 凯瑟琳',
  '  L2942: > 与「凯瑟琳」对话',
  '知识图谱:',
  '- 凯瑟琳'
].join('\n')

test('parseAkashaSearch extracts pathHash, kind and snippets', () => {
  const results = parseAkashaSearch(SEARCH_TEXT, 5)
  assert.equal(results.length, 2)
  assert.equal(results[0].kind, 'content')
  assert.equal(results[0].pathHash, 'doc_4caccc1b78f5')
  assert.match(results[0].snippet, /凯瑟琳/)
  assert.equal(results[1].kind, 'book')
  assert.equal(results[1].pathHash, 'doc_88a420d646ec')
})

test('AkashaClient initializes and calls akasha_search through MCP JSON-RPC', async () => {
  const config = resolveConfig({})
  const calls = []
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url, body, headers: init.headers })
    if (body.method === 'initialize') {
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'Story MCP' } } })
      }
    }
    return {
      ok: true,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: SEARCH_TEXT }], isError: false } })
    }
  }
  const client = new AkashaClient({ config, fetchImpl })
  const result = await client.search({ game: 'genshin', query: '凯瑟琳', limit: 2 })
  assert.equal(result.results.length, 2)
  assert.equal(calls[0].body.method, 'initialize')
  assert.equal(calls[1].body.method, 'tools/call')
  assert.equal(calls[1].body.params.name, 'akasha_search')
  assert.deepEqual(calls[1].body.params.arguments, { world: 'gi', keyword: '凯瑟琳', maxResults: 2 })
  assert.equal(calls[1].url, 'https://agent.zlb.ink/api/mcp/')
})

test('AkashaClient returns warnings instead of throwing on transport failure', async () => {
  const config = resolveConfig({ sources: { akasha: { enabled: true, url: 'https://example.invalid/mcp' } } })
  const client = new AkashaClient({ config, fetchImpl: async () => { throw new Error('offline') } })
  const result = await client.search({ game: 'hsr', query: '三月七', limit: 2 })
  assert.equal(result.results.length, 0)
  assert.ok(result.warnings.some((item) => item.includes('akasha_error')))
})

test('WebSource maps ctx.web.search sources and degrades cleanly', async () => {
  const config = resolveConfig({})
  const source = new WebSource({
    config,
    getWeb: () => ({
      search: async ({ query, maxResults }) => {
        assert.equal(query, '凯瑟琳')
        assert.equal(maxResults, 3)
        return {
          content: 'Katheryne is the Adventurers\' Guild receptionist.',
          sources: [{ url: 'https://example.com/katheryne', title: 'Katheryne', snippet: 'receptionist' }]
        }
      }
    })
  })
  const result = await source.search({ query: '凯瑟琳', limit: 3 })
  assert.equal(result.results[0].url, 'https://example.com/katheryne')
  assert.match(result.content, /Adventurers/)
  const missing = new WebSource({ config, getWeb: () => null })
  const empty = await missing.search({ query: 'x', limit: 1 })
  assert.match(empty.warnings[0], /web_unavailable/)
})

test('lore_query fans out to log, wiki, akasha and web', async () => {
  const config = resolveConfig({})
  const seen = []
  const logStore = {
    query: () => ({ entries: [], total: 0, scanned: { files: [], corrupt: 0 } })
  }
  const wikiSearch = { query: async () => ({ results: [], warnings: [] }) }
  const akasha = { search: async (options) => { seen.push(['akasha', options]); return { results: [{ title: 'Akasha result' }], warnings: [] } } }
  const web = { search: async (options) => { seen.push(['web', options]); return { results: [{ url: 'https://example.com' }], warnings: [] } } }
  const tool = createQueryTool({ config, logStore, wikiSearch, akasha, web })
  const result = await tool.execute({ query: '凯瑟琳', scope: 'all' }, { signal: new AbortController().signal })
  assert.deepEqual(result.sources, ['log', 'wiki', 'akasha', 'web'])
  assert.equal(result.akasha.results[0].title, 'Akasha result')
  assert.equal(result.web.results[0].url, 'https://example.com')
  assert.deepEqual(seen.map((item) => item[0]).sort(), ['akasha', 'web'])
})
