import Schema from '@deepseek-ai/schemastery'

const REGION_DEFAULTS = {
  genshin: { x: 0.08, y: 0.62, w: 0.84, h: 0.34 },
  hsr: { x: 0.06, y: 0.6, w: 0.88, h: 0.36 }
}

export const DEFAULTS = {
  dataDir: '',
  language: 'zh-CN',
  engine: {
    uv: '',
    python: '',
    cacheDir: '',
    pythonVersion: '3.12',
    installTimeoutMs: 900000,
    waitMs: 30000
  },
  capture: {
    settleMs: 350,
    maxSettleMs: 1200,
    minScore: 0.5,
    ocrMaxSide: 960,
    occlusionThreshold: 0.2,
    forceWhenNotForeground: false,
    outputIndex: null,
    backend: 'auto'
  },
  regions: {
    genshin: { ...REGION_DEFAULTS.genshin },
    hsr: { ...REGION_DEFAULTS.hsr }
  },
  dedupe: { windowMinutes: 10, similarity: 0.9, compareLast: 30 },
  wiki: {
    enabled: true,
    requestIntervalMs: 2000,
    timeoutMs: 12000,
    maxRetries: 1,
    maxPages: 300,
    cacheTtlDays: 7,
    maxPageBytes: 262144,
    snippetChars: 400,
    sources: {
      genshin: { api: 'https://wiki.biligame.com/ys/api.php', pageBase: 'https://wiki.biligame.com/ys/' },
      hsr: { api: 'https://wiki.biligame.com/sr/api.php', pageBase: 'https://wiki.biligame.com/sr/' }
    }
  },
  narrate: {
    defaultLast: 20,
    maxLast: 100,
    defaultStyle: '陪玩解说',
    sceneGapSeconds: 120,
    maxChars: 800
  },
  overlay: {
    enabled: true,
    autoShow: true,
    position: 'top-right',
    width: 480,
    height: 220,
    margin: 28,
    opacity: 0.95,
    autoHideOnGameLost: true
  },
  sources: {
    akasha: {
      enabled: true,
      url: 'https://agent.zlb.ink/api/mcp/',
      timeoutMs: 12000,
      maxResults: 5
    },
    web: {
      enabled: true,
      maxResults: 5
    }
  },
  vision: {
    enabled: true,
    maxFindings: 12,
    includeText: true
  },
  frames: {
    enabled: false,
    saveOnCapture: true,
    saveVision: true,
    maxFrames: 200,
    retentionDays: 7
  },
  watch: {
    enabled: true,
    intervalSec: 8
  }
}

const regionSchema = Schema.object({
  x: Schema.number().default(0.08),
  y: Schema.number().default(0.62),
  w: Schema.number().default(0.84),
  h: Schema.number().default(0.34)
})

