import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ScreenshotStore } from '../lib/screenshots.js'

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z8ZkAAAAASUVORK5CYII=', 'base64')

function withStore(settings, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-shots-'))
  try {
    const store = new ScreenshotStore({ dataDir: dir, config: { screenshots: settings || {} } })
    store.ensure()
    return fn(store, dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('screenshot store lists, reads and removes local captures', () => {
  withStore({}, (store, dir) => {
    const shot = join(dir, 'screenshots', 'shot-test.png')
    writeFileSync(shot, PNG_1X1)
    store.add({ path: shot, game: 'genshin', session: 's1', speaker: '格林', text: '是。', width: 2560, height: 1440 })
    const plain = store.list({ limit: 10 })
    assert.equal(plain.length, 1)
    assert.equal(plain[0].speaker, '格林')
    // Metadata stays small; thumbnails are opt-in.
    assert.equal(plain[0].thumb, undefined)
    const withThumbs = store.list({ limit: 10, thumbs: true })
    assert.match(withThumbs[0].thumb, /^data:image\/jpeg;base64,/)
    const full = store.read('shot-test.png')
    assert.match(full.dataUrl, /^data:image\/png;base64,/)
    store.remove('shot-test.png')
    assert.equal(store.list({ limit: 10 }).length, 0)
  })
})

test('thumbnails can be fetched by id', () => {
  withStore({}, (store, dir) => {
    const shot = join(dir, 'screenshots', 'shot-a.png')
    writeFileSync(shot, PNG_1X1)
    store.add({ path: shot, session: 's1' })
    const thumbs = store.thumbs(['shot-a.png', '../evil.png', 'missing.png'])
    assert.equal(thumbs.length, 1)
    assert.equal(thumbs[0].id, 'shot-a.png')
  })
})

test('summary counts sessions, bytes and span', () => {
  withStore({ dedupeSeconds: 0 }, (store, dir) => {
    for (const [index, session] of ['s1', 's1', 's2'].entries()) {
      const path = join(dir, 'screenshots', 'shot-' + index + '.png')
      writeFileSync(path, Buffer.concat([PNG_1X1, Buffer.from(String(index))]))
      store.add({ path, game: 'hsr', session, ts: '2026-11-11T0' + index + ':00:00.000Z' })
    }
    const summary = store.summary()
    assert.equal(summary.total, 3)
    assert.equal(summary.bySession.s1, 2)
    assert.equal(summary.bySession.s2, 1)
    assert.ok(summary.bytes > 0)
    assert.equal(summary.firstTs, '2026-11-11T00:00:00.000Z')
    const scoped = store.summary({ session: 's2' })
    assert.equal(scoped.total, 1)
  })
})

test('the same frame captured twice is reported as a duplicate', () => {
  withStore({ dedupeSeconds: 60 }, (store, dir) => {
    const first = join(dir, 'screenshots', 'shot-1.png')
    writeFileSync(first, PNG_1X1)
    const a = store.add({ path: first, session: 's1', ts: '2026-11-11T00:00:00.000Z' })
    const second = join(dir, 'screenshots', 'shot-2.png')
    writeFileSync(second, PNG_1X1)
    const b = store.add({ path: second, session: 's1', ts: '2026-11-11T00:00:05.000Z' })
    assert.equal(a.duplicate, undefined)
    assert.equal(b.duplicate, true)
    assert.equal(store.scan().length, 1)
  })
})

test('listing is scoped to the requested session', () => {
  withStore({ dedupeSeconds: 0 }, (store, dir) => {
    for (const [index, session] of ['s1', 's2'].entries()) {
      const path = join(dir, 'screenshots', 'shot-' + index + '.png')
      writeFileSync(path, Buffer.concat([PNG_1X1, Buffer.from(String(index))]))
      store.add({ path, session })
    }
    assert.equal(store.list({ limit: 10, session: 's1' }).length, 1)
    assert.equal(store.list({ limit: 10, session: 'unknown' }).length, 0)
  })
})

test('prune honours maxCount', () => {
  withStore({ dedupeSeconds: 0, maxCount: 2 }, (store, dir) => {
    for (let index = 0; index < 4; index += 1) {
      const path = join(dir, 'screenshots', 'shot-' + index + '.png')
      writeFileSync(path, Buffer.concat([PNG_1X1, Buffer.from(String(index))]))
      store.add({ path, session: 's1', ts: '2026-11-11T00:0' + index + ':00.000Z' })
    }
    assert.equal(store.scan().length, 2)
  })
})
