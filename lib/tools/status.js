import { defineTool } from '@deepseek-ai/dsh-tools'
import { asArray, captureParams, resolveGame, saveImageAttachment } from './common.js'
import { renderStatus } from '../render.js'

export function createStatusTool({ config, runtime, logStore, wikiSearch, ctx, overlay, akasha, web, frames, watcher, version }) {
  return defineTool({
    name: 'lore_status',
    description:
      'Report dsh-lore-companion status: local OCR engine readiness, visible Genshin/HSR windows, OCR warmup, ' +
      'data directory, Wiki cache, knowledge sources (Akasha MCP / DeepSeek web search), recent sessions, and the explicit background watcher. Set preview=true to capture and OCR the current ' +
      'dialogue region (read-only; no log write) and return the crop as an image.',
    parameters: {
      preview: { type: 'boolean', description: 'Capture one preview and return the crop image.' },
      game: { type: 'string', enum: ['auto', 'genshin', 'hsr'], description: 'Game for preview; default auto.' },
      window: { type: 'string', description: 'Optional window title/process substring for preview.' }
    },
    timeoutMs: 300000,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          plugin: { type: 'string', required: true },
          version: { type: 'string', required: true },
          platform: { type: 'string', required: true },
          engine: { type: 'json', required: true },
          dataDir: { type: 'string', required: true },
          games: { type: 'json' },
          ocr: { type: 'json' },
          wiki: { type: 'json' },
          sessions: { type: 'json' },
          overlay: { type: 'json' },
          sources: { type: 'json' },
          frames: { type: 'json' },
          watch: { type: 'json' },
          preview: { type: 'json' },
          previewError: { type: 'string' },
          attachment: { type: 'json' },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      render: (_args, value) => {
        const content = [{ type: 'text', text: renderStatus(value) }]
        if (value.attachment) content.push({ type: 'image', attachment: value.attachment })
        return content
      }
    },
    execute: async (args, exec) => {
      runtime.start()
      let engine = runtime.status()
      const warnings = []
      let report = null
      let games = []
      let ocr = null
      let attachment = null
      let preview = null
      let previewError = null
      if (engine.status !== 'ready') {
        try {
          await runtime.ensure({ timeoutMs: 60000, signal: exec.signal })
        } catch (error) {
          warnings.push('engine not ready: ' + error.message)
        }
        engine = runtime.status()
      }
      if (engine.status === 'ready') {
        try {
          const client = await runtime.ensure({ timeoutMs: 60000, signal: exec.signal })
          report = await client.request('selftest', { warmup: true }, { timeoutMs: 60000, signal: exec.signal })
          games = Object.entries(report.games || {}).map(([id, window]) => ({ id, window }))
          ocr = report.ocr
          if (args.preview) {
            try {
              const previewParams = captureParams(config, {
                game: resolveGame(args.game, { allowAuto: true }),
                window: args.window,
                mode: 'dialogue',
                includeImage: true
              })
              const result = await client.request('preview', previewParams, { timeoutMs: 120000, signal: exec.signal })
              preview = {
                game: result.game,
                text: result.text,
                speaker: result.speaker,
                region: result.region,
                empty: result.empty,
                dialogueLike: result.dialogueLike,
                window: result.window,
                foreground: result.foreground,
                occluded: result.occluded,
                backend: result.backend,
                settled: result.settled
              }
              try {
                attachment = await saveImageAttachment(ctx, result.image)
              } catch (error) {
                warnings.push('preview image attachment failed: ' + error.message)
              }
            } catch (error) {
              previewError = error.message
            }
          }
        } catch (error) {
          warnings.push('engine selftest failed: ' + error.message)
        }
      }
      const sessions = [
        ...logStore.sessions('genshin'),
        ...logStore.sessions('hsr')
      ].sort((a, b) => String(b.lastTs).localeCompare(String(a.lastTs))).slice(0, 20)
      const wiki = typeof wikiSearch.stats === 'function' ? wikiSearch.stats() : []
      const overlayStatus = overlay && typeof overlay.status === 'function' ? overlay.status() : null
      let frameList = []
      if (frames && typeof frames.list === 'function') {
        try { frameList = frames.list({ limit: 8 }) } catch { frameList = [] }
      }
      const sources = {
        akasha: {
          enabled: config.sources?.akasha?.enabled !== false,
          url: config.sources?.akasha?.url || '',
          maxResults: config.sources?.akasha?.maxResults || 5
        },
        web: {
          enabled: config.sources?.web?.enabled !== false,
          available: Boolean(web && typeof web.available === 'function' && web.available()),
          maxResults: config.sources?.web?.maxResults || 5
        }
      }
      return {
        plugin: 'dsh-lore-companion',
        version,
        platform: process.platform + '-' + process.arch,
        engine,
        dataDir: config.dataDir || logStore.dataDir,
        games,
        ocr,
        wiki,
        sessions,
        overlay: overlayStatus,
        sources,
        frames: frameList,
        watch: watcher && typeof watcher.status === 'function' ? watcher.status() : null,
        preview,
        previewError: previewError || '',
        attachment,
        warnings: [...warnings, ...asArray(report?.warnings)]
      }
    }
  })
}