export const Config = Schema.object({
  dataDir: Schema.string().default(''),
  language: Schema.string().default('zh-CN'),
  engine: Schema.object({
    uv: Schema.string().default(''),
    python: Schema.string().default(''),
    cacheDir: Schema.string().default(''),
    pythonVersion: Schema.string().default('3.12'),
    installTimeoutMs: Schema.number().default(900000),
    waitMs: Schema.number().default(30000)
  }).default(DEFAULTS.engine),
  capture: Schema.object({
    settleMs: Schema.number().default(350),
    maxSettleMs: Schema.number().default(1200),
    minScore: Schema.number().default(0.5),
    ocrMaxSide: Schema.number().default(960),
    occlusionThreshold: Schema.number().default(0.2),
    forceWhenNotForeground: Schema.boolean().default(false),
    outputIndex: Schema.number(),
    backend: Schema.union(['auto', 'dxcam', 'mss']).default('auto')
  }).default(DEFAULTS.capture),
  regions: Schema.object({
    genshin: regionSchema.default(REGION_DEFAULTS.genshin),
    hsr: regionSchema.default(REGION_DEFAULTS.hsr)
  }).default(DEFAULTS.regions),
  dedupe: Schema.object({
    windowMinutes: Schema.number().default(10),
    similarity: Schema.number().default(0.9),
    compareLast: Schema.number().default(30)
  }).default(DEFAULTS.dedupe),
  wiki: Schema.object({
    enabled: Schema.boolean().default(true),
    requestIntervalMs: Schema.number().default(2000),
    timeoutMs: Schema.number().default(12000),
    maxRetries: Schema.number().default(1),
    maxPages: Schema.number().default(300),
    cacheTtlDays: Schema.number().default(7),
    maxPageBytes: Schema.number().default(262144),
    snippetChars: Schema.number().default(400),
    sources: Schema.object({
      genshin: Schema.object({
        api: Schema.string().default(DEFAULTS.wiki.sources.genshin.api),
        pageBase: Schema.string().default(DEFAULTS.wiki.sources.genshin.pageBase)
      }).default(DEFAULTS.wiki.sources.genshin),
      hsr: Schema.object({
        api: Schema.string().default(DEFAULTS.wiki.sources.hsr.api),
        pageBase: Schema.string().default(DEFAULTS.wiki.sources.hsr.pageBase)
      }).default(DEFAULTS.wiki.sources.hsr)
    }).default(DEFAULTS.wiki.sources)
  }).default(DEFAULTS.wiki),
  narrate: Schema.object({
    defaultLast: Schema.number().default(20),
    maxLast: Schema.number().default(100),
    defaultStyle: Schema.union(['陪玩解说', '剧情复盘', '冷知识吐槽']).default('陪玩解说'),
    sceneGapSeconds: Schema.number().default(120),
    maxChars: Schema.number().default(800)
  }).default(DEFAULTS.narrate),
  overlay: Schema.object({
    enabled: Schema.boolean().default(true),
    autoShow: Schema.boolean().default(true),
    position: Schema.union(['top-right', 'top-left', 'bottom-center']).default('top-right'),
    width: Schema.number().default(480),
    height: Schema.number().default(220),
    margin: Schema.number().default(28),
    opacity: Schema.number().default(0.95),
    autoHideOnGameLost: Schema.boolean().default(true)
  }).default(DEFAULTS.overlay),
  sources: Schema.object({
    akasha: Schema.object({
      enabled: Schema.boolean().default(true),
      url: Schema.string().default(DEFAULTS.sources.akasha.url),
      timeoutMs: Schema.number().default(12000),
      maxResults: Schema.number().default(5)
    }).default(DEFAULTS.sources.akasha),
    web: Schema.object({
      enabled: Schema.boolean().default(true),
      maxResults: Schema.number().default(5)
    }).default(DEFAULTS.sources.web)
  }).default(DEFAULTS.sources),
  vision: Schema.object({
    enabled: Schema.boolean().default(true),
    maxFindings: Schema.number().default(12),
    includeText: Schema.boolean().default(true)
  }).default(DEFAULTS.vision),
  frames: Schema.object({
    enabled: Schema.boolean().default(false),
    saveOnCapture: Schema.boolean().default(true),
    saveVision: Schema.boolean().default(true),
    maxFrames: Schema.number().default(200),
    retentionDays: Schema.number().default(7)
  }).default(DEFAULTS.frames),
  watch: Schema.object({
    enabled: Schema.boolean().default(true),
    intervalSec: Schema.number().default(8)
  }).default(DEFAULTS.watch)
}).volatile()

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function deepMerge(base, patch) {
  if (!isPlainObject(base)) return patch === undefined ? base : patch
  const out = { ...base }
  if (!isPlainObject(patch)) return out
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    out[key] = isPlainObject(value) && isPlainObject(out[key]) ? deepMerge(out[key], value) : value
  }
  return out
}

function normalizeRegion(value, fallback) {
  const region = deepMerge(fallback, isPlainObject(value) ? value : {})
  const x = Number(region.x)
  const y = Number(region.y)
  const w = Number(region.w)
  const h = Number(region.h)
  if (![x, y, w, h].every(Number.isFinite) || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1 || y + h > 1) {
    throw new Error('invalid capture region: x/y/w/h must be normalized to 0..1 and stay inside the frame')
  }
  return { x, y, w, h }
}

