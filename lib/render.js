import { firstLine, formatTs } from './format.js'
import { shorten } from './store/text.js'

function list(values) {
  return Array.isArray(values) ? values.filter(Boolean) : []
}

export function renderStatus(value) {
  const lines = []
  const engine = value.engine || {}
  lines.push('dsh-lore-companion ' + (value.version || '?') + ' | engine: ' + (engine.status || 'unknown') + (engine.detail ? ' (' + engine.detail + ')' : ''))
  if (value.dataDir) lines.push('data: ' + value.dataDir)
  if (engine.python) lines.push('python: ' + engine.python + (engine.source ? ' (' + engine.source + ')' : ''))
  for (const game of list(value.games)) {
    if (!game || !game.id) continue
    const window = game.window
    if (window) {
      lines.push(game.id + ': ' + (window.title || window.process || 'window') + ' ' + (window.width || '?') + 'x' + (window.height || '?') + (window.minimized ? ' minimized' : ''))
    } else {
      lines.push(game.id + ': not running / no matching window')
    }
  }
  if (value.ocr) {
    lines.push('ocr: ' + (value.ocr.ready ? 'ready' : 'not warmed') + (value.ocr.warmupMs != null ? ' (' + value.ocr.warmupMs + 'ms)' : '') + (value.ocr.error ? ' — ' + value.ocr.error : ''))
  }
  if (value.wiki) {
    const parts = list(value.wiki).map((item) => item.game + ' ' + item.pages + 'p/' + Math.round((item.bytes || 0) / 1024) + 'KB')
    lines.push('wiki: ' + (parts.length ? parts.join(', ') : 'empty'))
  }
  if (value.overlay) {
    const state = value.overlay.state || {}
    lines.push('overlay: ' + (value.overlay.running ? 'running' : 'stopped') + (state.visible ? ' · visible' : '') + (state.status ? ' · ' + state.status : ''))
  }
  if (value.sources) {
    const akasha = value.sources.akasha || {}
    const web = value.sources.web || {}
    lines.push('sources: akasha ' + (akasha.enabled ? 'on' : 'off') + (akasha.url ? ' (' + akasha.url + ')' : '') + ' | web ' + (web.enabled ? (web.available ? 'on' : 'unavailable') : 'off'))
  }
  if (value.watch) {
    lines.push('watch: ' + (value.watch.running ? 'running' : 'stopped') + ' · ' + (value.watch.intervalSec || '?') + 's' + (value.watch.session ? ' · ' + value.watch.session : '') + (value.watch.ticks ? ' · ' + value.watch.ticks + ' tick(s)' : ''))
  }
  if (Array.isArray(value.frames)) {
    const latest = value.frames.slice(0, 4).map((frame) => frame.id + ' ' + frame.game + '/' + frame.source).join(', ')
    lines.push('frames: ' + (value.frames.length ? value.frames.length + ' recent' + (latest ? ' (' + latest + ')' : '') : 'none'))
  }
  for (const session of list(value.sessions).slice(0, 6)) {
    lines.push('session ' + session.game + '/' + session.session + ': ' + (session.entries || 0) + ' entries, last ' + formatTs(session.lastTs || '', 'Asia/Shanghai'))
  }
  if (value.preview) {
    const preview = value.preview
    lines.push('preview: ' + (preview.text ? preview.text : '(no text)') + ' | region ' + (preview.region?.method || '?') + (preview.empty ? ' | empty' : ''))
  }
  if (value.previewError) lines.push('preview failed: ' + value.previewError)
  for (const warning of list(value.warnings)) lines.push('warning: ' + warning)
  return lines.join('\n')
}

