import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { Timestamp } from './types'
dayjs.extend(utc)
dayjs.extend(timezone)
export function time(value: Timestamp) {
  if (value === null || value === undefined) return '尚无记录'
  return dayjs(typeof value === 'number' && value < 100000000000 ? value * 1000 : value).tz('Asia/Shanghai').format('MM-DD HH:mm:ss')
}
export function playerStatus(value: string | null) {
  const labels: Record<string, string> = { in_winners: '胜者组', in_losers: '败者组', winners: '胜者组', losers: '败者组', eliminated: '已淘汰', completed: '已完成', finished: '已完成', not_entered: '未匹配到参赛记录', not_registered: '未参赛', not_started: '尚未开赛', unknown: '待确认', active: '比赛中' }
  return value === null ? '等待采集' : labels[value] ?? value
}
export const sourceLabels = { player: '关注选手', seed: '种子', final: '决赛' }
export function eventStatus(value: string | null) {
  const labels: Record<string, string> = { CREATED: '尚未开赛', ACTIVE: '进行中', COMPLETED: '官方已完成', '1': '尚未开赛', '2': '进行中', '3': '官方已完成' }
  return value === null ? '等待采集' : labels[value] ?? value
}

export function stopReason(value: string | null) {
  const labels: Record<string, string> = { paused: "用户已暂停监控", no_events: "当前无活动项目", deadline: "超过大会结束时间，停止采集", completed: "所有监控项目官方已完成" }
  return value === null ? "尚无停止原因" : labels[value] ?? value
}
