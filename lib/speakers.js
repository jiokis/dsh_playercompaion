// OCR reads the same name several ways. One table keeps the journal, the story
// tool and the memory snapshot agreeing on who said what.
const SPEAKER_ALIASES = new Map([
  // Genshin
  ['纳西姐', '纳西妲'],
  ['茜特莉', '茜特拉莉'],
  ['茜特荘莉', '茜特拉莉'],
  ['茜特技莉', '茜特拉莉'],
  ['伊湿芙', '伊涅芙'],
  ['九条装罗', '九条裟罗'],
  ['神里华', '神里绫华'],
  // Honkai: Star Rail
  ['肩爷本屑', '屑爷本屑'],
  ['肩爷本属', '屑爷本屑'],
  ['火花', '花火'],
  ['灭花', '花火'],
  ['伙花', '花火'],
  ['排英', '绯英'],
  ['继英', '绯英'],
  ['维英', '绯英'],
  ['星期白', '星期日'],
  ['星期曰', '星期日'],
  ['星期目', '星期日'],
  ['三明七', '三月七'],
  ['兰月七', '三月七'],
  ['丹桓', '丹恒']
])

// Titles that OCR truncates or decorates; match by substring instead of exact name.
const SPEAKER_GROUPS = [
  ['诺迦法', '「诺迦法」'],
  ['丑角', '「丑角」'],
  ['光之镜', '「光之镜」']
]

export function normalizeSpeaker(value) {
  const name = String(value || '').trim()
  if (!name) return ''
  if (SPEAKER_ALIASES.has(name)) return SPEAKER_ALIASES.get(name)
  for (const [needle, canonical] of SPEAKER_GROUPS) {
    if (name.includes(needle)) return canonical
  }
  return name
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
