import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('AGENTS.md covers the repository agent contract', () => {
  const text = readFileSync('AGENTS.md', 'utf8')
  for (const anchor of [
    '只读红线',
    '禁止的 API',
    '开发命令',
    '测试与验收',
    '故障排查',
    '变更流程',
    'Definition of Done',
    'pnpm install',
    'node --test',
    'pytest',
    'smoke.ps1',
    'dsh.cmd plugin',
    'pnpm pack',
    'YuanShen.exe',
    'StarRail.exe'
  ]) {
    assert.ok(text.includes(anchor), 'AGENTS.md is missing: ' + anchor)
  }
})
