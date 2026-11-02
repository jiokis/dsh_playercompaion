import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

function sha16(text) {
  return createHash('sha1').update(String(text ?? ''), 'utf8').digest('hex').slice(0, 16)
}

function readJson(path, fallback) {
  try {
    if (!existsSync(path)) return fallback
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJsonAtomic(path, value) {
  const tmp = path + '.tmp'
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
  renameSync(tmp, path)
}

export class WikiCache {
  constructor({ dataDir, game, maxPages = 300 }) {
    this.game = game
    this.dir = join(dataDir, 'wiki', game)
    this.pagesDir = join(this.dir, 'pages')
    this.indexPath = join(this.dir, 'index.json')
    this.maxPages = Math.max(1, Number(maxPages) || 300)
    this.index = null
    this.allPages = null
  }

  ensure() {
    mkdirSync(this.pagesDir, { recursive: true })
  }

  loadIndex() {
    if (this.index) return this.index
    const loaded = readJson(this.indexPath, null)
    this.index = loaded && typeof loaded === 'object' && loaded.pages && typeof loaded.pages === 'object' ? loaded : { v: 1, pages: {}, updatedAt: null }
    return this.index
  }

  saveIndex() {
    this.ensure()
    this.index.updatedAt = new Date().toISOString()
    writeJsonAtomic(this.indexPath, this.index)
  }

  pagePath(title) {
    return join(this.pagesDir, sha16(this.game + '\n' + title) + '.json')
  }

  readPage(title) {
    const index = this.loadIndex()
    const entry = index.pages[title]
    if (!entry) return null
    const record = readJson(join(this.dir, entry.file), null)
    if (!record || typeof record.text !== 'string') return null
    return record
  }

  writePage(title, record) {
    const index = this.loadIndex()
    if (!index.pages[title] && Object.keys(index.pages).length >= this.maxPages) {
      return { ok: false, reason: 'cache_full', pages: Object.keys(index.pages).length }
    }
    const file = join('pages', sha16(this.game + '\n' + title) + '.json')
    const payload = { v: 1, game: this.game, title, ...record }
    writeJsonAtomic(join(this.dir, file), payload)
    index.pages[title] = {
      file,
      revid: payload.revid ?? null,
      fetchedAt: payload.fetchedAt ?? new Date().toISOString(),
      bytes: Buffer.byteLength(payload.text || '', 'utf8'),
      url: payload.url || null
    }
    this.allPages = null
    this.saveIndex()
    return { ok: true, bytes: index.pages[title].bytes }
  }

  readAllPages() {
    if (this.allPages) return this.allPages
    const index = this.loadIndex()
    const pages = []
    for (const [title, entry] of Object.entries(index.pages)) {
      const record = readJson(join(this.dir, entry.file), null)
      if (!record || typeof record.text !== 'string') continue
      pages.push({ title, record })
    }
    this.allPages = pages
    return pages
  }

  stats() {
    const index = this.loadIndex()
    let bytes = 0
    for (const entry of Object.values(index.pages)) bytes += Number(entry.bytes) || 0
    return { game: this.game, dir: this.dir, pages: Object.keys(index.pages).length, bytes, maxPages: this.maxPages }
  }

  listTitles() {
    return Object.keys(this.loadIndex().pages)
  }
}
