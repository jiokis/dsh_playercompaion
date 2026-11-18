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

test('tool specs are passed through untouched when complete', () => {
  const original = { name: 'x', description: 'd', parameters: { a: 1 }, execute: () => {} }
  assert.equal(normalizeToolSpec(original), original)
  // A missing description is filled, but no unknown keys are added: the host
  // rejects a registered tool whose shape it does not recognise.
  const filled = normalizeToolSpec({ name: 'x' })
  assert.equal(filled.description, 'x')
  assert.deepEqual(Object.keys(filled).sort(), ['description', 'name'])
})

test('the declared dsh range cannot gate out a prerelease host', async () => {
  // semver only lets a prerelease satisfy a range that names the same
  // major.minor.patch, so any bounded range silently rejects hosts like
  // 0.2.2-rc.3. Compatibility is decided at runtime by lib/compat.js instead.
  const { readFileSync } = await import('node:fs')
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.dsh.compatibility.dsh, '*')
  assert.equal(pkg.engines.dsh, '*')
})

test('lib avoids APIs that need a newer Node than the desktop host', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs')
  const { join } = await import('node:path')
  const root = new URL('../lib/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
  const offenders = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) {
        walk(path)
        continue
      }
      if (!name.endsWith('.js')) continue
      const source = readFileSync(path, 'utf8')
      // import.meta.dirname landed in Node 20.11; Electron hosts can be older.
      if (source.includes('import.meta.dirname') || source.includes('import.meta.filename')) offenders.push(path)
    }
  }
  walk(root)
  assert.deepEqual(offenders, [])
})