export function resolveConfig(raw = {}, env = process.env) {
  const unwrapped = raw && typeof raw.get === 'function' ? raw.get() : raw
  const source = isPlainObject(unwrapped) ? unwrapped : {}
  const merged = deepMerge(DEFAULTS, source)
  if (env.DSH_LORE_UV) merged.engine.uv = env.DSH_LORE_UV
  if (env.DSH_LORE_PYTHON) merged.engine.python = env.DSH_LORE_PYTHON
  if (env.DSH_LORE_ENGINE_DIR) merged.engine.engineDir = env.DSH_LORE_ENGINE_DIR
  merged.regions = {
    genshin: normalizeRegion(merged.regions?.genshin, REGION_DEFAULTS.genshin),
    hsr: normalizeRegion(merged.regions?.hsr, REGION_DEFAULTS.hsr)
  }
  merged.capture.settleMs = Math.max(100, Number(merged.capture.settleMs) || 350)
  merged.capture.maxSettleMs = Math.max(merged.capture.settleMs, Number(merged.capture.maxSettleMs) || 1200)
  merged.capture.minScore = Math.min(0.99, Math.max(0, Number(merged.capture.minScore) || 0.5))
  merged.capture.occlusionThreshold = Math.min(1, Math.max(0, Number(merged.capture.occlusionThreshold) || 0.2))
  merged.engine.waitMs = Math.max(1000, Number(merged.engine.waitMs) || 30000)
  merged.engine.installTimeoutMs = Math.max(30000, Number(merged.engine.installTimeoutMs) || 900000)
  merged.wiki.requestIntervalMs = Math.max(1500, Number(merged.wiki.requestIntervalMs) || 2000)
  merged.wiki.timeoutMs = Math.max(2000, Number(merged.wiki.timeoutMs) || 12000)
  merged.wiki.maxRetries = Math.max(0, Math.floor(Number(merged.wiki.maxRetries) || 1))
  merged.wiki.maxPages = Math.max(1, Math.floor(Number(merged.wiki.maxPages) || 300))
  merged.wiki.snippetChars = Math.max(80, Math.floor(Number(merged.wiki.snippetChars) || 400))
  merged.dedupe.windowMinutes = Math.max(1, Number(merged.dedupe.windowMinutes) || 10)
  merged.dedupe.similarity = Math.min(0.99, Math.max(0.5, Number(merged.dedupe.similarity) || 0.9))
  merged.dedupe.compareLast = Math.max(1, Math.floor(Number(merged.dedupe.compareLast) || 30))
  merged.narrate.defaultLast = Math.max(1, Math.floor(Number(merged.narrate.defaultLast) || 20))
  merged.narrate.maxLast = Math.max(merged.narrate.defaultLast, Math.floor(Number(merged.narrate.maxLast) || 100))
  merged.narrate.sceneGapSeconds = Math.max(10, Number(merged.narrate.sceneGapSeconds) || 120)
  merged.narrate.maxChars = Math.max(120, Math.floor(Number(merged.narrate.maxChars) || 800))
  merged.overlay.width = Math.min(900, Math.max(320, Math.floor(Number(merged.overlay.width) || 480)))
  merged.overlay.height = Math.min(500, Math.max(140, Math.floor(Number(merged.overlay.height) || 220)))
  merged.overlay.margin = Math.min(200, Math.max(8, Math.floor(Number(merged.overlay.margin) || 28)))
  merged.overlay.opacity = Math.min(1, Math.max(0.4, Number(merged.overlay.opacity) || 0.95))
  merged.sources.akasha.timeoutMs = Math.min(60000, Math.max(2000, Math.floor(Number(merged.sources.akasha.timeoutMs) || 12000)))
  merged.sources.akasha.maxResults = Math.min(20, Math.max(1, Math.floor(Number(merged.sources.akasha.maxResults) || 5)))
  merged.sources.web.maxResults = Math.min(20, Math.max(1, Math.floor(Number(merged.sources.web.maxResults) || 5)))
  merged.vision.maxFindings = Math.min(30, Math.max(1, Math.floor(Number(merged.vision.maxFindings) || 12)))
  merged.frames.maxFrames = Math.min(2000, Math.max(10, Math.floor(Number(merged.frames.maxFrames) || 200)))
  merged.frames.retentionDays = Math.min(90, Math.max(1, Math.floor(Number(merged.frames.retentionDays) || 7)))
  merged.watch.intervalSec = Math.min(300, Math.max(2, Math.floor(Number(merged.watch.intervalSec) || 8)))
  return merged
}
