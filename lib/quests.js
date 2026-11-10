import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const TYPE_LABELS = {
  main: '主线',
  world: '世界任务',
  activity: '活动',
  story: '传说任务',
  unknown: '未分类'
}

export function loadQuestMap(dataDir) {
  try {
    const path = join(dataDir, 'journal', 'quests.json')
    if (!existsSync(path)) return {}
    const value = JSON.parse(readFileSync(path, 'utf8'))
    return value && typeof value === 'object' && value.sessions && typeof value.sessions === 'object' ? value.sessions : {}
  } catch {
    return {}
  }
}

export function questForSession(dataDir, session) {
  const map = loadQuestMap(dataDir)
  const quest = session ? map[session] : null
  if (!quest) return { type: 'unknown', name: '', label: TYPE_LABELS.unknown, day: null }
  const type = ['main', 'world', 'activity', 'story'].includes(quest.type) ? quest.type : 'unknown'
  return {
    type,
    name: String(quest.name || ''),
    label: TYPE_LABELS[type],
    day: Number.isFinite(Number(quest.day)) ? Number(quest.day) : null
  }
}
