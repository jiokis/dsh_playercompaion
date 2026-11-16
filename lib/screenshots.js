import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp'])

function safeJsonRead(path) {
  try {
    if (!existsSync(path)) return null
    const value = JSON.parse(readFileSync(path, 'utf8'))
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

function fileHash(path) {
  try {
    return createHash('sha1').update(readFileSync(path)).digest('hex').slice(0, 16)
  } catch {
    return ''
  }
}

export class ScreenshotStore {
  constructor({ dataDir, config } = {}) {
    this.dir = join(dataDir, 'screenshots')
    this.thumbDir = join(this.dir, 'thumbs')
    this.settings = config?.screenshots || {}
  }

  ensure() {
    mkdirSync(this.thumbDir, { recursive: true })
  }

  validId(id) {
    return typeof id === 'string' && /^[A-Za-z0-9._-]{1,120}$/.test(id) && IMAGE_EXT.has(extname(id).toLowerCase())
  }

  metaPath(id) {
    return join(this.dir, id + '.json')
  }

  thumbPath(id) {
    return join(this.thumbDir, id.replace(/\.[^.]+$/, '') + '.jpg')
  }

  /**
   * Screenshots carry the dialogue on screen when they were taken, so the same
   * frame captured twice in a row is noise. A close-in-time copy of an
   * identical file is reported as a duplicate and not stored again.
   */
  add({ path, game, session, speaker, text, width, height, ts }) {
    if (!path || !existsSync(path)) return null
    if (this.settings.enabled === false) return null
    this.ensure()
    const id = basename(path)
    if (!this.validId(id)) return null
    const stat = statSync(path)
    const hash = fileHash(path)
    const duplicate = hash ? this.findDuplicate(hash, ts || new Date(stat.mtimeMs).toISOString()) : null
    if (duplicate) {
      // The caller already wrote a fresh copy; drop it so the gallery stays clean.
      try { if (dirname(path) === this.dir) unlinkSync(path) } catch { /* ignore */ }
      return { ...duplicate, duplicate: true }
    }
    const meta = {
      id,
      ts: ts || new Date(stat.mtimeMs).toISOString(),
      game: game || 'auto',
      session: session || '',
      speaker: speaker || '',
      text: String(text || '').slice(0, 300),
      width: Number(width) || null,
      height: Number(height) || null,
      bytes: stat.size,
      hash
    }
    try { writeFileSync(this.metaPath(id), JSON.stringify(meta, null, 2) + '\n', 'utf8') } catch { /* ignore */ }
    this.makeThumb(path, this.thumbPath(id))
    this.prune()
    return meta
  }

  findDuplicate(hash, ts) {
    const windowMs = Math.max(0, Number(this.settings.dedupeSeconds ?? 20)) * 1000
    if (!windowMs) return null
    const at = Date.parse(ts)
    if (!Number.isFinite(at)) return null
    for (const shot of this.list({ limit: 8, thumbs: false })) {
      if (shot.hash !== hash) continue
      const then = Date.parse(shot.ts)
      if (Number.isFinite(then) && Math.abs(at - then) <= windowMs) return shot
    }
    return null
  }

  makeThumb(source, target) {
    try {
      const quote = (value) => "'" + String(value).replace(/'/g, "''") + "'"
      const script = [
        'Add-Type -AssemblyName System.Drawing',
        '$src = ' + quote(source),
        '$dst = ' + quote(target),
        '$img = [System.Drawing.Image]::FromFile($src)',
        '$ratio = [Math]::Min(1.0, 480.0 / [Math]::Max(1, $img.Width))',
        '$w = [int]([Math]::Max(1, $img.Width * $ratio))',
        '$h = [int]([Math]::Max(1, $img.Height * $ratio))',
        '$bmp = New-Object System.Drawing.Bitmap($w, $h)',
        '$g = [System.Drawing.Graphics]::FromImage($bmp)',
        '$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic',
        '$g.DrawImage($img, 0, 0, $w, $h)',
        '$bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Jpeg)',
        '$g.Dispose(); $bmp.Dispose(); $img.Dispose()'
      ].join('; ')
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 10000, windowsHide: true })
    } catch {
      /* thumbnails are optional */
    }
  }

  read(id) {
    if (!this.validId(id)) throw new Error('invalid screenshot id')
    const path = join(this.dir, id)
    if (!existsSync(path)) throw new Error('screenshot not found')
    const ext = extname(id).toLowerCase()
    const mime = ext === '.webp' ? 'image/webp' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
    return { id, dataUrl: 'data:' + mime + ';base64,' + readFileSync(path).toString('base64'), meta: safeJsonRead(this.metaPath(id)) }
  }

  /** Thumbnails are fetched on demand; snapshots stay small enough to send often. */
  thumbs(ids) {
    const wanted = Array.isArray(ids) ? ids.filter((id) => this.validId(id)) : []
    const out = []
    for (const id of wanted.slice(0, 24)) {
      try {
        const path = this.thumbPath(id)
        if (existsSync(path)) out.push({ id, thumb: 'data:image/jpeg;base64,' + readFileSync(path).toString('base64') })
      } catch { /* skip unreadable thumb */ }
    }
    return out
  }

  /** Every stored shot, newest first; callers decide how much to keep. */
  scan() {
    this.ensure()
    let files
    try {
      files = readdirSync(this.dir)
        .filter((name) => IMAGE_EXT.has(extname(name).toLowerCase()))
        .map((name) => {
          const path = join(this.dir, name)
          try { return { name, path, stat: statSync(path) } } catch { return null }
        })
        .filter(Boolean)
    } catch {
      return []
    }
    return files
      .map((file) => {
        const meta = safeJsonRead(this.metaPath(file.name)) || {}
        return {
          id: file.name,
          ts: meta.ts || new Date(file.stat.mtimeMs).toISOString(),
          game: meta.game || 'auto',
          session: meta.session || '',
          speaker: meta.speaker || '',
          text: meta.text || '',
          width: meta.width || null,
          height: meta.height || null,
          bytes: meta.bytes || file.stat.size,
          hash: meta.hash || ''
        }
      })
      .sort((left, right) => String(right.ts).localeCompare(String(left.ts)))
  }

  list(options = {}) {
    const limit = Math.max(1, Math.min(60, Number(options.limit) || 24))
    const withThumbs = options.thumbs === true
    const rows = this.scan()
      .filter((row) => !options.session || row.session === options.session)
      .filter((row) => !options.game || row.game === options.game)
      .slice(0, limit)
    if (!withThumbs) return rows
    return rows.map((row) => {
      const thumb = this.thumbs([row.id])[0]
      return thumb ? { ...row, thumb: thumb.thumb } : row
    })
  }

  /** Counts and spans, so the journal can show a summary instead of 12 images. */
  summary(options = {}) {
    const rows = this.scan()
      .filter((row) => !options.session || row.session === options.session)
      .filter((row) => !options.game || row.game === options.game)
    const byGame = {}
    const bySession = {}
    let bytes = 0
    for (const row of rows) {
      byGame[row.game] = (byGame[row.game] || 0) + 1
      if (row.session) bySession[row.session] = (bySession[row.session] || 0) + 1
      bytes += Number(row.bytes) || 0
    }
    const times = rows.map((row) => row.ts).filter(Boolean).sort()
    return {
      total: rows.length,
      bytes,
      byGame,
      bySession,
      firstTs: times[0] || null,
      lastTs: times[times.length - 1] || null,
      latest: rows.slice(0, 6).map((row) => ({ id: row.id, ts: row.ts, speaker: row.speaker, session: row.session }))
    }
  }

  /** Configured retention: drop shots past retentionDays, then trim to maxCount. */
  prune() {
    const days = Number(this.settings.retentionDays ?? 0)
    const maxCount = Number(this.settings.maxCount ?? 0)
    if (!days && !maxCount) return { removed: 0 }
    const rows = this.scan()
    const cutoff = days ? Date.now() - days * 86400000 : null
    let removed = 0
    const victims = new Set()
    rows.forEach((row, index) => {
      const at = Date.parse(row.ts)
      if (cutoff && Number.isFinite(at) && at < cutoff) victims.add(row.id)
      else if (maxCount && index >= maxCount) victims.add(row.id)
    })
    for (const id of victims) {
      try {
        this.remove(id)
        removed += 1
      } catch { /* ignore */ }
    }
    return { removed }
  }

  remove(id) {
    if (!this.validId(id)) throw new Error('invalid screenshot id')
    for (const path of [join(this.dir, id), this.metaPath(id), this.thumbPath(id)]) {
      try { if (existsSync(path)) unlinkSync(path) } catch { /* ignore */ }
    }
    return { id, removed: true }
  }
}
