import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveConfig } from '../lib/config.js'
import { WikiSearch } from '../lib/wiki/search.js'

const dataDir = mkdtempSync(join(tmpdir(), 'dsh-lore-wiki-live-'))
const config = resolveConfig({ wiki: { enabled: true, timeoutMs: 12000, maxRetries: 0 } })
const search = new WikiSearch({ config, dataDir })
try {
  for (const [game, query] of [['genshin', '派蒙'], ['hsr', '三月七']]) {
    const result = await search.query(game, query, { limit: 3 })
    console.log(JSON.stringify({
      game,
      query,
      warnings: result.warnings,
      cache: result.cache,
      results: result.results.map((item) => ({ title: item.title, url: item.url, snippet: item.snippet, stale: item.stale }))
    }, null, 2).slice(0, 4000))
  }
} finally {
  rmSync(dataDir, { recursive: true, force: true })
}
