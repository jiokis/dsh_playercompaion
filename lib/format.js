export function formatTs(ts, tz = 'Asia/Shanghai', withDate = true) {
  try {
    const date = new Date(ts)
    if (Number.isNaN(date.getTime())) return String(ts)
    const options = withDate
      ? { timeZone: tz, hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
      : { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' }
    return new Intl.DateTimeFormat('zh-CN', options).format(date)
  } catch {
    return String(ts)
  }
}

export function formatClock(ts, tz = 'Asia/Shanghai') {
  return formatTs(ts, tz, false)
}

export function collapse(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

export function firstLine(text, max = 120) {
  const value = collapse(text)
  return value.length <= max ? value : value.slice(0, Math.max(0, max - 1)) + '…'
}
