function asNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export class WebSource {
  constructor({ config, getWeb } = {}) {
    this.config = config
    this.getWeb = getWeb
  }

  settings() {
    return this.config?.sources?.web || {}
  }

  available() {
    try {
      const web = typeof this.getWeb === 'function' ? this.getWeb() : null
      return Boolean(web && typeof web.search === 'function')
    } catch {
      return false
    }
  }

  async search({ query = '', limit = 5, signal } = {}) {
    const settings = this.settings()
    if (!settings.enabled) return { results: [], warnings: ['web_disabled'] }
    const keyword = String(query || '').trim()
    if (!keyword) return { results: [], warnings: ['web_no_query'] }
    let web = null
    try {
      web = typeof this.getWeb === 'function' ? this.getWeb() : null
    } catch {
      web = null
    }
    if (!web || typeof web.search !== 'function') {
      return { results: [], warnings: ['web_unavailable: the DSH ctx.web search service is not mounted'] }
    }
    try {
      const result = await web.search({ query: keyword, maxResults: Math.max(1, Math.min(20, asNumber(limit, 5))), signal })
      const sources = Array.isArray(result?.sources) ? result.sources : []
      const results = sources.map((source) => ({
        source: 'web',
        title: source.title || source.url || 'web result',
        url: source.url || '',
        snippet: source.snippet || '',
        publishedAt: source.publishedAt || null
      })).filter((item) => item.url)
      return {
        content: typeof result?.content === 'string' ? result.content : '',
        results,
        truncated: Boolean(result?.truncated),
        warnings: results.length ? [] : ['web_no_results']
      }
    } catch (error) {
      const code = error && error.code ? String(error.code) : 'WEB_ERROR'
      return { results: [], warnings: ['web_error: ' + code + ' ' + (error?.message || String(error))] }
    }
  }
}
