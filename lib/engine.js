import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

export class EngineError extends Error {
  constructor(message, code = 'ENGINE_ERROR', detail = null) {
    super(message)
    this.name = 'EngineError'
    this.code = code
    this.detail = detail
  }
}

function describeDetail(detail) {
  if (!detail || typeof detail !== 'object') return ''
  if (Array.isArray(detail.windows)) {
    const names = detail.windows.slice(0, 8).map((window) => (window.title || '(untitled)') + ' [' + (window.process || '?') + ']')
    return names.length ? 'visible windows: ' + names.join(', ') : 'no visible windows'
  }
  if (detail.occluded && typeof detail.occluded === 'object') {
    const ratio = Math.round(Number(detail.occluded.occluded_ratio || 0) * 100)
    const first = detail.occluded.covered_by?.[0]
    return 'occlusion ' + ratio + '%' + (first?.title ? ' by ' + first.title : '')
  }
  if (detail.stats && typeof detail.stats === 'object') {
    return 'backend ' + (detail.backend || '?') + ', mean ' + detail.stats.mean + ', std ' + detail.stats.std
  }
  try {
    return JSON.stringify(detail).slice(0, 400)
  } catch {
    return ''
  }
}

export class EngineClient {
  constructor({ python, cwd, env = process.env, timeoutMs = 30000 }) {
    this.python = python
    this.cwd = cwd
    this.env = env
    this.timeoutMs = timeoutMs
    this.child = null
    this.stderr = ''
    this.pending = new Map()
    this.nextId = 1
    this.failure = null
    this.exitHook = null
  }

  start() {
    if (this.child) return
    const child = spawn(this.python, ['-m', 'lore_engine', 'serve'], {
      cwd: this.cwd,
      env: { ...this.env, PYTHONIOENCODING: 'utf-8', PYTHONPATH: this.cwd },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.child = child
    child.unref()
    child.stdin?.unref?.()
    child.stdout?.unref?.()
    child.stderr?.unref?.()
    this.exitHook = () => {
      try {
        child.kill()
      } catch {
        /* already gone */
      }
    }
    process.once('exit', this.exitHook)
    const reader = createInterface({ input: child.stdout })
    reader.on('line', (line) => this.#onLine(line))
    child.stdin.on('error', () => {})
    child.on('error', (error) => {
      this.failure = 'engine failed to start: ' + error.message
      for (const entry of this.pending.values()) entry.reject(new EngineError(this.failure, 'ENGINE_SPAWN_FAILED'))
      this.pending.clear()
      this.child = null
    })
    child.stderr.on('data', (chunk) => {
      this.stderr = (this.stderr + String(chunk)).slice(-4000)
    })
    child.on('exit', (code, signal) => {
      this.failure = 'engine exited (code=' + String(code) + ', signal=' + String(signal) + '): ' + this.stderr.trim()
      for (const entry of this.pending.values()) entry.reject(new EngineError(this.failure, 'ENGINE_EXITED'))
      this.pending.clear()
      this.child = null
    })
  }

  #onLine(line) {
    if (!line.trim()) return
    let message
    try {
      message = JSON.parse(line)
    } catch {
      return
    }
    const entry = this.pending.get(message.id)
    if (!entry) return
    this.pending.delete(message.id)
    if (message.ok) {
      entry.resolve(message.result)
      return
    }
    const detail = message.error?.detail ?? null
    const base = message.error?.message || 'engine error'
    const extra = describeDetail(detail)
    entry.reject(new EngineError(extra ? base + ' (' + extra + ')' : base, message.error?.code || 'ENGINE_ERROR', detail))
  }

  request(method, params = {}, { timeoutMs, signal } = {}) {
    this.start()
    if (this.failure) return Promise.reject(new EngineError(this.failure, 'ENGINE_EXITED'))
    if (signal?.aborted) return Promise.reject(new EngineError('request aborted', 'ABORTED'))
    const id = this.nextId++
    const limit = timeoutMs ?? this.timeoutMs
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (fn, value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal?.removeEventListener?.('abort', onAbort)
        this.pending.delete(id)
        fn(value)
      }
      const onAbort = () => finish(reject, new EngineError('request aborted', 'ABORTED'))
      const timer = setTimeout(() => finish(reject, new EngineError("engine request '" + method + "' timed out after " + limit + 'ms', 'ENGINE_TIMEOUT')), limit)
      this.pending.set(id, {
        resolve: (value) => finish(resolve, value),
        reject: (error) => finish(reject, error)
      })
      signal?.addEventListener?.('abort', onAbort, { once: true })
      try {
        this.child.stdin.write(JSON.stringify({ id, method, params }) + '\n')
      } catch (error) {
        finish(reject, new EngineError('failed to write to engine: ' + error.message, 'ENGINE_WRITE_FAILED'))
      }
    })
  }

  dispose() {
    if (this.exitHook) {
      process.off('exit', this.exitHook)
      this.exitHook = null
    }
    if (!this.child) return
    try {
      this.child.stdin.end()
      this.child.kill()
    } catch {
      /* already gone */
    }
    this.child = null
  }
}
