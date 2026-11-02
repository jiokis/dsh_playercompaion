import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveConfig } from '../lib/config.js'
import { ROOT } from './_paths.mjs'

const messages = {
  title: '旅途记录仪',
  subtitle: '只读 · 原神 / 星铁 · 抓屏 OCR · 本地日志 · 游戏内悬浮窗',
  intro: '保存后请重启 DSH 生效；本页只改配置，不写日志、不抓屏。',
  save: '保存',
  reset: '恢复默认',
  saved: '已保存；重启 DSH 生效。',
  notApplied: 'Host 拒绝了这次写入，请刷新后重试。',
  notReady: '配置还没有就绪。',
  readOnly: '当前配置不可写。',
  error: '保存失败',
  hintOverlay: '悬浮窗置顶、鼠标穿透、不抢焦点；只在原神/星铁前台显示。'
}

let css = ''
const styleTag = { dataset: {}, get textContent() { return css }, set textContent(value) { css = value } }
globalThis.document = {
  getElementById: () => null,
  createElement: () => styleTag,
  head: { appendChild: () => {} }
}

const react = (() => {
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
  return { createElement, useState, useEffect, reset() { hooks = []; hookIndex = 0 } }
})()

const registered = []
const scope = {
  getSnapshot: () => ({ status: 'ready', value: resolveConfig({}), revision: 1, writable: true }),
  mutate: async () => true,
  subscribe: () => () => {}
}
const locale = { current: 'zh', subscribe: () => () => {} }
const ctx = {
  locale: { bind: () => (key) => messages[key] || key, register: () => () => {}, current: 'zh' },
  effect: (fn) => { fn(); return () => {} },
  configForms: { get: () => scope },
  slots: {
    inject: (_name, fn) => fn(),
    register: (options, component) => { registered.push({ options, component }); return () => {} }
  }
}
let exported = null
globalThis.window = {
  __ModuleLoader__: {
    load: ({ factory }) => {
      exported = factory((name) => {
        if (name === 'react') return react
        throw new Error('unexpected require ' + name)
      })
    }
  }
}
await import('../client.js')
exported.apply(ctx)
react.reset()
const tree = registered[0].component({ locale, t: (key) => messages[key] || key, scope })

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
}

function attrs(props) {
  const parts = []
  for (const [key, value] of Object.entries(props || {})) {
    if (key === 'children' || value === undefined || value === null || value === false) continue
    if (key === 'checked') { if (value) parts.push('checked'); continue }
    if (key === 'disabled') { if (value) parts.push('disabled'); continue }
    if (key === 'value') { parts.push('value="' + escapeHtml(value) + '"'); continue }
    const map = {
      className: 'class',
      strokeWidth: 'stroke-width',
      strokeLinejoin: 'stroke-linejoin',
      viewBox: 'viewBox',
      ariaChecked: 'aria-checked'
    }
    const name = map[key] || key
    parts.push(name + '="' + escapeHtml(value) + '"')
  }
  return parts.length ? ' ' + parts.join(' ') : ''
}

function serialize(node) {
  if (node === null || node === undefined || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return escapeHtml(node)
  if (Array.isArray(node)) return node.map(serialize).join('')
  if (!node.type) return ''
  const tag = node.type
  const content = serialize(node.props && node.props.children)
  if (tag === 'input') return '<input' + attrs(node.props) + '>'
  return '<' + tag + attrs(node.props) + '>' + content + '</' + tag + '>'
}

const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<style>html,body{margin:0;background:#0b0d12;color:#e8ecf4;font-family:"Microsoft YaHei UI",system-ui,sans-serif}body{padding:28px 20px 40px;display:flex;justify-content:center}.lc-root{width:100%}</style>' +
  '<style>' + css + '</style></head><body>' + serialize(tree) + '</body></html>'
writeFileSync(join(ROOT, 'scripts', 'client-preview.html'), html, 'utf8')
console.log('wrote preview', html.length)
