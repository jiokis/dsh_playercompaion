import { setTimeout as sleep } from 'node:timers/promises'

export const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function looksLikeWaf(text) {
  if (typeof text !== 'string') return false
  const trimmed = text.trim()
  return trimmed.startsWith('<') && /<style[\s\S]*?<\/style>/i.test(trimmed)
}

export class WikiClient {
  constructor(options = {}) {
    this.options = {
      api: options.api,
      pageBase: options.pageBase,
      intervalMs: Math.max(1500, Number(options.intervalMs) || 2000),
      timeoutMs: Math.max(2000, Number(options.timeoutMs) || 12000),
      maxRetries: Math.max(0, Math.floor(Number(options.maxRetries) || 1)),
      backoffMs: Math.max(0, Number(options.backoffMs) || 3000),
      userAgent: options.userAgent || DEFAULT_UA,
      fetchImpl: options.fetchImpl || globalThis.fetch,
      sleepImpl: options.sleepImpl || ((ms) => sleep(ms)),
      nowImpl: options.nowImpl || (() => Date.now()),
      onRequest: options.onRequest
    }
    this.lastRequestAt = 0
    this.chain = Promise.resolve()
    this.stats = { requests: 0, retries: 0, failures: 0 }
  }

  pageUrl(title) {
    return String(this.options.pageBase || '') + encodeURIComponent(String(title || '').replace(/ /g, '_'))
  }

  async #waitTurn() {
    const gap = this.options.intervalMs - (this.options.nowImpl() - this.lastRequestAt)
    if (this.lastRequestAt > 0 && gap > 0) await this.options.sleepImpl(gap)
    this.lastRequestAt = this.options.nowImpl()
  }

  async #once(url) {
    const started = this.options.nowImpl()
    try {
      const response = await this.options.fetchImpl(String(url), {
        headers: {
          'user-agent': this.options.userAgent,
          accept: 'application/json, text/plain, */*',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
          referer: this.options.pageBase || ''
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(this.options.timeoutMs)
      })
      const status = response.status
      const contentType = response.headers?.get?.('content-type') || ''
      const body = await response.text()
      return { status, contentType, body, ms: this.options.nowImpl() - started }
    } catch (error) {
      return { status: 0, contentType: '', body: '', ms: this.options.nowImpl() - started, error: error?.name === 'TimeoutError' ? 'timeout' : String(error?.message || error) }
    }
  }

  async #attempt(url) {
    let last = null
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      if (attempt > 0) {
        this.stats.retries += 1
        await this.options.sleepImpl(this.options.backoffMs * 2 ** (attempt - 1))
      }
      await this.#waitTurn()
      this.stats.requests += 1
      const raw = await this.#once(url)
      let json = null
      let error = raw.error || null
      let waf = false
      if (!error && raw.status >= 200 && raw.status < 300) {
        try {
          json = JSON.parse(raw.body)
        } catch {
          waf = looksLikeWaf(raw.body)
          error = waf ? 'WAF block (non-JSON response)' : 'invalid JSON response'
        }
      } else if (!error) {
        error = 'HTTP ' + raw.status
      }
      last = { ok: !error && json !== null, status: raw.status, json, body: raw.body, error, waf, attempts: attempt + 1, ms: raw.ms }
      try {
        this.options.onRequest?.({ url: String(url), attempt: attempt + 1, status: raw.status, ok: last.ok, error })
      } catch {
        /* diagnostics */
      }
      if (last.ok) return last
      if (this.stats.failures < 1000000) this.stats.failures += 1
    }
    return last
  }

  async requestJson(url) {
    const run = this.chain.then(() => this.#attempt(url), () => this.#attempt(url))
    this.chain = run.then(() => undefined, () => undefined)
    return run
  }

  async search(query, limit = 5) {
    const url = new URL(this.options.api)
    url.searchParams.set('action', 'query')
    url.searchParams.set('list', 'search')
    url.searchParams.set('srsearch', String(query || ''))
    url.searchParams.set('srlimit', String(Math.max(1, Math.min(20, Number(limit) || 5))))
    url.searchParams.set('format', 'json')
    url.searchParams.set('formatversion', '2')
    const result = await this.requestJson(url)
    if (!result?.ok) return { ok: false, error: result?.error || 'wiki search failed', waf: result?.waf, status: result?.status, titles: [] }
    const titles = (result.json?.query?.search || []).map((item) => item.title).filter(Boolean)
    return { ok: true, titles, total: result.json?.query?.searchinfo?.totalhits, status: result.status }
  }

  async parse(title) {
    const url = new URL(this.options.api)
    url.searchParams.set('action', 'parse')
    url.searchParams.set('page', String(title || ''))
    url.searchParams.set('prop', 'text')
    url.searchParams.set('redirects', '1')
    url.searchParams.set('format', 'json')
    url.searchParams.set('formatversion', '2')
    const result = await this.requestJson(url)
    if (!result?.ok) return { ok: false, error: result?.error || 'wiki parse failed', waf: result?.waf, status: result?.status }
    const parse = result.json?.parse
    if (!parse) return { ok: false, error: 'wiki parse returned no parse object', status: result.status }
    return {
      ok: true,
      title: parse.title || String(title),
      pageId: parse.pageid ?? null,
      revid: parse.revid ?? null,
      html: parse.text || '',
      status: result.status
    }
  }

  async revision(title) {
    const url = new URL(this.options.api)
    url.searchParams.set('action', 'query')
    url.searchParams.set('prop', 'revisions')
    url.searchParams.set('rvprop', 'ids|timestamp')
    url.searchParams.set('titles', String(title || ''))
    url.searchParams.set('format', 'json')
    url.searchParams.set('formatversion', '2')
    const result = await this.requestJson(url)
    if (!result?.ok) return { ok: false, error: result?.error || 'wiki revision failed', waf: result?.waf, status: result?.status }
    const page = result.json?.query?.pages?.[0]
    const revision = page?.revisions?.[0]
    if (!revision) return { ok: false, error: 'page not found', missing: page?.missing === true }
    return { ok: true, revid: revision.revid, timestamp: revision.timestamp }
  }
}
