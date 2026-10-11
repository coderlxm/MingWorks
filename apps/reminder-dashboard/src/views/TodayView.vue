<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import type { Feedback, LifeAction, LifeDashboard, LifeItem, Preset, ReminderBoardResponse, ReminderItem } from '../types'
import { clock, dateLabel, now } from '../format'
import { lifeStatusTone, statusTone, type Tone } from '../labels'
import AppIcon from '../components/AppIcon.vue'
import LifeCard from '../components/LifeCard.vue'
import QuickAdd from '../components/QuickAdd.vue'
import ReminderCard from '../components/ReminderCard.vue'
const props = defineProps<{ board: ReminderBoardResponse | null; lifeDays: LifeDashboard[]; days: 1 | 7; pending: Record<string, boolean>; feedback: Record<string, Feedback>; loading: boolean }>()
const emit = defineEmits<{ days: [value: 1 | 7]; detail: [item: ReminderItem]; edit: [item: ReminderItem]; action: [item: ReminderItem, action: 'done' | 'skip' | 'snooze']; lifeAction: [item: LifeItem, action: LifeAction]; settings: [item: LifeItem]; create: [preset?: Preset] }>()
const hour = now().hour()
const greeting = hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 13 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
const handledDetails = useTemplateRef<HTMLDetailsElement>('handled-details')
const lifeItems = computed(() => props.lifeDays.flatMap(day => day.items))
const awaitingLife = computed(() => lifeItems.value.filter(item => item.status === 'awaiting'))
const issueLife = computed(() => lifeItems.value.filter(item => ['failed', 'missed', 'legacy_unknown'].includes(item.status)))
const handledLife = computed(() => lifeItems.value.filter(item => ['confirmed', 'stopped', 'auto_closed', 'legacy_closed'].includes(item.status)))
type TimelineRow = { key: string; date: string; at: string; window: string | null; tone: Tone; item: ReminderItem | null; life: LifeItem | null }
const timeline = computed(() => {
  const rows: TimelineRow[] = (props.board?.upcoming ?? []).map(item => ({ key: item.key, date: item.date, at: item.triggerAt, window: null, tone: statusTone[item.status], item, life: null }))
  for (const life of lifeItems.value) {
    if (!['scheduled', 'snoozed'].includes(life.status)) continue
    const at = life.nextTriggerAt ?? life.firstTriggerAt ?? life.windowStart
    if (at) rows.push({ key: `life:${life.kind}:${life.date}`, date: life.date, at, window: !life.nextTriggerAt && !life.firstTriggerAt ? life.windowEnd : null, tone: lifeStatusTone[life.status], item: null, life })
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
const issueCount = computed(() => (props.board?.issues.length ?? 0) + issueLife.value.length)
const handledCount = computed(() => (props.board?.handled.length ?? 0) + handledLife.value.length)
function showHandled() {
  handledDetails.value!.open = true
  handledDetails.value!.scrollIntoView({ block: 'start' })
}
</script>
<template>
  <div class="view">
    <p v-if="board" class="eyebrow">{{ dateLabel(board.date) }}</p>
    <div class="page-header">
      <div>
        <h1>{{ greeting }}</h1>
        <p v-if="board">{{ days === 1 ? '今天' : '未来七天' }}还有 {{ upcomingCount }} 项待触发<template v-if="pendingCount">，{{ pendingCount }} 项等你确认</template></p>
      </div>
    </div>
    <QuickAdd @create="emit('create', $event)" />
    <template v-if="board">
      <div class="stat-strip">
        <component :is="pendingCount ? 'a' : 'div'" :href="pendingCount ? '#today-pending' : undefined" class="stat-card" data-tone="warm">
          <strong>{{ pendingCount }}</strong><span>待确认</span>
        </component>
        <a href="#today-upcoming" class="stat-card" data-tone="green">
          <strong>{{ upcomingCount }}</strong><span>待触发</span>
        </a>
        <component :is="issueCount ? 'a' : 'div'" :href="issueCount ? '#today-issues' : undefined" class="stat-card" :data-tone="issueCount ? 'danger' : 'gray'">
          <strong>{{ issueCount }}</strong><span>需留意</span>
        </component>
        <button type="button" class="stat-card" data-tone="gray" @click="showHandled">
          <strong>{{ handledCount }}</strong><span>已处理</span>
        </button>
      </div>

      <section v-if="pendingCount" id="today-pending" class="section">
        <div class="section-heading"><h2>待确认<span class="count">{{ pendingCount }}</span></h2></div>
        <div class="card-stack">
          <ReminderCard v-for="item in board.pending" :key="item.key" :item="item" :busy="pending[item.key]" :feedback="feedback[item.key]" @detail="emit('detail', $event)" @edit="emit('edit', $event)" @action="(entry, action) => emit('action', entry, action)" />
          <LifeCard v-for="item in awaitingLife" :key="`life:${item.kind}:${item.date}`" :item="item" :busy="pending[`life:${item.kind}:${item.date}`]" :feedback="feedback[`life:${item.kind}:${item.date}`]" @action="(entry, action) => emit('lifeAction', entry, action)" @settings="emit('settings', $event)" />
        </div>
      </section>

      <section v-if="issueCount" id="today-issues" class="section">
        <div class="section-heading"><h2>需留意<span class="count">{{ issueCount }}</span></h2></div>
        <p class="muted section-note">有异常、已错过或信息不完整，不会自动重发。</p>
        <div class="card-stack">
          <ReminderCard v-for="item in board.issues" :key="item.key" :item="item" :busy="pending[item.key]" :feedback="feedback[item.key]" @detail="emit('detail', $event)" @edit="emit('edit', $event)" @action="(entry, action) => emit('action', entry, action)" />
          <LifeCard v-for="item in issueLife" :key="`issue:${item.kind}:${item.date}`" :item="item" :busy="pending[`life:${item.kind}:${item.date}`]" :feedback="feedback[`life:${item.kind}:${item.date}`]" @action="(entry, action) => emit('lifeAction', entry, action)" @settings="emit('settings', $event)" />
        </div>
      </section>

      <section id="today-upcoming" class="section">
        <div class="section-heading">
          <h2>接下来</h2>
          <div class="segmented" aria-label="安排范围">
            <button :class="{ active: days === 1 }" @click="emit('days', 1)">今天</button>
            <button :class="{ active: days === 7 }" @click="emit('days', 7)">未来七天</button>
          </div>
        </div>
        <div v-for="group in timeline" :key="group.date" class="day-group">
          <h3 v-if="days === 7" class="day-heading">{{ dateLabel(group.date) }}</h3>
          <div class="timeline">
            <div v-for="row in group.rows" :key="row.key" class="timeline-row">
              <time class="timeline-time" :datetime="row.at">{{ clock(row.at) }}<small v-if="row.window">至 {{ clock(row.window) }}</small></time>
              <span class="timeline-marker" :data-tone="row.tone" aria-hidden="true"><i /></span>
              <ReminderCard v-if="row.item" compact :item="row.item" :busy="pending[row.item.key]" :feedback="feedback[row.item.key]" @detail="emit('detail', $event)" @edit="emit('edit', $event)" @action="(entry, action) => emit('action', entry, action)" />
              <LifeCard v-else-if="row.life" compact :item="row.life" :busy="pending[`life:${row.life.kind}:${row.life.date}`]" :feedback="feedback[`life:${row.life.kind}:${row.life.date}`]" @action="(entry, action) => emit('lifeAction', entry, action)" @settings="emit('settings', $event)" />
            </div>
          </div>
        </div>
        <div v-if="!timeline.length" class="empty">
          <AppIcon name="sun" />
          <h3>这段时间很空闲</h3>
          <p>这个时间范围内没有待触发的安排。</p>
          <div class="actions"><button class="outline-button" @click="emit('create')">记一件小事</button></div>
        </div>
      </section>

      <details id="today-handled" ref="handled-details" class="handled">
        <summary>已处理<span class="count">{{ handledCount }}</span><AppIcon name="chevron-down" /></summary>
        <div class="card-stack">
          <ReminderCard v-for="item in board.handled" :key="item.key" :item="item" @detail="emit('detail', $event)" />
          <LifeCard v-for="item in handledLife" :key="`handled:${item.kind}:${item.date}`" :item="item" @settings="emit('settings', $event)" />
          <p v-if="!handledCount" class="muted">完成或结束的提醒会留在这里。</p>
        </div>
      </details>
    </template>
    <div v-else class="loading-placeholder" role="status">{{ loading ? '正在展开今天的安排…' : '今天的安排尚未读取。' }}</div>
  </div>
</template>
<style scoped>
.eyebrow { margin: 0 0 6px; }
.stat-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}
.stat-card {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  color: var(--body);
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: default;
}
a.stat-card, button.stat-card { cursor: pointer; }
a.stat-card:hover, button.stat-card:hover { border-color: var(--accent); }
.stat-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.stat-card strong {
  color: var(--ink);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.stat-card span { color: var(--muted); font-size: 13px; }
.stat-card[data-tone='warm'] strong { color: var(--warm); }
.stat-card[data-tone='green'] strong { color: var(--accent-ink); }
.stat-card[data-tone='danger'] strong { color: var(--danger); }
.section-note { margin: -4px 0 12px; }
.timeline-row {
  display: grid;
  grid-template-columns: 56px 18px minmax(0, 1fr);
  column-gap: 10px;
  padding-bottom: 12px;
}
.timeline-row:last-child { padding-bottom: 0; }
.timeline-time {
  font-size: 15px;
  font-weight: 600;
  line-height: 24px;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.timeline-time small {
  display: block;
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
}
.timeline-marker {
  position: relative;
  display: flex;
  justify-content: center;
}
.timeline-marker::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  margin-left: -0.5px;
  background: var(--line);
}
.timeline-marker i {
  position: relative;
  width: 10px;
  height: 10px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--tone);
  box-shadow: 0 0 0 3px var(--bg);
}
.timeline-marker[data-tone='green'] { --tone: var(--accent); }
.timeline-marker[data-tone='warm'] { --tone: var(--warm); }
.timeline-marker[data-tone='danger'] { --tone: var(--danger); }
.timeline-marker[data-tone='info'] { --tone: var(--info); }
.timeline-marker[data-tone='gray'] { --tone: var(--muted); }
.day-group { margin-top: 16px; }
.day-heading {
  position: sticky;
  top: var(--topbar-height);
  z-index: 1;
  margin: 0 0 8px;
  padding: 6px 0;
  background: var(--bg);
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
}
.handled { margin-top: 32px; }
.handled summary {
  display: flex;
  align-items: center;
  min-height: 40px;
  color: var(--ink);
  font-size: 15px;
  font-weight: 600;
  list-style: none;
  cursor: pointer;
}
.handled summary::-webkit-details-marker { display: none; }
.handled summary .count {
  margin-left: 6px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
}
.handled summary svg {
  width: 18px;
  height: 18px;
  margin-left: auto;
  color: var(--muted);
  transition: transform .2s ease;
}
.handled[open] summary svg { transform: rotate(180deg); }
.handled .card-stack { margin-top: 12px; }
@media (max-width: 719px) {
  .stat-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .timeline-row { grid-template-columns: 50px 16px minmax(0, 1fr); column-gap: 8px; }
  .timeline-time { font-size: 14px; }
}
</style>
