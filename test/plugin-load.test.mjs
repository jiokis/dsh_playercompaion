import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/index.js'

// Cordis exposes ctx through a proxy: reading a service that is not loaded can
// throw. A plugin that probes ctx defensively must still load under that shape.
function strictCtx(extra = {}) {
  const base = {
    tools: { register: () => {} },
    logger: { warn: () => {}, info: () => {}, error: () => {} },
    plugin: () => {},
    on: () => {},
    inject: () => {},
    get: () => null,
    host: { version: '0.2.1-rc.2' },
    ...extra
  }
  return new Proxy(base, {
    get(target, prop) {
      if (typeof prop === 'symbol') return target[prop]
      if (prop in target) return target[prop]
      throw new Error('service not available: ' + String(prop))
    }
  })
}

test('apply loads against a strict proxy host', async () => {
  const registered = []
  const ctx = strictCtx({ tools: { register: (spec) => registered.push(spec.name) } })
  await apply(ctx, { dataDir: undefined })
  assert.deepEqual(registered, [
    'lore_status',
    'lore_capture',
    'lore_query',
    'lore_narrate',
    'lore_overlay',
    'lore_vision',
    'lore_watch',
    'lore_story'
  ])
})

test('a host without web search still loads and registers every tool', async () => {
  const registered = []
  const ctx = strictCtx({ tools: { register: (spec) => registered.push(spec.name) } })
  await apply(ctx, {})
  assert.equal(registered.length, 8)
})

test('a throwing tool registry does not abort apply', async () => {
  const ctx = strictCtx({
    tools: {
      register: () => {
        throw new Error('schema rejected by host')
      }
    }
  })
  await apply(ctx, {})
})
