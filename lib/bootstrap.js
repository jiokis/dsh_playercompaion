import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { resolveEngineCacheDir } from './paths.js'

export const ENGINE_VERSION = '0.1.0'
const MAX_BOOTSTRAP_LOG = 2 * 1024 * 1024

export function readRequirements(engineDir) {
  try {
    return readFileSync(join(engineDir, 'requirements.txt'), 'utf8')
  } catch {
    return ''
  }
}

export function requirementsHash(engineDir) {
  return createHash('sha1').update(readRequirements(engineDir), 'utf8').digest('hex').slice(0, 8)
}

export function engineCacheRoot(config, env = process.env) {
  return resolveEngineCacheDir(config, env)
}

export function engineCacheDir(config, engineDir, env = process.env) {
  return join(engineCacheRoot(config, env), ENGINE_VERSION + '-' + requirementsHash(engineDir))
}

function venvPython(dir) {
  return process.platform === 'win32' ? join(dir, 'Scripts', 'python.exe') : join(dir, 'bin', 'python')
}

export function locateUv(env = process.env) {
  const explicit = String(env.DSH_LORE_UV || '').trim()
  if (explicit) return existsSync(explicit) ? explicit : null
  const probe = spawnSync('uv', ['--version'], { windowsHide: true, encoding: 'utf8' })
  if (probe.status === 0) return 'uv'
  const candidates = [
    join(homedir(), '.local', 'bin', 'uv.exe'),
    join(homedir(), '.local', 'bin', 'uv'),
    join(env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Programs', 'uv', 'uv.exe'),
    join(env.USERPROFILE || homedir(), '.local', 'bin', 'uv.exe')
  ]
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate
  }
  return null
}

function appendBootstrapLog(path, text) {
  try {
    mkdirSync(dirname(path), { recursive: true })
    if (existsSync(path) && statSync(path).size > MAX_BOOTSTRAP_LOG) {
      try {
        renameSync(path, path + '.old')
      } catch {
        rmSync(path, { force: true })
      }
    }
    appendFileSync(path, '[' + new Date().toISOString() + '] ' + text + '\n', 'utf8')
  } catch {
    /* diagnostics must never break bootstrap */
  }
}

function run(command, args, { env, timeoutMs = 600000, signal, onOutput } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let output = ''
    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', onAbort)
      fn(value)
    }
    const collect = (chunk) => {
      const text = String(chunk)
      output = (output + text).slice(-8000)
      onOutput?.(text.trim())
    }
    const kill = () => {
      try {
        if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true })
        else child.kill('SIGKILL')
      } catch {
        /* already gone */
      }
    }
    const onAbort = () => {
      kill()
      finish(reject, new Error(command + ' ' + args.join(' ') + ' aborted\n' + output.slice(-2000)))
    }
    const timer = setTimeout(() => {
      kill()
      finish(reject, new Error(command + ' ' + args.join(' ') + ' timed out after ' + timeoutMs + 'ms\n' + output.slice(-2000)))
    }, timeoutMs)
    signal?.addEventListener?.('abort', onAbort, { once: true })
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.on('error', (error) => finish(reject, new Error(command + ' failed to start: ' + error.message)))
    child.on('close', (code) => {
      if (code === 0) finish(resolve, output)
      else finish(reject, new Error(command + ' ' + args.join(' ') + ' exited ' + String(code) + '\n' + output.slice(-2000)))
    })
  })
}

function cacheHealthy(python, engineCwd, env) {
  try {
    const result = spawnSync(python, ['-c', 'import lore_engine, numpy, cv2, dxcam, rapidocr_onnxruntime, mss'], {
      cwd: engineCwd,
      env: { ...process.env, ...env, PYTHONIOENCODING: 'utf-8', PYTHONPATH: engineCwd },
      windowsHide: true,
      timeout: 30000,
      encoding: 'utf8'
    })
    return result.status === 0
  } catch {
    return false
  }
}

export function createEngineBootstrap({ config, engineDir, dataDir, env = process.env, onProgress = () => {} }) {
  let promise = null
  let controller = null
  const cacheDir = engineCacheDir(config, engineDir, env)
  const python = venvPython(cacheDir)
  const bootstrapLog = join(dataDir, 'engine-bootstrap.log')

  function progress(text) {
    const line = String(text || '').trim()
    if (!line) return
    appendBootstrapLog(bootstrapLog, line)
    try {
      onProgress(line)
    } catch {
      /* ignore */
    }
  }

  async function bootstrap() {
    const devPython = String(config?.engine?.python || env.DSH_LORE_PYTHON || '').trim()
    const engineCwd = String(env.DSH_LORE_ENGINE_DIR || engineDir)
    if (devPython === 'off') throw new Error('engine disabled by DSH_LORE_PYTHON=off')
    if (devPython) {
      progress('using dev python: ' + devPython)
      return { python: devPython, cwd: engineCwd, source: 'dev', cacheDir }
    }
    if (existsSync(python) && cacheHealthy(python, engineCwd, env)) {
      progress('engine cache hit: ' + cacheDir)
      return { python, cwd: engineCwd, source: 'cache', cacheDir }
    }
    if (existsSync(cacheDir)) {
      progress('removing incomplete engine cache: ' + cacheDir)
      rmSync(cacheDir, { recursive: true, force: true })
    }
    const uv = locateUv(env)
    if (!uv) {
      throw new Error('uv not found. Install it once (winget install astral-sh.uv) or set DSH_LORE_UV to the uv executable.')
    }
    controller = new AbortController()
    mkdirSync(cacheDir, { recursive: true })
    progress('creating engine venv at ' + cacheDir)
    await run(uv, ['venv', cacheDir, '--python', String(config?.engine?.pythonVersion || '3.12')], {
      env,
      signal: controller.signal,
      timeoutMs: 300000,
      onOutput: (text) => progress(text)
    })
    progress('installing engine dependencies')
    await run(uv, ['pip', 'install', '--python', python, '-r', join(engineDir, 'requirements.txt')], {
      env,
      signal: controller.signal,
      timeoutMs: Number(config?.engine?.installTimeoutMs) || 900000,
      onOutput: (text) => progress(text)
    })
    if (!existsSync(python)) throw new Error('engine install finished but ' + python + ' is missing')
    if (!cacheHealthy(python, engineCwd, env)) throw new Error('engine dependencies are not importable after install')
    progress('warming up OCR models')
    await run(python, ['-m', 'lore_engine', 'warmup'], {
      env,
      signal: controller.signal,
      timeoutMs: 180000,
      onOutput: (text) => progress(text)
    })
    progress('engine ready: ' + python)
    return { python, cwd: engineCwd, source: 'installed', cacheDir }
  }

  return {
    ensure() {
      if (!promise) {
        promise = bootstrap().catch((error) => {
          promise = null
          throw error
        })
      }
      return promise
    },
    cancel() {
      controller?.abort()
      controller = null
    },
    cacheDir() {
      return cacheDir
    },
    python() {
      return python
    }
  }
}
