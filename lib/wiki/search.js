import { WikiCache } from './cache.js'
import { WikiClient } from './client.js'
import { scoreText, shorten } from '../store/text.js'

function collapse(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function makeSnippet(text, query, maxChars) {
  const body = collapse(text)
  const needle = String(query || '').trim()
  let start = needle ? body.indexOf(needle) : -1
  if (start < 0 && needle) {
    const lower = body.toLowerCase()
    start = lower.indexOf(needle.toLowerCase())
  }
  if (start < 0) return shorten(body, maxChars)
  const left = Math.max(0, start - 120)
  const right = Math.min(body.length, start + needle.length + 120)
  const prefix = left > 0 ? '…' : ''
  const suffix = right < body.length ? '…' : ''
  return shorten(prefix + body.slice(left, right) + suffix, maxChars)
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => {
      const value = Number(code)
      return Number.isFinite(value) ? String.fromCodePoint(value) : ''
    })
}

export function htmlToText(html, maxBytes = 262144) {
  let text = String(html || '')
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  text = text.replace(/<!--[\s\S]*?-->/g, ' ')
  text = text.replace(/<div[^>]*class="[^"]*(?:navbox|mw-editsection|toc)[^"]*"[\s\S]*?<\/div>/gi, ' ')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/(p|li|h[1-6]|tr|div)>/gi, '\n')
  text = text.replace(/<[^>]+>/g, ' ')
  text = decodeEntities(text)
  const noise = [
    /ctrl\+d/i,
    /wiki功能/i,
    /收藏随时查看更新/i,
    /推荐给朋友/i,
    /第一次来/i,
    /按右上角/i,
    /新建相应的图鉴页/i,
    /阅\s*编\s*刷\s*历/i,
    /^首页\s*>/i,
    /以下为名字或内容相近的条目/i,
    /^本条目介绍的是/i,
    /^编\s*刷\s*历/i,
    /角色导航/,
    /角色立绘|角色介绍立绘/,
    /^请上传文件/,
    /^点击查看/,
    /^重定向到/,
    /^\d+(?:\.\d+)*\s+\S{1,20}$/,
    /角色语音|角色资料|贺图视频/,
    /^站立动作/,
    /^立绘/
  ]
  text = text.replace(/\[\s*编辑\s*\]/g, '')
  text = text.split(/\n+/).map((line) => line.trim()).filter(Boolean).filter((line) => {
    if (noise.some((pattern) => pattern.test(line))) return false
    const numbers = line.match(/\b\d+(?:\.\d+)?\b/g) || []
    if (numbers.length >= 3 && line.length < 220) return false
    const bullets = (line.match(/•/g) || []).length
    return !(bullets >= 2 && line.length < 80)
  }).join('\n')
  text = text.replace(/[ \t\u3000]+/g, ' ').replace(/\n+/g, '\n').trim()
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    text = Buffer.from(text, 'utf8').subarray(0, maxBytes).toString('utf8')
  }
  return text
}

export class WikiSearch {
  constructor({ config, dataDir, env = process.env, fetchImpl, sleepImpl }) {
    this.config = config
    this.dataDir = dataDir
    this.env = env
    this.fetchImpl = fetchImpl
    this.sleepImpl = sleepImpl
    this.clients = new Map()
    this.caches = new Map()
  }

  offline() {
    return this.env.DSH_LORE_OFFLINE === '1'
  }

  source(game) {
    return this.config.wiki.sources[game] || this.config.wiki.sources.genshin
  }

  client(game) {
    if (!this.clients.has(game)) {
      const source = this.source(game)
      this.clients.set(game, new WikiClient({
        api: source.api,
        pageBase: source.pageBase,
        intervalMs: this.config.wiki.requestIntervalMs,
        timeoutMs: this.config.wiki.timeoutMs,
        maxRetries: this.config.wiki.maxRetries,
        fetchImpl: this.fetchImpl,
        sleepImpl: this.sleepImpl
      }))
    }
    return this.clients.get(game)
  }

  cache(game) {
    if (!this.caches.has(game)) {
      this.caches.set(game, new WikiCache({ dataDir: this.dataDir, game, maxPages: this.config.wiki.maxPages }))
    }
    return this.caches.get(game)
  }

  stats() {
    return ['genshin', 'hsr'].map((game) => this.cache(game).stats())
  }

  scorePage(page, query) {
    const title = String(page.title || '')
    const text = String(page.record?.text || '')
    let score = 0
    if (title === query) score += 5
    else if (title.includes(query)) score += 3
    else if (query && title.toLowerCase().includes(query.toLowerCase())) score += 3
    score += scoreText(text, query)
    return score
  }

  localResults(game, query, limit) {
    const cache = this.cache(game)
    const pages = cache.readAllPages()
    const ttlMs = Math.max(1, Number(this.config.wiki.cacheTtlDays) || 7) * 86400000
    const scored = []
    for (const page of pages) {
      const score = this.scorePage(page, query)
      if (score <= 0) continue
      const fetchedAt = page.record?.fetchedAt || null
      const stale = fetchedAt ? Date.now() - Date.parse(fetchedAt) > ttlMs : true
      scored.push({
        title: page.title,
        url: page.record?.url || this.client(game).pageUrl(page.title),
        summary: shorten(collapse(page.record?.text || ''), 240),
        snippet: makeSnippet(page.record?.text || '', query, this.config.wiki.snippetChars),
        score: Number(score.toFixed(3)),
        fetchedAt,
        revid: page.record?.revid ?? null,
        stale
      })
    }
    scored.sort((a, b) => b.score - a.score || String(b.fetchedAt || '').localeCompare(String(a.fetchedAt || '')))
    return scored.slice(0, limit)
  }

  async query(game, query, options = {}) {
    const limit = Math.max(1, Math.min(10, Number(options.limit) || 5))
    const q = String(query || '').trim()
    const warnings = []
    if (!this.config.wiki.enabled) return { results: [], warnings: ['wiki_disabled'], cache: this.cache(game).stats() }
    const cache = this.cache(game)
    let local = q ? this.localResults(game, q, limit) : []
    const shouldRemote = q && (options.refresh || local.length < 2)
    if (shouldRemote && !this.offline()) {
      const client = this.client(game)
      const search = await client.search(q, 5)
      if (!search.ok) {
        warnings.push('wiki_unavailable')
        return { results: local, warnings, cache: cache.stats() }
      }
      const titles = (search.titles || []).slice(0, 3)
      for (const title of titles) {
        const cached = cache.readPage(title)
        const fetchedAt = cached?.fetchedAt ? Date.parse(cached.fetchedAt) : 0
        const ttlMs = Math.max(1, Number(this.config.wiki.cacheTtlDays) || 7) * 86400000
        const needsFetch = !cached || options.refresh || !fetchedAt || Date.now() - fetchedAt > ttlMs
        if (!needsFetch) continue
        const parsed = await client.parse(title)
        if (!parsed.ok) {
          if (cached) warnings.push('wiki_stale:' + title)
          else warnings.push('wiki_fetch_failed:' + title)
          continue
        }
        const text = htmlToText(parsed.html, this.config.wiki.maxPageBytes)
        const record = {
          pageId: parsed.pageId,
          revid: parsed.revid,
          url: client.pageUrl(title),
          fetchedAt: new Date().toISOString(),
          text
        }
        const written = cache.writePage(title, record)
        if (!written.ok) warnings.push(written.reason + ':' + title)
      }
      local = this.localResults(game, q, limit)
    } else if (shouldRemote && this.offline()) {
      warnings.push('wiki_offline')
    }
    return { results: local, warnings, cache: cache.stats() }
  }
}
