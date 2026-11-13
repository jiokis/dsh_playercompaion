import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const GAMES = ['genshin', 'hsr']
const seeds = new Map()
let overrides = null
let index = null
let activeDataDir

function readJson(path) {
  try {
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function seedPath(game) {
  return join(import.meta.dirname, '..', 'characters', game + '.json')
}

function seedFor(game) {
  if (!seeds.has(game)) {
    const value = readJson(seedPath(game))
    seeds.set(game, Array.isArray(value?.characters) ? value.characters : [])
  }
  return seeds.get(game)
}

function readOverrides(dataDir) {
  if (!dataDir) return null
  return readJson(join(dataDir, 'journal', 'characters.json'))
}

function normalizeEntry(entry, game) {
  const name = String(entry?.name || '').trim()
  if (!name) return null
  const aliases = Array.isArray(entry.aliases) ? entry.aliases.map((item) => String(item).trim()).filter(Boolean) : []
  return {
    name,
    game: entry.game || game,
    aliases: aliases.filter((alias) => alias !== name),
    rarity: entry.rarity ?? null,
    element: entry.element || '',
    path: entry.path || '',
    note: entry.note || '',
    source: entry.source || '',
    custom: Boolean(entry.custom)
  }
}

/**
 * Seed roster plus the user's own additions. The user file wins so a wrong
 * seed can be corrected without touching the plugin.
 */
export function loadRoster({ dataDir, game } = {}) {
  // Calls without dataDir reuse the last configured dir so a lookup never
  // silently drops the user's overrides.
  if (dataDir !== undefined) activeDataDir = dataDir
  const dir = activeDataDir
  overrides = readOverrides(dir)
  const out = []
  const byName = new Map()
  for (const id of game ? [game] : GAMES) {
    for (const entry of seedFor(id)) {
      const normalized = normalizeEntry(entry, id)
      if (!normalized || byName.has(normalized.name)) continue
      byName.set(normalized.name, normalized)
      out.push(normalized)
    }
  }
  const extra = Array.isArray(overrides?.characters) ? overrides.characters : []
  for (const entry of extra) {
    const normalized = normalizeEntry(entry, entry?.game || game || 'genshin')
    if (!normalized) continue
    const merged = normalized.custom ? normalized : { ...normalized, custom: true }
    if (byName.has(merged.name)) {
      const existing = byName.get(merged.name)
      const replaced = { ...existing, ...merged, aliases: [...new Set([...existing.aliases, ...merged.aliases])] }
      byName.set(merged.name, replaced)
      const at = out.findIndex((item) => item.name === merged.name)
      if (at >= 0) out[at] = replaced
      continue
    }
    byName.set(merged.name, merged)
    out.push(merged)
  }
  index = buildIndex(out)
  return { game: game || 'all', characters: out, index, overridesPath: dir ? join(dir, 'journal', 'characters.json') : null }
}

function buildIndex(characters) {
  const byAlias = new Map()
  const ambiguous = new Map()
  const claim = (alias, name) => {
    if (!alias || alias === name) return
    if (byAlias.has(alias) && byAlias.get(alias) !== name) {
      // Two characters claim the same OCR spelling: refuse to guess.
      ambiguous.set(alias, [byAlias.get(alias), name])
      byAlias.delete(alias)
      return
    }
    if (ambiguous.has(alias)) return
    byAlias.set(alias, name)
  }
  for (const character of characters) {
    byAlias.set(character.name, character.name)
    for (const alias of character.aliases) claim(alias, character.name)
  }
  return { byAlias, ambiguous, byName: new Map(characters.map((item) => [item.name, item])) }
}

export function currentRoster() {
  if (!index) loadRoster({})
  return index
}

export function findCharacter(name) {
  const value = String(name || '').trim()
  if (!value) return null
  return currentRoster().byName.get(value) || null
}

export function resolveCharacterName(name) {
  const value = String(name || '').trim()
  if (!value) return ''
  const built = currentRoster()
  const exact = built.byAlias.get(value)
  if (exact) return exact
  return value
}

export function ambiguousSpeaker(name) {
  return currentRoster().ambiguous.get(String(name || '').trim()) || null
}

export function rosterFacts() {
  const built = currentRoster()
  return {
    characters: built.byName.size,
    aliases: built.byAlias.size,
    ambiguous: [...built.ambiguous.entries()].map(([alias, names]) => ({ alias, names }))
  }
}

export function profileCharacter({ dataDir, game, query } = {}) {
  const roster = loadRoster({ dataDir, game })
  const needle = String(query || '').trim()
  if (!needle) return { character: null, suggestions: [], ambiguous: null, rosterPath: roster.overridesPath }
  const direct = roster.index.byName.get(needle)
  const viaAlias = roster.index.byAlias.get(needle)
  const character = direct || (viaAlias ? roster.index.byName.get(viaAlias) : null) || null
  const ambiguous = roster.index.ambiguous.get(needle) || null
  const suggestions = character
    ? []
    : roster.characters
      .filter((item) => item.name.includes(needle) || item.aliases.some((alias) => alias.includes(needle)))
      .slice(0, 5)
  return { character, suggestions, ambiguous, rosterPath: roster.overridesPath }
}

export function suggestCharacters(query, limit = 5) {
  const needle = String(query || '').trim()
  if (!needle) return []
  const built = currentRoster()
  const hits = []
  for (const character of built.byName.values()) {
    const haystack = character.name + '|' + character.aliases.join('|')
    if (!haystack.includes(needle)) continue
    hits.push(character)
    if (hits.length >= limit) break
  }
  return hits
}
