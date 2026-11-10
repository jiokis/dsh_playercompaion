import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { buildJournal } from '../journal.js'
import { buildCompanionContext, buildStoryMemory, saveStoryMemory } from '../story-memory.js'
import { resolveGame } from './common.js'

const NOISE = /鼠标|键盘|WASD|IJKL|左键|右键|空格|Enter|Lv\.|\d+\s*\/\s*\d+|(?:摩拉|原石|纠缠之缘|相遇之缘)\s*[×xX]\s*\d+/i
const SPEAKER_ALIASES = new Map([
  ['纳西姐', '纳西妲'],
  ['茜特莉', '茜特拉莉'],
  ['茜特荘莉', '茜特拉莉'],
  ['茜特技莉', '茜特拉莉'],
  ['伊湿芙', '伊涅芙'],
  ['九条装罗', '九条裟罗'],
  ['神里华', '神里绫华']
])

function normalizeSpeaker(value) {
  const name = String(value || '').trim()
  if (!name) return ''
  if (SPEAKER_ALIASES.has(name)) return SPEAKER_ALIASES.get(name)
  if (name.includes('诺迦法')) return '「诺迦法」'
  if (name.includes('丑角')) return '「丑角」'
  if (name.includes('光之镜')) return '「光之镜」'
  return name
}

function normalizeLine(entry) {
  return {
    ts: entry.ts || '',
    speaker: normalizeSpeaker(entry.speaker),
    title: entry.speakerTitle || '',
    text: String(entry.text || '').trim()
  }
}

function clock(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return String(ts)
  return date.toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }).replace(/\//g, '-')
}

