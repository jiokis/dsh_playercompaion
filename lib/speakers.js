import { resolveCharacterName } from './characters.js'

// OCR reads the same name several ways. The roster in characters/*.json holds
// the canonical names and their variants; this module only adds what cannot be
// expressed as a name: decorated titles that OCR truncates.
const SPEAKER_GROUPS = [
  ['诺迦法', '「诺迦法」'],
  ['丑角', '「丑角」'],
  ['光之镜', '「光之镜」']
]

export function normalizeSpeaker(value) {
  const name = String(value || '').trim()
  if (!name) return ''
  for (const [needle, canonical] of SPEAKER_GROUPS) {
    if (name.includes(needle)) return canonical
  }
  return resolveCharacterName(name)
}

// Speakers that are HUD counters rather than characters.
export const NOISE_SPEAKER = /^(?:原粹树脂|原石|摩拉|纠缠之缘|相遇之缘|w|a|s|d|e|q|r|f|enter|esc|lv\.?\d*)$/i
// Dialogue captures that are really the control hints or currency counters.
export const NOISE_TEXT = /鼠标|键盘|WASD|IJKL|左键|右键|空格|Enter|Lv\.|\d+\s*\/\s*\d+|(?:摩拉|原石|纠缠之缘|相遇之缘)\s*[×xX]\s*\d+/

export function isNoiseEntry(entry) {
  const speaker = String(entry?.speaker || '').trim()
  const text = String(entry?.text || '').trim()
  return !text || NOISE_SPEAKER.test(speaker) || NOISE_TEXT.test(text)
}
