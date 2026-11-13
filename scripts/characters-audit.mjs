#!/usr/bin/env node
// Lists speakers from the local log that the roster does not know about, so
// maintaining characters/*.json stays a mechanical chore instead of a guess.
import { resolveDataDir } from '../lib/paths.js'
import { resolveConfig } from '../lib/config.js'
import { LogStore } from '../lib/store/log.js'
import { loadRoster } from '../lib/characters.js'
import { normalizeSpeaker } from '../lib/speakers.js'

const args = process.argv.slice(2)
const gameArg = args.find((item) => item.startsWith('--game='))?.split('=')[1]
const dataDirArg = args.find((item) => item.startsWith('--data='))?.split('=')[1]
const games = gameArg ? [gameArg] : ['genshin', 'hsr']
const dataDir = dataDirArg || resolveDataDir(resolveConfig({}))
const store = new LogStore({ dataDir })
loadRoster({ dataDir })

console.log('dataDir=' + dataDir)
for (const game of games) {
  const roster = loadRoster({ dataDir, game })
  const known = roster.index
  const counts = new Map()
  for (const entry of store.allEntries(game).records) {
    const name = normalizeSpeaker(entry.speaker)
    if (!name) continue
    if (known.byName.has(name)) continue
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  const rows = [...counts.entries()].sort((left, right) => right[1] - left[1])
  console.log('')
  console.log(game + ': ' + rows.length + ' unknown speakers / ' + known.byName.size + ' known')
  for (const [name, count] of rows.slice(0, 40)) console.log('  ' + String(count).padStart(5) + '  ' + name)
  if (rows.length > 40) console.log('  … ' + (rows.length - 40) + ' more')
  const facts = rosterFactsOf(roster)
  if (facts.ambiguous.length) {
    console.log('  ambiguous aliases: ' + facts.ambiguous.map((item) => item.alias + '→' + item.names.join('/')).join(', '))
  }
}

function rosterFactsOf(roster) {
  return {
    ambiguous: [...roster.index.ambiguous.entries()].map(([alias, names]) => ({ alias, names }))
  }
}
