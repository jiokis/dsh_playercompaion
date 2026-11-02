import { createHash, randomBytes } from 'node:crypto'
import { editSimilarity, matchKey, textHash } from './text.js'

export function utteranceId({ game, session, text, speaker = null, kind = 'dialogue' }) {
  const material = [game, session, matchKey(text), speaker ?? '', kind].join('\n')
  return createHash('sha1').update(material, 'utf8').digest('hex').slice(0, 16)
}

export function newRecordId(now = new Date()) {
  return 'd' + now.getTime().toString(36) + randomBytes(4).toString('hex')
}

export function timeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
  } catch {
    return 'Asia/Shanghai'
  }
}

export function makeDialogueRecord({ game, session, kind = 'dialogue', speaker = null, speakerTitle = null, choices = [], text, lines = [], capture = {}, note = null, now = new Date() }) {
  const ts = now.toISOString()
  return {
    v: 1,
    op: 'dialogue',
    id: newRecordId(now),
    utteranceId: utteranceId({ game, session, text, speaker, kind }),
    ts,
    tz: timeZone(),
    game,
    session,
    kind,
    speaker: speaker || null,
    speakerTitle: speakerTitle || null,
    choices: Array.isArray(choices) ? choices.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
    text: String(text ?? '').trim(),
    textHash: textHash(text),
    normalized: matchKey(text),
    lines,
    capture,
    note: note == null ? null : String(note)
  }
}

export function makeSeenRecord({ game, session, utteranceId: id, now = new Date() }) {
  return {
    v: 1,
    op: 'seen',
    utteranceId: id,
    ts: now.toISOString(),
    game,
    session
  }
}

export function findDuplicate(entries, candidate, options = {}) {
  const windowMinutes = Number(options.windowMinutes ?? 10)
  const threshold = Number(options.similarity ?? 0.9)
  const compareLast = Number(options.compareLast ?? 30)
  const now = Number(options.now ?? Date.now())
  const cutoff = now - windowMinutes * 60 * 1000
  const candidateKey = matchKey(candidate.text)
  const recent = entries
    .filter((entry) => entry && entry.op !== 'seen' && entry.text)
    .filter((entry) => {
      const ts = Date.parse(entry.ts)
      return Number.isFinite(ts) && ts >= cutoff
    })
    .slice(-Math.max(1, compareLast))
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const entry = recent[index]
    if ((entry.speaker ?? null) !== (candidate.speaker ?? null)) continue
    if ((entry.kind ?? 'dialogue') !== (candidate.kind ?? 'dialogue')) continue
    if (entry.textHash === candidate.textHash) {
      return { record: entry, similarity: 1, exact: true }
    }
    const entryKey = entry.normalized ?? matchKey(entry.text)
    if (entryKey.length >= 8 && candidateKey.length >= 8) {
      const shorter = entryKey.length <= candidateKey.length ? entryKey : candidateKey
      const longer = entryKey.length <= candidateKey.length ? candidateKey : entryKey
      if (longer.startsWith(shorter) && shorter.length >= Math.max(8, Math.floor(longer.length * 0.6))) {
        return { record: entry, similarity: Number((shorter.length / longer.length).toFixed(4)), exact: false, prefix: true }
      }
    }
    if (candidateKey.length < 8) continue
    const value = editSimilarity(entryKey, candidateKey)
    if (value >= threshold) return { record: entry, similarity: value, exact: false }
  }
  return null
}
