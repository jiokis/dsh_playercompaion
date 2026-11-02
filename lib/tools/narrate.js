import { defineTool } from '@deepseek-ai/dsh-tools'
import { asArray, clampInt, parseDate, resolveGame, resolveSession } from './common.js'
import { buildNarration, selectEntities } from '../narrate.js'
import { renderNarrate } from '../render.js'

export function createNarrateTool({ config, logStore, wikiSearch }) {
  return defineTool({
    name: 'lore_narrate',
    description:
      'Gather recent captured dialogue (plus optional cached wiki background) and return a narration brief, a ready ' +
      'prompt, and the transcript. This tool does NOT call an LLM: write the narration yourself in the user\'s ' +
      'language and persona, using only the recorded material. It refuses to invent unrecorded plot.',
    parameters: {
      game: { type: 'string', enum: ['auto', 'genshin', 'hsr'], description: 'Game; auto uses the latest log.' },
      session: { type: 'string', description: 'Optional session id.' },
      last: { type: 'number', description: 'Recent lines to include (default 20, max 100).' },
      since: { type: 'string', description: 'Optional ISO 8601 lower bound.' },
      until: { type: 'string', description: 'Optional ISO 8601 upper bound.' },
      style: { type: 'string', enum: ['陪玩解说', '剧情复盘', '冷知识吐槽'], description: 'Narration style.' },
      spoiler: { type: 'string', enum: ['none', 'light', 'full'], description: 'Spoiler policy; default none.' },
      includeWiki: { type: 'boolean', description: 'Look up up to two entities in the local wiki cache.' },
      maxChars: { type: 'number', description: 'Suggested narration length (default 800).' }
    },
    timeoutMs: 60000,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          game: { type: 'string', required: true },
          session: { type: 'string' },
          range: { type: 'json' },
          lines: { type: 'array', items: { type: 'json' }, required: true },
          scenes: { type: 'array', items: { type: 'json' }, required: true },
          background: { type: 'array', items: { type: 'json' } },
          brief: { type: 'json', required: true },
          prompt: { type: 'string', required: true },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      render: (_args, value) => [{ type: 'text', text: renderNarrate(value) }]
    },
    execute: async (args) => {
      let game = resolveGame(args.game, { allowAuto: true })
      const session = args.session ? resolveSession(args.session) : undefined
      const since = parseDate(args.since, 'since')
      const until = parseDate(args.until, 'until')
      const last = clampInt(args.last, config.narrate.defaultLast, 1, config.narrate.maxLast)
      const warnings = []
      if (game === 'auto') {
        const genshin = logStore.recent('genshin', { limit: 1, session, since, until })[0]
        const hsr = logStore.recent('hsr', { limit: 1, session, since, until })[0]
        if (genshin && hsr) game = String(genshin.ts) >= String(hsr.ts) ? 'genshin' : 'hsr'
        else if (genshin) game = 'genshin'
        else if (hsr) game = 'hsr'
        else {
          game = 'genshin'
          warnings.push('no log entries for either game; returning an empty brief')
        }
      }
      const entries = logStore.recent(game, { limit: last, session, since, until })
      const background = []
      if (args.includeWiki && entries.length && config.wiki.enabled) {
        const deadline = Date.now() + 15000
        for (const entity of selectEntities(entries, 2)) {
          if (Date.now() >= deadline) {
            warnings.push('wiki background budget exhausted')
            break
          }
          try {
            const reply = await wikiSearch.query(game, entity, { limit: 1 })
            background.push(...asArray(reply.results))
            warnings.push(...asArray(reply.warnings))
          } catch (error) {
            warnings.push('wiki background failed for ' + entity + ': ' + error.message)
          }
        }
      }
      const narration = buildNarration({
        entries,
        game,
        style: args.style || config.narrate.defaultStyle,
        spoiler: args.spoiler || 'none',
        maxChars: clampInt(args.maxChars, config.narrate.maxChars, 120, 4000),
        background,
        sceneGapSeconds: config.narrate.sceneGapSeconds
      })
      return {
        game,
        session: session || entries[0]?.session || null,
        range: entries.length ? { from: entries[0].ts, to: entries[entries.length - 1].ts } : null,
        lines: narration.lines,
        scenes: narration.scenes,
        background: narration.background,
        brief: narration.brief,
        prompt: narration.prompt,
        warnings: [...new Set([...warnings, ...narration.warnings])]
      }
    }
  })
}
