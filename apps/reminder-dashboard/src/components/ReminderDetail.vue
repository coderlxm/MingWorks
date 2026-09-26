<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { api, ApiError } from '../api'
import { dateTime, fullDateTime } from '../format'
import { deliveryText, ruleStatusText, statusText } from '../labels'
import type { Feedback, ReminderItem, ReminderRuleView, RuleDetailResponse } from '../types'
import ModalShell from './ModalShell.vue'
import ReminderCard from './ReminderCard.vue'
const props = defineProps<{ item?: ReminderItem; ruleId?: number; busy: boolean; feedback?: Feedback; pending: Record<string, boolean>; actionFeedback: Record<string, Feedback> }>()
const emit = defineEmits<{ close: []; detail: [item: ReminderItem]; edit: [item: ReminderItem]; editRule: [rule: ReminderRuleView]; copy: [item: ReminderItem]; action: [item: ReminderItem, action: 'done' | 'skip' | 'snooze' | 'cancel']; ruleAction: [rule: ReminderRuleView, action: 'pause' | 'resume' | 'end']; expired: [] }>()
const detail = shallowRef<RuleDetailResponse | null>(null)
const latestItem = shallowRef<ReminderItem | null>(null)
const loading = shallowRef(false)
const error = shallowRef('')
let controller: AbortController | undefined
const item = computed(() => latestItem.value ?? props.item)
const terminal = computed(() => item.value && ['done', 'cancelled', 'skipped'].includes(item.value.status))
async function reload(user = false) {
  if (error.value && !user) return
  controller?.abort()
  const requestController = new AbortController()
  controller = requestController
  loading.value = true; error.value = ''
  try {
    if (props.ruleId !== undefined) {
      const response = await api<RuleDetailResponse>(`/rules/${props.ruleId}`, 'GET', undefined, requestController.signal)
      if (!requestController.signal.aborted) detail.value = response
    } else if (props.item?.kind === 'once') {
      const response = await api<{ item: ReminderItem }>(`/items/${props.item.id}`, 'GET', undefined, requestController.signal)
      if (!requestController.signal.aborted) latestItem.value = response.item
    } else if (props.item?.kind === 'run') {
      const response = await api<RuleDetailResponse>(`/rules/${props.item.ruleId}`, 'GET', undefined, requestController.signal)
      if (requestController.signal.aborted) return
      const run = response.runs.find(entry => entry.id === props.item!.id)
      if (!run) throw new Error('这次循环提醒已不存在。')
      latestItem.value = run
    }
  } catch (cause) {
    if (requestController.signal.aborted) return
    if (cause instanceof ApiError && cause.status === 401) emit('expired')
    else error.value = cause instanceof Error ? cause.message : String(cause)
  } finally { if (controller === requestController) loading.value = false }
}
onMounted(() => reload(true))
onBeforeUnmount(() => controller?.abort())
defineExpose({ reload })
</script>
<template><ModalShell :title="ruleId !== undefined ? '循环规则详情' : '提醒详情'" :busy="busy" @close="emit('close')"><p v-if="loading" class="muted" role="status">正在读取最新状态…</p><p v-if="error" class="error" role="alert">{{ error }}</p><button class="text-button" :disabled="loading" @click="reload(true)">重新读取这条记录</button><template v-if="detail"><section class="detail-section"><h3 class="detail-content">{{ detail.rule.text }}</h3><p>{{ detail.rule.summary }}</p><div class="tag-row"><span class="tag">{{ ruleStatusText[detail.rule.status] }}</span><span class="tag">{{ detail.rule.timezone }}</span></div><p>下一次 {{ dateTime(detail.rule.nextTriggerAt) }}</p><p v-if="detail.rule.error" class="error">{{ detail.rule.error }}</p><div class="actions"><button v-if="detail.rule.status !== 'cancelled'" class="primary" :disabled="busy" @click="emit('editRule', detail.rule)">编辑规则</button><button v-if="detail.rule.status !== 'cancelled'" class="outline-button" :disabled="busy" @click="emit('ruleAction', detail.rule, detail.rule.status === 'active' ? 'pause' : 'resume')">{{ detail.rule.status === 'active' ? '暂停规则' : '恢复规则' }}</button><button v-if="detail.rule.status !== 'cancelled'" class="text-button danger" :disabled="busy" @click="emit('ruleAction', detail.rule, 'end')">结束整条规则</button></div><p class="field-note">暂停、结束不会撤销已发出的待确认实例；恢复只安排下一个未来时间，不补发。</p></section><section class="detail-section"><h3>未来七天</h3><ul class="preview-list"><li v-for="at in detail.rule.preview" :key="at">{{ fullDateTime(at, detail.rule.timezone) }}</li></ul><p v-if="!detail.rule.preview.length" class="muted">这个范围内没有预计触发。</p></section><section class="detail-section"><h3>已发生的提醒</h3><div class="card-stack"><ReminderCard v-for="run in detail.runs" :key="run.key" :item="run" :busy="pending[run.key]" :feedback="actionFeedback[run.key]" @detail="emit('detail', $event)" @action="(entry, action) => emit('action', entry, action)" /><p v-if="!detail.runs.length" class="muted">还没有触发记录。</p></div></section></template>
    <template v-else-if="item && ruleId === undefined"><section class="detail-section"><h3 class="detail-content">{{ item.text }}</h3><div class="tag-row"><span class="tag">{{ item.kind === 'once' ? '一次性' : '循环当次' }}</span><span class="tag">{{ statusText[item.status] }}</span></div><dl class="detail-facts"><dt>计划时间</dt><dd>{{ fullDateTime(item.triggerAt, item.timezone) }}</dd><dt>时区</dt><dd>{{ item.timezone }}</dd><dt>发送结果</dt><dd>{{ deliveryText[item.deliveryStatus] }}</dd><dt>发送时间</dt><dd>{{ dateTime(item.sentAt) }}</dd><dt>处理时间</dt><dd>{{ dateTime(item.actedAt) }}</dd></dl><p v-if="item.note" class="notice">{{ item.note }}</p><p v-if="item.error" class="error">{{ item.error }}</p><div class="actions"><template v-if="item.kind === 'once'"><button v-if="!terminal" class="primary" :disabled="busy" @click="emit('edit', item)">编辑内容与时间</button><button v-if="!terminal" class="outline-button" :disabled="busy" @click="emit('action', item, 'done')">完成</button><button v-if="!terminal" class="outline-button" :disabled="busy" @click="emit('action', item, 'snooze')">指定稍后时间</button><button class="outline-button" :disabled="busy" @click="emit('copy', item)">复制为新提醒</button><button v-if="!terminal" class="text-button danger" :disabled="busy" @click="emit('action', item, 'cancel')">取消这条提醒</button></template><template v-else-if="item.status === 'awaiting'"><button class="primary" :disabled="busy" @click="emit('action', item, 'done')">完成本次</button><button class="outline-button" :disabled="busy" @click="emit('action', item, 'skip')">跳过本次</button></template></div></section></template><p v-if="feedback" :class="feedback.error ? 'error' : 'success'" role="status">{{ feedback.text }}</p></ModalShell></template>
