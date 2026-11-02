import { mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const dataDir = mkdtempSync(join(tmpdir(), 'dsh-lore-installed-'))
process.env.DSH_LORE_DATA_DIR = dataDir
const entry = join(homedir(), '.dsh', 'profiles', 'lore-dev', 'node_modules', 'dsh-lore-companion', 'lib', 'index.js')
const mod = await import(pathToFileURL(entry).href)
const registered = []
let dispose = null
const ctx = {
  tools: { register(tool) { registered.push(tool.name); return () => {} } },
  attachments: { saveImage: async () => ({ attachmentId: 'x' }) },
  on(event, handler) { if (event === 'dispose') dispose = handler }
}
try {
  mod.apply(ctx, {})
  await new Promise((resolve) => setTimeout(resolve, 800))
  console.log(JSON.stringify({ name: mod.name, inject: mod.inject, tools: registered, hasDispose: typeof dispose === 'function' }))
} finally {
  try { dispose?.() } catch {}
  rmSync(dataDir, { recursive: true, force: true })
}
