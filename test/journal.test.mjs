import test from 'node:test'
import assert from 'node:assert/strict'
import { buildJournal } from '../lib/journal.js'
import { parseJournalCommand } from '../lib/journal-remote.js'

test('journal snapshot builds events, characters and co-occurrence relations', () => {
  const entries = [
    { utteranceId: 'a', ts: '2026-11-03T10:00:00.000Z', session: 's1', speaker: '凯瑟琳', speakerTitle: '接待员', text: '需要帮忙吗？', choices: [] },
    { utteranceId: 'b', ts: '2026-11-03T10:01:00.000Z', session: 's1', speaker: '旅行者', text: '我来交任务。', choices: [] },
    { utteranceId: 'c', ts: '2026-11-03T11:00:00.000Z', session: 's1', speaker: '凯瑟琳', text: '辛苦了。', choices: [] }
  ]
  const logStore = {
    sessions: () => [{ session: 's1', entries: 3, firstTs: entries[0].ts, lastTs: entries[2].ts }],
    allEntries: () => ({ records: entries, files: [], corrupt: 0 })
  }
  const snapshot = buildJournal(logStore, { game: 'genshin' })
  assert.equal(snapshot.stats.lines, 3)
  assert.equal(snapshot.events.length, 2)
  assert.equal(snapshot.characters.length, 2)
  assert.equal(snapshot.relationships[0].a, '凯瑟琳')
  assert.equal(snapshot.relationships[0].events, 1)
  assert.equal(snapshot.session, 's1')
})

test('journal command contract defaults and validates game', () => {
  assert.deepEqual(parseJournalCommand({}), { action: 'snapshot', game: 'genshin' })
  assert.equal(parseJournalCommand({ game: 'hsr', session: 's2', limit: 10 }).limit, 20)
  assert.throws(() => parseJournalCommand({ action: 'write' }), /snapshot/)
})
