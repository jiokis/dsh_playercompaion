import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ScreenshotStore } from '../lib/screenshots.js'

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z8ZkAAAAASUVORK5CYII=', 'base64')

test('screenshot store lists, reads and removes local captures', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-shots-'))
  try {
    const store = new ScreenshotStore({ dataDir: dir })
    store.ensure()
    const shot = join(dir, 'screenshots', 'shot-test.png')
    writeFileSync(shot, PNG_1X1)
    store.add({ path: shot, game: 'genshin', session: 's1', speaker: '格林', text: '是。', width: 2560, height: 1440 })
    const list = store.list(10)
    assert.equal(list.length, 1)
    assert.equal(list[0].speaker, '格林')
    assert.equal(list[0].id, 'shot-test.png')
    assert.match(list[0].thumb, /^data:image\/jpeg;base64,/)
    const full = store.read('shot-test.png')
    assert.match(full.dataUrl, /^data:image\/png;base64,/)
    store.remove('shot-test.png')
    assert.equal(store.list(10).length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
