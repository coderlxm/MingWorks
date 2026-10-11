<script setup lang="ts">
import { reactive } from 'vue'
import type { Feedback, ReminderItem, ReminderListResponse } from '../types'
import AppIcon from '../components/AppIcon.vue'
import ReminderCard from '../components/ReminderCard.vue'
const props = defineProps<{ data: ReminderListResponse | null; filters: { q: string; status: string; from: string; to: string }; loading: boolean; pending: Record<string, boolean>; feedback: Record<string, Feedback> }>()
const emit = defineEmits<{ filter: [value: Record<string, string>]; more: []; create: []; detail: [item: ReminderItem]; edit: [item: ReminderItem]; action: [item: ReminderItem, action: 'done' | 'skip' | 'snooze'] }>()
const draft = reactive({ ...props.filters })
function clear() { Object.assign(draft, { q: '', status: 'active', from: '', to: '' }); emit('filter', { ...draft }) }
</script>

<template>
  <div>
    <header class="page-header">
      <div>
        <h1>全部提醒</h1>
        <p>一次性安排，按时间排列。</p>
      </div>
    </header>

    <nav class="view-links">
      <RouterLink to="/reminders" aria-current="page">一次性提醒</RouterLink>
      <RouterLink to="/rules">循环规则</RouterLink>
      <RouterLink to="/life">生活提醒</RouterLink>
    </nav>

    <form class="toolbar" @submit.prevent="emit('filter', { ...draft })">
      <label class="field grow">
        查找内容
        <span class="search-box">
          <span class="search-icon"><AppIcon name="search" /></span>
          <input v-model="draft.q" type="search" placeholder="搜索提醒内容">
        </span>
      </label>
      <label class="field">
        状态
        <select v-model="draft.status">
          <option value="active">有效提醒</option>
          <option value="all">全部状态</option>
          <option value="scheduled">待触发</option>
          <option value="snoozed">已延期</option>
          <option value="awaiting">已发送待确认</option>
          <option value="done">已完成</option>
          <option value="cancelled">已取消</option>
          <option value="missed">已错过</option>
          <option value="failed">发送失败</option>
          <option value="unknown">历史结果不明</option>
        </select>
      </label>
      <label class="field">
        从
        <input v-model="draft.from" type="date">
      </label>
      <label class="field">
        至
        <input v-model="draft.to" type="date" :min="draft.from || undefined">
      </label>
      <button class="primary" :disabled="loading">筛选</button>
      <button class="text-button" type="button" @click="clear">清除</button>
    </form>

    <p v-if="data" class="results-summary">{{ data.total }} 条提醒<span v-if="loading"> · 正在更新…</span></p>

    <div class="card-stack">
      <ReminderCard
        v-for="item in data?.items"
        :key="item.key"
        :item="item"
        :busy="pending[item.key]"
        :feedback="feedback[item.key]"
        @detail="emit('detail', $event)"
        @edit="emit('edit', $event)"
        @action="(entry, action) => emit('action', entry, action)"
      />
    </div>

    <div v-if="data && !data.items.length" class="empty">
      <AppIcon name="search" />
      <h3>没有符合条件的提醒</h3>
      <p>可以调整筛选，或新建一条安排。</p>
      <div class="actions">
        <button class="outline-button" @click="clear">清除筛选</button>
        <button class="primary" @click="emit('create')">新建提醒</button>
      </div>
    </div>

    <p v-if="!data" class="loading-placeholder">{{ loading ? '正在读取提醒…' : '提醒列表尚未读取。' }}</p>

    <button v-if="data?.nextOffset !== null && data" class="load-more outline-button" :disabled="loading" @click="emit('more')">{{ loading ? '正在读取…' : '继续查看' }}</button>
  </div>
</template>

<style scoped>
.search-box {
  position: relative;
  display: block;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  color: var(--muted);
  pointer-events: none;
}

.field .search-box input {
  padding-left: 38px;
}
</style>
