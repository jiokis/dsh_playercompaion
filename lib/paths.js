import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export function expandHome(value, env = process.env) {
  const text = String(value ?? '').trim()
  if (!text) return text
  if (text === '~') return homedir()
  if (text.startsWith('~/') || text.startsWith('~\\')) return join(homedir(), text.slice(2))
  return text.replace(/^%([^%]+)%/, (_m, name) => env[name] ?? _m)
}

export function defaultBaseDir(env = process.env) {
  if (process.platform === 'win32') {
    const local = env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
    return join(local, 'dsh-lore-companion')
  }
  const xdg = env.XDG_DATA_HOME || join(homedir(), '.local', 'share')
  return join(xdg, 'dsh-lore-companion')
}

export function resolveDataDir(config = {}, env = process.env) {
  const fromEnv = String(env.DSH_LORE_DATA_DIR ?? '').trim()
  if (fromEnv) return resolve(expandHome(fromEnv, env))
  const fromConfig = String(config?.dataDir ?? '').trim()
  if (fromConfig) return resolve(expandHome(fromConfig, env))
  return join(defaultBaseDir(env), 'data')
}

export function resolveEngineCacheDir(config = {}, env = process.env) {
  const fromEnv = String(env.DSH_LORE_CACHE_DIR ?? '').trim()
  if (fromEnv) return resolve(expandHome(fromEnv, env))
  const fromConfig = String(config?.engine?.cacheDir ?? '').trim()
  if (fromConfig) return resolve(expandHome(fromConfig, env))
  return join(defaultBaseDir(env), 'engine')
}

export function ensureDir(dir) {
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return true
  } catch {
    return false
  }
}

export function dataLayout(dataDir) {
  return {
    dataDir,
    logsDir: join(dataDir, 'logs'),
    wikiDir: join(dataDir, 'wiki'),
    bootstrapLog: join(dataDir, 'engine-bootstrap.log')
  }
}
