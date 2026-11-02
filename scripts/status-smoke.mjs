import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveConfig } from '../lib/config.js'
import { LogStore } from '../lib/store/log.js'
import { createRuntime } from '../lib/runtime.js'
import { WikiSearch } from '../lib/wiki/search.js'
import { createStatusTool } from '../lib/tools/status.js'

const dataDir = mkdtempSync(join(tmpdir(), 'dsh-lore-status-'))
const engineDir = new URL('../engine', import.meta.url).pathname.replace(/^\//, '')
const config = resolveConfig({ dataDir })
const runtime = createRuntime({ config, engineDir, dataDir })
const logStore = new LogStore({ dataDir })
const wikiSearch = new WikiSearch({ config, dataDir })
const ctx = { attachments: { saveImage: async () => ({ attachmentId: 'x' }) } }
const tool = createStatusTool({ config, runtime, logStore, wikiSearch, ctx, version: '0.4.0' })
try {
  const result = await tool.execute({}, { signal: new AbortController().signal })
  console.log(JSON.stringify({
    plugin: result.plugin,
    version: result.version,
    engine: result.engine,
    ocr: result.ocr,
    games: result.games,
    dataDir: result.dataDir,
    wiki: result.wiki,
    sources: result.sources,
    warnings: result.warnings
  }, null, 2).slice(0, 6000))
} catch (error) {
  console.error('FAILED ' + error.message)
  process.exitCode = 1
} finally {
  runtime.dispose()
  rmSync(dataDir, { recursive: true, force: true })
}
