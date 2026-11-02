import { createHash } from 'node:crypto'

const SPACE_RE = /[\s\u3000]+/g
const PUNCT_MAP = new Map([
  ['\u3002', '.'], ['\uff0e', '.'], ['\uff01', '!'], ['\uff1f', '?'],
  ['\uff0c', ','], ['\uff1b', ';'], ['\uff1a', ':'], ['\u3001', ','],
  ['\u201c', '"'], ['\u201d', '"'], ['\u2018', "'"], ['\u2019', "'"],
  ['\u3010', '['], ['\u3011', ']'], ['\u300a', '<'], ['\u300b', '>']
])
const PUNCT_STRIP = /[.,!?;:'"()\[\]{}<>\u300a\u300b\u300c\u300d\u300e\u300f\u2026\u00b7~\uff5e\-\u2014]/g

export function normalizeText(value) {
  let out = String(value ?? '').normalize('NFKC').replace(SPACE_RE, '')
  for (const [from, to] of PUNCT_MAP) out = out.split(from).join(to)
  out = out.replace(/\.{2,}/g, '...')
  return out.toLowerCase()
}

export function matchKey(value) {
  return normalizeText(value).replace(PUNCT_STRIP, '')
}

export function sha1(value) {
  return createHash('sha1').update(String(value ?? ''), 'utf8').digest('hex')
}

export function textHash(value) {
  return sha1(matchKey(value)).slice(0, 16)
}

export function bigrams(value) {
  const text = matchKey(value)
  const out = new Set()
  if (text.length < 2) {
    if (text) out.add(text)
    return out
  }
  for (let index = 0; index < text.length - 1; index += 1) out.add(text.slice(index, index + 2))
  return out
}

export function similarity(left, right) {
  const a = bigrams(left)
  const b = bigrams(right)
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const item of a) if (b.has(item)) intersection += 1
  return intersection / (a.size + b.size - intersection)
}

export function levenshtein(left, right) {
  const a = String(left ?? '')
  const b = String(right ?? '')
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_value, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
    }
    previous = current
  }
  return previous[b.length]
}

export function editSimilarity(left, right) {
  const a = matchKey(left)
  const b = matchKey(right)
  const longest = Math.max(a.length, b.length)
  if (!longest) return 1
  return 1 - levenshtein(a, b) / longest
}

export function scoreText(text, query) {
  const q = matchKey(query)
  const t = matchKey(text)
  if (!q || !t) return 0
  if (t.includes(q)) return 3
  return similarity(t, q)
}

export function isPunctuationOnly(value) {
  return matchKey(value).length === 0
}

export function shorten(value, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return text.slice(0, Math.max(0, max - 1)) + '…'
}
