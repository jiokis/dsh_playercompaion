import { defineTool } from '@deepseek-ai/dsh-tools'
import { makeDialogueRecord, makeSeenRecord, findDuplicate } from '../store/dedupe.js'
import { captureParams, resolveGame, resolveSession, saveImageAttachment, validateRegion, asArray } from './common.js'
import { renderCapture } from '../render.js'

export function createCaptureTool({ config, runtime, logStore, ctx, overlay, frames }) {
  return defineTool({
    name: 'lore_capture',
    description:
      'Capture the current Genshin Impact / Honkai: Star Rail dialogue with local OCR, deduplicate it, and append ' +
      'new lines to the local lore log. Read-only: never sends input, never reads game memory, never focuses a window. ' +
      'The game must be in borderless/windowed mode and visible; the tool refuses when the window is occluded.',
    parameters: {
      game: { type: 'string', enum: ['auto', 'genshin', 'hsr'], description: 'Game to capture; default auto.' },
      window: { type: 'string', description: 'Optional window title/process substring.' },
      session: { type: 'string', description: 'Session id (default today-main). 1..40 chars [A-Za-z0-9._-].' },
      note: { type: 'string', description: 'Optional note stored with the captured line.' },
      region: { type: 'json', description: 'Optional normalized crop override {x,y,w,h}.' },
      mode: { type: 'string', enum: ['dialogue', 'read'], description: 'dialogue (default) or read (books/items/task text).' },
      includeImage: { type: 'boolean', description: 'Return the OCR crop as an image attachment.' },
      force: { type: 'boolean', description: 'Capture even when occlusion or dialogue-like checks fail.' },
      dryRun: { type: 'boolean', description: 'OCR and dedupe but do not write to the log.' }
    },
    timeoutMs: 120000,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          captured: { type: 'boolean', required: true },
          game: { type: 'string' },
          session: { type: 'string' },
          text: { type: 'string' },
          entries: { type: 'array', items: { type: 'json' } },
          duplicate: { type: 'boolean' },
          empty: { type: 'boolean' },
          skipped: { type: 'boolean' },
          persisted: { type: 'boolean' },
          window: { type: 'json' },
          region: { type: 'json' },
          foreground: { type: 'json' },
          occluded: { type: 'json' },
          backend: { type: 'string' },
          isForeground: { type: 'boolean' },
          attachment: { type: 'json' },
          frameId: { type: 'string' },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      render: (_args, value) => {
        const content = [{ type: 'text', text: renderCapture(value) }]
        if (value.attachment) content.push({ type: 'image', attachment: value.attachment })
        return content
      }
    },
    execute: async (args, exec) => {
      const gameArg = resolveGame(args.game, { allowAuto: true })
      const session = resolveSession(args.session)
      const region = validateRegion(args.region)
      const mode = args.mode === 'read' ? 'read' : 'dialogue'
      const client = await runtime.ensure({ timeoutMs: config.engine.waitMs, signal: exec.signal })
      const params = captureParams(config, { ...args, game: gameArg, region, mode })
      params.include_window_image = Boolean(frames?.enabled && config.frames?.saveOnCapture && !args.dryRun)
      const result = await client.request('capture', params, {
        timeoutMs: 120000,
        signal: exec.signal
      })
      const warnings = [...asArray(result.warnings)]
      let frameId = null
      if (!args.dryRun && result.windowImage && frames?.enabled && config.frames?.saveOnCapture) {
        try {
          const frame = frames.save({
            game: result.game,
            base64: result.windowImage,
            width: result.window?.width,
            height: result.window?.height,
            meta: {
              source: 'capture',
              mode,
              session,
              speaker: result.speaker || null,
              speakerTitle: result.speakerTitle || null,
              text: String(result.text || '').slice(0, 400),
              backend: result.backend || ''
            }
          })
          frameId = frame?.id || null
        } catch (error) {
          warnings.push('frame archive failed: ' + error.message)
        }
      }
      let attachment = null
      if (args.includeImage && result.image) {
        try {
          attachment = await saveImageAttachment(ctx, result.image)
        } catch (error) {
          warnings.push('image attachment failed: ' + error.message)
        }
      }
      const base = {
        game: result.game,
        session,
        text: result.text || '',
        window: result.window,
        region: result.region,
        foreground: result.foreground,
        occluded: result.occluded,
        backend: result.backend,
        isForeground: result.isForeground,
        attachment,
        frameId: frameId || undefined,
        warnings
      }
      async function syncOverlay(status) {
        if (!overlay || config.overlay?.enabled === false) return
        const state = {
          game: result.game,
          session,
          status,
          speaker: result.speaker || null,
          speakerTitle: result.speakerTitle || null,
          text: result.text || '',
          choices: Array.isArray(result.choices) ? result.choices : [],
          ts: new Date().toISOString()
        }
        try {
          if (config.overlay.autoShow && !args.dryRun) {
            const shown = await overlay.show(state)
            if (!shown.ok && shown.error && shown.error !== 'overlay_disabled') warnings.push('overlay: ' + shown.error)
          } else {
            await overlay.update(state)
          }
        } catch (error) {
          warnings.push('overlay update failed: ' + error.message)
        }
      }
      if (result.empty) {
        await syncOverlay('空对话')
        return { ...base, captured: false, empty: true, entries: [], persisted: false }
      }
      if (mode === 'dialogue' && result.dialogueLike === false && !args.force) {
        await syncOverlay('未识别到对话')
        return { ...base, captured: false, skipped: true, entries: [], persisted: false }
      }
      const record = makeDialogueRecord({
        game: result.game,
        session,
        kind: mode === 'read' ? 'read' : 'dialogue',
        speaker: result.speaker,
        speakerTitle: result.speakerTitle,
        choices: result.choices,
        text: result.text,
        lines: result.lines || [],
        capture: {
          window: result.window?.title || '',
          process: result.window?.process || '',
          hwnd: result.window?.hwnd ?? null,
          region: result.region,
          foreground: result.isForeground === true,
          occludedRatio: result.occluded?.occluded_ratio ?? 0,
          backend: result.backend || ''
        },
        note: args.note == null ? null : String(args.note)
      })
      const recent = logStore.recent(result.game, { limit: 80 }).filter((entry) => entry.session === session)
      const duplicate = findDuplicate(recent, record, {
        windowMinutes: config.dedupe.windowMinutes,
        similarity: config.dedupe.similarity,
        compareLast: config.dedupe.compareLast
      })
      let persisted = false
      if (!args.dryRun) {
        try {
          if (duplicate) {
            logStore.appendSeen(makeSeenRecord({ game: result.game, session, utteranceId: duplicate.record.utteranceId }))
          } else {
            logStore.append(record)
          }
          persisted = true
        } catch (error) {
          warnings.push('log write failed: ' + error.message)
        }
      }
      const entry = {
        id: record.id,
        utteranceId: record.utteranceId,
        kind: record.kind,
        speaker: record.speaker,
        speakerTitle: record.speakerTitle,
        choices: record.choices,
        text: record.text,
        score: result.score ?? null,
        duplicate: Boolean(duplicate),
        similarity: duplicate ? Number(duplicate.similarity.toFixed(4)) : null,
        persisted
      }
      await syncOverlay(duplicate ? '重复 · 仅记录' : '已记录')
      return {
        ...base,
        captured: true,
        duplicate: Boolean(duplicate),
        entries: [entry],
        persisted,
        warnings
      }
    }
  })
}
