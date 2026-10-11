<script setup lang="ts">
import type { Feedback, ReminderRulesResponse, ReminderRuleView } from '../types'
import { dateTime } from '../format'
import { ruleStatusText, ruleStatusTone } from '../labels'
import AppIcon from '../components/AppIcon.vue'
const props = defineProps<{ data: ReminderRulesResponse | null; status: string; loading: boolean; pending: Record<string, boolean>; feedback: Record<string, Feedback> }>()
const emit = defineEmits<{ filter: [value: Record<string, string>]; create: []; detail: [rule: ReminderRuleView]; action: [rule: ReminderRuleView, action: 'pause' | 'resume'] }>()
const statusOptions = [
  { value: 'active', label: '运行中' },
  { value: 'paused', label: '已暂停' },
  { value: 'cancelled', label: '已结束' },
  { value: 'all', label: '全部' },
] as const
</script>

<template>
  <div>
    <header class="page-header">
      <div>
        <h1>循环规则</h1>
        <p>管理重复安排，也能看到每一次提醒。</p>
      </div>
      <button class="outline-button" @click="emit('create')"><AppIcon name="plus" />新建规则</button>
    </header>

    <nav class="view-links">
      <RouterLink to="/reminders">一次性提醒</RouterLink>
      <RouterLink to="/rules" aria-current="page">循环规则</RouterLink>
      <RouterLink to="/life">生活提醒</RouterLink>
    </nav>

    <div class="segmented rule-filter" role="group" aria-label="按状态筛选">
      <button
        v-for="option in statusOptions"
        :key="option.value"
        type="button"
        :class="{ active: props.status === option.value }"
        :aria-pressed="props.status === option.value"
        @click="emit('filter', { status: option.value })"
      >{{ option.label }}</button>
    </div>

    <p v-if="loading" class="muted" role="status">正在更新规则…</p>

    <div class="card-stack">
      <article v-for="rule in data?.rules" :key="rule.id" class="card rule-card" :class="{ 'is-inactive': rule.status !== 'active' }">
        <div class="rule-main">
          <span class="rule-icon"><AppIcon name="repeat" /></span>
          <div class="rule-body">
            <button class="rule-title" type="button" @click="emit('detail', rule)">{{ rule.text }}</button>
            <p class="rule-summary">{{ rule.summary }}</p>
            <p class="rule-next">
              <AppIcon name="calendar" />
              <span>{{ rule.nextTriggerAt ? `下一次 ${dateTime(rule.nextTriggerAt)}` : '暂无下一次' }}</span>
              <span v-if="rule.timezone !== 'Asia/Shanghai'">· 原时区 {{ rule.timezone }}</span>
            </p>
            <div class="tag-row">
              <span class="tag" :class="`tag--${ruleStatusTone[rule.status]}`">{{ ruleStatusText[rule.status] }}</span>
            </div>
          </div>
        </div>
        <p v-if="rule.error" class="error">{{ rule.error }}</p>
        <p v-if="feedback[`rule:${rule.id}`]" :class="feedback[`rule:${rule.id}`]!.error ? 'error' : 'success'" role="status">{{ feedback[`rule:${rule.id}`]!.text }}</p>
        <div class="rule-footer">
          <button class="text-button" type="button" @click="emit('detail', rule)">查看记录<AppIcon name="chevron" /></button>
          <button v-if="rule.status !== 'cancelled'" class="outline-button small" :disabled="pending[`rule:${rule.id}`]" @click="emit('action', rule, rule.status === 'active' ? 'pause' : 'resume')">{{ pending[`rule:${rule.id}`] ? '处理中…' : rule.status === 'active' ? '暂停' : '恢复' }}</button>
        </div>
      </article>
    </div>

    <div v-if="data && !data.rules.length" class="empty">
      <AppIcon name="repeat" />
      <h3>这里还没有对应的规则</h3>
      <p>每天读书、每周整理，都可以慢慢安排。</p>
      <div class="actions">
        <button class="outline-button" @click="emit('create')">新建循环规则</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rule-filter {
  display: flex;
  width: fit-content;
  max-width: 100%;
  margin-bottom: 16px;
  overflow-x: auto;
}

.rule-filter button {
  flex: none;
}

.rule-card {
  display: grid;
  gap: 12px;
}

.rule-main {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.rule-card.is-inactive .rule-main {
  opacity: 0.6;
}

.rule-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent);
}

.rule-body {
  display: grid;
  flex: 1;
  gap: 4px;
  justify-items: start;
  min-width: 0;
}

.rule-title {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink);
  font: inherit;
  font-size: 15px;
  font-weight: 550;
  line-height: 1.5;
  text-align: left;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.rule-title:hover {
  color: var(--accent-ink);
}

.rule-summary {
  margin: 0;
  color: var(--body);
  font-size: 14px;
}

.rule-next {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.rule-body .tag-row {
  margin-top: 4px;
}

.rule-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}
</style>
