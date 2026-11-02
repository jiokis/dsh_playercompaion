import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LogStore } from '../lib/store/log.js'
import { makeDialogueRecord } from '../lib/store/dedupe.js'

function seed() {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-query-'))
  const store = new LogStore({ dataDir: dir })
  store.append(makeDialogueRecord({ game: 'genshin', session: 's1', text: '派蒙：旅行者，我们走吧！', speaker: '派蒙', now: new Date('2026-11-01T05:00:00.000Z') }))
  store.append(makeDialogueRecord({ game: 'genshin', session: 's1', text: '钟离：契约之神。', speaker: '钟离', now: new Date('2026-11-01T05:01:00.000Z') }))
  store.append(makeDialogueRecord({ game: 'genshin', session: 's2', text: '派蒙：另一个会话。', speaker: '派蒙', now: new Date('2026-11-02T05:00:00.000Z') }))
  return { dir, store }
}

test('query filters by session and time', () => {
  const { dir, store } = seed()
  try {
    const bySession = store.query('genshin', { query: '派蒙', session: 's1', context: 0, limit: 10 })
    assert.equal(bySession.entries.length, 1)
    const byTime = store.query('genshin', { query: '派蒙', since: '2026-11-02T00:00:00.000Z', context: 0, limit: 10 })
    assert.equal(byTime.entries.length, 1)
    assert.equal(byTime.entries[0].session, 's2')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('query matches speaker and speaker title', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-query-speaker-'))
  try {
    const store = new LogStore({ dataDir: dir })
    store.append(makeDialogueRecord({
      game: 'genshin',
      session: 's1',
      speaker: '凯瑟琳',
      speakerTitle: '冒险家协会接待员',
      text: '向着星辰与深渊！',
      now: new Date('2026-11-01T05:00:00.000Z')
    }))
    assert.equal(store.query('genshin', { query: '凯瑟琳', context: 0, limit: 5 }).entries.length, 1)
    assert.equal(store.query('genshin', { query: '冒险家协会接待员', context: 0, limit: 5 }).entries.length, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('query without a term returns recent lines', () => {
  const { dir, store } = seed()
  try {
    const result = store.query('genshin', { limit: 2, context: 0 })
    assert.equal(result.entries.length, 2)
    assert.ok(result.entries[0].ts >= result.entries[1].ts)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
