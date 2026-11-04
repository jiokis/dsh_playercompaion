import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ensureDir } from './paths.js'
import { captureParams } from './tools/common.js'

const POLL_MS = 500

function oneLine(value, limit = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

export class OverlayActionBridge {
  constructor({ config, dataDir, runtime, capture, vision, query, overlay, screenshots, setIntervalFn = setInterval, clearIntervalFn = clearInterval }) {
    this.config = config
    this.dataDir = dataDir
    this.runtime = runtime
    this.capture = capture
    this.vision = vision
    this.query = query
    this.overlay = overlay
    this.screenshots = screenshots
    this.setIntervalFn = setIntervalFn
    this.clearIntervalFn = clearIntervalFn
    this.dir = join(dataDir, 'overlay')
    this.commandPath = join(this.dir, 'command.json')
    this.timer = null
    this.busy = false
  }

  start() {
    if (this.timer) return
    this.timer = this.setIntervalFn(() => {
      this.poll().catch(() => {})
    }, POLL_MS)
    if (this.timer && typeof this.timer.unref === 'function') this.timer.unref()
  }

  async poll() {
    if (this.busy || !existsSync(this.commandPath)) return
    let command
    try {
      command = JSON.parse(readFileSync(this.commandPath, 'utf8').replace(/^\uFEFF/, ''))
      unlinkSync(this.commandPath)
    } catch {
      try { unlinkSync(this.commandPath) } catch { /* ignore */ }
      return
    }
    if (!command || typeof command.action !== 'string') return
    this.busy = true
    try {
      await this.execute(command)
    } catch (error) {
      await this.feedback('失败', oneLine(error?.message || error, 160))
    } finally {
      this.busy = false
    }
  }

  async feedback(status, text) {
    try {
      await this.overlay.update({ visible: true, preview: true, status, text: oneLine(text, 260) })
    } catch {
      /* overlay feedback is best effort */
    }
  }

  async execute(command) {
    if (command.action === 'screenshot') return this.screenshot()
    if (command.action === 'vision') return this.analyze()
    if (command.action === 'read') return this.readText()
    if (command.action === 'force') return this.forceCapture()
    if (command.action === 'query') return this.lookup()
    await this.feedback('未知操作', command.action)
  }

  async screenshot() {
    await this.feedback('截图中', '正在抓取当前游戏画面…')
    const client = await this.runtime.ensure({ timeoutMs: this.config.engine.waitMs })
    const params = captureParams(this.config, { game: 'auto', mode: 'dialogue', includeImage: true })
    params.include_image = true
    params.include_window_image = true
    const result = await client.request('capture', params, { timeoutMs: 120000 })
    const base64 = result.windowImage || result.image
    if (!base64) {
      const warnings = Array.isArray(result.warnings) ? result.warnings.join('；') : ''
      throw new Error('没有拿到截图' + (warnings ? '：' + warnings : '，可能被遮挡或游戏不在前台'))
    }
    const dir = join(this.dataDir, 'screenshots')
    ensureDir(dir)
    const name = 'shot-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png'
    const path = join(dir, name)
    writeFileSync(path, Buffer.from(base64, 'base64'))
    const state = this.overlay.readState?.() || {}
    try {
      this.screenshots?.add({
        path,
        game: result.game || state.game || 'auto',
        session: state.session || '',
        speaker: result.speaker || '',
        text: result.text || '',
        width: result.window?.width,
        height: result.window?.height,
        ts: new Date().toISOString()
      })
    } catch { /* gallery metadata is best effort */ }
    const preview = oneLine(result.text || result.speaker || '未识别到台词', 100)
    await this.feedback('截图完成', name + ' · ' + preview)
  }

  async readText() {
    await this.feedback('阅读中', '正在抓取阅读区域并识别文字…')
    const client = await this.runtime.ensure({ timeoutMs: this.config.engine.waitMs })
    const params = captureParams(this.config, {
      game: 'auto',
      mode: 'read',
      includeImage: true,
      region: { x: 0.06, y: 0.06, w: 0.88, h: 0.88 }
    })
    params.include_image = true
    params.ocr_max_side = 1600
    const result = await client.request('capture', params, { timeoutMs: 120000 })
    const text = String(result.text || '').trim()
    await this.feedback(text ? '阅读文本' : '没有文字', text || '阅读区域没有识别到文字')
  }

  async forceCapture() {
    const state = this.overlay.readState?.() || {}
    await this.feedback('强制识别中', '忽略对话判定，按当前画面强制记录…')
    const result = await this.capture.execute({
      game: state.game === 'hsr' ? 'hsr' : 'auto',
      session: state.session || undefined,
      mode: 'dialogue',
      region: { x: 0.04, y: 0.44, w: 0.92, h: 0.54 },
      force: true,
      fast: true,
      includeImage: false,
      dryRun: false
    }, {})
    if (result.captured) {
      const entry = Array.isArray(result.entries) ? result.entries[0] : null
      const speaker = entry?.speaker || result.speaker || ''
      const text = entry?.text || result.text || ''
      await this.feedback('已强制记录', (speaker ? speaker + '：' : '') + text)
      return
    }
    if (result.duplicate) {
      await this.feedback('重复', '这句已经在记录里了')
      return
    }
    if (result.empty) {
      await this.feedback('强制失败', '画面里没有 OCR 到文字；换到有字幕的画面再试')
      return
    }
    await this.feedback('强制失败', result.warnings?.[0] || '没有形成可记录的文字')
  }

  async analyze() {
    await this.feedback('分析中', '正在读取当前画面…')
    const result = await this.vision.execute({ mode: 'semantic', includeText: true, includeImage: false }, {})
    const metrics = result.analysis?.metrics || {}
    const findings = Array.isArray(result.analysis?.findings) ? result.analysis.findings : []
    const scene = metrics.scene ? '场景 ' + metrics.scene : '场景未知'
    const text = metrics.textBlocks != null ? ' · 文字块 ' + metrics.textBlocks : ''
    const top = findings.filter((item) => item.label).slice(0, 2).map((item) => item.label).join(' · ')
    await this.feedback('分析完成', scene + text + (top ? ' · ' + top : ''))
  }

  async lookup() {
    const state = this.overlay.readState?.() || {}
    const query = String(state.speaker || state.text || '').trim().slice(0, 80)
    if (!query) {
      await this.feedback('查找', '当前没有可查的台词；先抓一帧对话。')
      return
    }
    await this.feedback('查找中', '正在查 ' + oneLine(query, 50) + '…')
    const result = await this.query.execute({ query, scope: 'all', limit: 3, context: 1 }, {})
    const log = result.log?.entries?.[0]
    const wiki = result.wiki?.results?.[0]
    const akasha = result.akasha?.results?.[0]
    const web = result.web?.results?.[0]
    const parts = []
    if (log) parts.push('日志：' + oneLine(log.text, 60))
    if (wiki) parts.push('Wiki：' + oneLine(wiki.title, 40))
    if (akasha) parts.push('虚空：' + oneLine(akasha.title, 40))
    if (web) parts.push('Web：' + oneLine(web.title, 40))
    await this.feedback(parts.length ? '查找完成' : '没有结果', parts.join('\n') || '没有找到相关资料')
  }

  dispose() {
    if (this.timer) {
      this.clearIntervalFn(this.timer)
      this.timer = null
    }
  }
}
