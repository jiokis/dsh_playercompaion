import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNarration, groupScenes, pickKeyLines, selectEntities } from '../lib/narrate.js'

const entries = [
  { utteranceId: 'a', ts: '2026-11-01T05:00:00.000Z', speaker: '派蒙', text: '旅行者，我们走吧！', kind: 'dialogue' },
  { utteranceId: 'b', ts: '2026-11-01T05:00:30.000Z', speaker: '钟离', text: '契约之神，重在「璃月」。', kind: 'dialogue' },
  { utteranceId: 'c', ts: '2026-11-01T05:05:00.000Z', speaker: '派蒙', text: '前面就是璃月港了。', kind: 'dialogue' }
]

test('groupScenes splits on the configured time gap', () => {
  const scenes = groupScenes(entries, 120)
  assert.equal(scenes.length, 2)
  assert.deepEqual(scenes[0].speakers, ['派蒙', '钟离'])
  assert.equal(scenes[1].lines.length, 1)
})

test('pickKeyLines keeps first, last, speaker changes and punctuation', () => {
  const picked = pickKeyLines(entries)
  assert.ok(picked.some((entry) => entry.utteranceId === 'a'))
  assert.ok(picked.some((entry) => entry.utteranceId === 'c'))
  assert.ok(picked.some((entry) => entry.utteranceId === 'b'))
})

test('selectEntities picks speakers and quoted terms', () => {
  const value = selectEntities(entries, 3)
  assert.ok(value.includes('派蒙'))
  assert.ok(value.includes('璃月'))
})

test('buildNarration returns transcript, scenes, brief and a no-LLM prompt', () => {
  const result = buildNarration({ entries, game: 'genshin', style: '陪玩解说', spoiler: 'none', maxChars: 300 })
  assert.equal(result.lines.length, 3)
  assert.equal(result.scenes.length, 2)
  assert.ok(result.brief.mustNot.some((item) => item.includes('不编造')))
  assert.ok(result.brief.transcript.includes('派蒙'))
  assert.ok(result.prompt.includes('原神'))
  assert.ok(result.prompt.includes('不剧透'))
  assert.ok(!result.prompt.includes('工具调用'))
})
