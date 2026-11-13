import test from 'node:test'
import assert from 'node:assert/strict'
import { NOISE_TEXT, isNoiseEntry, normalizeSpeaker } from '../lib/speakers.js'

test('genshin OCR variants collapse to one name', () => {
  assert.equal(normalizeSpeaker('纳西姐'), '纳西妲')
  assert.equal(normalizeSpeaker('茜特技莉'), '茜特拉莉')
  assert.equal(normalizeSpeaker('神里华'), '神里绫华')
})

test('star rail OCR variants collapse to one name', () => {
  assert.equal(normalizeSpeaker('肩爷本屑'), '屑爷本屑')
  assert.equal(normalizeSpeaker('排英'), '绯英')
  // 火花 and 花火 are two different characters; never merge them.
  assert.equal(normalizeSpeaker('火花'), '火花')
  assert.equal(normalizeSpeaker('花火'), '花火')
  assert.equal(normalizeSpeaker('星期曰'), '星期日')
  assert.equal(normalizeSpeaker('三明七'), '三月七')
})

test('substring rules apply to decorated titles', () => {
  assert.equal(normalizeSpeaker('「诺迦法」的残响'), '「诺迦法」')
  assert.equal(normalizeSpeaker('光之镜'), '「光之镜」')
})

test('unknown and empty speakers pass through', () => {
  assert.equal(normalizeSpeaker('派蒙'), '派蒙')
  assert.equal(normalizeSpeaker(''), '')
  assert.equal(normalizeSpeaker(null), '')
})

test('hud noise is recognised in one place', () => {
  assert.ok(NOISE_TEXT.test('摩拉×37000'))
  assert.ok(NOISE_TEXT.test('Lv.50'))
  assert.ok(!NOISE_TEXT.test('芙宁娜：审判开始了。'))
  assert.equal(isNoiseEntry({ speaker: '摩拉', text: '37000' }), true)
  assert.equal(isNoiseEntry({ speaker: '派蒙', text: '' }), true)
  assert.equal(isNoiseEntry({ speaker: '派蒙', text: '我们走吧！' }), false)
})

test('journal and story tool share the same table', async () => {
  const { buildJournal } = await import('../lib/journal.js')
  const { LogStore } = await import('../lib/store/log.js')
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-speakers-'))
  try {
    const store = new LogStore({ dataDir: dir })
    const { makeDialogueRecord } = await import('../lib/store/dedupe.js')
    store.append(makeDialogueRecord({ game: 'hsr', session: 's1', speaker: '肩爷本屑', text: '这里是哪儿？', now: new Date('2026-11-01T05:00:00.000Z') }))
    const journal = buildJournal(store, { game: 'hsr', session: 's1' })
    const names = journal.characters.map((person) => person.name)
    assert.ok(names.includes('屑爷本屑'))
    assert.ok(!names.includes('肩爷本屑'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
