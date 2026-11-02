import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveConfig } from '../lib/config.js'
import { LogStore } from '../lib/store/log.js'
import { createRuntime } from '../lib/runtime.js'
import { WikiSearch } from '../lib/wiki/search.js'
import { createCaptureTool } from '../lib/tools/capture.js'
import { createQueryTool } from '../lib/tools/query.js'
import { createNarrateTool } from '../lib/tools/narrate.js'
import { ROOT } from './_paths.mjs'

const dataDir = join(ROOT, 'data-realtest')
const engineDir = join(ROOT, 'engine')
const session = '2026-11-01-realtest'
const cropPath = join(ROOT, 'scripts', 'realtest-crop.png')
const config = resolveConfig({ dataDir })
const logStore = new LogStore({ dataDir })
let imageBytes = null
const ctx = {
  attachments: {
    saveImage: async ({ data, mediaType }) => {
      imageBytes = data
      writeFileSync(cropPath, data)
      return { attachmentId: 'realtest', mediaType, bytes: data.length, width: 0, height: 0 }
    }
  }
}
const runtime = createRuntime({ config, engineDir, dataDir })
const wikiSearch = new WikiSearch({ config, dataDir })
const captureTool = createCaptureTool({ config, runtime, logStore, ctx })
const queryTool = createQueryTool({ config, logStore, wikiSearch })
const narrateTool = createNarrateTool({ config, logStore, wikiSearch })
const signal = new AbortController().signal

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

async function main() {
  rmSync(dataDir, { recursive: true, force: true })
  mkdirSync(dataDir, { recursive: true })
  const deadline = Date.now() + 300000
  let first = null
  let attempts = 0
  let lastError = null
  while (Date.now() < deadline) {
    attempts += 1
    try {
      const result = await captureTool.execute({ game: 'genshin', session, includeImage: true }, { signal })
      if (result.captured && !result.skipped && !result.duplicate) {
        first = result
        break
      }
      await sleep(1500)
    } catch (error) {
      lastError = String(error?.message || error)
      await sleep(1500)
    }
  }
  if (!first) {
    console.log(JSON.stringify({ ok: false, attempts, lastError }, null, 2))
    return
  }
  await sleep(1500)
  let second = null
  let secondError = null
  try {
    second = await captureTool.execute({ game: 'genshin', session, includeImage: false }, { signal })
  } catch (error) {
    secondError = String(error?.message || error)
  }
  const queryTerm = first.entries?.[0]?.speaker || first.entries?.[0]?.speakerTitle || '冒险家协会'
  const query = await queryTool.execute({ query: queryTerm, game: 'genshin', scope: 'log', limit: 5, context: 1 }, { signal })
  const narrate = await narrateTool.execute({ game: 'genshin', session, last: 10, style: '陪玩解说' }, { signal })
  console.log(JSON.stringify({
    ok: true,
    attempts,
    first: {
      speaker: first.entries?.[0]?.speaker,
      speakerTitle: first.entries?.[0]?.speakerTitle,
      choices: first.entries?.[0]?.choices,
      text: first.entries?.[0]?.text,
      persisted: first.persisted
    },
    second: second ? {
      duplicate: second.duplicate,
      persisted: second.persisted,
      text: second.entries?.[0]?.text
    } : null,
    secondError,
    query: { term: queryTerm, hits: query.log?.entries?.length, first: query.log?.entries?.[0]?.text },
    narrate: { lines: narrate.lines?.length, scenes: narrate.scenes?.length, hasNoSpoiler: narrate.prompt?.includes('不剧透') },
    dataDir,
    crop: imageBytes ? cropPath : null
  }, null, 2))
}

try {
  await main()
} catch (error) {
  console.log(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2))
} finally {
  runtime.dispose()
}
