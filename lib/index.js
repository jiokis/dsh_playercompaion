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
import { createStoryTool } from './tools/story.js'
import { LoreWatcher } from './watcher.js'
import { registerWatchRemote } from './watch-remote.js'
import { OverlayManager } from './overlay.js'
import { OverlayActionBridge } from './overlay-bridge.js'
import { AkashaClient } from './sources/akasha.js'
import { WebSource } from './sources/web.js'
import { FrameStore } from './frames.js'
import { ScreenshotStore } from './screenshots.js'
import { loadRoster } from './characters.js'
import { compatibilityReport, registerTool } from './compat.js'

export const name = 'dsh-lore-companion'
export const inject = ['tools', 'attachments']
export { Config }

const VERSION = '0.23.0'
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const ENGINE_DIR = join(PACKAGE_ROOT, 'engine')
const OVERLAY_SCRIPT = join(PACKAGE_ROOT, 'overlay', 'overlay.ps1')

export function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)
  const dataDir = resolveDataDir(config)
  ensureDir(dataDir)
  const logStore = new LogStore({ dataDir })
  // Load the user's character overrides once so speaker names stay stable
  // for every tool in this session. A broken file must not block the plugin.
  try {
    loadRoster({ dataDir })
  } catch { /* fall back to the bundled seeds */ }
  const runtime = createRuntime({ config, engineDir: ENGINE_DIR, dataDir })
  const wikiSearch = new WikiSearch({ config, dataDir })
  const overlay = new OverlayManager({ config, dataDir, scriptPath: OVERLAY_SCRIPT })
  const akasha = new AkashaClient({ config })
  const frames = new FrameStore({ config, dataDir })
  const screenshots = new ScreenshotStore({ dataDir, config })
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
  const deps = { ctx, config, runtime, logStore, wikiSearch, overlay, akasha, web, frames, screenshots, version: VERSION }
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
    },
    onError: async (error, status) => {
      const message = String(error?.message || error)
      if (/foreground/i.test(message)) {
        await overlay.show({
          visible: true,
          preview: true,
          status: '等待游戏',
          game: status.game,
          session: status.session,
          text: '游戏不在前台，当前没有记录。切到游戏窗口后，后台记录才会继续。'
        })
      } else {
        await overlay.update({ visible: true, preview: true, status: '记录失败', text: message.slice(0, 220) })
      }
    }
  })
  deps.watcher = watcher
  const queryTool = createQueryTool(deps)
  const visionTool = createVisionTool(deps)
  // Host surfaces move between DSH releases; register through the compat layer
  // so a renamed optional service degrades instead of aborting apply().
  const compat = compatibilityReport(ctx)
  const registrationWarnings = []
  for (const spec of [
    createStatusTool(deps),
    captureTool,
    queryTool,
    createNarrateTool(deps),
    createOverlayTool(deps),
    visionTool,
    createWatchTool({ config, watcher }),
    createStoryTool({ config, logStore, dataDir })
  ]) {
    registerTool(ctx, spec, registrationWarnings)
  }
  for (const warning of [...compat.warnings, ...registrationWarnings]) {
    try { ctx.logger?.warn?.('[dsh-lore-companion] ' + warning) } catch { /* logging is best effort */ }
  }
  // Optional subsystems must never take the tools down with them: the composer
  // button and the overlay are conveniences, the tools are the product.
  const warn = (message) => {
    try { ctx.logger?.warn?.('[dsh-lore-companion] ' + message) } catch { /* logging is best effort */ }
  }
  try {
    registerWatchRemote(ctx, watcher, logStore, screenshots, dataDir)
  } catch (error) {
    warn('recording remote unavailable: ' + (error?.message || error))
  }
  let overlayBridge = null
  try {
    overlayBridge = new OverlayActionBridge({ config, dataDir, runtime, capture: captureTool, vision: visionTool, query: queryTool, overlay, screenshots })
    overlayBridge.start()
  } catch (error) {
    warn('overlay bridge unavailable: ' + (error?.message || error))
  }
  try {
    runtime.start()
  } catch (error) {
    warn('engine bootstrap deferred: ' + (error?.message || error))
  }
  if (typeof ctx.on === 'function') {
    ctx.on('dispose', () => {
      try { overlayBridge?.dispose() } catch { /* ignore */ }
      try { watcher.dispose() } catch { /* ignore */ }
      try { overlay.dispose() } catch { /* ignore */ }
      runtime.dispose()
    })
  }
}
