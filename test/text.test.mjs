import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeText, matchKey, similarity, editSimilarity, textHash, scoreText, isPunctuationOnly } from '../lib/store/text.js'

test('normalizeText maps full-width punctuation and removes whitespace', () => {
  assert.equal(normalizeText(' 派蒙：旅行者，我们走吧！ '), '派蒙:旅行者,我们走吧!')
})

test('matchKey removes punctuation for fuzzy matching', () => {
  assert.equal(matchKey('派蒙：旅行者，我们走吧！'), '派蒙旅行者我们走吧')
})

test('textHash is stable across punctuation and whitespace jitter', () => {
  assert.equal(textHash('派蒙：旅行者，我们走吧！'), textHash('派蒙: 旅行者 我们走吧'))
})

test('editSimilarity catches one-character OCR jitter in a long line', () => {
  const left = '旅行者，我们走吧！前面就是璃月港了'
  const right = '旅行者，我们走吧！前面就是璃月巷了'
  const value = editSimilarity(left, right)
  assert.ok(value > 0.9, 'expected high similarity, got ' + value)
  assert.ok(value < 1, 'expected not identical')
  assert.ok(similarity(left, right) > 0.7)
})

test('short text similarity stays coarse', () => {
  assert.equal(similarity('嗯', '嗯'), 1)
  assert.ok(similarity('嗯', '好') < 0.2)
})

test('scoreText rewards exact substring', () => {
  assert.equal(scoreText('旅行者，我们走吧！', '旅行者'), 3)
  assert.ok(scoreText('旅行者，我们走吧！', '走吧') > 0)
  assert.equal(scoreText('旅行者，我们走吧！', '完全不相关'), 0)
})

test('isPunctuationOnly detects punctuation-only OCR noise', () => {
  assert.equal(isPunctuationOnly('……！'), true)
  assert.equal(isPunctuationOnly('派蒙'), false)
})
