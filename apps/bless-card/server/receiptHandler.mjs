function createHttpError(message, statusCode) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function formatBeijingTime(date) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second} (北京时间)`
}

/**
 * Validate the receipt payload and push a notification to Ming's Telegram bot.
 * @param {unknown} payload
 * @returns {Promise<{ ok: true; receivedAt: string }>}
 */
export async function sendBlessReceipt(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createHttpError('请求内容格式不正确', 400)
  }

  const rawThemeLabel = payload.themeLabel
  if (typeof rawThemeLabel !== 'string') {
    throw createHttpError('缺少有效的风格名称', 400)
  }
  const themeLabel = rawThemeLabel.trim()
  if (themeLabel.length === 0 || [...themeLabel].length > 40) {
    throw createHttpError('风格名称长度不合法', 400)
  }

  const rawNote = payload.note
  let note = ''
  if (rawNote !== undefined && rawNote !== null) {
    if (typeof rawNote !== 'string') {
      throw createHttpError('附言必须为文本', 400)
    }
    note = rawNote.trim()
    if ([...note].length > 200) {
      throw createHttpError('附言不能超过 200 个字', 400)
    }
  }

  const tgToken = process.env.TG_TOKEN
  const tgChatId = process.env.TG_CHAT_ID
  if (!tgToken || !tgChatId) {
    throw createHttpError('缺少 TG_TOKEN 或 TG_CHAT_ID 配置', 500)
  }

  const now = new Date()
  const receivedAt = now.toISOString()
  const bjTime = formatBeijingTime(now)
  const text = [
    '🎊 婚礼贺卡已拆阅签收！',
    '',
    '新人：马勋豪 & 张郡桐（2026-11-28 · 昆明）',
    `当前风格：${themeLabel}`,
    `新人附言：${note || '（直接一键签收）'}`,
    `签收时间：${bjTime}`,
  ].join('\n')

  const response = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: tgChatId,
      text,
    }),
    signal: AbortSignal.timeout(10000),
  })

  const rawBody = await response.text()
  let parsed
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    throw createHttpError(`Telegram API 返回了非 JSON 响应（HTTP ${response.status}）`, 502)
  }

  if (!response.ok || !parsed?.ok) {
    const detail = parsed?.description ? `：${parsed.description}` : `（HTTP ${response.status}）`
    throw createHttpError(`Telegram 通知发送失败${detail}`, 502)
  }

  return { ok: true, receivedAt }
}
