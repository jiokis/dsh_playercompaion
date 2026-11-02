import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveConfig } from '../lib/config.js'
import { OverlayManager } from '../lib/overlay.js'

test('overlay manager writes state, reports status and fails cleanly when the script is missing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-overlay-'))
  try {
    const config = resolveConfig({ dataDir: dir, overlay: { enabled: true, autoShow: false } })
    const manager = new OverlayManager({ config, dataDir: dir, scriptPath: join(dir, 'missing.ps1') })
    await manager.update({ visible: true, speaker: '凯瑟琳', text: '向着星辰与深渊！' })
    const state = JSON.parse(readFileSync(join(dir, 'overlay', 'state.json'), 'utf8'))
    assert.equal(state.visible, true)
    assert.equal(state.speaker, '凯瑟琳')
    const status = manager.status()
    assert.equal(status.state.text, '向着星辰与深渊！')
    assert.equal(status.running, false)
    const shown = await manager.show({ text: '等待对话……' })
    assert.equal(shown.ok, false)
    assert.match(shown.error, /overlay script missing/)
    await manager.hide()
    assert.equal(manager.readState().visible, false)
    manager.dispose()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
