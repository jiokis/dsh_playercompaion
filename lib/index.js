import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Config, resolveConfig } from './config.js'
import { ensureDir, resolveDataDir } from './paths.js'
import { LogStore } from './store/log.js'
import { createRuntime } from './runtime.js'
import { WikiSearch } from './wiki/search.js'
import { createStatusTool } from './tools/status.js'
import { createCaptureTool } from './tools/capture.js'
import { createQueryTool } from './tools/query.js'
import { createNarrateTool } from './tools/narrate.js'
import { createOverlayTool } from './tools/overlay.js'
import { createVisionTool } from './tools/vision.js'
import { OverlayManager } from './overlay.js'
import { AkashaClient } from './sources/akasha.js'
import { WebSource } from './sources/web.js'
import { FrameStore } from './frames.js'

export const name = 'dsh-lore-companion'
export const inject = ['tools', 'attachments']
export { Config }

const VERSION = '0.4.0'
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const ENGINE_DIR = join(PACKAGE_ROOT, 'engine')
const OVERLAY_SCRIPT = join(PACKAGE_ROOT, 'overlay', 'overlay.ps1')

export function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)
  const dataDir = resolveDataDir(config)
  ensureDir(dataDir)
  const logStore = new LogStore({ dataDir })
  const runtime = createRuntime({ config, engineDir: ENGINE_DIR, dataDir })
  const wikiSearch = new WikiSearch({ config, dataDir })
  const overlay = new OverlayManager({ config, dataDir, scriptPath: OVERLAY_SCRIPT })
  const akasha = new AkashaClient({ config })
  const frames = new FrameStore({ config, dataDir })
  const web = new WebSource({
    config,
    getWeb: () => {
      try {
        if (ctx.web) return ctx.web
        return typeof ctx.get === 'function' ? ctx.get('web') : null
      } catch {
        return null
      }
    }
  })
  const deps = { ctx, config, runtime, logStore, wikiSearch, overlay, akasha, web, frames, version: VERSION }
  ctx.tools.register(createStatusTool(deps))
  ctx.tools.register(createCaptureTool(deps))
  ctx.tools.register(createQueryTool(deps))
  ctx.tools.register(createNarrateTool(deps))
  ctx.tools.register(createOverlayTool(deps))
  ctx.tools.register(createVisionTool(deps))
  runtime.start()
  if (typeof ctx.on === 'function') {
    ctx.on('dispose', () => {
      try { overlay.dispose() } catch { /* ignore */ }
      runtime.dispose()
    })
  }
}
