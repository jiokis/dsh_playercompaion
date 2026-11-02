import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const FORBIDDEN = [
  'SendInput', 'keybd_event', 'mouse_event', 'SetCursorPos', 'ClipCursor',
  'SetForegroundWindow', 'PostMessage', 'SendMessage', 'SetWindowsHookEx',
  'ReadProcessMemory', 'WriteProcessMemory', 'CreateRemoteThread'
]

function walk(dir, suffix, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, suffix, out)
    else if (path.endsWith(suffix)) out.push(path)
  }
  return out
}

test('engine and plugin source contain no input-injection or memory APIs', () => {
  const files = [
    ...walk('engine/lore_engine', '.py'),
    ...walk('lib', '.js')
  ]
  const hits = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const name of FORBIDDEN) {
      if (new RegExp('\\b' + name + '\\b').test(text)) hits.push(file + ': ' + name)
    }
  }
  assert.deepEqual(hits, [])
  const windowsSource = readFileSync('engine/lore_engine/windows.py', 'utf8')
  assert.ok(windowsSource.includes('GetForegroundWindow'))
})
