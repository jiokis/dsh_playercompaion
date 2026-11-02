import { defineTool } from '@deepseek-ai/dsh-tools'
import { renderWatch } from '../render.js'

function cleanStatus(status) {
  const out = {}
  for (const [key, value] of Object.entries(status || {})) {
    if (value !== null && value !== undefined) out[key] = value
  }
  return out
}

export function createWatchTool({ watcher }) {
  return defineTool({
    name: 'lore_watch',
    description:
      'Start, stop or inspect explicit background polling of the current Genshin/HSR dialogue. It reuses the normal capture pipeline ' +
      '(foreground/occlusion/black-frame checks, OCR, dedupe, local log) and never calls a model or uploads anything. ' +
      'It starts only after action=start and stops on action=stop or plugin dispose.',
    parameters: {
      action: { type: 'string', enum: ['start', 'stop', 'status'], description: 'Watch action; required.' },
      intervalSec: { type: 'number', description: 'Polling interval in seconds (2..300; default config.watch.intervalSec).' },
      game: { type: 'string', enum: ['auto', 'genshin', 'hsr'], description: 'Game for polling; default auto.' },
      window: { type: 'string', description: 'Optional window title/process substring.' },
      session: { type: 'string', description: 'Session id; default watch-YYYYMMDD.' },
      note: { type: 'string', description: 'Note stored on captured lines; default watch.' },
      mode: { type: 'string', enum: ['dialogue', 'read'], description: 'Capture mode; default dialogue.' }
    },
    timeoutMs: 120000,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string', required: true },
          enabled: { type: 'boolean', required: true },
          running: { type: 'boolean', required: true },
          busy: { type: 'boolean' },
          intervalSec: { type: 'number', required: true },
          session: { type: 'string' },
          game: { type: 'string' },
          mode: { type: 'string' },
          ticks: { type: 'number' },
          captured: { type: 'number' },
          duplicates: { type: 'number' },
          skipped: { type: 'number' },
          empty: { type: 'number' },
          errors: { type: 'number' },
          startedAt: { type: 'string' },
          stoppedAt: { type: 'string' },
          lastAt: { type: 'string' },
          lastResult: { type: 'json' },
          lastError: { type: 'string' }
        }
      },
      render: (_args, value) => [{ type: 'text', text: renderWatch(value) }]
    },
    execute: async (args) => {
      const action = String(args.action || '').toLowerCase()
      if (action === 'start') {
        const status = await watcher.start(args)
        return { action, ...cleanStatus(status) }
      }
      if (action === 'stop') return { action, ...cleanStatus(watcher.stop()) }
      if (action === 'status') return { action, ...cleanStatus(watcher.status()) }
      throw new Error('action must be start, stop or status')
    }
  })
}
