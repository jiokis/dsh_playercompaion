import test from 'node:test'
import assert from 'node:assert/strict'

test('client registers the journal view in the conversation tab slot', async () => {
  const views = []
  const scope = {
    getSnapshot: () => ({ status: 'ready', value: {}, revision: 1, writable: true }),
    mutate: async () => true,
    subscribe: () => () => {}
  }
  const ctx = {
    locale: { bind: () => (key) => key, register: () => () => {}, current: 'zh' },
    effect: (fn) => { const disposer = fn(); return typeof disposer === 'function' ? disposer : () => {} },
    configForms: { get: () => scope },
    slots: {
      inject: (name, fn) => {
        if (name === 'conversation.view') {
          const disposer = fn()
          return disposer
        }
        return fn()
      },
      register: (options) => {
        if (options.name === 'conversation.view') views.push(options)
        return () => {}
      }
    },
    remote: { $mount: async () => {} },
    inject: (names, fn) => {
      if (names.includes('remote.loreWatch')) fn({ remote: { loreWatch: { execute: async () => ({ ok: true, value: {} }) } } })
      if (names.includes('remote.loreJournal')) fn({ remote: { loreJournal: { execute: async () => ({ ok: true, value: {} }) } } })
    }
  }
  let exportsValue = null
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({ dataset: {}, textContent: '', remove: () => {} }),
    head: { appendChild: () => {} }
  }
  globalThis.window = {
    __ModuleLoader__: {
      load: ({ factory }) => {
        const react = {
          createElement: () => ({}),
          useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
          useEffect: () => {},
          useCallback: (fn) => fn
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
  assert.equal(views.length, 1)
  assert.equal(views[0].id, 'lore-journal')
  assert.equal(views[0].label(), '旅途')
})
