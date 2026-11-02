import { readFile, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { asArray, captureParams, resolveGame, saveImageAttachment } from './common.js'
import { renderVision } from '../render.js'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

function summarize(analysis) {
  if (!analysis || typeof analysis !== 'object') return null
  return {
    findings: Array.isArray(analysis.findings) ? analysis.findings.length : 0,
    metrics: analysis.metrics || {},
    warnings: Array.isArray(analysis.warnings) ? analysis.warnings : []
  }
}

function normalizeMode(value) {
  const mode = String(value || 'all').trim().toLowerCase()
  if (!['composition', 'ui', 'map', 'semantic', 'all'].includes(mode)) throw new Error('mode must be composition, ui, map, semantic or all')
  return mode
}

async function readImageFile(path) {
  const absolute = resolve(String(path))
  const extension = extname(absolute).toLowerCase()
  if (!IMAGE_EXTENSIONS.has(extension)) throw new Error('imagePath must be a .png, .jpg, .jpeg or .webp file')
  let info
  try {
    info = await stat(absolute)
  } catch (error) {
    throw new Error('cannot read imagePath: ' + error.message)
  }
  if (!info.isFile()) throw new Error('imagePath is not a file')
  if (info.size <= 0) throw new Error('imagePath is empty')
  if (info.size > MAX_IMAGE_BYTES) throw new Error('imagePath is larger than 20 MB')
  const data = await readFile(absolute)
  return { absolute, data }
}

export function createVisionTool({ config, runtime, ctx, frames }) {
  return defineTool({
    name: 'lore_vision',
    description:
      'Analyze image elements locally and read-only: composition (subject, thirds, balance, palette), UI panels, and low-confidence map/POI candidates. ' +
      'Without imagePath it captures the current Genshin/HSR window once (foreground + occlusion checks, no log write); with imagePath it analyzes a local ' +
      'PNG/JPG/WebP. It never calls a model or uploads the image. Set includeImage=true for an annotated crop.',
    parameters: {
      mode: { type: 'string', enum: ['composition', 'ui', 'map', 'semantic', 'all'], description: 'What to analyze; default all.' },
      game: { type: 'string', enum: ['auto', 'genshin', 'hsr'], description: 'Game for live capture; ignored when imagePath is set.' },
      window: { type: 'string', description: 'Optional window title/process substring for live capture.' },
      region: { type: 'json', description: 'Optional normalized crop override {x,y,w,h}.' },
      imagePath: { type: 'string', description: 'Optional local PNG/JPG/WebP to analyze instead of the live game window.' },
      frameId: { type: 'string', description: 'Optional archived frame id from lore_status.frames; takes precedence over imagePath.' },
      maxFindings: { type: 'number', description: 'Max findings per section (default config.vision.maxFindings, 1..30).' },
      includeText: { type: 'boolean', description: 'OCR text for semantic scene/POI labels; default config.vision.includeText.' },
      includeImage: { type: 'boolean', description: 'Return an annotated image attachment.' }
    },
    timeoutMs: 60000,
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          mode: { type: 'string', required: true },
          source: { type: 'string', required: true },
          game: { type: 'string' },
          imagePath: { type: 'string' },
          frameId: { type: 'string' },
          analysis: { type: 'json' },
          attachment: { type: 'json' },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      render: (_args, value) => [{ type: 'text', text: renderVision(value) }]
    },
    execute: async (args, exec) => {
      if (config.vision?.enabled === false) throw new Error('lore_vision is disabled in settings')
      const mode = normalizeMode(args.mode)
      const maxFindings = Math.min(30, Math.max(1, Number(args.maxFindings) || config.vision?.maxFindings || 12))
      const includeText = args.includeText !== undefined ? Boolean(args.includeText) : config.vision?.includeText !== false
      const withText = includeText && (mode === 'semantic' || mode === 'all')
      const warnings = []
      let result
      let source
      let game = null
      let imagePath = null
      let frameId = null
      if (args.frameId) {
        if (!frames || typeof frames.read !== 'function') throw new Error('frame archive is not available')
        const stored = frames.read(args.frameId)
        if (!stored) throw new Error('archived frame not found: ' + args.frameId)
        source = 'frame'
        frameId = stored.id
        imagePath = stored.path
        game = stored.metadata?.game || null
        result = await runtime.request('analyze_image', {
          image_b64: stored.base64,
          vision_mode: mode,
          max_findings: maxFindings,
          include_text: withText,
          include_image: Boolean(args.includeImage)
        }, { timeoutMs: 60000, signal: exec?.signal })
      } else if (args.imagePath) {
        source = 'image'
        const image = await readImageFile(args.imagePath)
        imagePath = image.absolute
        result = await runtime.request('analyze_image', {
          image_b64: image.data.toString('base64'),
          vision_mode: mode,
          max_findings: maxFindings,
          include_text: withText,
          include_image: Boolean(args.includeImage)
        }, { timeoutMs: 60000, signal: exec?.signal })
        if (frames?.enabled && config.frames?.saveVision) {
          try {
            const frame = frames.save({
              game: game || 'unknown',
              base64: image.data.toString('base64'),
              width: result.width,
              height: result.height,
              meta: { source: 'image', mode, imagePath, analysis: summarize(result.analysis) }
            })
            frameId = frame?.id || null
          } catch (error) {
            warnings.push('frame archive failed: ' + error.message)
          }
        }
      } else {
        source = 'screen'
        const params = captureParams(config, { ...args, mode: 'read' })
        params.vision_mode = mode
        params.max_findings = maxFindings
        params.include_image = Boolean(args.includeImage)
        params.include_text = withText
        params.include_window_image = Boolean(frames?.enabled && config.frames?.saveVision)
        game = resolveGame(args.game || 'auto', { allowAuto: true })
        result = await runtime.request('vision', params, { timeoutMs: 60000, signal: exec?.signal })
        game = result.game || game
        if (frames?.enabled && config.frames?.saveVision && result.windowImage) {
          try {
            const frame = frames.save({
              game: game || 'unknown',
              base64: result.windowImage,
              width: result.window?.width,
              height: result.window?.height,
              meta: { source: 'screen', mode, analysis: summarize(result.analysis) }
            })
            frameId = frame?.id || null
          } catch (error) {
            warnings.push('frame archive failed: ' + error.message)
          }
        }
      }
      warnings.push(...asArray(result.warnings))
      warnings.push(...asArray(result.analysis?.warnings))
      let attachment = null
      if (args.includeImage && result.image) {
        try {
          attachment = await saveImageAttachment(ctx, result.image)
        } catch (error) {
          warnings.push('annotated image attachment failed: ' + error.message)
        }
      }
      return {
        mode,
        source,
        game: game || undefined,
        imagePath: imagePath || undefined,
        frameId: frameId || undefined,
        analysis: result.analysis || null,
        attachment,
        warnings
      }
    }
  })
}
