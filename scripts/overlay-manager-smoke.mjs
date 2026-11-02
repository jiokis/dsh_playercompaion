import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveConfig } from '../lib/config.js'
import { OverlayManager } from '../lib/overlay.js'
import { ROOT } from './_paths.mjs'

const dir = mkdtempSync(join(tmpdir(), 'dsh-lore-overlay-manager-'))
const config = resolveConfig({ dataDir: dir, overlay: { enabled: true, autoShow: false, position: 'top-right' } })
const manager = new OverlayManager({ config, dataDir: dir, scriptPath: join(ROOT, 'overlay', 'overlay.ps1') })
const shown = await manager.show({
  visible: true,
  preview: true,
  status: '管理器预览',
  speaker: '凯瑟琳',
  speakerTitle: '冒险家协会接待员',
  text: '这里是冒险家协会总部，如果您遇到问题，可以来总部咨询。',
  choices: ['关于至冬', '再见。']
})
await new Promise((resolve) => setTimeout(resolve, 2500))
const status = manager.status()
await manager.hide()
manager.dispose()
await new Promise((resolve) => setTimeout(resolve, 500))
console.log(JSON.stringify({ shown, status, stateVisible: manager.readState().visible }, null, 2))
rmSync(dir, { recursive: true, force: true })