export function renderCapture(value) {
  const lines = []
  if (value.duplicate) {
    lines.push('Duplicate line (' + (value.entries?.[0]?.similarity ?? 1) + '): ' + firstLine(value.entries?.[0]?.text || value.text || '', 140))
  } else if (value.empty) {
    lines.push('No dialogue text found in the capture region.')
  } else if (value.skipped) {
    lines.push('Skipped: the captured region does not look like a dialogue box.')
    if (value.text) lines.push('OCR: ' + firstLine(value.text, 140))
  } else if (value.captured) {
    lines.push('Captured ' + (value.entries?.length || 0) + ' line(s) from ' + (value.game || 'game') + ' (' + (value.backend || 'capture') + ').')
    for (const entry of list(value.entries).slice(0, 6)) {
      const title = entry.speakerTitle ? '（' + entry.speakerTitle + '）' : ''
      const speaker = entry.speaker ? entry.speaker + title + '：' : ''
      lines.push((entry.kind === 'read' ? '[read] ' : '') + speaker + firstLine(entry.text || '', 160))
      if (Array.isArray(entry.choices) && entry.choices.length) lines.push('  choices: ' + entry.choices.join(' / '))
    }
  } else {
    lines.push('No new text captured.')
  }
  if (value.frameId) lines.push('frame archived: ' + value.frameId)
  if (value.persisted === false) lines.push('warning: OCR succeeded but the log was not persisted.')
  if (value.foreground && value.foreground.hwnd) {
    if (value.isForeground === false) lines.push('warning: the game window is not in the foreground.')
  }
  if (value.occluded?.available && value.occluded.occluded_ratio > 0) {
    lines.push('occlusion: ' + Math.round(value.occluded.occluded_ratio * 100) + '%')
  }
  for (const warning of list(value.warnings)) lines.push('warning: ' + warning)
  return lines.join('\n')
}

export function renderQuery(value) {
  const lines = []
  const query = value.query ? ' for "' + value.query + '"' : ''
  if (value.log) {
    const entries = list(value.log.entries)
    lines.push('Log' + query + ': ' + (value.log.total ?? entries.length) + ' hit(s).')
    for (const entry of entries.slice(0, 8)) {
      const speaker = entry.speaker ? entry.speaker + '：' : ''
      lines.push('[' + formatTs(entry.ts, entry.tz) + '] ' + speaker + firstLine(entry.text, 180))
      for (const before of list(entry.contextBefore)) lines.push('  … ' + (before.speaker ? before.speaker + '：' : '') + firstLine(before.text, 120))
      for (const after of list(entry.contextAfter)) lines.push('  … ' + (after.speaker ? after.speaker + '：' : '') + firstLine(after.text, 120))
    }
  }
  if (value.wiki) {
    const results = list(value.wiki.results)
    lines.push('Wiki: ' + (results.length ? results.length + ' result(s).' : 'no results.'))
    for (const result of results.slice(0, 5)) {
      lines.push('[' + (result.title || '?') + '] ' + shorten(result.snippet || result.summary || '', 220) + (result.stale ? ' (stale)' : ''))
      if (result.url) lines.push('  ' + result.url)
    }
  }
  if (value.akasha) {
    const results = list(value.akasha.results)
    lines.push('Akasha 虚空终端: ' + (results.length ? results.length + ' result(s).' : 'no results.'))
    for (const result of results.slice(0, 6)) {
      const kind = result.kind === 'content' ? '内容' : '书目'
      lines.push('[' + kind + '] ' + (result.title || '?') + ' (' + (result.pathHash || '?') + ')' + (result.origin ? ' · ' + result.origin : ''))
      if (result.snippet) lines.push('  ' + shorten(result.snippet, 240))
      lines.push('  pathHash=' + (result.pathHash || '?') + ' — use akasha_read for the full text')
    }
  }
  if (value.web) {
    const results = list(value.web.results)
    lines.push('Web (DeepSeek search): ' + (results.length ? results.length + ' result(s).' : 'no results.'))
    if (value.web.content) lines.push('  ' + shorten(value.web.content, 360))
    for (const result of results.slice(0, 6)) {
      lines.push('[' + (result.title || '?') + '] ' + shorten(result.snippet || '', 220) + (result.publishedAt ? ' · ' + result.publishedAt : ''))
      if (result.url) lines.push('  ' + result.url)
    }
  }
  for (const warning of [...new Set(list(value.warnings))]) lines.push('warning: ' + warning)
  return lines.join('\n')
}

