import { readFileSync } from 'node:fs'
import { resolveConfig } from '../lib/config.js'
import { Config } from '../lib/config.js'

const registered = []
const locales = []
let disposeSlot = null
const scope = {
  getSnapshot: () => ({ status: 'ready', value: {}, revision: 1, writable: true }),
  mutate: async () => true,
  subscribe: () => () => {}
}
const ctx = {
  locale: {
    bind: () => (key) => key,
    register: (ns, dicts) => { locales.push({ ns, dicts }); return () => {} },
    current: 'zh'
  },
  effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : () => {} },
  configForms: { get: (id) => { if (id !== 'lore-companion') throw new Error('unexpected namespace ' + id); return scope } },
  slots: {
    inject: (name, fn) => fn(),
    register: (options, component) => {
      registered.push({ options, component })
      disposeSlot = () => {}
      return disposeSlot
    }
  }
}
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ dataset: {}, textContent: '' }),
  head: { appendChild: () => {} }
}
globalThis.window = {
  __ModuleLoader__: {
    load: ({ id, factory }) => {
      const module = { exports: {} }
      const require = (name) => {
        if (name === 'react') return { createElement: () => ({}), useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useEffect: () => {} }
        throw new Error('unexpected require ' + name)
      }
      const exports = factory(require)
      module.exports = exports
      if (id !== 'dsh-lore-companion') throw new Error('unexpected id ' + id)
      if (typeof exports.apply !== 'function') throw new Error('missing apply')
      exports.apply(ctx)
    }
  }
}
await import('../client.js')
const vol = Config({})
const plain = typeof vol.get === 'function' ? vol.get() : vol
const resolved = resolveConfig(vol)
console.log(JSON.stringify({
  locales: locales.map((x) => x.ns),
  slots: registered.map((x) => ({ name: x.options.name, key: x.options.key, locale: x.options.locale })),
  component: typeof registered[0]?.component,
  volatile: typeof vol.get === 'function',
  configDefault: resolved.capture.settleMs,
  plainDefault: plain.capture.settleMs
}, null, 2))
