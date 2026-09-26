import type { LifeKind, LifeStatus, ReminderDisplayStatus, ReminderDeliveryStatus } from './types'

export const statusText: Record<ReminderDisplayStatus, string> = { scheduled: '待触发', snoozed: '已延期', awaiting: '已发送 · 待确认', done: '已完成', cancelled: '已取消', skipped: '已跳过', missed: '已错过', failed: '发送失败', unknown: '历史结果不明' }
export const deliveryText: Record<ReminderDeliveryStatus, string> = { waiting: '尚未发送', sending: '发送中', sent: '已发送', failed: '发送失败', missed: '未发送 · 已错过', unknown: '发送结果未知' }
export const lifeStatusText: Record<LifeStatus, string> = { scheduled: '待触发', awaiting: '已发送 · 待确认', snoozed: '已延期', confirmed: '已确认', stopped: '今天已停止', auto_closed: '自动结束', missed: '已错过', failed: '发送失败', legacy_unknown: '历史结果不明', legacy_closed: '历史提醒已处理', not_scheduled: '当天没有安排' }
export const lifeConfirmText: Record<LifeKind, string> = { vitamin: '已吃', 'work-checkin': '我已打卡', bus: '已下车' }
export const lifeIcon: Record<LifeKind, string> = { vitamin: 'capsule', 'work-checkin': 'work', bus: 'bus' }
export const ruleStatusText = { active: '运行中', paused: '已暂停', cancelled: '已结束' }
export const historyActionText: Record<string, string> = { created: '新建', edited: '修改', snoozed: '延期', sent: '已发送', send_failed: '发送失败', delivery_unknown: '发送结果未知', done: '已完成', cancelled: '已取消', missed: '已错过', skip: '跳过本次', none: '历史记录未处理', pending: '历史记录待处理', paused: '暂停规则', resumed: '恢复规则', ended: '结束规则', confirmed: '已确认', stopped: '主动停止当天', auto_closed: '自动结束', failed: '发送失败', legacy_unknown: '历史结果不明', legacy_closed: '历史提醒已处理，结束原因未完整记录' }
export const historyKindText: Record<string, string> = { once: '一次性', run: '循环当次', rule: '循环规则', vitamin: '维生素', 'work-checkin': '打卡', bus: '下车' }
