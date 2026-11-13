import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { buildJournal } from '../journal.js'
import { buildCompanionContext, buildStoryMemory, saveStoryMemory } from '../story-memory.js'
import { resolveGame } from './common.js'
import { firstClause } from '../store/clean.js'
import { similarity } from '../store/text.js'
import { NOISE_TEXT, normalizeSpeaker } from '../speakers.js'
import { profileCharacter } from '../characters.js'


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

function shortClock(ts) {
  return String(clock(ts)).split(' ').pop() || ''
}

function dayOf(ts) {
  return String(clock(ts)).split(' ')[0] || ''
}

/** Pick a few distinct, complete lines; OCR fragments and repeats add no signal. */
function pickQuotes(chunk, limit = 3) {
  const picked = []
  for (const entry of chunk) {
    const text = String(entry.text || '').trim()
    if (text.replace(/[^\u4e00-\u9fff]/g, '').length < 6) continue
    if (picked.some((other) => similarity(other.text, text) > 0.72)) continue
    picked.push(entry)
    if (picked.length >= limit) break
  }
  return picked
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
      'auto (automatic extractive overview of a whole session), ' +
      'search (find recorded dialogue), character (a speaker overview), scene (a synopsis arc), recent (latest lines), ' +
      'stats, memory (structured scenes/characters/relationships/threads) and context (compact state for a live companion). ' +
      'Read-only; never invents lines. The returned text is ready to send as a QQ message.',
    parameters: {
      action: {
        type: 'string',
        enum: ['summary', 'auto', 'search', 'character', 'scene', 'recent', 'stats', 'memory', 'context', 'profile'],
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
          profile: { type: 'json' },
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
      const synopsis = readJson(join(dataDir, 'journal', game === 'hsr' ? 'hsr-synopsis.json' : 'synopsis.json'))
      const curated = readJson(join(dataDir, 'journal', game === 'hsr' ? 'hsr-curated.json' : 'curated.json'))
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

      if (action === 'profile') {
        const found = profileCharacter({ dataDir, game, query: args.query })
        if (!found.character) {
          const hint = found.ambiguous
            ? '「' + args.query + '」在资料库里对应多个角色：' + found.ambiguous.join(' / ') + '，不猜。'
            : '资料库里没有「' + String(args.query || '') + '」。'
          const suggestions = found.suggestions.map((item) => item.name).join('、')
          return {
            ...base,
            text: hint + (suggestions ? '相近候选：' + suggestions : '') + '\n可编辑 ' + (found.rosterPath || '<dataDir>/journal/characters.json') + ' 补充。',
            warnings: [...warnings, 'character not in roster']
          }
        }
        const profile = found.character
        const spoken = logStore.allEntries(game).records.filter((entry) => normalizeSpeaker(entry.speaker) === profile.name)
        const lines = spoken.length
        const bySession = new Map()
        for (const entry of spoken) bySession.set(entry.session, (bySession.get(entry.session) || 0) + 1)
        const facts = [
          profile.rarity ? profile.rarity + '★' : '',
          profile.element || '',
          profile.path ? '「' + profile.path + '」' : ''
        ].filter(Boolean).join(' · ')
        const text = [
          profile.name + (profile.game === 'hsr' ? ' · 崩坏：星穹铁道' : ' · 原神'),
          facts,
          profile.note,
          profile.aliases.length ? 'OCR 别名：' + profile.aliases.join('、') : '',
          '本机记录：' + lines + ' 行' + (bySession.size ? '，场次 ' + [...bySession.entries()].map(([id, count]) => id + '(' + count + ')').join(' ') : ''),
          profile.source ? '来源：' + profile.source : ''
        ].filter(Boolean).join('\n')
        return { ...base, profile, character: { name: profile.name, lines }, text, warnings }
      }

      if (action === 'auto') {
        const gameName = game === 'hsr' ? '崩坏：星穹铁道' : '原神'
        const all = logStore.allEntries(game).records
          .filter((entry) => !args.session || entry.session === args.session)
          .filter((entry) => entry.text && !NOISE_TEXT.test(String(entry.text)))
          .sort((left, right) => String(left.ts).localeCompare(String(right.ts)))
        const selectedSession = args.session || all.at(-1)?.session || ''
        const entries = all.filter((entry) => !selectedSession || entry.session === selectedSession)
        const maxScenes = Math.max(4, Math.min(12, Number(limit) || 8))
        const scenes = []
        if (entries.length) {
          const size = Math.max(1, Math.ceil(entries.length / maxScenes))
          for (let start = 0; start < entries.length; start += size) {
            const chunk = entries.slice(start, start + size)
            const speakers = [...new Set(chunk.map((entry) => normalizeSpeaker(entry.speaker)).filter(Boolean))]
            const meaningful = pickQuotes(chunk)
            const lead = meaningful[0]
            const headline = firstClause(lead?.text)
            scenes.push({
              id: 'auto-' + (scenes.length + 1),
              title: (speakers.slice(0, 2).join('、') || '旁白') + (headline ? ' · ' + headline : ''),
              headline,
              range: shortClock(chunk[0]?.ts) + '–' + shortClock(chunk.at(-1)?.ts),
              summary: meaningful.map((entry) => (entry.speaker ? entry.speaker + '：' : '') + String(entry.text).replace(/\s+/g, ' ').slice(0, 90)).join(' / '),
              speakers,
              lines: chunk.length
            })
          }
        }
        const characterCount = new Map()
        for (const entry of entries) {
          const name = normalizeSpeaker(entry.speaker)
          if (name) characterCount.set(name, (characterCount.get(name) || 0) + 1)
        }
        const characters = [...characterCount.entries()].sort((left, right) => right[1] - left[1]).slice(0, 10).map(([name]) => name)
        const span = entries.length ? dayOf(entries[0].ts) + ' ' + shortClock(entries[0].ts) + '–' + shortClock(entries.at(-1)?.ts) : ''
        const text = [
          '《' + gameName + ' · ' + (selectedSession || '最新场次') + '》剧情速览',
          '抽取式速览，不是润色稿；' + (span ? span + '，' : '') + '共 ' + entries.length + ' 行。',
          '',
          ...scenes.map((scene, index) => (index + 1) + '. ' + scene.range + ' · ' + scene.title + '\n' + scene.summary),
          '',
          characters.length ? '主要人物：' + characters.join('、') : ''
        ].filter((line) => line !== undefined).join('\n').trim()
        return {
          ...base,
          session: selectedSession,
          title: gameName + ' · 剧情速览',
          arcs: scenes,
          character: { names: characters },
          stats: { lines: entries.length, scenes: scenes.length, characters: characters.length },
          text: compact(text, 4200),
          warnings: [...warnings, 'auto summary is extractive; use a polished synopsis for narrative prose']
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
          .filter((entry) => !NOISE_TEXT.test(String(entry.text || '')))
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
          .filter((entry) => !NOISE_TEXT.test(String(entry.text || '')))
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
