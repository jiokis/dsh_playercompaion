import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveConfig } from '../lib/config.js'
import { createStoryTool } from '../lib/tools/story.js'

function fixture() {
  const dataDir = mkdtempSync(join(tmpdir(), 'dsh-lore-story-'))
  mkdirSync(join(dataDir, 'journal'), { recursive: true })
  writeFileSync(join(dataDir, 'journal', 'synopsis.json'), JSON.stringify({
    title: '测试剧情',
    period: '2026-11-04',
    source: { session: 's1' },
    overview: '一段测试梗概。',
    arcs: [{ title: '第一幕', range: '10:00', summary: '旅行者抵达。', keyBeats: ['抵达'], characters: ['派蒙'] }],
    unresolved: ['未知']
  }), 'utf8')
  const records = [
    { ts: '2026-11-04T10:00:00Z', session: 's1', speaker: '派蒙', text: '我们到了。' },
    { ts: '2026-11-04T10:00:01Z', session: 's1', speaker: '纳西姐', text: '这里很安静。' }
  ]
  const logStore = {
    sessions: () => [{ session: 's1', entries: 2 }],
    allEntries: () => ({ records }),
    query: (_game, options = {}) => ({ entries: records.filter((entry) => !options.query || entry.text.includes(options.query)), total: 2 }),
    recent: () => records
  }
  return { dataDir, logStore }
}

test('lore_story exposes summary, search, character, scene and stats', async () => {
  const { dataDir, logStore } = fixture()
  try {
    const tool = createStoryTool({ config: resolveConfig({ dataDir }), logStore, dataDir })
    const summary = await tool.execute({ action: 'summary' })
    assert.equal(summary.action, 'summary')
    assert.match(summary.text, /测试剧情/)
    assert.match(summary.text, /第一幕/)
    const search = await tool.execute({ action: 'search', query: '到了' })
    assert.equal(search.matches.length, 1)
    assert.match(search.text, /派蒙/)
    const character = await tool.execute({ action: 'character', query: '纳西妲' })
    assert.equal(character.character.lines, 1)
    assert.equal(character.recent[0].speaker, '纳西妲')
    const scene = await tool.execute({ action: 'scene', query: '第一幕' })
    assert.equal(scene.scene.title, '第一幕')
    const stats = await tool.execute({ action: 'stats' })
    assert.equal(stats.stats.arcs, 1)
    assert.match(stats.text, /梗概阶段：1/)
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})