export function renderVision(value) {
  const lines = []
  const analysis = value.analysis || {}
  lines.push('Vision ' + (value.mode || 'all') + ' · ' + (value.source || '?') + (value.frameId ? ' · frame ' + value.frameId : value.imagePath ? ' · ' + value.imagePath : value.game ? ' · ' + value.game : ''))
  const metrics = analysis.metrics || {}
  if (metrics.panelCount != null) lines.push('UI panels: ' + metrics.panelCount + (metrics.uiConfidence != null ? ' (confidence ' + metrics.uiConfidence + ')' : ''))
  if (metrics.poiCandidates != null) lines.push('Map POI candidates: ' + metrics.poiCandidates + ' (likelihood ' + (metrics.mapLikelihood ?? '?') + ')')
  if (metrics.scene != null) lines.push('Semantic scene: ' + metrics.scene + (metrics.sceneScore != null ? ' (' + metrics.sceneScore + ')' : '') + (metrics.textBlocks != null ? ' · ' + metrics.textBlocks + ' OCR block(s)' : ''))
  for (const finding of list(analysis.findings).slice(0, 10)) {
    const box = finding.box ? ' [' + finding.box.x + ',' + finding.box.y + ' ' + finding.box.w + '×' + finding.box.h + ']' : ''
    lines.push('- ' + (finding.label || finding.short || finding.kind || 'finding') + (finding.score != null ? ' (' + finding.score + ')' : '') + box + (finding.detail ? ' — ' + finding.detail : ''))
    if (Array.isArray(finding.colors) && finding.colors.length) lines.push('  palette: ' + finding.colors.map((color) => color.hex + ' ' + Math.round((color.ratio || 0) * 100) + '%').join(' · '))
  }
  for (const warning of [...new Set(list(analysis.warnings).concat(list(value.warnings)))]) lines.push('warning: ' + warning)
  if (value.attachment) lines.push('annotated image attached')
  lines.push('Local heuristic analysis; treat weak map/POI findings as speculative.')
  return lines.join('\n')
}

export function renderWatch(value) {
  const lines = []
  lines.push('Watch ' + (value.action || 'status') + ': ' + (value.running ? 'running' : 'stopped') + ' · ' + (value.intervalSec || '?') + 's')
  if (value.session) lines.push('session: ' + value.session + (value.game ? ' · ' + value.game : '') + (value.mode ? ' · ' + value.mode : ''))
  lines.push('ticks: ' + (value.ticks || 0) + ' | captured ' + (value.captured || 0) + ' | duplicate ' + (value.duplicates || 0) + ' | skipped ' + (value.skipped || 0) + ' | empty ' + (value.empty || 0) + ' | errors ' + (value.errors || 0))
  if (value.lastAt) lines.push('last tick: ' + formatTs(value.lastAt, 'Asia/Shanghai'))
  if (value.lastResult) lines.push('last: ' + (value.lastResult.duplicate ? 'duplicate' : value.lastResult.skipped ? 'skipped' : value.lastResult.empty ? 'empty' : value.lastResult.captured ? 'captured' : 'noop') + (value.lastResult.speaker ? ' · ' + value.lastResult.speaker : '') + (value.lastResult.text ? ' — ' + firstLine(value.lastResult.text, 120) : ''))
  if (value.lastError) lines.push('last error: ' + value.lastError)
  lines.push('Explicit local polling; same capture checks; no model or network.')
  return lines.join('\n')
}

export function renderNarrate(value) {
  const lines = []
  lines.push('Narration material: ' + (value.lines?.length || 0) + ' line(s), ' + (value.scenes?.length || 0) + ' scene(s).')
  if (value.brief?.tone) lines.push('Style: ' + value.brief.tone + ' | ' + (value.brief.lengthHint || ''))
  if (value.background?.length) lines.push('Background: ' + value.background.map((item) => item.title).join(', '))
  lines.push('Write the narration yourself using the transcript and brief; do not call another model.')
  for (const warning of list(value.warnings)) lines.push('warning: ' + warning)
  return lines.join('\n')
}
