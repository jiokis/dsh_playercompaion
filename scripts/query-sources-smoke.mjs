import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveConfig } from '../lib/config.js'
import { LogStore } from '../lib/store/log.js'
import { AkashaClient } from '../lib/sources/akasha.js'
import { WebSource } from '../lib/sources/web.js'
import { createQueryTool } from '../lib/tools/query.js'

const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-query-'))
const config = resolveConfig({ dataDir: dir })
const logStore = new LogStore({ dataDir: dir })
const wikiSearch = { query: async () => ({ results: [], warnings: [] }), stats: () => [] }
const akasha = new AkashaClient({ config })
const web = new WebSource({ config, getWeb: () => ({ search: async () => ({ content: 'web summary', sources: [{ url: 'https://example.com/kath', title: 'Katheryne', snippet: 'Adventurers Guild' }] }) }) })
const tool = createQueryTool({ config, logStore, wikiSearch, akasha, web })
const result = await tool.execute({ query: '凯瑟琳', game: 'genshin', sources: ['akasha', 'web'], limit: 3 }, { signal: new AbortController().signal })
console.log(JSON.stringify({ sources: result.sources, akasha: result.akasha.results.map((x) => ({ title: x.title, pathHash: x.pathHash })), web: result.web.results.map((x) => x.url), warnings: result.warnings }, null, 2))
rmSync(dir, { recursive: true, force: true })
