import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveConfig } from '../lib/config.js'
import { createRuntime } from '../lib/runtime.js'
import { createVisionTool } from '../lib/tools/vision.js'
import { FrameStore } from '../lib/frames.js'
import { ROOT } from './_paths.mjs'

const dataDir = mkdtempSync(join(tmpdir(), 'dsh-lore-vision-e2e-'))
const config = resolveConfig({
  dataDir,
  vision: { enabled: true, maxFindings: 12 },
  frames: { enabled: true, saveVision: true, maxFrames: 20, retentionDays: 7 }
})
const runtime = createRuntime({ config, engineDir: join(ROOT, 'engine'), dataDir })
const frames = new FrameStore({ config, dataDir })
const ctx = {
  attachments: {
    saveImage: async ({ data, mediaType }) => {
      writeFileSync(join(ROOT, 'scripts', 'vision-e2e.png'), data)
      return { attachmentId: 'vision-e2e', mediaType, bytes: data.length }
    }
  }
}
const tool = createVisionTool({ config, runtime, ctx, frames })
try {
  const first = await tool.execute({
    mode: 'all',
    imagePath: join(ROOT, 'scripts', 'realtest-crop.png'),
    includeImage: true
  }, { signal: new AbortController().signal })
  const archived = frames.list({ limit: 5 })
  const second = await tool.execute({
    mode: 'ui',
    frameId: first.frameId
  }, { signal: new AbortController().signal })
  console.log(JSON.stringify({
    first: {
      mode: first.mode,
      source: first.source,
      frameId: first.frameId,
      attachment: first.attachment,
      warnings: first.warnings,
      metrics: first.analysis?.metrics,
      findings: first.analysis?.findings?.slice(0, 6)
    },
    archived: archived.map((frame) => ({ id: frame.id, game: frame.game, source: frame.source, bytes: frame.bytes })),
    second: {
      source: second.source,
      frameId: second.frameId,
      mode: second.mode,
      panelCount: second.analysis?.metrics?.panelCount
    }
  }, null, 2))
} finally {
  runtime.dispose()
  rmSync(dataDir, { recursive: true, force: true })
}
