import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveConfig } from '../lib/config.js'
import { LogStore } from '../lib/store/log.js'
import { createRuntime } from '../lib/runtime.js'
import { createCaptureTool } from '../lib/tools/capture.js'

const dataDir = mkdtempSync(join(tmpdir(), 'dsh-lore-capture-'))
const engineDir = new URL('../engine', import.meta.url).pathname.replace(/^\//, '')
const config = resolveConfig({ dataDir, engine: { waitMs: 30000 } })
const runtime = createRuntime({ config, engineDir, dataDir })
const logStore = new LogStore({ dataDir })
const ctx = { attachments: { saveImage: async () => ({ attachmentId: 'x' }) } }
const tool = createCaptureTool({ config, runtime, logStore, ctx })
try {
  const result = await tool.execute({ game: 'auto' }, { signal: new AbortController().signal })
  console.log('UNEXPECTED', JSON.stringify(result).slice(0, 1000))
} catch (error) {
  console.log('EXPECTED_ERROR ' + error.name + ': ' + error.message)
} finally {
  runtime.dispose()
  rmSync(dataDir, { recursive: true, force: true })
}
