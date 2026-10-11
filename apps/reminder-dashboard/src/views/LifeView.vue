<script setup lang="ts">
import type { Feedback, LifeAction, LifeDashboard, LifeItem } from '../types'
import { clock, dateLabel, dateTime } from '../format'
import AppIcon from '../components/AppIcon.vue'
import LifeCard from '../components/LifeCard.vue'
defineProps<{ data: LifeDashboard | null; loading: boolean; pending: Record<string, boolean>; feedback: Record<string, Feedback> }>()
const emit = defineEmits<{ action: [item: LifeItem, action: LifeAction]; settings: [item: LifeItem] }>()
</script>

<template>
  <div class="view">
    <header class="page-header">
      <div>
        <h1>生活提醒</h1>
        <p>今天的动作和长期规则分开管理。</p>
      </div>
    </header>

    <nav class="view-links">
      <RouterLink to="/reminders">一次性提醒</RouterLink>
      <RouterLink to="/rules">循环规则</RouterLink>
      <RouterLink to="/life" aria-current="page">生活提醒</RouterLink>
    </nav>

    <p v-if="data" class="life-date"><AppIcon name="calendar" />{{ dateLabel(data.date) }}</p>
    <p v-if="data" class="field-note">今天不再提醒只影响当天，明天照常；长期关闭会停止后续安排。</p>

    <div class="life-grid">
      <LifeCard
        v-for="item in data?.items"
        :key="item.kind"
        :item="item"
        :settings-link="true"
        :busy="pending[`life:${item.kind}:${item.date}`] || pending[`settings:${item.kind}`]"
        :feedback="feedback[`life:${item.kind}:${item.date}`]"
        @action="(entry, action) => emit('action', entry, action)"
        @settings="emit('settings', $event)"
      />
    </div>

    <section v-if="data" class="section">
      <div class="section-heading">
        <h2>生活里的轻提醒</h2>
      </div>
      <p class="field-note">这些只发送提示，不需要确认。下面显示的是计划时间，不是发送记录。</p>
      <div class="card fixed-list">
        <article v-for="rule in data.fixedRules" :key="rule.id" class="fixed-row">
          <div class="fixed-copy">
            <h3>{{ rule.title }}</h3>
            <p>{{ rule.rule }}</p>
          </div>
          <p class="fixed-time">
            <template v-if="rule.nextAt">当天计划 {{ dateTime(rule.nextAt) }}</template>
            <template v-else-if="rule.windowStart && rule.windowEnd">预计 {{ clock(rule.windowStart) }}–{{ clock(rule.windowEnd) }} 之间</template>
          </p>
        </article>
      </div>
      <a class="text-button lu-link" href="https://lu.xmcloud.buzz" target="_blank" rel="noopener noreferrer">打开 Lu 记录看板<AppIcon name="external" /></a>
    </section>
  </div>
</template>

<style scoped>
.life-date {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 14px;
}

.life-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  margin-top: 16px;
}

.fixed-list {
  padding: 4px 18px;
}

.fixed-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
}

.fixed-row + .fixed-row {
  border-top: 1px solid var(--line);
}

.fixed-copy {
  min-width: 0;
}

.fixed-copy h3 {
  margin: 0;
  color: var(--ink);
  font-size: 15px;
  font-weight: 600;
}

.fixed-copy p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.fixed-time {
  margin: 0;
  color: var(--body);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.lu-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
}

@media (max-width: 719px) {
  .fixed-row {
    flex-direction: column;
    gap: 6px;
  }

  .fixed-time {
    text-align: left;
    white-space: normal;
  }
}
</style>
