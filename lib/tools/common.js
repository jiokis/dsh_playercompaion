export const GAME_IDS = ['genshin', 'hsr']

export function resolveGame(value, { allowAll = false, allowAuto = true } = {}) {
  const text = String(value || '').trim().toLowerCase()
  if (!text || (allowAuto && text === 'auto')) return 'auto'
  if (allowAll && text === 'all') return 'all'
  if (GAME_IDS.includes(text)) return text
  throw new Error('unknown game: ' + JSON.stringify(value) + '; expected genshin, hsr' + (allowAll ? ', all' : '') + (allowAuto ? ' or auto' : ''))
}

export function localDate(now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    return map.year + '-' + map.month + '-' + map.day
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

export function resolveSession(value, now = new Date()) {
  const text = String(value || '').trim()
  if (!text) return localDate(now) + '-main'
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(text)) throw new Error('invalid session: use 1..40 chars from [A-Za-z0-9._-]')
  return text
}

export function parseDate(value, name) {
  if (value == null || value === '') return null
  const parsed = Date.parse(String(value))
  if (!Number.isFinite(parsed)) throw new Error('invalid ' + name + ': expected an ISO 8601 date/time')
  return new Date(parsed).toISOString()
}

export function validateRegion(value) {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('region must be an object with x/y/w/h normalized to 0..1')
  const out = { x: Number(value.x), y: Number(value.y), w: Number(value.w), h: Number(value.h) }
  if (![out.x, out.y, out.w, out.h].every(Number.isFinite) || out.x < 0 || out.y < 0 || out.w <= 0 || out.h <= 0 || out.x + out.w > 1 || out.y + out.h > 1) {
    throw new Error('region x/y/w/h must be normalized to 0..1 and stay inside the frame')
  }
  return out
}

export function clampInt(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.floor(number)))
}

export function asArray(value) {
  return Array.isArray(value) ? value : []
}

export function captureParams(config, args) {
  return {
    game: args.game || 'auto',
    window: args.window || undefined,
    mode: args.mode || 'dialogue',
    region: args.region || undefined,
    force: Boolean(args.force),
    require_foreground: !args.force,
    include_image: Boolean(args.includeImage),
    settle_ms: config.capture.settleMs,
    max_settle_ms: config.capture.maxSettleMs,
    min_score: config.capture.minScore,
    ocr_max_side: config.capture.ocrMaxSide,
    occlusion_threshold: config.capture.occlusionThreshold,
    backend: config.capture.backend,
    output_index: config.capture.outputIndex ?? undefined
  }
}

export async function saveImageAttachment(ctx, base64) {
  if (!base64) return null
  if (!ctx?.attachments?.saveImage) throw new Error('attachments service is not available')
  const data = Buffer.from(String(base64), 'base64')
  return ctx.attachments.saveImage({ data, mediaType: 'image/png' })
}
