import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const FRAME_ID_RE = /^[A-Za-z0-9._-]{1,80}$/
const GAMES = new Set(['genshin', 'hsr', 'unknown'])

function frameId(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  const stamp = [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join('') + '-' +
    [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('')
  return 'f_' + stamp + '-' + randomBytes(3).toString('hex')
}

function safeGame(value) {
  const game = String(value || '').toLowerCase()
  return GAMES.has(game) ? game : 'unknown'
}

function isoNow() {
  return new Date().toISOString()
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

export class FrameStore {
  constructor({ config, dataDir }) {
    this.config = config
    this.dataDir = dataDir
    this.root = join(dataDir, 'frames')
    this.enabled = config?.frames?.enabled === true
  }

  ensureRoot() {
    mkdirSync(this.root, { recursive: true })
  }

  save({ game, base64, width, height, meta = {} } = {}) {
    if (!this.enabled || !base64) return null
    const data = Buffer.from(String(base64), 'base64')
    if (!data.length) return null
    const id = frameId()
    const ts = isoNow()
    const date = ts.slice(0, 10)
    const gameId = safeGame(game)
    const directory = join(this.root, gameId, date)
    this.ensureRoot()
    mkdirSync(directory, { recursive: true })
    const imageName = id + '.png'
    const imagePath = join(directory, imageName)
    const tmpPath = imagePath + '.tmp'
    writeFileSync(tmpPath, data)
    renameSync(tmpPath, imagePath)
    const metadata = {
      v: 1,
      id,
      ts,
      game: gameId,
      source: meta.source || 'capture',
      width: Number(width) || null,
      height: Number(height) || null,
      image: imageName,
      ...meta
    }
    const jsonPath = join(directory, id + '.json')
    writeFileSync(jsonPath + '.tmp', JSON.stringify(metadata, null, 2) + '\n', 'utf8')
    renameSync(jsonPath + '.tmp', jsonPath)
    try {
      this.prune()
    } catch {
      /* retention is best-effort */
    }
    return { id, ts, path: relative(this.root, imagePath), metadata }
  }

  all() {
    if (!existsSync(this.root)) return []
    const metadata = []
    const walk = (directory) => {
      let entries
      try {
        entries = readdirSync(directory, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) {
          walk(path)
          continue
        }
        if (!entry.name.endsWith('.json')) continue
        const value = readJson(path)
        if (!value || !value.id || !FRAME_ID_RE.test(String(value.id))) continue
        const imagePath = join(directory, value.image || value.id + '.png')
        let bytes = 0
        try { bytes = statSync(imagePath).size } catch { /* missing image */ }
        metadata.push({ ...value, path: relative(this.root, imagePath), bytes })
      }
    }
    walk(this.root)
    return metadata
  }

  list({ game, limit = 10 } = {}) {
    const max = Math.max(1, Math.min(50, Number(limit) || 10))
    const gameId = game ? safeGame(game) : null
    return this.all()
      .filter((item) => !gameId || item.game === gameId)
      .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
      .slice(0, max)
  }

  find(id) {
    const value = String(id || '')
    if (!FRAME_ID_RE.test(value)) return null
    return this.all().find((item) => item.id === value) || null
  }

  read(id) {
    const metadata = this.find(id)
    if (!metadata) return null
    const imagePath = join(this.root, metadata.path)
    try {
      return { id: metadata.id, metadata, path: imagePath, base64: readFileSync(imagePath).toString('base64') }
    } catch {
      return null
    }
  }

  prune() {
    if (!this.enabled) return
    const maxFrames = Math.max(1, Number(this.config?.frames?.maxFrames) || 200)
    const retentionDays = Math.max(1, Number(this.config?.frames?.retentionDays) || 7)
    const cutoff = Date.now() - retentionDays * 86400000
    const items = this.all().sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      const tooMany = index >= maxFrames
      const tooOld = Date.parse(item.ts) < cutoff
      if (!tooMany && !tooOld) continue
      for (const path of [join(this.root, item.path), join(this.root, item.path.replace(/\.png$/i, '.json'))]) {
        try { unlinkSync(path) } catch { /* already gone */ }
      }
    }
  }
}
