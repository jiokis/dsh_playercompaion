import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveConfig } from '../lib/config.js'
import { LogStore } from '../lib/store/log.js'
import { makeDialogueRecord } from '../lib/store/dedupe.js'
import { createQueryTool } from '../lib/tools/query.js'
import { createNarrateTool } from '../lib/tools/narrate.js'

const dataDir = mkdtempSync(join(tmpdir(), 'dsh-lore-tools-'))
const config = resolveConfig({ dataDir })
const logStore = new LogStore({ dataDir })
const wikiSearch = { stats: () => [], query: async () => ({ results: [], warnings: [] }) }
try {
  const lines = [
    ['派蒙', '旅行者，我们走吧！', '2026-11-01T05:00:00.000Z'],
    ['钟离', '契约之神，重在「璃月」。', '2026-11-01T05:01:00.000Z'],
    ['派蒙', '前面就是璃月港了。', '2026-11-01T05:02:00.000Z']
  ]
  for (const [speaker, text, ts] of lines) {
    logStore.append(makeDialogueRecord({ game: 'genshin', session: '2026-11-01-main', text, speaker, now: new Date(ts) }))
  }
  const queryTool = createQueryTool({ config, logStore, wikiSearch })
  const queryResult = await queryTool.execute({ query: '璃月', scope: 'log', context: 1, limit: 5 }, { signal: new AbortController().signal })
  const queryRender = queryTool.output.render({ query: '璃月' }, queryResult)
  const narrateTool = createNarrateTool({ config, logStore, wikiSearch })
  const narrateResult = await narrateTool.execute({ game: 'genshin', last: 5, style: '陪玩解说' }, { signal: new AbortController().signal })
  const narrateRender = narrateTool.output.render({}, narrateResult)
  console.log(JSON.stringify({
    query: { hits: queryResult.log.entries.length, first: queryResult.log.entries[0]?.text, context: queryResult.log.entries[0]?.contextBefore?.length, text: queryRender[0].text.slice(0, 120) },
    narrate: { lines: narrateResult.lines.length, scenes: narrateResult.scenes.length, promptHasNoSpoiler: narrateResult.prompt.includes('不剧透'), render: narrateRender[0].text.slice(0, 120) }
  }, null, 2))
} finally {
  rmSync(dataDir, { recursive: true, force: true })
}
