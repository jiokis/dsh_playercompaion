#!/usr/bin/env node
// One command that proves the plugin can load on this machine, without booting
// the GUI. Run it after every DSH update: node scripts/selfcheck.mjs
import { readFileSync } from 'node:fs'
import { apply } from '../lib/index.js'
import { compatibilityReport } from '../lib/compat.js'
import { rosterFacts } from '../lib/characters.js'
import { resolveConfig } from '../lib/config.js'
import { resolveDataDir } from '../lib/paths.js'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
console.log('dsh-lore-companion ' + pkg.version)
console.log('declared dsh range: ' + (pkg.dsh?.compatibility?.dsh ?? '(none)') + ' | engines.dsh: ' + (pkg.engines?.dsh ?? '(none)'))
console.log('node: ' + process.version)

// A Cordis-like ctx: unknown services throw instead of returning undefined.
function strictCtx(extra = {}) {
  const base = { logger: { warn: () => {}, info: () => {}, error: () => {} }, ...extra }
  return new Proxy(base, {
    get(target, prop) {
      if (typeof prop === 'symbol') return target[prop]
      if (prop in target) return target[prop]
      throw new Error('service not available: ' + String(prop))
    }
  })
}

const registered = []
const warnings = []
const ctx = strictCtx({
  tools: { register: (spec) => registered.push(spec && spec.name) },
  plugin: () => {},
  on: () => {},
  inject: () => {},
  get: () => null,
  logger: { warn: (message) => warnings.push(String(message)), info: () => {}, error: (m) => warnings.push(String(m)) }
})

try {
  await apply(ctx, {})
  console.log('apply: ok')
} catch (error) {
  console.log('apply: FAILED')
  console.log(error && error.stack ? error.stack.split('\n').slice(0, 8).join('\n') : String(error))
  process.exitCode = 1
}

console.log('tools: ' + (registered.length ? registered.join(', ') : 'none'))
console.log('compat: ' + JSON.stringify(compatibilityReport(ctx), null, 2))
const roster = rosterFacts()
console.log('roster: ' + roster.characters + ' characters, ' + roster.aliases + ' aliases, ' + roster.ambiguous.length + ' ambiguous')
console.log('dataDir: ' + resolveDataDir(resolveConfig({})))
if (warnings.length) {
  console.log('warnings:')
  for (const warning of warnings) console.log('  - ' + warning)
}
