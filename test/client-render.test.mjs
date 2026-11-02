import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConfig } from '../lib/config.js'

function makeReact() {
  let hooks = []
  let hookIndex = 0
  function createElement(type, props, ...children) {
    const merged = Object.assign({}, props || {})
    if (children.length === 1) merged.children = children[0]
    else if (children.length > 1) merged.children = children
    if (typeof type === 'function') return type(merged)
    return { type, props: merged }
  }
  function useState(initial) {
    const index = hookIndex++
    if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial
    return [hooks[index], (value) => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value }]
  }
  function useEffect() {}
  return {
    createElement,
    useState,
    useEffect,
    reset() { hooks = []; hookIndex = 0 }
  }
}

function walk(node, visit) {
  if (node === null || node === undefined || node === false) return
  if (typeof node === 'string' || typeof node === 'number') {
    visit({ text: String(node) })
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit)
    return
  }
  visit({ type: node.type, props: node.props || {} })
  if (node.props) walk(node.props.children, visit)
}

test('client settings page renders DSH-style cards, switches and source fields', async () => {
  const react = makeReact()
  const registered = []
  let exported = null
  const scope = {
    getSnapshot: () => ({ status: 'ready', value: resolveConfig({}), revision: 1, writable: true }),
    mutate: async () => true,
    subscribe: () => () => {}
  }
  const locale = { current: 'zh', subscribe: () => () => {} }
  const messages = { title: '旅途记录仪', subtitle: '只读 · 原神 / 星铁', intro: '保存后请重启 DSH 生效', save: '保存', reset: '恢复默认', notReady: '配置还没有就绪。', readOnly: '当前配置不可写。', hintOverlay: '悬浮窗置顶。' }
  const ctx = {
    locale: { bind: () => (key) => messages[key] || key, register: () => () => {}, current: 'zh' },
    effect: (fn) => { fn(); return () => {} },
    configForms: { get: () => scope },
    slots: {
      inject: (_name, fn) => fn(),
      register: (options, component) => { registered.push({ options, component }); return () => {} }
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
        assert.equal(id, 'dsh-lore-companion')
        exported = factory((name) => {
          if (name === 'react') return react
          throw new Error('unexpected require ' + name)
        })
      }
    }
  }
  await import('../client.js')
  assert.equal(typeof exported.apply, 'function')
  exported.apply(ctx)
  assert.equal(registered.length, 1)
  assert.equal(registered[0].options.key, 'dsh-lore-companion')

  react.reset()
  const tree = registered[0].component({ locale, t: (key) => messages[key] || key, scope })
  const text = []
  const types = []
  walk(tree, (node) => {
    if (node.text !== undefined) text.push(node.text)
    if (node.type !== undefined) types.push(node.type)
  })
  const joined = text.join(' ')
  assert.match(joined, /旅途记录仪/)
  assert.match(joined, /知识源/)
  assert.match(joined, /虚空终端 MCP/)
  assert.match(joined, /启用 DeepSeek Web Search/)
  assert.match(joined, /保存/)
  assert.ok(types.filter((type) => type === 'button').length >= 2)
  assert.ok(types.filter((type) => type === 'input').length >= 30)
  assert.ok(types.filter((type) => type === 'select').length >= 3)
})
