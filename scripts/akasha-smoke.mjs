import { resolveConfig } from '../lib/config.js'
import { AkashaClient } from '../lib/sources/akasha.js'

const config = resolveConfig({})
const client = new AkashaClient({ config })
const result = await client.search({ game: 'genshin', query: '凯瑟琳', limit: 3 })
console.log(JSON.stringify({ count: result.results.length, warnings: result.warnings, results: result.results.map((x) => ({ title: x.title, pathHash: x.pathHash, kind: x.kind, snippet: x.snippet.slice(0, 120) })) }, null, 2))