function readJson(path) {
  try {
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function compact(text, limit = 3800) {
  const value = String(text || '').trim()
  return value.length > limit ? value.slice(0, limit - 1) + '…' : value
}

function summaryText(synopsis) {
  if (!synopsis) return ''
  const lines = [
    '《' + (synopsis.title || '录制剧情') + '》',
    synopsis.period ? '时间：' + synopsis.period : '',
    synopsis.overview || '',
    ''
  ]
  for (const [index, arc] of (synopsis.arcs || []).entries()) {
    lines.push(String(index + 1) + '. ' + (arc.title || '剧情段') + (arc.range ? '（' + arc.range + '）' : ''))
    if (arc.summary) lines.push(arc.summary)
    lines.push('')
  }
  if (Array.isArray(synopsis.unresolved) && synopsis.unresolved.length) {
    lines.push('未解决 / 存疑：')
    for (const item of synopsis.unresolved) lines.push('- ' + item)
  }
  return lines.filter((line) => line !== undefined).join('\n').trim()
}

function matchArcs(synopsis, query) {
  if (!synopsis) return []
  const needle = String(query || '').toLowerCase().trim()
  const arcs = synopsis.arcs || []
  if (!needle) return arcs
  return arcs.filter((arc) => {
    const haystack = [arc.title, arc.range, arc.summary, ...(arc.keyBeats || []), ...(arc.characters || [])].join(' ').toLowerCase()
    return haystack.includes(needle)
  })
}

export function createStoryTool({ config, logStore, dataDir }) {
  return defineTool({
    name: 'lore_story',
    description:
      'Read the locally recorded Genshin/HSR story for chat use. Actions: summary (whole recorded story synopsis), ' +
      'search (find recorded dialogue), character (a speaker overview), scene (a synopsis arc), recent (latest lines), ' +
      'stats, memory (structured scenes/characters/relationships/threads) and context (compact state for a live companion). ' +
      'Read-only; never invents lines. The returned text is ready to send as a QQ message.',
    parameters: {
      action: {
        type: 'string',
        enum: ['summary', 'search', 'character', 'scene', 'recent', 'stats', 'memory', 'context'],
        description: 'What to read. Default summary.'
      },
      query: { type: 'string', description: 'Search text, speaker name, or scene title.' },
      game: { type: 'string', enum: ['auto', 'genshin', 'hsr'], description: 'Game; default auto.' },
      session: { type: 'string', description: 'Optional session id; default latest.' },
      limit: { type: 'number', description: 'Max results/lines (1..20, default 8).' }
    },
    timeoutMs: 30000,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string', required: true },
          game: { type: 'string', required: true },
          session: { type: 'string' },
          title: { type: 'string' },
          text: { type: 'string', required: true },
          overview: { type: 'string' },
          arcs: { type: 'array', items: { type: 'json' } },
          matches: { type: 'array', items: { type: 'json' } },
          character: { type: 'json' },
          scene: { type: 'json' },
          recent: { type: 'array', items: { type: 'json' } },
          stats: { type: 'json' },
          memory: { type: 'json' },
          context: { type: 'json' },
          prompt: { type: 'string' },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      render: (_args, value) => [{ type: 'text', text: value.text }]
    },
    execute: async (args) => {
      const action = args.action || 'summary'
      let game = resolveGame(args.game, { allowAuto: true })
      const limit = Math.max(1, Math.min(20, Number(args.limit) || 8))
      const warnings = []
      const synopsis = readJson(join(dataDir, 'journal', 'synopsis.json'))
      const curated = readJson(join(dataDir, 'journal', 'curated.json'))
      if (game === 'auto') {
        const g = logStore.sessions('genshin')[0]
        const h = logStore.sessions('hsr')[0]
        game = h && (!g || String(h.lastTs) > String(g.lastTs)) ? 'hsr' : 'genshin'
      }
      const sessions = logStore.sessions(game)
      const session = args.session || synopsis?.source?.session || sessions[0]?.session || ''
      if (game !== 'genshin' && synopsis) warnings.push('synopsis is for the Genshin recording; HSR log search still works')

      const base = { action, game, session, warnings }
      const synopsisSession = synopsis?.source?.session || ''
      const curatedSession = curated?.source?.session || ''
      const activeSynopsis = !args.session || !synopsisSession || args.session === synopsisSession ? synopsis : null
      const activeCurated = !args.session || !curatedSession || args.session === curatedSession ? curated : null

      if (action === 'memory' || action === 'context') {
        const journal = buildJournal(logStore, {
          game,
          session: args.session || activeSynopsis?.source?.session || session || '',
          limit: 300
        })
        const memory = buildStoryMemory({ journal, synopsis: activeSynopsis, curated: activeCurated, game })
        const saved = saveStoryMemory(dataDir, memory)
        if (!saved) warnings.push('memory.json could not be written; returning the in-memory snapshot')
        if (action === 'context') {
          const context = buildCompanionContext(memory, { limit })
          return {
            ...base,
            title: memory.title,
            scene: context.scene,
            recent: context.recent,
            context,
            prompt: context.prompt,
            text: compact(context.text, 2600),
            warnings
          }
        }
        return {
          ...base,
          title: memory.title,
          memory,
          stats: { scenes: memory.scenes.length, characters: memory.characters.length, relationships: memory.relationships.length, threads: memory.threads.length, recent: memory.recent.length },
          text: compact('结构性记忆：' + memory.scenes.length + ' 个阶段 · ' + memory.characters.length + ' 位人物 · ' + memory.relationships.length + ' 组关系 · ' + memory.threads.length + ' 条未解决线索。\n' + memory.title + '\n最近：' + (memory.recent.at(-1)?.text || '暂无台词'), 1600),
          warnings
        }
      }

      if (action === 'summary' || action === 'scene') {
        if (!activeSynopsis) {
          const fallback = activeCurated
          if (!fallback) {
            return { ...base, warnings: ['该场次尚无 AI 整理稿；不会把另一场次的主线梗概套过来'], text: '这个场次还没有整理稿。' }
          }
          const text = summaryText({
            title: fallback.title,
            period: fallback.source?.range,
            overview: fallback.summary,
            arcs: (fallback.scenes || []).map((scene) => ({ title: scene.title, summary: scene.summary }))
          })
          return { ...base, title: fallback.title, text, warnings }
        }
        if (action === 'scene') {
          const found = matchArcs(activeSynopsis, args.query)
          const text = found.length
            ? found.map((arc, index) => String(index + 1) + '. ' + arc.title + (arc.range ? '（' + arc.range + '）' : '') + '\n' + arc.summary).join('\n\n')
            : '没有找到匹配的场景。可用场景：' + (activeSynopsis.arcs || []).map((arc) => arc.title).join(' / ')
          return { ...base, title: activeSynopsis.title, scene: found[0] || null, arcs: found, text: compact(text), warnings }
        }
        return {
          ...base,
          title: activeSynopsis.title,
          overview: activeSynopsis.overview,
          arcs: activeSynopsis.arcs,
          text: compact(summaryText(activeSynopsis)),
          warnings
        }
      }

      if (action === 'search') {
        const query = String(args.query || '').trim()
        if (!query) return { ...base, matches: [], text: '搜索需要 query，例如「判罚之钉」「玛薇卡」。', warnings: ['query is required for search'] }
        const found = logStore.query(game, { query, session: args.session || undefined, limit, context: 1 })
        const matches = found.entries
          .filter((entry) => !NOISE.test(String(entry.text || '')))
          .map((entry) => ({ ...normalizeLine(entry), score: entry.score }))
        const text = matches.length
          ? '找到 ' + matches.length + ' 条（' + query + '）：\n' + matches.map((entry, index) => (index + 1) + '. ' + clock(entry.ts) + (entry.speaker ? ' ' + entry.speaker + '：' : ' ') + entry.text).join('\n')
          : '没有找到「' + query + '」的录制台词。'
        return { ...base, matches, text: compact(text), warnings }
      }

      if (action === 'character') {
        const query = String(args.query || '').trim()
        if (!query) return { ...base, text: '角色查询需要 query，例如「玛薇卡」。', warnings: ['query is required for character'] }
        const all = logStore.allEntries(game).records
        const hits = all.filter((entry) => normalizeSpeaker(entry.speaker).includes(query) || String(entry.speakerTitle || '').includes(query))
        const lines = hits.slice(-limit).map(normalizeLine)
        const text = hits.length
          ? query + '：录制中共 ' + hits.length + ' 条。\n' + lines.map((entry) => clock(entry.ts) + '：' + entry.text).join('\n')
          : '没有找到角色「' + query + '」的台词。'
        return {
          ...base,
          character: { name: query, lines: hits.length, firstTs: hits[0]?.ts || null, lastTs: hits.at(-1)?.ts || null },
          recent: lines,
          text: compact(text),
          warnings
        }
      }

      if (action === 'recent') {
        const entries = logStore.recent(game, { limit, session: args.session || undefined })
          .filter((entry) => !NOISE.test(String(entry.text || '')))
          .map(normalizeLine)
        const text = entries.length
          ? '最近 ' + entries.length + ' 条：\n' + entries.map((entry) => clock(entry.ts) + (entry.speaker ? ' ' + entry.speaker + '：' : ' ') + entry.text).join('\n')
          : '这个场次还没有录制台词。'
        return { ...base, recent: entries, text: compact(text), warnings }
      }

      const stats = {
        sessions: sessions.length,
        latestSession: sessions[0]?.session || null,
        recordedLines: sessions.reduce((sum, item) => sum + Number(item.entries || 0), 0),
        arcs: synopsis?.arcs?.length || 0,
        title: synopsis?.title || null
      }
      return {
        ...base,
        stats,
        text: '录制场次：' + stats.sessions + '；总行数：' + stats.recordedLines + '；梗概阶段：' + stats.arcs + (stats.title ? '；《' + stats.title + '》' : ''),
        warnings
      }
    }
  })
}
