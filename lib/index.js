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
import { createWatchTool } from './tools/watch.js'
import { LoreWatcher } from './watcher.js'
import { registerWatchRemote } from './watch-remote.js'
import { registerJournalRemote } from './journal-remote.js'
import { OverlayManager } from './overlay.js'
import { OverlayActionBridge } from './overlay-bridge.js'
import { AkashaClient } from './sources/akasha.js'
import { WebSource } from './sources/web.js'
import { FrameStore } from './frames.js'

export const name = 'dsh-lore-companion'
export const inject = ['tools', 'attachments']
export { Config }

const VERSION = '0.7.1'
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
  const captureTool = createCaptureTool(deps)
  const watcher = new LoreWatcher({
    config,
    capture: captureTool,
    onStart: async (status) => {
      await overlay.show({
        visible: true,
        preview: true,
        status: '等待对话',
        game: status.game,
        session: status.session,
        text: '后台记录已启动；切到原神保持对话，抓到的台词会显示在这里。'
      })
    },
    onStop: async () => {
      await overlay.update({ visible: false })
    }
  })
  deps.watcher = watcher
  const queryTool = createQueryTool(deps)
  const visionTool = createVisionTool(deps)
  ctx.tools.register(createStatusTool(deps))
  ctx.tools.register(captureTool)
  ctx.tools.register(queryTool)
  ctx.tools.register(createNarrateTool(deps))
  ctx.tools.register(createOverlayTool(deps))
  ctx.tools.register(visionTool)
  ctx.tools.register(createWatchTool({ config, watcher }))
  registerWatchRemote(ctx, watcher)
  registerJournalRemote(ctx, logStore)
  const overlayBridge = new OverlayActionBridge({ config, dataDir, runtime, capture: captureTool, vision: visionTool, query: queryTool, overlay })
  overlayBridge.start()
  runtime.start()
  if (typeof ctx.on === 'function') {
    ctx.on('dispose', () => {
      try { overlayBridge.dispose() } catch { /* ignore */ }
      try { watcher.dispose() } catch { /* ignore */ }
      try { overlay.dispose() } catch { /* ignore */ }
      runtime.dispose()
    })
  }
}
