const WATERMARK_MIN_LENGTH = 5
const WATERMARK_MIN_COUNT = 3
const DIGIT_RUN = /\d{5,}/g
const UID_PATTERN = /UID\s*[:：]?\s*\d{4,}/gi
const ARTIFACT_LINE = /^[\d\s:：.,%+\-/\\|()\[\]<>]+$/
const CJK = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/
// Ellipsis-only replies are real dialogue; they must survive the artifact filter.
const MEANINGFUL = /[\u2026\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/
// Broadcast tickers OCR into caps-only soup such as "TM.rMAR!.PSGAT!".
const ASCII_TOKEN = /[A-Za-z0-9!._:'"~^\/-]{6,}/g
const BUILD_STAMP = /_[A-Z]\d{4,}_/
const LONG_DIGITS = /\d{8,}/g

function isGibberish(token) {
  const separators = (token.match(/[.!:]/g) || []).length
  if (separators >= 2) return true
  return token.length >= 10 && /^[A-Za-z0-9!]+$/.test(token)
}

function stripAsciiNoise(text) {
  return text.replace(ASCII_TOKEN, (token) => (isGibberish(token) ? ' ' : token))
}

/**
 * OCR picks up the game's UID watermark that sits in the same capture band as
 * the subtitle, so long digit runs get glued onto dialogue. Counting repeats
 * across a session isolates that watermark from numbers that are part of the
 * story text.
 */
export function detectWatermarks(records) {
  const counts = new Map()
  for (const record of records) {
    for (const run of String(record?.text ?? '').match(DIGIT_RUN) || []) {
      counts.set(run, (counts.get(run) || 0) + 1)
    }
  }
  const marks = new Set()
  for (const [run, count] of counts) {
    if (count < WATERMARK_MIN_COUNT) continue
    marks.add(run)
    // The watermark is often clipped at the head, so every long suffix counts too.
    for (let offset = 1; offset <= run.length - WATERMARK_MIN_LENGTH; offset += 1) {
      marks.add(run.slice(offset))
    }
  }
  return marks
}

function isArtifactLine(line) {
  if (!line) return true
  if (ARTIFACT_LINE.test(line)) return true
  if (BUILD_STAMP.test(line)) return true
  return !MEANINGFUL.test(line) && line.length <= 8
}

function joinWrapped(lines) {
  let out = ''
  for (const line of lines) {
    if (!out) {
      out = line
      continue
    }
    const left = out.slice(-1)
    const right = line.slice(0, 1)
    out += CJK.test(left) && CJK.test(right) ? line : ' ' + line
  }
  return out
}

export function cleanOcrText(value, marks = new Set()) {
  let text = String(value ?? '')
  if (!text) return ''
  text = text.replace(UID_PATTERN, ' ').replace(LONG_DIGITS, ' ')
  text = stripAsciiNoise(text)
  for (const mark of marks) {
    if (mark.length < WATERMARK_MIN_LENGTH) continue
    if (text.includes(mark)) text = text.split(mark).join(' ')
  }
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => !isArtifactLine(line))
  return joinWrapped(lines)
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([，。！？；：、）」』】])/g, '$1')
    .replace(/([（「『【])\s+/g, '$1')
    .trim()
}

/** Cleaned text is what every reader sees; raw JSONL stays untouched on disk. */
export function cleanRecords(records) {
  const marks = detectWatermarks(records)
  const out = []
  for (const record of records) {
    const text = cleanOcrText(record.text, marks)
    if (!text && !(Array.isArray(record.choices) && record.choices.length)) continue
    out.push(text === record.text ? record : { ...record, text })
  }
  return out
}

/** First readable clause, used for extractive headlines and scene titles. */
export function firstClause(value, limit = 28) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const cut = text.split(/[。！？；，.!?;]/).find((part) => part.trim().length >= 4)
  const phrase = (cut || text).trim()
  return phrase.length <= limit ? phrase : phrase.slice(0, limit - 1) + '…'
}
