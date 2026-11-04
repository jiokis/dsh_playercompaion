import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
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

export class ScreenshotStore {
  constructor({ dataDir }) {
    this.dir = join(dataDir, 'screenshots')
    this.thumbDir = join(this.dir, 'thumbs')
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

  add({ path, game, session, speaker, text, width, height, ts }) {
    if (!path || !existsSync(path)) return null
    this.ensure()
    const id = basename(path)
    if (!this.validId(id)) return null
    const stat = statSync(path)
    const meta = {
      id,
      ts: ts || new Date(stat.mtimeMs).toISOString(),
      game: game || 'auto',
      session: session || '',
      speaker: speaker || '',
      text: String(text || '').slice(0, 300),
      width: Number(width) || null,
      height: Number(height) || null,
      bytes: stat.size
    }
    try { writeFileSync(this.metaPath(id), JSON.stringify(meta, null, 2) + '\n', 'utf8') } catch { /* ignore */ }
    this.makeThumb(path, this.thumbPath(id))
    return meta
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

  list(limit = 24) {
    this.ensure()
    const max = Math.max(1, Math.min(60, Number(limit) || 24))
    const files = readdirSync(this.dir)
      .filter((name) => IMAGE_EXT.has(extname(name).toLowerCase()))
      .map((name) => {
        const path = join(this.dir, name)
        try { return { name, path, stat: statSync(path) } } catch { return null }
      })
      .filter(Boolean)
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
      .slice(0, max)
    return files.map((file) => {
      const meta = safeJsonRead(this.metaPath(file.name)) || {}
      let thumb = null
      try {
        const t = this.thumbPath(file.name)
        if (existsSync(t)) thumb = 'data:image/jpeg;base64,' + readFileSync(t).toString('base64')
      } catch { /* ignore */ }
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
        thumb
      }
    })
  }

  remove(id) {
    if (!this.validId(id)) throw new Error('invalid screenshot id')
    for (const path of [join(this.dir, id), this.metaPath(id), this.thumbPath(id)]) {
      try { if (existsSync(path)) unlinkSync(path) } catch { /* ignore */ }
    }
    return { id, removed: true }
  }
}
