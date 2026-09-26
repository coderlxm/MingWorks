<script setup lang="ts">
import { computed } from 'vue'
import type { Feedback, ReminderItem } from '../types'
import { dateTime } from '../format'
import { statusText } from '../labels'
import AppIcon from './AppIcon.vue'
const props = defineProps<{ item: ReminderItem; busy?: boolean; feedback?: Feedback; compact?: boolean }>()
const emit = defineEmits<{ detail: [item: ReminderItem]; edit: [item: ReminderItem]; action: [item: ReminderItem, action: 'done' | 'skip' | 'snooze'] }>()
const needsAction = computed(() => props.item.status === 'awaiting')
const editable = computed(() => props.item.kind === 'once' && ['scheduled', 'snoozed', 'missed', 'failed'].includes(props.item.status))
</script>
<template>
  <article class="reminder-card" :class="{ 'reminder-card--waiting': needsAction, 'reminder-card--issue': item.error }" :aria-busy="busy">
    <div class="task-main"><span class="task-icon" :class="{ clay: needsAction }"><AppIcon :name="item.kind === 'once' ? 'clock' : 'repeat'" /></span><div class="task-copy"><button class="task-title" @click="emit('detail', item)">{{ item.text }}</button><p>{{ item.kind === 'forecast' ? '预计触发' : '计划时间' }} {{ dateTime(item.triggerAt) }}<span v-if="item.timezone !== 'Asia/Shanghai'"> · 原时区 {{ item.timezone }}</span></p><div class="tag-row"><span class="tag">{{ item.kind === 'once' ? '一次性' : item.kind === 'forecast' ? '循环 · 预计' : '循环当次' }}</span><span class="tag" :class="{ 'tag--clay': needsAction, 'tag--green': ['scheduled','snoozed','done'].includes(item.status) }">{{ statusText[item.status] }}</span></div></div></div>
    <p v-if="item.note" class="item-note">{{ item.note }}</p><p v-if="item.error" class="error" role="alert">{{ item.error }}</p>
    <div v-if="needsAction || editable || feedback" class="task-footer"><p v-if="feedback" :class="feedback.error ? 'error' : 'success'" role="status">{{ feedback.text }}</p><div class="actions"><template v-if="needsAction"><button class="primary small" :disabled="busy" @click="emit('action', item, 'done')">{{ busy ? '处理中…' : item.kind === 'once' ? '完成' : '完成本次' }}</button><button class="outline-button" :disabled="busy" @click="emit('action', item, item.kind === 'once' ? 'snooze' : 'skip')">{{ item.kind === 'once' ? '稍后' : '跳过本次' }}</button></template><button v-else-if="editable" class="outline-button" :disabled="busy" @click="emit('edit', item)">{{ item.status === 'missed' || item.status === 'failed' ? '重新安排时间' : '编辑时间' }}</button></div></div>
  </article>
</template>
