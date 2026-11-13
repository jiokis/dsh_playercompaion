import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadRoster, profileCharacter, resolveCharacterName, rosterFacts } from '../lib/characters.js'

function withRoster(characters, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-roster-'))
  try {
    mkdirSync(join(dir, 'journal'), { recursive: true })
    writeFileSync(join(dir, 'journal', 'characters.json'), JSON.stringify({ characters }), 'utf8')
    loadRoster({ dataDir: dir })
    return fn(dir)
  } finally {
    loadRoster({ dataDir: null })
    rmSync(dir, { recursive: true, force: true })
  }
}

test('two characters that look alike stay separate', () => {
  loadRoster({})
  assert.equal(resolveCharacterName('火花'), '火花')
  assert.equal(resolveCharacterName('花火'), '花火')
  const spark = profileCharacter({ game: 'hsr', query: '火花' }).character
  const sparkle = profileCharacter({ game: 'hsr', query: '花火' }).character
  assert.equal(spark.element, '火')
  assert.notEqual(spark.note, sparkle.note)
})

test('OCR variants resolve through the roster', () => {
  loadRoster({})
  assert.equal(resolveCharacterName('肩爷本屑'), '屑爷本屑')
  assert.equal(resolveCharacterName('排英'), '绯英')
  assert.equal(resolveCharacterName('未知路人'), '未知路人')
})

test('a variant claimed by two characters is never guessed', () => {
  withRoster([
    { name: '火花', aliases: ['花'] },
    { name: '花火', aliases: ['花'] }
  ], () => {
    assert.equal(resolveCharacterName('花'), '花')
    const found = profileCharacter({ game: 'hsr', query: '花' })
    assert.equal(found.character, null)
    assert.deepEqual(found.ambiguous, ['火花', '花火'])
    const facts = rosterFacts()
    assert.ok(facts.ambiguous.some((item) => item.alias === '花'))
  })
})

test('user overrides win over the bundled seed', () => {
  withRoster([
    { name: '火花', aliases: ['火火'], note: '主播' }
  ], () => {
    assert.equal(resolveCharacterName('火火'), '火花')
    const found = profileCharacter({ game: 'hsr', query: '火花' })
    assert.equal(found.character.custom, true)
    assert.equal(found.character.note, '主播')
  })
})

test('profile suggests candidates when the name is unknown', () => {
  loadRoster({})
  const found = profileCharacter({ game: 'hsr', query: '花' })
  const names = found.suggestions.map((item) => item.name)
  assert.ok(names.includes('火花'))
  assert.ok(names.includes('花火'))
})
