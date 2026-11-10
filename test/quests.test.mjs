import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { questForSession } from '../lib/quests.js'

test('quest mapping separates main and world sessions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-quests-'))
  try {
    mkdirSync(join(dir, 'journal'), { recursive: true })
    writeFileSync(join(dir, 'journal', 'quests.json'), JSON.stringify({
      sessions: {
        main: { type: 'main', name: '圣土化', day: 1 },
        world: { type: 'world', name: '新基捷', day: 2 }
      }
    }), 'utf8')
    assert.equal(questForSession(dir, 'main').label, '主线')
    assert.equal(questForSession(dir, 'world').label, '世界任务')
    assert.equal(questForSession(dir, 'missing').label, '未分类')
    assert.equal(questForSession(dir, 'world').day, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
