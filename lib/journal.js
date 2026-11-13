import { isNoiseEntry, normalizeSpeaker } from './speakers.js'

const EVENT_GAP_MS = 6 * 60 * 1000

function short(value, limit = 56) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function pairKey(left, right) {
  return left < right ? left + '\u0000' + right : right + '\u0000' + left
}

/**
 * Build a read-only journal snapshot from local dialogue lines.
 * Events are time-gap segments; summaries are literal first lines, not model output.
 */
export function buildJournal(logStore, options = {}) {
  const game = options.game === 'hsr' ? 'hsr' : 'genshin'
  const sessions = logStore.sessions(game)
  const limit = Math.max(20, Math.min(1200, Number(options.limit) || 600))
  const all = logStore.allEntries(game).records.filter((entry) => !isNoiseEntry(entry))
  const fallback = sessions.find((item) => all.some((entry) => entry.session === item.session))
  const selected = String(options.session || fallback?.session || sessions[0]?.session || '')
  const filtered = all.filter((entry) => !selected || entry.session === selected)
  const entries = filtered.slice(-limit).map((entry, index) => ({
    index,
    id: entry.utteranceId || game + ':' + entry.ts,
    ts: entry.ts,
    session: entry.session,
    speaker: normalizeSpeaker(entry.speaker),
    speakerTitle: entry.speakerTitle || '',
    text: entry.text || '',
    choices: Array.isArray(entry.choices) ? entry.choices.slice(0, 6) : []
  }))

  const events = []
  let current = null
  for (const entry of entries) {
    const time = Date.parse(entry.ts)
    const previous = current ? Date.parse(current.endTs) : NaN
    if (!current || (Number.isFinite(time) && Number.isFinite(previous) && time - previous > EVENT_GAP_MS)) {
      current = {
        id: 'event-' + (events.length + 1),
        startTs: entry.ts,
        endTs: entry.ts,
        entries: []
      }
      events.push(current)
    }
    current.endTs = entry.ts
    current.entries.push(entry)
  }

  for (const event of events) {
    const speakers = []
    for (const entry of event.entries) {
      if (entry.speaker && !speakers.includes(entry.speaker)) speakers.push(entry.speaker)
    }
    const first = event.entries.find((entry) => entry.text) || event.entries[0]
    const second = event.entries.find((entry) => entry.text && entry !== first)
    event.speakers = speakers
    event.lineCount = event.entries.length
    event.title = (first?.speaker ? first.speaker + ' · ' : '') + short(first?.text, 38)
    event.summary = [first, second]
      .filter(Boolean)
      .map((entry) => (entry.speaker ? entry.speaker + '：' : '') + short(entry.text, 70))
      .join(' / ')
  }

  const characterMap = new Map()
  for (const entry of entries) {
    if (!entry.speaker) continue
    const existing = characterMap.get(entry.speaker) || {
      name: entry.speaker,
      title: entry.speakerTitle || '',
      lines: 0,
      firstTs: entry.ts,
      lastTs: entry.ts
    }
    existing.lines += 1
    if (!existing.title && entry.speakerTitle) existing.title = entry.speakerTitle
    if (entry.ts < existing.firstTs) existing.firstTs = entry.ts
    if (entry.ts > existing.lastTs) existing.lastTs = entry.ts
    characterMap.set(entry.speaker, existing)
  }

  const relationMap = new Map()
  for (const event of events) {
    const speakers = event.speakers
    for (let i = 0; i < speakers.length; i += 1) {
      for (let j = i + 1; j < speakers.length; j += 1) {
        const key = pairKey(speakers[i], speakers[j])
        const relation = relationMap.get(key) || { a: speakers[i], b: speakers[j], events: 0, lastTs: event.endTs }
        relation.events += 1
        if (event.endTs > relation.lastTs) relation.lastTs = event.endTs
        relationMap.set(key, relation)
      }
    }
  }

  const characters = [...characterMap.values()].sort((a, b) => b.lines - a.lines || a.name.localeCompare(b.name))
  const relationships = [...relationMap.values()].sort((a, b) => b.events - a.events).slice(0, 24)
  return {
    game,
    session: selected,
    sessions,
    entries,
    events,
    characters,
    relationships,
    stats: {
      lines: entries.length,
      characters: characters.length,
      events: events.length,
      sessions: sessions.length,
      truncated: filtered.length > entries.length
    },
    generatedAt: new Date().toISOString()
  }
}
