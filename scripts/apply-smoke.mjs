import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, inject, name } from '../lib/index.js'

const dataDir = mkdtempSync(join(tmpdir(), 'dsh-lore-apply-'))
process.env.DSH_LORE_DATA_DIR = dataDir
const registered = []
let dispose = null
const ctx = {
  tools: { register(tool) { registered.push(tool); return () => {} } },
  attachments: { saveImage: async () => ({ attachmentId: 'x' }) },
  on(event, handler) { if (event === 'dispose') dispose = handler }
}
try {
  apply(ctx, {})
  await new Promise((resolve) => setTimeout(resolve, 800))
  console.log(JSON.stringify({ name, inject, tools: registered.map((tool) => tool.name), hasDispose: typeof dispose === 'function' }))
} finally {
  try { dispose?.() } catch {}
  rmSync(dataDir, { recursive: true, force: true })
}
