import test from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions, compatibilityReport, normalizeToolSpec, parseVersion, registerTool } from '../lib/compat.js'

test('versions parse and compare, with prereleases below releases', () => {
  assert.deepEqual(parseVersion('0.2.1-rc.2'), { major: 0, minor: 2, patch: 1, prerelease: 'rc.2', raw: '0.2.1-rc.2' })
  assert.equal(parseVersion('nope'), null)
  assert.ok(compareVersions('0.2.0', '0.3.0') < 0)
  assert.ok(compareVersions('0.3.0', '0.3.0') === 0)
  assert.ok(compareVersions('0.2.1-rc.2', '0.2.1') < 0)
  assert.ok(compareVersions('1.0.0', '0.9.9') > 0)
})

test('a tested host reports no version warning', () => {
  const report = compatibilityReport({
    host: { version: '0.2.1-rc.2' },
    tools: { register: () => {} },
    web: { search: () => {} },
    attachments: {},
    plugin: () => {},
    get: () => null
  })
  assert.equal(report.status, 'tested')
  assert.equal(report.version, '0.2.1-rc.2')
  assert.deepEqual(report.warnings, [])
  assert.equal(report.capabilities.tools, true)
})

test('a newer host is allowed but flagged as untested', () => {
  const report = compatibilityReport({ host: { version: '0.5.0' }, tools: { register: () => {} } })
  assert.equal(report.status, 'newer-than-tested')
  assert.ok(report.warnings.some((item) => item.includes('newer than the tested range')))
})

test('a missing optional surface degrades instead of throwing', () => {
  const report = compatibilityReport({ host: { version: '0.2.1-rc.2' }, tools: { register: () => {} } })
  assert.equal(report.status, 'tested')
  assert.ok(report.missing.includes('web'))
  assert.ok(report.warnings.some((item) => item.includes('optional host surface: web')))
})

test('a missing required surface is reported as an error warning', () => {
  const report = compatibilityReport({ host: { version: '0.2.1-rc.2' } })
  assert.ok(report.warnings.some((item) => item.includes('missing required host surface: tools.register')))
})

test('tool registration survives a broken host register', () => {
  const warnings = []
  assert.equal(registerTool({}, { name: 'lore_status' }, warnings), false)
  assert.ok(warnings[0].includes('ctx.tools.register is missing'))

  const registered = []
  const ok = registerTool({ tools: { register: (spec) => registered.push(spec) } }, { name: 'lore_status', input: { type: 'object' } }, [])
  assert.equal(ok, true)
  assert.equal(registered.length, 1)
  assert.equal(registered[0].name, 'lore_status')

  const throwing = []
  assert.equal(registerTool({ tools: { register: () => { throw new Error('schema rejected') } } }, { name: 'x' }, throwing), false)
  assert.ok(throwing[0].includes('failed to register'))
})

test('tool specs get the fields the host expects', () => {
  const spec = normalizeToolSpec({ name: 'x' })
  assert.equal(spec.description, 'x')
  assert.deepEqual(spec.input, { type: 'object', properties: {} })
})
