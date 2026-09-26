import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import 'dayjs/locale/zh-cn'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale('zh-cn')

export const TIMEZONE = 'Asia/Shanghai'
export { dayjs }
export const now = () => dayjs().tz(TIMEZONE)
export const localDate = (value: string, zone = TIMEZONE) => dayjs(value).tz(zone).format('YYYY-MM-DD')
export const clock = (value: string, zone = TIMEZONE) => dayjs(value).tz(zone).format('HH:mm')
export const dateTime = (value: string | null, zone = TIMEZONE) => value === null ? '未记录' : dayjs(value).tz(zone).format('M月D日 HH:mm')
export const fullDateTime = (value: string, zone = TIMEZONE) => dayjs(value).tz(zone).format('YYYY年M月D日 HH:mm')
export const dateLabel = (value: string) => dayjs(value).format('M月D日 dddd')
export const wallTimeIso = (date: string, time: string, zone = TIMEZONE) => dayjs.tz(`${date} ${time}`, zone).toISOString()
