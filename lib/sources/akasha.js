const PROTOCOL_VERSION = '2024-11-05'
const CLIENT_INFO = { name: 'dsh-lore-companion', version: '0.7.5' }
const WORLDS = { genshin: 'gi', hsr: 'hsr' }

function asText(value) {
  return typeof value === 'string' ? value : ''
}

function errorWithCode(code, message, detail) {
  const error = new Error(message)
  error.code = code
  if (detail !== undefined) error.detail = detail
  return error
}

function pickRpcMessage(payload, id) {
  if (!payload) return null
  if (Array.isArray(payload)) {
    return payload.find((item) => item && item.id === id) || payload.find((item) => item && (item.result || item.error)) || null
  }
  if (payload.id === id || payload.result || payload.error) return payload
  return null
}

function parseMcpBody(text, contentType, id) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null
  if (contentType.includes('text/event-stream') || trimmed.includes('\ndata:') || trimmed.startsWith('data:') || trimmed.startsWith('event:')) {
    const messages = []
    for (const line of trimmed.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue
      const raw = line.slice(5).trim()
      if (!raw || raw === '[DONE]') continue
      try {
        messages.push(JSON.parse(raw))
      } catch {
        /* skip malformed event */
      }
    }
    return pickRpcMessage(messages, id)
  }
  try {
    return pickRpcMessage(JSON.parse(trimmed), id)
  } catch {
    return null
  }
}

function cleanOrigin(value) {
  return String(value || '').replace(/^来源=/, '').trim()
}

export function parseAkashaSearch(text, limit = 10) {
  const results = []
  const byHash = new Map()
  let section = 'book'
  let current = null
  for (const line of String(text || '').split(/\r?\n/)) {
    if (/^书名命中/.test(line)) {
      section = 'book'
      current = null
      continue
    }
    if (/^内容命中/.test(line)) {
      section = 'content'
      current = null
      continue
    }
    if (/^知识图谱/.test(line)) {
      section = 'graph'
      current = null
      continue
    }
    if (!line.startsWith('- ')) {
      const snippet = line.match(/^\s+L(\d+):\s*(.*)$/)
      if (snippet && current) {
        current.lines.push({ line: Number(snippet[1]), text: snippet[2] })
        current.snippetParts.push(snippet[2])
      }
      continue
    }
    const parts = line.slice(2).split(' | ')
    if (parts.length < 4) continue
    const pathHash = parts[1]
    if (!/^doc_[0-9a-f]+$/.test(pathHash)) continue
    const title = parts[0].trim()
    const lineCount = Number(String(parts[2]).replace(/[^0-9]/g, '')) || 0
    const origin = cleanOrigin(parts[3])
    const tags = parts.slice(4).join(' | ').trim()
    let item = byHash.get(pathHash)
    if (!item) {
      item = {
        source: 'akasha',
        kind: section === 'content' ? 'content' : 'book',
        title,
        pathHash,
        lineCount,
        origin,
        tags,
        snippet: '',
        lines: [],
        snippetParts: []
      }
      byHash.set(pathHash, item)
      results.push(item)
    } else if (section === 'content') {
      item.kind = 'content'
    }
    current = item
  }
  const output = results.map((item) => ({
    source: 'akasha',
    kind: item.kind,
    title: item.title,
    pathHash: item.pathHash,
    lineCount: item.lineCount,
    origin: item.origin,
    tags: item.tags,
    snippet: item.snippetParts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 600),
    lines: item.lines.slice(0, 8)
  }))
  output.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'content' ? -1 : 1))
  return output.slice(0, Math.max(1, limit))
}

export class AkashaClient {
  constructor({ config, fetchImpl = globalThis.fetch } = {}) {
    this.config = config
    this.fetchImpl = fetchImpl
    this.nextId = 0
    this.sessionId = null
    this.initialized = false
    this.initPromise = null
  }

  configValue() {
    return this.config?.sources?.akasha || {}
  }

