<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { ReminderHistoryItem, ReminderHistoryResponse } from '../types'
import { clock, dateLabel, dateTime, now } from '../format'
import { deliveryText, historyActionText, historyKindText } from '../labels'
import type { Tone } from '../labels'
const props = defineProps<{ data: ReminderHistoryResponse | null; filters: { from: string; to: string; kind: string }; loading: boolean }>()
const emit = defineEmits<{ filter: [value: Record<string, string>]; more: []; copy: [item: ReminderHistoryItem] }>()
const draft = reactive({ ...props.filters })
function range(days: number) { draft.from = now().subtract(days - 1, 'day').format('YYYY-MM-DD'); draft.to = now().format('YYYY-MM-DD'); emit('filter', { ...draft }) }
const activeRange = computed(() => [7, 30].find(days => draft.from === now().subtract(days - 1, 'day').format('YYYY-MM-DD') && draft.to === now().format('YYYY-MM-DD')))
const groups = computed(() => {
  const byDate = new Map<string, ReminderHistoryItem[]>()
  for (const item of props.data?.items ?? []) byDate.set(item.date, [...(byDate.get(item.date) ?? []), item])
  return [...byDate].map(([date, items]) => ({ date, items }))
})
function actionTone(action: string): Tone {
  if (['done', 'confirmed'].includes(action)) return 'green'
  if (action === 'sent') return 'info'
  return ['send_failed', 'delivery_unknown', 'missed', 'failed', 'legacy_unknown'].includes(action) ? 'danger' : 'gray'
}
function deliveryTone(status: string): Tone {
  if (status === 'sent') return 'info'
  return ['failed', 'missed', 'unknown'].includes(status) ? 'danger' : 'gray'
}
</script>

<template>
  <div>
    <header class="page-header">
      <div>
        <h1>提醒历史</h1>
        <p>已发送与已处理的记录，按计划日期分组。</p>
      </div>
    </header>

    <form class="toolbar" @submit.prevent="emit('filter', { ...draft })">
      <div class="segmented" role="group" aria-label="快捷范围">
        <button type="button" :class="{ active: activeRange === 7 }" :aria-pressed="activeRange === 7" @click="range(7)">最近 7 天</button>
        <button type="button" :class="{ active: activeRange === 30 }" :aria-pressed="activeRange === 30" @click="range(30)">最近 30 天</button>
      </div>
      <label class="field">
        计划日期 · 从
        <input v-model="draft.from" type="date" required>
      </label>
      <label class="field">
        计划日期 · 至
        <input v-model="draft.to" type="date" :min="draft.from" required>
      </label>
      <label class="field">
        类型
        <select v-model="draft.kind">
          <option value="all">全部类型</option>
          <option value="once">一次性</option>
          <option value="run">循环当次</option>
          <option value="rule">循环规则</option>
          <option value="vitamin">维生素</option>
          <option value="work-checkin">打卡</option>
          <option value="bus">下车</option>
        </select>
      </label>
      <button class="primary" :disabled="loading">筛选</button>
    </form>

    <p v-if="data" class="results-summary">{{ data.total }} 条记录<span v-if="loading"> · 正在更新…</span></p>

    <section v-for="group in groups" :key="group.date" class="history-group">
      <div class="section-heading">
        <h2>{{ dateLabel(group.date) }}<span class="count">{{ group.items.length }} 条</span></h2>
      </div>
      <div class="card history-card">
        <article v-for="item in group.items" :key="item.id" class="history-row">
          <p class="history-time">
            <time v-if="item.triggerAt" :datetime="item.triggerAt">{{ clock(item.triggerAt) }}</time>
            <span v-else>—</span>
          </p>
          <div class="history-main">
            <h3 class="history-text">{{ item.text }}</h3>
            <div class="tag-row">
              <span class="tag tag--gray">{{ historyKindText[item.kind] }}</span>
              <span class="tag" :class="`tag--${actionTone(item.action)}`">{{ historyActionText[item.action] }}</span>
              <span class="tag" :class="`tag--${deliveryTone(item.deliveryStatus)}`">{{ deliveryText[item.deliveryStatus] }}</span>
            </div>
            <p v-if="item.occurredAt" class="history-meta">操作于 {{ dateTime(item.occurredAt) }}</p>
            <p v-if="item.note" class="history-meta">{{ item.note }}</p>
            <p v-if="item.error" class="error">{{ item.error }}</p>
          </div>
          <button v-if="item.kind === 'once'" class="text-button small" type="button" @click="emit('copy', item)">复制</button>
        </article>
      </div>
    </section>

    <div v-if="data && !data.items.length" class="empty">
      <h3>这段时间没有相应记录</h3>
      <p>可以调整日期或提醒类型。</p>
    </div>
    <p v-if="!data" class="loading-placeholder">{{ loading ? '正在读取历史…' : '历史记录尚未读取。' }}</p>
    <button v-if="data && data.nextOffset !== null" class="load-more outline-button" :disabled="loading" @click="emit('more')">{{ loading ? '正在读取…' : '继续查看' }}</button>
  </div>
</template>

<style scoped>
.history-group + .history-group {
  margin-top: 24px;
}

.history-group .section-heading {
  margin-bottom: 10px;
}

.history-card {
  padding: 4px 18px;
}

.history-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  align-items: start;
  gap: 14px;
  padding: 14px 0;
}

.history-row + .history-row {
  border-top: 1px solid var(--line);
}

.history-time {
  margin: 0;
  color: var(--ink);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.history-time span {
  color: var(--muted);
  font-weight: 400;
}

.history-main {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.history-text {
  margin: 0;
  color: var(--ink);
  font-size: 15px;
  font-weight: 550;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.history-meta {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

@media (max-width: 719px) {
  .history-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }

  .history-row .text-button {
    justify-self: start;
    padding-left: 0;
  }
}
</style>
