<script setup lang="ts">
import { computed } from 'vue'
import type { Feedback, LifeAction, LifeDashboard, LifeItem, ReminderBoardResponse, ReminderItem } from '../types'
import { clock, dateLabel } from '../format'
import AppIcon from '../components/AppIcon.vue'
import ReminderCard from '../components/ReminderCard.vue'
import LifeCard from '../components/LifeCard.vue'
const props = defineProps<{ board: ReminderBoardResponse | null; lifeDays: LifeDashboard[]; days: 1 | 7; pending: Record<string, boolean>; feedback: Record<string, Feedback>; loading: boolean }>()
const emit = defineEmits<{ days: [value: 1 | 7]; detail: [item: ReminderItem]; edit: [item: ReminderItem]; action: [item: ReminderItem, action: 'done' | 'skip' | 'snooze']; lifeAction: [item: LifeItem, action: LifeAction]; settings: [item: LifeItem]; create: [] }>()
const lifeItems = computed(() => props.lifeDays.flatMap(day => day.items))
const awaitingLife = computed(() => lifeItems.value.filter(item => item.status === 'awaiting'))
const issueLife = computed(() => lifeItems.value.filter(item => ['failed', 'missed', 'legacy_unknown'].includes(item.status)))
const handledLife = computed(() => lifeItems.value.filter(item => ['confirmed', 'stopped', 'auto_closed', 'legacy_closed'].includes(item.status)))
type TimelineRow = { key: string; date: string; at: string; window: string | null; item: ReminderItem | null; life: LifeItem | null }
const timeline = computed(() => {
  const rows: TimelineRow[] = (props.board?.upcoming ?? []).map(item => ({ key: item.key, date: item.date, at: item.triggerAt, window: null, item, life: null }))
  for (const life of lifeItems.value) {
    if (!['scheduled', 'snoozed'].includes(life.status)) continue
    const at = life.nextTriggerAt ?? life.firstTriggerAt ?? life.windowStart
    if (at) rows.push({ key: `life:${life.kind}:${life.date}`, date: life.date, at, window: !life.nextTriggerAt && !life.firstTriggerAt ? life.windowEnd : null, item: null, life })
  }
  rows.sort((a, b) => a.at.localeCompare(b.at))
  const groups: { date: string; rows: TimelineRow[] }[] = []
  for (const row of rows) {
    const group = groups.at(-1)
    if (group?.date === row.date) group.rows.push(row)
    else groups.push({ date: row.date, rows: [row] })
  }
  return groups
})
const upcomingCount = computed(() => timeline.value.reduce((sum, group) => sum + group.rows.length, 0))
const pendingCount = computed(() => (props.board?.pending.length ?? 0) + awaitingLife.value.length)
const handledCount = computed(() => (props.board?.handled.length ?? 0) + handledLife.value.length)
</script>
<template>
  <div><p v-if="board" class="eyebrow">{{ dateLabel(board.date) }}</p><div class="page-heading"><div><h1>今天，慢慢来。</h1><p>一件件安排好，也给自己留一点空白。</p></div><div v-if="board" class="date-stamp"><span>{{ board.date.slice(5, 7) }} 月</span><strong>{{ board.date.slice(8) }}</strong></div></div>
    <template v-if="board"><div class="focus-note"><AppIcon name="leaf" /><p>{{ days === 1 ? '今天' : '未来七天' }}还有 {{ upcomingCount }} 项待触发，{{ pendingCount }} 项等你确认。<small>已发送的提醒，和还没到时间的安排，分开放。</small></p></div>
      <section v-if="pendingCount" class="section"><div class="section-heading"><h2>待处理 <span class="number">{{ pendingCount }} 项</span></h2></div><div class="card-stack"><ReminderCard v-for="item in board.pending" :key="item.key" :item="item" :busy="pending[item.key]" :feedback="feedback[item.key]" @detail="emit('detail', $event)" @edit="emit('edit', $event)" @action="(entry, action) => emit('action', entry, action)" /><LifeCard v-for="item in awaitingLife" :key="`life:${item.kind}:${item.date}`" :item="item" :busy="pending[`life:${item.kind}:${item.date}`]" :feedback="feedback[`life:${item.kind}:${item.date}`]" @action="(entry, action) => emit('lifeAction', entry, action)" @settings="emit('settings', $event)" /></div></section>
      <section v-if="board.issues.length || issueLife.length" class="section"><div class="section-heading"><h2>需要留意</h2></div><p class="section-description">以下提醒有异常、已错过或历史信息不完整，没有自动重新发送。</p><div class="card-stack"><ReminderCard v-for="item in board.issues" :key="item.key" :item="item" :busy="pending[item.key]" :feedback="feedback[item.key]" @detail="emit('detail', $event)" @edit="emit('edit', $event)" @action="(entry, action) => emit('action', entry, action)" /><LifeCard v-for="item in issueLife" :key="`issue:${item.kind}:${item.date}`" :item="item" :busy="pending[`life:${item.kind}:${item.date}`]" :feedback="feedback[`life:${item.kind}:${item.date}`]" @action="(entry, action) => emit('lifeAction', entry, action)" @settings="emit('settings', $event)" /></div></section>
      <section class="section"><div class="section-heading"><h2>接下来的安排</h2><div class="segmented" aria-label="安排范围"><button :class="{ active: days === 1 }" @click="emit('days', 1)">今天</button><button :class="{ active: days === 7 }" @click="emit('days', 7)">未来七天</button></div></div><p v-if="loading" class="muted" role="status">正在更新安排…</p><div v-for="group in timeline" :key="group.date" class="day-group"><h3 v-if="days === 7" class="day-heading">{{ dateLabel(group.date) }}</h3><div class="timeline"><div v-for="row in group.rows" :key="row.key" class="timeline-row"><time class="timeline-time" :datetime="row.at">{{ clock(row.at) }}<small v-if="row.window">至 {{ clock(row.window) }}</small></time><ReminderCard v-if="row.item" :item="row.item" :busy="pending[row.item.key]" :feedback="feedback[row.item.key]" @detail="emit('detail', $event)" @edit="emit('edit', $event)" @action="(entry, action) => emit('action', entry, action)" /><LifeCard v-else-if="row.life" :item="row.life" :busy="pending[`life:${row.life.kind}:${row.life.date}`]" :feedback="feedback[`life:${row.life.kind}:${row.life.date}`]" @action="(entry, action) => emit('lifeAction', entry, action)" @settings="emit('settings', $event)" /></div></div></div><div v-if="!timeline.length" class="empty"><AppIcon name="sun" /><h3>给日程留一点空白</h3><p>这个时间范围内没有待触发的安排。</p><button class="outline-button" @click="emit('create')">记下一件小事</button></div></section>
      <details class="handled"><summary>已经处理 <span>{{ handledCount }} 项</span></summary><div class="card-stack"><ReminderCard v-for="item in board.handled" :key="item.key" :item="item" @detail="emit('detail', $event)" /><LifeCard v-for="item in handledLife" :key="`handled:${item.kind}:${item.date}`" :item="item" @settings="emit('settings', $event)" /><p v-if="!handledCount" class="muted">完成或结束的提醒会留在这里。</p></div></details>
    </template><div v-else class="loading-placeholder" role="status">{{ loading ? '正在展开今天的安排…' : '今天的安排尚未读取。' }}</div>
  </div>
</template>
