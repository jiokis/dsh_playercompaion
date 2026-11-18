import { createRequire } from 'node:module'

// The plugin talks to a handful of host surfaces. Keeping the list here means a
// future DSH release only needs edits in one file, and a missing surface turns
// into a reported capability instead of a crash.
export const HOST_SURFACES = [
  { id: 'tools', path: ['tools', 'register'], required: true, feature: 'tool registration' },
  { id: 'web', service: 'web', path: ['web', 'search'], required: false, feature: 'DSH web search' },
  { id: 'attachments', service: 'attachments', path: ['attachments'], required: false, feature: 'image attachments' },
  { id: 'plugin', path: ['plugin'], required: false, feature: 'remote services' },
  { id: 'get', path: ['get'], required: false, feature: 'service lookup' }
]

// Ranges are inclusive of what has been tested; anything newer is reported as
// "untested" rather than blocked, because this plugin only uses stable surfaces.
export const TESTED_RANGE = { min: '0.2.1-rc.2', maxExclusive: '0.4.0' }

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

export function parseVersion(value) {
  const match = VERSION_RE.exec(String(value || '').trim())
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || '',
    raw: String(value).trim()
  }
}

export function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (!a || !b) return 0
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1
  }
  // A prerelease sorts before the matching release.
  if (a.prerelease && !b.prerelease) return -1
  if (!a.prerelease && b.prerelease) return 1
  if (a.prerelease === b.prerelease) return 0
  return a.prerelease < b.prerelease ? -1 : 1
}

function resolvePackageVersion(name) {
  try {
    const require = createRequire(import.meta.url)
    return JSON.parse(require('node:fs').readFileSync(require.resolve(name + '/package.json'), 'utf8')).version
  } catch {
    return null
  }
}

/**
 * Cordis exposes ctx as a proxy: reading a service that is not loaded can throw
 * instead of returning undefined. Every probe here must survive that.
 */
export function safeRead(target, path) {
  try {
    let cursor = target
    for (const key of path) {
      if (!cursor || typeof cursor !== 'object') return undefined
      cursor = cursor[key]
    }
    return cursor
  } catch {
    return undefined
  }
}

function lookupService(ctx, name) {
  try {
    if (typeof ctx?.get === 'function') {
      const value = ctx.get(name)
      if (value !== undefined && value !== null) return value
    }
  } catch {
    /* service not available through get() */
  }
  return safeRead(ctx, [name])
}

export function hostVersion(ctx) {
  const candidates = [
    safeRead(ctx, ['host', 'version']),
    safeRead(ctx, ['version']),
    process.env.DSH_HOST_VERSION,
    resolvePackageVersion('@deepseek-ai/dsh-tools'),
    resolvePackageVersion('@deepseek-ai/dsh-typert-protocol')
  ]
  for (const value of candidates) {
    if (parseVersion(value)) return String(value)
  }
  return null
}

export function hostCapabilities(ctx) {
  const out = {}
  for (const surface of HOST_SURFACES) {
    const direct = surface.service ? lookupService(ctx, surface.service) : safeRead(ctx, surface.path.slice(0, -1))
    const value = surface.service
      ? (surface.path.length > 1 ? safeRead(direct, surface.path.slice(1)) : direct)
      : safeRead(ctx, surface.path)
    out[surface.id] = typeof value === 'function' || (value !== null && typeof value === 'object')
  }
  return out
}

export function compatibilityReport(ctx) {
  const version = hostVersion(ctx)
  const capabilities = hostCapabilities(ctx)
  const warnings = []
  let status = 'unknown'
  if (version) {
    const min = compareVersions(version, TESTED_RANGE.min)
    const max = compareVersions(version, TESTED_RANGE.maxExclusive)
    if (min < 0) {
      status = 'older-than-tested'
      warnings.push('host ' + version + ' is older than the tested ' + TESTED_RANGE.min)
    } else if (max >= 0) {
      status = 'newer-than-tested'
      warnings.push('host ' + version + ' is newer than the tested range; core tools should still work')
    } else {
      status = 'tested'
    }
  } else {
    warnings.push('host version could not be detected; capability detection is still used')
  }
  for (const surface of HOST_SURFACES) {
    if (surface.required && !capabilities[surface.id]) {
      warnings.push('missing required host surface: ' + surface.path.join('.'))
    } else if (!surface.required && !capabilities[surface.id]) {
      warnings.push('missing optional host surface: ' + surface.path.join('.') + ' (' + surface.feature + ' disabled)')
    }
  }
  return {
    version,
    status,
    testedRange: TESTED_RANGE,
    capabilities,
    missing: HOST_SURFACES.filter((surface) => !capabilities[surface.id]).map((surface) => surface.id),
    warnings
  }
}

export function normalizeToolSpec(spec) {
  if (!spec || typeof spec !== 'object') return spec
  // Never invent fields: the host validates registered tools and an unknown key
  // rejects the whole definition. Only fill what defineTool always requires.
  if (typeof spec.name !== 'string' || !spec.name) return spec
  if (typeof spec.description === 'string' && spec.description) return spec
  return { ...spec, description: String(spec.description || spec.name) }
}

// Tool factories already call the host's defineTool, so this only guards the
// registration surface itself.
export function registerTool(ctx, spec, warnings) {
  let register
  try {
    register = typeof ctx?.tools?.register === 'function' ? ctx.tools.register : null
  } catch {
    register = null
  }
  if (!register) {
    if (Array.isArray(warnings)) warnings.push('ctx.tools.register is missing; tool ' + spec?.name + ' was not registered')
    return false
  }
  const normalized = normalizeToolSpec(spec)
  try {
    register.call(ctx.tools, normalized)
    return true
  } catch (error) {
    if (Array.isArray(warnings)) warnings.push('tool ' + (spec?.name || '?') + ' failed to register: ' + error.message)
    return false
  }
}
