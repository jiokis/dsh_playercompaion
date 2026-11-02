import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

function readJson(path, fallback) {
  try {
    if (!existsSync(path)) return fallback
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJsonAtomic(path, value) {
  const tmp = path + '.tmp'
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
  renameSync(tmp, path)
}

function isAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export class OverlayManager {
  constructor({ config, dataDir, env = process.env, scriptPath }) {
    this.config = config
    this.dataDir = dataDir
    this.env = env
    this.scriptPath = scriptPath
    this.dir = join(dataDir, 'overlay')
    this.statePath = join(this.dir, 'state.json')
    this.pidPath = join(this.dir, 'pid')
    this.logPath = join(this.dir, 'overlay.log')
    this.child = null
    this.lastError = null
  }

  ensureDir() {
    mkdirSync(this.dir, { recursive: true })
  }

  defaultState() {
    const overlay = this.config.overlay || {}
    return {
      v: 1,
      visible: false,
      status: '待命',
      game: null,
      session: null,
      speaker: null,
      speakerTitle: null,
      text: '',
      choices: [],
      ts: null,
      position: overlay.position || 'top-right',
      width: overlay.width || 460,
      height: overlay.height || 200,
      margin: overlay.margin || 28,
      opacity: overlay.opacity || 0.94,
      autoHideOnGameLost: overlay.autoHideOnGameLost !== false,
      updatedAt: null
    }
  }

  readState() {
    const state = readJson(this.statePath, null)
    return state && typeof state === 'object' ? { ...this.defaultState(), ...state } : this.defaultState()
  }

  writeState(state) {
    this.ensureDir()
    writeJsonAtomic(this.statePath, state)
    return state
  }

  async update(patch = {}) {
    const next = { ...this.readState(), ...patch, updatedAt: new Date().toISOString() }
    return this.writeState(next)
  }

  pidFromFile() {
    try {
      if (!existsSync(this.pidPath)) return null
      const value = Number(readFileSync(this.pidPath, 'utf8').trim())
      return Number.isFinite(value) && value > 0 ? value : null
    } catch {
      return null
    }
  }

  ensureProcess() {
    if (this.child && this.child.exitCode === null) {
      return { ok: true, running: true, pid: this.child.pid }
    }
    const oldPid = this.pidFromFile()
    if (oldPid && isAlive(oldPid)) {
      return { ok: true, running: true, pid: oldPid, reused: true }
    }
    if (!existsSync(this.scriptPath)) {
      this.lastError = 'overlay script missing: ' + this.scriptPath
      return { ok: false, running: false, error: this.lastError }
    }
    this.ensureDir()
    let child
    try {
      child = spawn('powershell.exe', [
        '-STA',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-WindowStyle',
        'Hidden',
        '-File',
        this.scriptPath,
        '-StatePath',
        this.statePath
      ], {
        windowsHide: true,
        cwd: this.dir,
        env: { ...process.env, ...this.env },
        stdio: ['ignore', 'ignore', 'pipe']
      })
    } catch (error) {
      this.lastError = 'overlay start failed: ' + error.message
      return { ok: false, running: false, error: this.lastError }
    }
    this.child = child
    child.unref()
    child.stdout?.unref?.()
    child.stderr?.unref?.()
    try {
      writeFileSync(this.pidPath, String(child.pid), 'utf8')
    } catch {
      /* diagnostics */
    }
    child.stderr.on('data', (chunk) => {
      try {
        appendFileSync(this.logPath, String(chunk), 'utf8')
      } catch {
        /* ignore */
      }
    })
    child.on('exit', (code, signal) => {
      if (this.child === child) this.child = null
      try {
        appendFileSync(this.logPath, '[' + new Date().toISOString() + '] overlay exited code=' + String(code) + ' signal=' + String(signal) + '\n', 'utf8')
      } catch {
        /* ignore */
      }
    })
    child.on('error', (error) => {
      this.lastError = 'overlay process error: ' + error.message
    })
    return { ok: true, running: true, pid: child.pid, started: true }
  }

  async show(extra = {}) {
    if (!this.config.overlay?.enabled) {
      await this.update({ visible: false, ...extra })
      return { ok: false, running: false, error: 'overlay_disabled' }
    }
    const overlay = this.config.overlay || {}
    await this.update({
      visible: true,
      position: overlay.position || 'top-right',
      width: overlay.width || 460,
      height: overlay.height || 200,
      margin: overlay.margin || 28,
      opacity: overlay.opacity || 0.94,
      autoHideOnGameLost: overlay.autoHideOnGameLost !== false,
      ...extra
    })
    const processInfo = this.ensureProcess()
    return { ...processInfo, statePath: this.statePath, logPath: this.logPath }
  }

  async hide() {
    const state = await this.update({ visible: false })
    return { ok: true, running: Boolean(this.child || this.pidFromFile()), state }
  }

  status() {
    const pid = this.child?.pid ?? this.pidFromFile()
    return {
      running: Boolean(this.child && this.child.exitCode === null) || Boolean(pid && isAlive(pid)),
      pid: pid || null,
      scriptPath: this.scriptPath,
      statePath: this.statePath,
      logPath: this.logPath,
      state: this.readState(),
      lastError: this.lastError
    }
  }

  dispose() {
    try {
      if (this.child && this.child.exitCode === null) this.child.kill()
    } catch {
      /* ignore */
    }
    this.child = null
    try {
      const state = this.readState()
      writeJsonAtomic(this.statePath, { ...state, visible: false, updatedAt: new Date().toISOString() })
    } catch {
      /* ignore */
    }
  }
}
