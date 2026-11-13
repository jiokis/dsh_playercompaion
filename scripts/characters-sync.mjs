#!/usr/bin/env node
// Enriches the local character cache from the Akasha (虚空终端) document base.
// Only the character name is sent. Results land in <dataDir>/journal/characters.json
// so the roster keeps working offline.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { resolveConfig } from '../lib/config.js'
import { resolveDataDir } from '../lib/paths.js'
import { LogStore } from '../lib/store/log.js'
import { loadRoster } from '../lib/characters.js'
import { normalizeSpeaker } from '../lib/speakers.js'
import { AkashaClient } from '../lib/sources/akasha.js'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = args.find((item) => item.startsWith('--' + name + '='))
  return hit ? hit.split('=')[1] : fallback
}
const game = flag('game', 'genshin')
const dataDir = flag('data', resolveDataDir(resolveConfig({})))
const limit = Math.max(1, Math.min(200, Number(flag('limit', 10)) || 10))
const minLines = Math.max(1, Number(flag('min', 5)) || 5)
const world = game === 'hsr' ? 'hsr' : 'gi'

const store = new LogStore({ dataDir })
const roster = loadRoster({ dataDir, game })
const counts = new Map()
for (const entry of store.allEntries(game).records) {
  const name = normalizeSpeaker(entry.speaker)
  if (!name || roster.index.byName.has(name)) continue
  counts.set(name, (counts.get(name) || 0) + 1)
}
// Names that are really HUD verbs, counters or generic labels.
const NOT_A_NAME = /^(?:获得|已获得|未确定|信息|提示|旁白|选项|任务|奖励|日期|久远|实验者|冰之印|传送|开启|解锁|已解锁|新|系统)/
const candidates = [...counts.entries()]
  .filter(([, count]) => count >= minLines)
  .filter(([name]) => /^[\u4e00-\u9fff·]{2,12}$/.test(name))
  .filter(([name]) => !NOT_A_NAME.test(name))
  .sort((left, right) => right[1] - left[1])
  .slice(0, limit)

console.log('game=' + game + ' dataDir=' + dataDir)
console.log('candidates=' + candidates.length + ' (min ' + minLines + ' lines)')
if (!candidates.length) process.exit(0)

const client = new AkashaClient({ config: resolveConfig({}) })
const cachePath = join(dataDir, 'journal', 'characters.json')
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : { characters: [] }
if (!Array.isArray(cache.characters)) cache.characters = []
let added = 0

for (const [name, count] of candidates) {
  try {
    const found = await client.search({ game, query: name, limit: 3 })
    if ((found.warnings || []).some((item) => item.includes('429'))) {
      console.log('  !  限流（429），先停下；已写入的条目保留')
      break
    }
    // Only an exact title is trustworthy; a fuzzy hit would rename the speaker.
    const hit = (found.results || []).find((item) => item.title === name)
    if (!hit) {
      console.log('  -  ' + name + ' (' + count + ')' + ' 未收录')
      continue
    }
    const detail = await readCharacterDoc(client, world, hit.pathHash)
    if (!detail.isCharacter) {
      console.log('  -  ' + name + ' (' + count + ')' + ' 不是角色文档，跳过')
      continue
    }
    const entry = { name, game, aliases: [], source: 'akasha:' + (hit.pathHash || ''), syncedAt: new Date().toISOString() }
    Object.assign(entry, detail)
    const existing = cache.characters.findIndex((item) => item.name === name)
    if (existing >= 0) cache.characters[existing] = entry
    else cache.characters.push(entry)
    added += 1
    console.log('  +  ' + name + ' (' + count + ')' + (detail.element ? '  ' + detail.element + '·' + (detail.path || '') : ''))
  } catch (error) {
    console.log('  !  ' + name + ' ' + (error.code || '') + ' ' + error.message)
  }
}

if (added) {
  mkdirSync(dirname(cachePath), { recursive: true })
  const tmp = cachePath + '.tmp'
  writeFileSync(tmp, JSON.stringify(cache, null, 2) + '\n', 'utf8')
  renameSync(tmp, cachePath)
}
console.log('updated=' + added + ' cache=' + cachePath)

async function readCharacterDoc(akasha, worldId, pathHash) {
  if (!pathHash) return { isCharacter: false }
  const result = await akasha.rpc('tools/call', { name: 'akasha_read', arguments: { world: worldId, pathHash, offset: 1, limit: 12 } })
  const payload = result.result || {}
  const text = (payload.content || []).filter((item) => item.type === 'text').map((item) => item.text).join('\n')
  const rarity = /稀有度\*\*:\s*(\d)星/.exec(text)?.[1]
  const element = (/属性\*\*:\s*([^\n]+)/.exec(text)?.[1] || /元素\*\*:\s*([^\n]+)/.exec(text)?.[1] || '').trim()
  const path = (/命途\*\*:\s*([^\n]+)/.exec(text)?.[1] || /武器\*\*:\s*([^\n]+)/.exec(text)?.[1] || '').trim()
  // A character doc always carries a profile block; anything else is a quest,
  // item or glossary page that happens to share the name.
  const isCharacter = Boolean(rarity) || text.includes('角色故事') || text.includes('基础资料')
  return {
    isCharacter,
    rarity: rarity ? Number(rarity) : null,
    element,
    path
  }
}
