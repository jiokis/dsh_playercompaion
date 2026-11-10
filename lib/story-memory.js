import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const MEMORY_VERSION = 1

function clean(value, limit = 400) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

export function buildStoryMemory({ journal, synopsis, curated, game = 'genshin' }) {
  const entries = Array.isArray(journal?.entries) ? journal.entries : []
  const arcs = Array.isArray(synopsis?.arcs) && synopsis.arcs.length
    ? synopsis.arcs
    : Array.isArray(curated?.scenes)
      ? curated.scenes.map((scene, index) => ({ id: scene.id || 'scene-' + (index + 1), title: scene.title, summary: scene.summary, keyBeats: [] }))
      : []
  const scenes = arcs.map((arc, index) => ({
    id: arc.id || 'scene-' + (index + 1),
    title: clean(arc.title || '剧情段落', 80),
    range: clean(arc.range || '', 40),
    summary: clean(arc.summary || '', 500),
    keyBeats: Array.isArray(arc.keyBeats) ? arc.keyBeats.map((beat) => clean(beat, 180)).slice(0, 8) : [],
    characters: Array.isArray(arc.characters) ? arc.characters.map((name) => clean(name, 40)).slice(0, 12) : []
  }))
  const curatedLines = []
  for (const scene of (Array.isArray(curated?.scenes) ? curated.scenes : [])) {
    for (const line of (Array.isArray(scene.lines) ? scene.lines : [])) {
      curatedLines.push({
        ts: '',
        speaker: clean(line.speaker, 60),
        title: clean(scene.title, 80),
        text: clean(line.text, 500)
      })
    }
  }
  // Prefer the AI-cleaned final scene over the session tail: the watcher may
  // keep logging menus/UI after the story ends, which is useless for a
  // companion context.
  const recentSource = curatedLines.length ? curatedLines : entries
  const recent = recentSource.slice(-40).map((entry) => ({
    ts: entry.ts || '',
    speaker: entry.speaker || '',
    title: entry.speakerTitle || entry.title || '',
    text: clean(entry.text, 500)
  }))
  return {
    version: MEMORY_VERSION,
    game,
    session: journal?.session || synopsis?.source?.session || '',
    title: clean(synopsis?.title || curated?.title || '录制剧情', 120),
    period: clean(synopsis?.period || synopsis?.source?.range || '', 80),
    updatedAt: new Date().toISOString(),
    source: synopsis?.source || curated?.source || null,
    scenes,
    characters: Array.isArray(journal?.characters) ? journal.characters.slice(0, 40).map((person) => ({
      name: clean(person.name, 60),
      title: clean(person.title, 80),
      lines: Number(person.lines) || 0,
      firstTs: person.firstTs || null,
      lastTs: person.lastTs || null
    })) : [],
    relationships: Array.isArray(journal?.relationships) ? journal.relationships.slice(0, 30).map((relation) => ({
      a: relation.a,
      b: relation.b,
      events: Number(relation.events) || 0,
      lastTs: relation.lastTs || null
    })) : [],
    threads: Array.isArray(synopsis?.unresolved) ? synopsis.unresolved.map((item) => clean(item, 240)).slice(0, 12) : [],
    recent
  }
}

export function memoryPath(dataDir) {
  return join(dataDir, 'journal', 'memory.json')
}

export function saveStoryMemory(dataDir, memory) {
  try {
    mkdirSync(join(dataDir, 'journal'), { recursive: true })
    const path = memoryPath(dataDir)
    const tmp = path + '.tmp'
    writeFileSync(tmp, JSON.stringify(memory, null, 2) + '\n', 'utf8')
    renameSync(tmp, path)
    return true
  } catch {
    return false
  }
}

export function loadStoryMemory(dataDir) {
  try {
    const path = memoryPath(dataDir)
    if (!existsSync(path)) return null
    const value = JSON.parse(readFileSync(path, 'utf8'))
    return value && value.version === MEMORY_VERSION ? value : null
  } catch {
    return null
  }
}

export function buildCompanionContext(memory, { limit = 8 } = {}) {
  if (!memory) return { text: '还没有可用的结构性记忆。', prompt: '', scene: null, recent: [], characters: [], threads: [] }
  const count = Math.max(1, Math.min(20, Number(limit) || 8))
  const recent = (memory.recent || []).slice(-count)
  const scene = (memory.scenes || [])[memory.scenes.length - 1] || null
  const active = new Map()
  for (const entry of recent) {
    if (entry.speaker) active.set(entry.speaker, (active.get(entry.speaker) || 0) + 1)
  }
  const characters = [...active.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6).map(([name, lines]) => ({ name, lines }))
  const threads = (memory.threads || []).slice(0, 4)
  const lines = []
  if (memory.title) lines.push('《' + memory.title + '》')
  if (scene) lines.push('当前阶段：' + scene.title + (scene.range ? '（' + scene.range + '）' : ''))
  if (scene?.summary) lines.push(scene.summary)
  if (recent.length) {
    lines.push('最近对话：')
    for (const entry of recent) lines.push((entry.speaker || '旁白') + '：' + entry.text)
  }
  if (threads.length) {
    lines.push('未解决：')
    for (const thread of threads) lines.push('- ' + thread)
  }
  const text = lines.join('\n')
  const prompt = [
    '你正在作为《原神》陪玩搭档和玩家对话。',
    '只使用下面这份本地录制记忆，不编造未记录的情节，不主动剧透未发生的剧情。',
    '如果玩家问到的内容不在记忆里，直说不确定，并建议查看当前画面或继续录制。',
    '',
    text
  ].join('\n')
  return {
    session: memory.session || null,
    title: memory.title || null,
    scene,
    recent,
    characters,
    threads,
    text,
    prompt
  }
}
