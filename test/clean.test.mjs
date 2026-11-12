import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LogStore } from '../lib/store/log.js'
import { makeDialogueRecord } from '../lib/store/dedupe.js'
import { cleanOcrText, cleanRecords, detectWatermarks, firstClause } from '../lib/store/clean.js'

test('repeated long digit runs are treated as a watermark', () => {
  const records = [
    { text: '虚照：你看新闻了吗？\n102153472' },
    { text: '噗噗：大家好！\n102153472' },
    { text: '归寂：呵。\n102153472' },
    { text: '三月七：走吧！\n153472' }
  ]
  const marks = detectWatermarks(records)
  assert.ok(marks.has('102153472'))
  // The watermark is often clipped at the head, so its suffixes count as marks too.
  assert.ok(marks.has('153472'))
  assert.equal(cleanOcrText(records[0].text, marks), '虚照：你看新闻了吗？')
  assert.equal(cleanOcrText(records[3].text, marks), '三月七：走吧！')
})

test('a number that appears once is not mistaken for a watermark', () => {
  const marks = detectWatermarks([{ text: '信用点×21000' }, { text: '信用点×21000' }])
  assert.equal(cleanOcrText('信用点×21000', marks), '信用点×21000')
})

test('artifact-only lines are dropped but ellipsis survives', () => {
  assert.equal(cleanOcrText('0:10\n12\n7325'), '')
  assert.equal(cleanOcrText('……'), '……')
  assert.equal(cleanOcrText('RODWin4.6.0_D16854589_A16781679_L16781679'), '')
})

test('wrapped CJK lines rejoin without a space', () => {
  assert.equal(cleanOcrText('如此激进的行为必将带来无穷恶果，被归寂的骰揭开真相的灯塔对亚婆离注入了过量的古兽源质，令其彻底\n为吃语的疯兽。'), '如此激进的行为必将带来无穷恶果，被归寂的骰揭开真相的灯塔对亚婆离注入了过量的古兽源质，令其彻底为吃语的疯兽。')
})

test('broadcast ticker soup is stripped, real words are kept', () => {
  assert.equal(cleanOcrText('阿哈现身归来！ TM.rMAR!.PSGAT!'), '阿哈现身归来！')
  assert.equal(cleanOcrText('Tech otakus save the World'), 'Tech otakus save the World')
})

test('cleanRecords drops records that only held noise', () => {
  const out = cleanRecords([
    { text: '102153472', utteranceId: 'a' },
    { text: '派蒙：走吧！', utteranceId: 'b' }
  ])
  assert.deepEqual(out.map((record) => record.utteranceId), ['b'])
})

test('firstClause trims at the first readable clause', () => {
  assert.equal(firstClause('虚照：你看新闻了吗？后面还有很多话'), '虚照：你看新闻了吗')
  assert.equal(firstClause('短'), '短')
})

test('log store returns cleaned text without rewriting the file on disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-clean-'))
  try {
    const store = new LogStore({ dataDir: dir })
    for (const [index, text] of ['虚照：你看新闻了吗？\n102153472', '噗噗：大家好！\n102153472', '归寂：呵。\n102153472'].entries()) {
      store.append(makeDialogueRecord({ game: 'hsr', session: 's1', text, speaker: 'x', now: new Date(Date.UTC(2026, 10, 1, 5, index)) }))
    }
    const records = store.allEntries('hsr').records
    assert.equal(records.length, 3)
    assert.ok(records.every((record) => !record.text.includes('102153472')))
    assert.equal(records[0].text, '虚照：你看新闻了吗？')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
