import test from 'node:test'
import assert from 'node:assert/strict'
import { findDuplicate, makeDialogueRecord, utteranceId } from '../lib/store/dedupe.js'

function record(text, options = {}) {
  return makeDialogueRecord({
    game: 'genshin',
    session: 's1',
    text,
    speaker: options.speaker ?? null,
    kind: options.kind ?? 'dialogue',
    now: options.now ?? new Date('2026-11-01T05:00:00.000Z')
  })
}

test('utteranceId is deterministic for the same normalized line', () => {
  assert.equal(
    utteranceId({ game: 'genshin', session: 's1', text: '派蒙：旅行者，我们走吧！', speaker: '派蒙' }),
    utteranceId({ game: 'genshin', session: 's1', text: '派蒙: 旅行者 我们走吧', speaker: '派蒙' })
  )
})

test('exact duplicate is found', () => {
  const first = record('旅行者，我们走吧！')
  const second = record('旅行者，我们走吧！')
  const match = findDuplicate([first], second, { now: Date.parse('2026-11-01T05:00:05.000Z') })
  assert.ok(match)
  assert.equal(match.exact, true)
  assert.equal(match.record.utteranceId, first.utteranceId)
})

test('OCR jitter in a long line is treated as duplicate', () => {
  const first = record('旅行者，我们走吧！前面就是璃月港了')
  const second = record('旅行者，我们走吧！前面就是璃月巷了')
  const match = findDuplicate([first], second, { now: Date.parse('2026-11-01T05:00:05.000Z') })
  assert.ok(match)
  assert.equal(match.exact, false)
  assert.ok(match.similarity > 0.85)
})

test('prefix truncation is treated as duplicate', () => {
  const first = record('这里是冒险家协会总部，如果您在其他国家与地区遇到什么当地冒险家协会没法解决的问题，可以来总部进行咨询。')
  const second = record('这里是冒险家协会总部，如果您在其他国家与地区遇到什么当地冒险家协会没法解决的问题。')
  const match = findDuplicate([first], second, { now: Date.parse('2026-11-01T05:00:05.000Z') })
  assert.ok(match)
  assert.equal(match.prefix, true)
})

test('speaker change prevents merging', () => {
  const first = record('旅行者，我们走吧！', { speaker: '派蒙' })
  const second = record('旅行者，我们走吧！', { speaker: '钟离' })
  assert.equal(findDuplicate([first], second, { now: Date.parse('2026-11-01T05:00:05.000Z') }), null)
})

test('lines outside the dedupe window are not merged', () => {
  const first = record('旅行者，我们走吧！')
  const second = record('旅行者，我们走吧！')
  const match = findDuplicate([first], second, {
    windowMinutes: 10,
    now: Date.parse('2026-11-01T06:00:00.000Z')
  })
  assert.equal(match, null)
})

test('short lines use exact matching only', () => {
  const first = record('好')
  const second = record('好的')
  const match = findDuplicate([first], second, { now: Date.parse('2026-11-01T05:00:05.000Z') })
  assert.equal(match, null)
})
