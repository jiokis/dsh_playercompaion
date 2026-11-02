import { EngineClient, EngineError } from './engine.js'
import { createEngineBootstrap } from './bootstrap.js'

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new EngineError('aborted', 'ABORTED'))
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new EngineError('aborted', 'ABORTED'))
    }
    signal?.addEventListener?.('abort', onAbort, { once: true })
  })
}

export function createRuntime({ config, engineDir, dataDir, env = process.env }) {
  const state = {
    status: 'idle',
    detail: 'not started',
    python: null,
    source: null,
    error: null,
    cacheDir: null,
    cwd: null,
    log: []
  }
  const bootstrap = createEngineBootstrap({
    config,
    engineDir,
    dataDir,
    env,
    onProgress: (line) => {
      state.detail = line
      state.log.push(line)
      if (state.log.length > 40) state.log.shift()
    }
  })
  let client = null

  function start() {
    if (state.status === 'installing' || state.status === 'ready') return
    state.status = 'installing'
    state.detail = 'starting local engine bootstrap'
    bootstrap.ensure()
      .then((info) => {
        state.python = info.python
        state.source = info.source
        state.cacheDir = info.cacheDir
        state.cwd = info.cwd
        state.status = 'ready'
        state.detail = 'engine ready (' + info.source + ')'
        client = new EngineClient({ python: info.python, cwd: info.cwd, env })
      })
      .catch((error) => {
        state.status = 'failed'
        state.error = error.message
        state.detail = 'engine unavailable: ' + error.message
      })
  }

  function status() {
    return {
      status: state.status,
      detail: state.detail,
      python: state.python,
      source: state.source,
      error: state.error,
      cacheDir: state.cacheDir,
      cwd: state.cwd,
      log: state.log.slice(-8)
    }
  }

  async function waitForReady(timeoutMs, signal) {
    const deadline = Date.now() + Math.max(1000, Number(timeoutMs) || config.engine.waitMs)
    while (Date.now() < deadline) {
      if (state.status === 'ready' && client) return client
      if (state.status === 'failed') throw new EngineError('local engine failed: ' + (state.error || state.detail), 'ENGINE_UNAVAILABLE')
      await delay(150, signal)
    }
    throw new EngineError('local engine is still installing; call lore_status and retry. ' + state.detail, 'ENGINE_NOT_READY')
  }

  async function ensure({ timeoutMs = config.engine.waitMs, signal } = {}) {
    start()
    const ready = await waitForReady(timeoutMs, signal)
    if (ready.failure) {
      ready.dispose()
      client = new EngineClient({ python: state.python, cwd: state.cwd || engineDir, env })
    }
    return client
  }

  async function request(method, params = {}, options = {}) {
    const ready = await ensure({ timeoutMs: options.timeoutMs, signal: options.signal })
    return ready.request(method, params, options)
  }

  function dispose() {
    bootstrap.cancel()
    try {
      client?.dispose()
    } catch {
      /* ignore */
    }
    client = null
    state.status = 'disposed'
  }

  return { start, status, ensure, request, dispose }
}
