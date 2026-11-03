const DEFAULT_INTERVAL_SEC = 8
const MIN_INTERVAL_SEC = 2
const MAX_INTERVAL_SEC = 300

function clampInterval(value) {
  const number = Math.floor(Number(value))
  if (!Number.isFinite(number)) return DEFAULT_INTERVAL_SEC
  return Math.min(MAX_INTERVAL_SEC, Math.max(MIN_INTERVAL_SEC, number))
}

function localDateStamp() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return year + month + day
}

function summarize(result) {
  const entry = Array.isArray(result?.entries) ? result.entries[0] : null
  return {
    captured: Boolean(result?.captured),
    duplicate: Boolean(result?.duplicate),
    skipped: Boolean(result?.skipped),
    empty: Boolean(result?.empty),
    persisted: result?.persisted !== false,
    frameId: result?.frameId || null,
    game: result?.game || null,
    speaker: entry?.speaker || null,
    text: entry?.text ? String(entry.text).slice(0, 160) : null
  }
}

/**
 * Explicit, local-only polling around the existing capture pipeline.
 * It never starts on its own and never runs while disabled in settings.
 */
export class LoreWatcher {
  constructor({ config, capture, setIntervalFn = setInterval, clearIntervalFn = clearInterval }) {
    this.config = config
    this.capture = capture
    this.setIntervalFn = setIntervalFn
    this.clearIntervalFn = clearIntervalFn
    this.timer = null
    this.controller = null
    this.running = false
    this.busy = false
    this.options = null
    this.stats = this.emptyStats()
  }

  emptyStats() {
    return {
      ticks: 0,
      captured: 0,
      duplicates: 0,
      skipped: 0,
      empty: 0,
      errors: 0,
      startedAt: null,
      stoppedAt: null,
      lastAt: null,
      lastResult: null,
      lastError: null
    }
  }

  status() {
    return {
      enabled: this.config.watch?.enabled !== false,
      running: this.running,
      busy: this.busy,
      intervalSec: clampInterval(this.options?.intervalSec ?? this.config.watch?.intervalSec),
      session: this.options?.session || null,
      game: this.options?.game || 'auto',
      mode: this.options?.mode || 'dialogue',
      ...this.stats
    }
  }

  async start(args = {}) {
    if (this.config.watch?.enabled === false) throw new Error('watch is disabled in settings')
    if (this.running) throw new Error('watch is already running; stop it first')
    const intervalSec = clampInterval(args.intervalSec ?? this.config.watch?.intervalSec)
    const session = String(args.session || ('watch-' + localDateStamp())).trim()
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(session)) throw new Error('session must match [A-Za-z0-9._-]{1,40}')
    const mode = String(args.mode || 'dialogue').toLowerCase()
    if (!['dialogue', 'read'].includes(mode)) throw new Error('mode must be dialogue or read')
    const game = String(args.game || 'auto').toLowerCase()
    if (!['auto', 'genshin', 'hsr'].includes(game)) throw new Error('game must be auto, genshin or hsr')
    this.options = {
      intervalSec,
      session,
      mode,
      game,
      window: args.window ? String(args.window) : undefined,
      note: String(args.note || 'watch')
    }
    this.stats = this.emptyStats()
    this.stats.startedAt = new Date().toISOString()
    this.running = true
    await this.tick()
    if (!this.running) return this.status()
    this.timer = this.setIntervalFn(() => { this.tick().catch(() => {}) }, intervalSec * 1000)
    if (this.timer && typeof this.timer.unref === 'function') this.timer.unref()
    return this.status()
  }

  stop() {
    if (this.timer) {
      this.clearIntervalFn(this.timer)
      this.timer = null
    }
    this.running = false
    this.stats.stoppedAt = new Date().toISOString()
    if (this.controller) {
      try { this.controller.abort() } catch { /* ignore */ }
    }
    return this.status()
  }

  async tick() {
    if (!this.running) return this.status()
    if (this.busy) return this.status()
    if (!this.capture || typeof this.capture.execute !== 'function') throw new Error('capture tool is not available')
    this.busy = true
    this.controller = new AbortController()
    this.stats.ticks += 1
    const captureArgs = {
      game: this.options.game,
      session: this.options.session,
      note: this.options.note,
      mode: this.options.mode,
      includeImage: false,
      force: false,
      dryRun: false
    }
    if (this.options.window) captureArgs.window = this.options.window
    try {
      const result = await this.capture.execute(captureArgs, { signal: this.controller.signal })
      if (this.running) {
        const summary = summarize(result)
        if (summary.duplicate) this.stats.duplicates += 1
        else if (summary.skipped) this.stats.skipped += 1
        else if (summary.empty) this.stats.empty += 1
        else if (summary.captured) this.stats.captured += 1
        else this.stats.skipped += 1
        this.stats.lastResult = summary
        this.stats.lastError = null
      }
    } catch (error) {
      if (this.running) {
        this.stats.errors += 1
        this.stats.lastError = String(error?.message || error).slice(0, 300)
      }
    } finally {
      this.busy = false
      this.controller = null
      this.stats.lastAt = new Date().toISOString()
    }
    return this.status()
  }

  dispose() {
    this.stop()
  }
}
