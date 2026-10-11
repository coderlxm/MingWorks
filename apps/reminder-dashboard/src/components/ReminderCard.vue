<script setup lang="ts">
import { computed } from 'vue'
import type { Feedback, ReminderItem } from '../types'
import { dateTime } from '../format'
import { statusText, statusTone } from '../labels'
import AppIcon from './AppIcon.vue'
const props = defineProps<{ item: ReminderItem; busy?: boolean; feedback?: Feedback; compact?: boolean }>()
const emit = defineEmits<{ detail: [item: ReminderItem]; edit: [item: ReminderItem]; action: [item: ReminderItem, action: 'done' | 'skip' | 'snooze'] }>()
const needsAction = computed(() => props.item.status === 'awaiting')
const editable = computed(() => props.item.kind === 'once' && ['scheduled', 'snoozed', 'missed', 'failed'].includes(props.item.status))
const tone = computed(() => statusTone[props.item.status])
const kindText = computed(() => ({ once: '一次性', forecast: '循环 · 预计', run: '循环当次' })[props.item.kind])
</script>
<template>
  <article class="reminder-card" :class="{ 'reminder-card--compact': compact }" :data-tone="tone" :aria-busy="busy">
    <span v-if="!compact" class="task-icon">
      <AppIcon :name="item.kind === 'once' ? 'clock' : 'repeat'" />
    </span>
    <div class="task-body">
      <div class="task-copy">
        <button class="task-title" @click="emit('detail', item)">{{ item.text }}</button>
        <p v-if="!compact" class="task-time">
          {{ item.kind === 'forecast' ? '预计' : '计划' }} {{ dateTime(item.triggerAt) }}<span v-if="item.timezone !== 'Asia/Shanghai'"> · 原时区 {{ item.timezone }}</span>
        </p>
        <div class="tag-row">
          <span class="tag" :class="item.kind === 'once' ? 'tag--gray' : 'tag--info'">{{ kindText }}</span>
          <span class="tag" :class="`tag--${tone}`">{{ statusText[item.status] }}</span>
        </div>
      </div>
      <p v-if="item.note" class="item-note">{{ item.note }}</p>
      <p v-if="item.error" class="error" role="alert">{{ item.error }}</p>
      <p v-if="feedback" :class="feedback.error ? 'error' : 'success'" role="status">{{ feedback.text }}</p>
    </div>
    <div v-if="needsAction || editable" class="actions task-actions">
      <template v-if="needsAction">
        <button class="primary small" :disabled="busy" @click="emit('action', item, 'done')">{{ busy ? '处理中…' : item.kind === 'once' ? '完成' : '完成本次' }}</button>
        <button class="outline-button small" :disabled="busy" @click="emit('action', item, item.kind === 'once' ? 'snooze' : 'skip')">{{ item.kind === 'once' ? '稍后' : '跳过本次' }}</button>
      </template>
      <button v-else class="outline-button small" :disabled="busy" @click="emit('edit', item)">{{ item.status === 'missed' || item.status === 'failed' ? '重新安排时间' : '编辑时间' }}</button>
    </div>
  </article>
</template>
<style scoped>
.reminder-card {
  position: relative;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
  min-width: 0;
  padding: 16px 18px 16px 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  transition: box-shadow .2s ease;
}
.reminder-card:hover { box-shadow: var(--shadow); }
.reminder-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 14px;
  bottom: 14px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--tone);
}
.reminder-card--compact { grid-template-columns: minmax(0, 1fr) auto; }
.reminder-card[data-tone='green'] { --tone: var(--accent); --tone-soft: var(--accent-soft); }
.reminder-card[data-tone='warm'] { --tone: var(--warm); --tone-soft: var(--warm-soft); }
.reminder-card[data-tone='danger'] { --tone: var(--danger); --tone-soft: var(--danger-soft); }
.reminder-card[data-tone='info'] { --tone: var(--info); --tone-soft: var(--info-soft); }
.reminder-card[data-tone='gray'] { --tone: var(--muted); --tone-soft: var(--surface-2); }
.task-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--tone-soft);
  color: var(--tone);
}
.task-icon svg { width: 18px; height: 18px; }
.task-body { min-width: 0; }
.task-title {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink);
  font: inherit;
  font-size: 15px;
  font-weight: 550;
  line-height: 1.6;
  text-align: left;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  cursor: pointer;
}
.task-title:hover { color: var(--accent-ink); }
.task-title:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
.task-time {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.tag-row { margin-top: 8px; }
.item-note {
  margin: 10px 0 0;
  color: var(--body);
  font-size: 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.task-body > .error, .task-body > .success { margin: 8px 0 0; font-size: 13px; }
.task-actions {
  align-self: center;
  justify-content: flex-end;
}
@media (max-width: 719px) {
  .reminder-card {
    grid-template-columns: 36px minmax(0, 1fr);
    padding: 14px 14px 14px 16px;
  }
  .reminder-card--compact { grid-template-columns: minmax(0, 1fr); }
  .task-actions {
    grid-column: 2;
    align-self: auto;
    justify-content: flex-start;
  }
  .reminder-card--compact .task-actions { grid-column: 1; }
}
</style>
