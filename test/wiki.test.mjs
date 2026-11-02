import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WikiCache } from '../lib/wiki/cache.js'
import { WikiClient } from '../lib/wiki/client.js'
import { WikiSearch, htmlToText } from '../lib/wiki/search.js'
import { resolveConfig } from '../lib/config.js'

function jsonResponse(value) {
  return {
    status: 200,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify(value)
  }
}

function mockFetch(counter = {}) {
  return async (url) => {
    counter.calls = (counter.calls || 0) + 1
    if (String(url).includes('list=search')) {
      return jsonResponse({ query: { search: [{ title: '派蒙' }], searchinfo: { totalhits: 1 } } })
    }
    if (String(url).includes('action=parse')) {
      return jsonResponse({ parse: { title: '派蒙', pageid: 1, revid: 2, text: '<div class="mw-parser-output"><p>派蒙是旅行者的向导。</p><script>bad()</script></div>' } })
    }
    return jsonResponse({})
  }
}

test('htmlToText strips scripts and decodes entities', () => {
  const value = htmlToText('<div class="mw-parser-output"><p>派蒙&nbsp;是<br>向导</p><script>x</script></div>')
  assert.ok(value.includes('派蒙'))
  assert.ok(value.includes('向导'))
  assert.ok(!value.includes('script'))
})

test('WikiCache writes atomically and respects maxPages', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-wiki-'))
  try {
    const cache = new WikiCache({ dataDir: dir, game: 'genshin', maxPages: 1 })
    assert.equal(cache.writePage('派蒙', { text: '向导', revid: 1, fetchedAt: new Date().toISOString() }).ok, true)
    assert.equal(cache.readPage('派蒙').text, '向导')
    assert.equal(cache.stats().pages, 1)
    const second = cache.writePage('钟离', { text: '契约', revid: 2, fetchedAt: new Date().toISOString() })
    assert.equal(second.ok, false)
    assert.equal(second.reason, 'cache_full')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('WikiClient performs search and parse without throwing', async () => {
  const counter = {}
  const client = new WikiClient({
    api: 'https://example.test/api.php',
    pageBase: 'https://example.test/',
    fetchImpl: mockFetch(counter),
    sleepImpl: async () => {}
  })
  const search = await client.search('派蒙', 5)
  assert.equal(search.ok, true)
  assert.deepEqual(search.titles, ['派蒙'])
  const parsed = await client.parse('派蒙')
  assert.equal(parsed.ok, true)
  assert.ok(parsed.html.includes('向导'))
  assert.equal(counter.calls, 2)
})

test('WikiSearch fetches on demand, caches, and falls back on WAF', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-wikisearch-'))
  try {
    const config = resolveConfig({ wiki: { enabled: true, requestIntervalMs: 2000 } })
    const search = new WikiSearch({ config, dataDir: dir, fetchImpl: mockFetch(), sleepImpl: async () => {} })
    const first = await search.query('genshin', '派蒙', { limit: 5 })
    assert.equal(first.results.length, 1)
    assert.ok(first.results[0].url.includes('wiki.biligame.com'))
    assert.equal(first.cache.pages, 1)
    const wafConfig = resolveConfig({ wiki: { enabled: true } })
    const wafSearch = new WikiSearch({
      config: wafConfig,
      dataDir: dir,
      fetchImpl: async () => ({ status: 200, headers: { get: () => 'text/html' }, text: async () => '<html><style>x</style>blocked</html>' }),
      sleepImpl: async () => {}
    })
    const waf = await wafSearch.query('hsr', '不存在', { limit: 5 })
    assert.deepEqual(waf.results, [])
    assert.ok(waf.warnings.includes('wiki_unavailable'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
