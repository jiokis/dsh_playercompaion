import test from 'node:test'
import assert from 'node:assert/strict'
import { appendFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LogStore } from '../lib/store/log.js'
import { makeDialogueRecord, makeSeenRecord } from '../lib/store/dedupe.js'

function withStore(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-store-'))
  try {
    return fn(new LogStore({ dataDir: dir }), dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('append/fold/sessions round-trip', () => {
  withStore((store) => {
    const first = makeDialogueRecord({ game: 'genshin', session: 's1', text: '旅行者，我们走吧！', speaker: '派蒙', now: new Date('2026-11-01T05:00:00.000Z') })
    const second = makeDialogueRecord({ game: 'genshin', session: 's1', text: '前面的路还很长。', speaker: '派蒙', now: new Date('2026-11-01T05:01:00.000Z') })
    store.append(first)
    store.append(second)
    store.appendSeen(makeSeenRecord({ game: 'genshin', session: 's1', utteranceId: first.utteranceId, now: new Date('2026-11-01T05:02:00.000Z') }))
    const folded = store.allEntries('genshin').records
    assert.equal(folded.length, 2)
    assert.equal(folded[0].seenCount, 1)
    const sessions = store.sessions('genshin')
    assert.equal(sessions.length, 1)
    assert.equal(sessions[0].entries, 2)
  })
})

test('monthly JSONL file is created and corrupt lines are skipped', () => {
  withStore((store, dir) => {
    const record = makeDialogueRecord({ game: 'hsr', session: 's1', text: '三月七：出发！', now: new Date('2026-11-01T05:00:00.000Z') })
    store.append(record)
    const gameDir = join(dir, 'logs', 'hsr')
    assert.ok(existsSync(gameDir))
    const files = readdirSync(gameDir).filter((name) => name.endsWith('.jsonl'))
    assert.deepEqual(files, ['2026-11.jsonl'])
    appendFileSync(join(gameDir, files[0]), 'not-json\n', 'utf8')
    const result = store.readAll('hsr')
    assert.equal(result.corrupt, 1)
    assert.equal(store.allEntries('hsr').records.length, 1)
  })
})

test('query returns scored hits with context', () => {
  withStore((store) => {
    const lines = ['旅行者，我们走吧！', '派蒙：前面就是璃月港了。', '钟离：契约之神。']
    lines.forEach((text, index) => {
      store.append(makeDialogueRecord({
        game: 'genshin',
        session: 's1',
        text,
        speaker: index === 0 ? '派蒙' : (index === 1 ? '派蒙' : '钟离'),
        now: new Date('2026-11-01T05:0' + index + ':00.000Z')
      }))
    })
    const result = store.query('genshin', { query: '璃月港', context: 1, limit: 5 })
    assert.equal(result.entries.length, 1)
    assert.equal(result.entries[0].text, '派蒙：前面就是璃月港了。')
    assert.equal(result.entries[0].contextBefore.length, 1)
  })
})
