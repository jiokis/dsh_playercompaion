import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { matchKey, scoreText, shorten } from './text.js'
import { cleanRecords } from './clean.js'

function safeJson(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

function readJsonFile(path, fallback) {
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

function emptyIndex() {
  return { v: 1, games: {}, updatedAt: null }
}

function monthKey(ts) {
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return null
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
}

export class LogStore {
  constructor({ dataDir }) {
    this.dataDir = dataDir
    this.logsDir = join(dataDir, 'logs')
    this.indexPath = join(this.logsDir, 'index.json')
    this.index = null
  }

  ensure() {
    mkdirSync(this.logsDir, { recursive: true })
  }

  loadIndex() {
    if (this.index) return this.index
    const loaded = readJsonFile(this.indexPath, null)
    this.index = loaded && typeof loaded === 'object' && loaded.games && typeof loaded.games === 'object' ? loaded : emptyIndex()
    return this.index
  }

  saveIndex() {
    this.ensure()
    this.index.updatedAt = new Date().toISOString()
    writeJsonAtomic(this.indexPath, this.index)
  }

  fileFor(game, ts) {
    const month = monthKey(ts)
    if (!month) throw new Error('invalid timestamp: ' + String(ts))
    return join(this.logsDir, game, month + '.jsonl')
  }

  append(record) {
    this.ensure()
    const path = this.fileFor(record.game, record.ts)
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, JSON.stringify(record) + '\n', 'utf8')
    const index = this.loadIndex()
    const gameEntry = index.games[record.game] || { sessions: {}, updatedAt: null }
    const session = gameEntry.sessions[record.session] || { firstTs: record.ts, lastTs: record.ts, entries: 0, file: path }
    session.firstTs = session.firstTs && session.firstTs < record.ts ? session.firstTs : record.ts
    session.lastTs = session.lastTs && session.lastTs > record.ts ? session.lastTs : record.ts
    session.entries = Number(session.entries || 0) + (record.op === 'dialogue' ? 1 : 0)
    session.file = path
    gameEntry.sessions[record.session] = session
    gameEntry.updatedAt = new Date().toISOString()
    index.games[record.game] = gameEntry
    this.saveIndex()
    return record
  }

  appendSeen(record) {
    this.ensure()
    const path = this.fileFor(record.game, record.ts)
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, JSON.stringify(record) + '\n', 'utf8')
    return record
  }

  readFile(path) {
    let raw
    try {
      raw = readFileSync(path, 'utf8')
    } catch {
      return { records: [], corrupt: 0 }
    }
    const records = []
    let corrupt = 0
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        const value = JSON.parse(line)
        if (value && typeof value === 'object' && (value.op === 'dialogue' || value.op === 'seen')) records.push(value)
      } catch {
        corrupt += 1
      }
    }
    return { records, corrupt }
  }

  readAll(game) {
    this.ensure()
    const dir = join(this.logsDir, game)
    if (!existsSync(dir)) return { records: [], corrupt: 0, files: [] }
    const files = readdirSync(dir)
      .filter((name) => name.endsWith('.jsonl'))
      .sort()
      .map((name) => join(dir, name))
    const records = []
    let corrupt = 0
    for (const file of files) {
      const result = this.readFile(file)
      records.push(...result.records)
      corrupt += result.corrupt
    }
    records.sort((a, b) => String(a.ts).localeCompare(String(b.ts)))
    return { records, corrupt, files }
  }

  fold(records) {
    const byId = new Map()
    const order = []
    for (const record of records) {
      if (record.op === 'dialogue') {
        if (!byId.has(record.utteranceId)) {
          byId.set(record.utteranceId, { ...record, seenCount: 0, lastSeenAt: record.ts })
          order.push(record.utteranceId)
        }
      } else if (record.op === 'seen' && byId.has(record.utteranceId)) {
        const entry = byId.get(record.utteranceId)
        entry.seenCount += 1
        if (!entry.lastSeenAt || entry.lastSeenAt < record.ts) entry.lastSeenAt = record.ts
      }
    }
    return order.map((id) => byId.get(id))
  }

  allEntries(game) {
    if (game === 'all') {
      const left = this.allEntries('genshin')
      const right = this.allEntries('hsr')
      return {
        records: [...left.records, ...right.records].sort((a, b) => String(a.ts).localeCompare(String(b.ts))),
        corrupt: left.corrupt + right.corrupt,
        files: [...left.files, ...right.files]
      }
    }
    const { records, corrupt, files } = this.readAll(game)
    // Readers get OCR-cleaned text; the JSONL on disk keeps what the engine saw.
    return { records: cleanRecords(this.fold(records)), corrupt, files }
  }

  recent(game, options = {}) {
    const limit = Math.max(1, Math.min(500, Number(options.limit) || 20))
    const entries = this.allEntries(game).records
    const since = options.since ? Date.parse(options.since) : null
    const until = options.until ? Date.parse(options.until) : null
    return entries
      .filter((entry) => !options.session || entry.session === options.session)
      .filter((entry) => !since || Date.parse(entry.ts) >= since)
      .filter((entry) => !until || Date.parse(entry.ts) <= until)
      .slice(-limit)
  }

  query(game, options = {}) {
    const limit = Math.max(1, Math.min(50, Number(options.limit) || 10))
    const context = Math.max(0, Math.min(3, Number(options.context) || 0))
    const all = this.allEntries(game)
    const entries = all.records
    const since = options.since ? Date.parse(options.since) : null
    const until = options.until ? Date.parse(options.until) : null
    const filtered = entries
      .filter((entry) => !options.session || entry.session === options.session)
      .filter((entry) => !since || Date.parse(entry.ts) >= since)
      .filter((entry) => !until || Date.parse(entry.ts) <= until)
    if (!options.query) {
      return { entries: filtered.slice(-limit).reverse(), total: filtered.length, scanned: { files: all.files, corrupt: all.corrupt } }
    }
    const scored = []
    for (let index = 0; index < filtered.length; index += 1) {
      const entry = filtered[index]
      const textScore = scoreText(entry.text, options.query)
      const speakerScore = entry.speaker ? (matchKey(entry.speaker) === matchKey(options.query) ? 4 : scoreText(entry.speaker, options.query)) : 0
      const titleScore = entry.speakerTitle ? scoreText(entry.speakerTitle, options.query) : 0
      const score = Math.max(textScore, speakerScore, titleScore)
      if (score <= 0) continue
      scored.push({ entry, index, score })
    }
    scored.sort((a, b) => (b.score - a.score) || String(b.entry.ts).localeCompare(String(a.entry.ts)))
    const selected = scored.slice(0, limit)
    const out = selected.map(({ entry, index, score }) => ({
      ...entry,
      score: Number(score.toFixed(3)),
      contextBefore: context ? filtered.slice(Math.max(0, index - context), index).map((item) => ({ ts: item.ts, speaker: item.speaker, text: item.text })) : [],
      contextAfter: context ? filtered.slice(index + 1, index + 1 + context).map((item) => ({ ts: item.ts, speaker: item.speaker, text: item.text })) : []
    }))
    return { entries: out, total: scored.length, scanned: { files: all.files, corrupt: all.corrupt } }
  }

  sessions(game) {
    const index = this.loadIndex()
    const out = []
    for (const [id, entry] of Object.entries(index.games?.[game]?.sessions || {})) {
      out.push({ game, session: id, firstTs: entry.firstTs, lastTs: entry.lastTs, entries: entry.entries })
    }
    return out.sort((a, b) => String(b.lastTs).localeCompare(String(a.lastTs)))
  }

  transcript(entries) {
    return entries.map((entry) => {
      const speaker = entry.speaker ? entry.speaker + '：' : ''
      return speaker + shorten(entry.text, 500)
    }).join('\n')
  }
}
