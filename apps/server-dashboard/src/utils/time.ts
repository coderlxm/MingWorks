import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import 'dayjs/locale/zh-cn'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(duration)
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const TIMEZONE = 'Asia/Shanghai'

export function formatCheckedAt(checkedAt: string, trigger: 'daily' | 'manual'): string {
  if (trigger === 'manual') return dayjs(checkedAt).fromNow()
  const time = dayjs(checkedAt).tz(TIMEZONE)
  const today = dayjs().tz(TIMEZONE)
  return time.format('YYYY-MM-DD') === today.format('YYYY-MM-DD')
    ? `今天 ${time.format('HH:mm')}`
    : time.format('M月D日 HH:mm')
}

export function formatDateTime(value: string | null): string {
  return value === null ? '无记录' : dayjs(value).tz(TIMEZONE).format('M月D日 HH:mm')
}

export function formatDayLabel(date: string): string {
  return dayjs.tz(date, TIMEZONE).format('M月D日')
}

export function formatUptime(seconds: number): string {
  const span = dayjs.duration(seconds, 'seconds')
  const days = Math.floor(span.asDays())
  return days > 0
    ? `运行 ${days} 天`
    : `运行 ${span.hours()} 小时 ${span.minutes()} 分钟`
}
