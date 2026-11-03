import { defineTool } from '@deepseek-ai/dsh-tools'
import { resolveGame } from './common.js'

function renderOverlay(value) {
  const lines = []
  if (value.action === 'status') {
    lines.push('Overlay ' + (value.running ? 'running' : 'stopped') + (value.pid ? ' (pid ' + value.pid + ')' : '') + '.')
  } else if (value.action === 'show') {
    lines.push(value.running ? 'Overlay shown (pid ' + value.pid + ').' : 'Overlay could not start: ' + (value.error || 'unknown error'))
  } else {
    lines.push('Overlay hidden.')
  }
  const state = value.state || {}
  if (state.visible) {
    lines.push('visible · ' + (state.status || '待命') + (state.speaker || state.speakerTitle ? ' · ' + [state.speaker, state.speakerTitle].filter(Boolean).join(' / ') : ''))
  }
  if (state.text) lines.push(String(state.text).slice(0, 180))
  if (Array.isArray(state.choices) && state.choices.length) lines.push('choices: ' + state.choices.join(' / '))
  if (value.error) lines.push('error: ' + value.error)
  if (value.logPath) lines.push('log: ' + value.logPath)
  return lines.join('\n')
}

function cleanStatus(status = {}) {
  const out = {}
  if (status.running !== undefined) out.running = Boolean(status.running)
  if (status.pid !== null && status.pid !== undefined) out.pid = Number(status.pid)
  if (status.state !== undefined) out.state = status.state
  if (status.error) out.error = String(status.error)
  if (status.lastError) out.error = String(status.lastError)
  if (status.statePath) out.statePath = String(status.statePath)
  if (status.logPath) out.logPath = String(status.logPath)
  return out
}

export function createOverlayTool({ config, overlay }) {
  return defineTool({
    name: 'lore_overlay',
    description:
      'Show, hide or inspect the always-on-top, click-through in-game overlay. The overlay displays the last captured ' +
      'speaker/title/body/choices and never takes input or focus. It auto-hides when Genshin/HSR is not in the ' +
      'foreground unless disabled in settings. Use it when the user wants a visible in-game HUD.',
    parameters: {
      action: { type: 'string', enum: ['show', 'hide', 'status'], required: true, description: 'show | hide | status.' },
      game: { type: 'string', enum: ['auto', 'genshin', 'hsr'], description: 'Game hint for show; default auto.' },
      position: { type: 'string', enum: ['top-right', 'top-left', 'bottom-center'], description: 'Optional position override for show.' }
    },
    timeoutMs: 30000,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string', required: true },
          enabled: { type: 'boolean', required: true },
          running: { type: 'boolean', required: true },
          pid: { type: 'number' },
          state: { type: 'json' },
          error: { type: 'string' },
          statePath: { type: 'string' },
          logPath: { type: 'string' },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      render: (_args, value) => [{ type: 'text', text: renderOverlay(value) }]
    },
    execute: async (args) => {
      const action = String(args.action || 'status').trim().toLowerCase()
      const enabled = config.overlay?.enabled !== false
      if (action === 'hide') {
        const result = await overlay.hide()
        return { action, enabled, ...cleanStatus({ ...result, statePath: overlay.statePath, logPath: overlay.logPath }) }
      }
      if (action === 'status') {
        return { action, enabled, ...cleanStatus(overlay.status()) }
      }
      if (action !== 'show') throw new Error('unknown lore_overlay action: ' + action)
      const extra = { status: '待命', text: '等待对话……', game: resolveGame(args.game, { allowAuto: true }), preview: true }
      if (args.position) extra.position = args.position
      const result = await overlay.show(extra)
      const status = overlay.status()
      return {
        action,
        enabled,
        ...cleanStatus({
          running: result.running,
          pid: result.pid,
          state: status.state,
          error: result.error || status.lastError,
          statePath: overlay.statePath,
          logPath: overlay.logPath
        })
      }
    }
  })
}
