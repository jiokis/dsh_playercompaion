import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCommand, watchRemote } from '../lib/watch-remote.js'

test('watch remote command contract', () => {
  assert.equal(watchRemote.package, 'dsh-lore-companion')
  assert.equal(watchRemote.descriptors[0].service, 'loreWatch')
  assert.equal(watchRemote.descriptors[0].method, 'execute')

  assert.deepEqual(parseCommand({ action: 'start', game: 'genshin', intervalSec: 8, window: '原神' }), {
    action: 'start',
    game: 'genshin',
    intervalSec: 8,
    window: '原神'
  })
  assert.deepEqual(parseCommand({ action: 'stop' }), { action: 'stop' })
  assert.deepEqual(parseCommand({ action: 'status' }), { action: 'status' })

  assert.throws(() => parseCommand({ action: 'nope' }), /action/)
  assert.throws(() => parseCommand({ action: 'start', game: 'zzz' }), /game/)
  assert.throws(() => parseCommand({ action: 'start', mode: 'menu' }), /mode/)
  assert.throws(() => parseCommand(null), /object/)
})