  async search({ game = 'all', query = '', limit = 5, signal } = {}) {
    const settings = this.configValue()
    if (!settings.enabled) return { results: [], warnings: ['akasha_disabled'] }
    const keyword = String(query || '').trim()
    if (!keyword) return { results: [], warnings: ['akasha_no_query'] }
    const worlds = game === 'all' ? ['gi', 'hsr'] : [WORLDS[game] || 'gi']
    const warnings = []
    const batches = await Promise.all(worlds.map(async (world) => {
      try {
        const result = await this.searchWorld(world, keyword, limit, signal)
        warnings.push(...result.warnings)
        return result.results
      } catch (error) {
        warnings.push('akasha_error(' + world + '): ' + (error.code ? error.code + ' ' : '') + error.message)
        return []
      }
    }))
    const seen = new Set()
    const results = []
    for (const item of batches.flat()) {
      const key = item.pathHash || item.title
      if (seen.has(key)) continue
      seen.add(key)
      results.push(item)
    }
    return { results: results.slice(0, Math.max(1, limit)), warnings: [...new Set(warnings)] }
  }

  async searchWorld(world, keyword, limit, signal) {
    const result = await this.rpc('tools/call', {
      name: 'akasha_search',
      arguments: { world, keyword, maxResults: Math.max(1, Math.min(20, limit)) }
    }, signal)
    const payload = result.result || {}
    if (payload.isError) {
      const message = (payload.content || []).map((item) => asText(item.text)).join(' ').trim()
      throw errorWithCode('AKASHA_TOOL_ERROR', message || 'akasha_search returned isError')
    }
    const text = (payload.content || [])
      .filter((item) => item && item.type === 'text')
      .map((item) => asText(item.text))
      .join('\n')
    const results = parseAkashaSearch(text, limit)
    return { results, warnings: results.length ? [] : ['akasha_no_results'] }
  }

  async ensureInitialized(signal) {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise
    this.initPromise = (async () => {
      const response = await this.rpc('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: CLIENT_INFO
      }, signal)
      this.initialized = true
      return response
    })().finally(() => {
      this.initPromise = null
    })
    return this.initPromise
  }

  async rpc(method, params, signal) {
    if (method !== 'initialize') await this.ensureInitialized(signal)
    const id = ++this.nextId
    const { payload, sessionId } = await this.post({ jsonrpc: '2.0', id, method, params }, signal)
    if (sessionId) this.sessionId = sessionId
    if (!payload) throw errorWithCode('AKASHA_BAD_RESPONSE', 'empty MCP response for ' + method)
    if (payload.error) {
      throw errorWithCode('AKASHA_RPC_ERROR', payload.error.message || ('MCP error for ' + method), payload.error)
    }
    return { result: payload.result || {}, sessionId }
  }

  async post(message, signal) {
    const settings = this.configValue()
    const url = String(settings.url || '').trim()
    if (!url) throw errorWithCode('AKASHA_CONFIG', 'sources.akasha.url is empty')
    const controller = new AbortController()
    const timeoutMs = Math.max(2000, Number(settings.timeoutMs) || 12000)
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onAbort = () => controller.abort()
    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }
    try {
      const headers = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': PROTOCOL_VERSION
      }
      if (this.sessionId) headers['mcp-session-id'] = this.sessionId
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        signal: controller.signal
      })
      const sessionId = response.headers?.get?.('mcp-session-id') || null
      const text = await response.text()
      const payload = parseMcpBody(text, String(response.headers?.get?.('content-type') || ''), message.id)
      if (!response.ok) {
        throw errorWithCode('AKASHA_HTTP_' + response.status, 'akasha HTTP ' + response.status + ': ' + text.slice(0, 240))
      }
      return { payload, sessionId }
    } catch (error) {
      if (error.name === 'AbortError') throw errorWithCode('AKASHA_TIMEOUT', 'akasha request timed out after ' + timeoutMs + 'ms')
      throw error
    } finally {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
    }
  }
}
