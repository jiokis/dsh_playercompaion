import test from 'node:test'
import assert from 'node:assert/strict'

test('client bundle registers the DSH plugin config page', async () => {
  const registered = []
  const locales = []
  const scope = {
    getSnapshot: () => ({ status: 'ready', value: {}, revision: 1, writable: true }),
    mutate: async () => true,
    subscribe: () => () => {}
  }
  const ctx = {
    locale: {
      bind: () => (key) => key,
      register: (namespace, dictionaries) => { locales.push({ namespace, dictionaries }); return () => {} },
      current: 'zh'
    },
    effect: (fn) => { const disposer = fn(); return typeof disposer === 'function' ? disposer : () => {} },
    configForms: { get: (id) => { assert.equal(id, 'lore-companion'); return scope } },
    slots: {
      inject: (name, fn) => { assert.equal(name, 'plugins.bundle.config'); return fn() },
      register: (options, component) => { registered.push({ options, component }); return () => {} }
    }
  }
  let exportsValue = null
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({ dataset: {}, textContent: '' }),
    head: { appendChild: () => {} }
  }
  globalThis.window = {
    __ModuleLoader__: {
      load: ({ id, factory }) => {
        assert.equal(id, 'dsh-lore-companion')
        const react = {
          createElement: () => ({}),
          useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
          useEffect: () => {}
        }
        exportsValue = factory((name) => {
          if (name === 'react') return react
          throw new Error('unexpected require: ' + name)
        })
      }
    }
  }
  await import('../client.js')
  exportsValue.apply(ctx)
  assert.deepEqual(exportsValue.inject, ['slots', 'locale', 'configForms', 'remote'])
  assert.equal(typeof exportsValue.apply, 'function')
  assert.equal(locales.length, 1)
  assert.equal(locales[0].namespace, 'loreCompanion')
  assert.equal(registered.length, 1)
  assert.equal(registered[0].options.key, 'dsh-lore-companion')
  assert.equal(registered[0].options.name, 'plugins.bundle.config')
  assert.equal(typeof registered[0].component, 'function')
})
