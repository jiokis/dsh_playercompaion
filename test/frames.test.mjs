import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveConfig } from '../lib/config.js'
import { FrameStore } from '../lib/frames.js'

test('frame store saves, lists, reads and prunes local frames', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-frames-'))
  try {
    const config = resolveConfig({ dataDir: dir, frames: { enabled: true, maxFrames: 10, retentionDays: 7 } })
    const store = new FrameStore({ config, dataDir: dir })
    const saved = []
    for (let index = 0; index < 12; index += 1) {
      saved.push(store.save({
        game: index % 2 ? 'hsr' : 'genshin',
        base64: Buffer.from('frame-' + index).toString('base64'),
        width: 640,
        height: 360,
        meta: { source: 'vision', mode: 'composition', analysis: { findings: index } }
      }))
    }
    assert.ok(saved.every((frame) => frame && /^f_[0-9]{8}-[0-9]{6}-[0-9a-f]{6}$/.test(frame.id)))
    const listed = store.list({ limit: 10 })
    assert.equal(listed.length, 10)
    assert.ok(listed.every((frame) => frame.bytes > 0))
    const found = store.find(saved[11].id)
    assert.ok(found)
    const read = store.read(saved[11].id)
    assert.equal(read.base64, Buffer.from('frame-11').toString('base64'))
    assert.equal(store.read('../../etc/passwd'), null)
    assert.ok(existsSync(join(dir, 'frames')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('frame store is a no-op when disabled', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-frames-off-'))
  try {
    const config = resolveConfig({ dataDir: dir, frames: { enabled: false } })
    const store = new FrameStore({ config, dataDir: dir })
    const result = store.save({ game: 'genshin', base64: Buffer.from('x').toString('base64') })
    assert.equal(result, null)
    assert.deepEqual(store.list(), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
