<script setup lang="ts">
import { computed } from 'vue'
import type { Feedback, LifeAction, LifeItem } from '../types'
import { clock, dateTime } from '../format'
import { lifeConfirmText, lifeIcon, lifeStatusText, lifeStatusTone } from '../labels'
import AppIcon from './AppIcon.vue'
const props = defineProps<{ item: LifeItem; busy?: boolean; feedback?: Feedback; settingsLink?: boolean; compact?: boolean }>()
const emit = defineEmits<{ action: [item: LifeItem, action: LifeAction]; settings: [item: LifeItem] }>()
const tone = computed(() => lifeStatusTone[props.item.status])
</script>
<template>
  <article class="reminder-card life-card" :class="{ 'reminder-card--compact': compact }" :data-tone="tone" :aria-busy="busy">
    <span v-if="!compact" class="task-icon">
      <AppIcon :name="lifeIcon[item.kind]" />
    </span>
    <div class="task-body">
      <div class="task-copy">
        <button class="task-title" @click="emit('settings', item)">{{ item.title }}</button>
        <template v-if="!compact">
          <p v-if="item.nextTriggerAt" class="task-time">下次 {{ dateTime(item.nextTriggerAt) }}</p>
          <p v-else-if="item.windowStart && item.windowEnd" class="task-time">{{ clock(item.windowStart) }}–{{ clock(item.windowEnd) }} 之间 · 时刻尚未确定</p>
          <p v-else-if="item.firstTriggerAt" class="task-time">计划 {{ dateTime(item.firstTriggerAt) }}</p>
        </template>
        <div class="tag-row">
          <span class="tag tag--info">生活专项</span>
          <span class="tag" :class="`tag--${tone}`">{{ lifeStatusText[item.status] }}</span>
          <span v-if="!item.enabled" class="tag tag--gray">长期已关闭</span>
        </div>
      </div>
      <p class="meta-line">{{ item.rule }}</p>
      <p v-if="item.lastSentAt" class="meta-line">最近提醒 {{ dateTime(item.lastSentAt) }}<span v-if="item.sentCount !== null"> · 已提醒 {{ item.sentCount }} 次</span></p>
      <p v-if="item.reason" class="meta-line">{{ item.reason }}</p>
      <p v-if="item.error" class="error" role="alert">{{ item.error }}</p>
      <p v-if="feedback" :class="feedback.error ? 'error' : 'success'" role="status">{{ feedback.text }}</p>
    </div>
    <div v-if="item.actions.length || settingsLink" class="actions task-actions">
      <button v-if="item.actions.includes('confirm')" class="primary small" :disabled="busy" @click="emit('action', item, 'confirm')">{{ busy ? '处理中…' : lifeConfirmText[item.kind] }}</button>
      <button v-if="item.actions.includes('snooze')" class="outline-button small" :disabled="busy" @click="emit('action', item, 'snooze')">30 分钟后</button>
      <button v-if="settingsLink" class="text-button" @click="emit('settings', item)">今天与规则<AppIcon name="chevron" /></button>
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
.meta-line {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
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
