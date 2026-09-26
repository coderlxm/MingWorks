<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, shallowRef } from 'vue'
import type { Feedback, LifeAction, LifeItem, LifeSettings as Settings } from '../types'
import { dateLabel, dateTime } from '../format'
import { lifeConfirmText, lifeStatusText } from '../labels'
import ModalShell from './ModalShell.vue'
const props = defineProps<{ item: LifeItem; current?: LifeItem; execute: (path: string, body: unknown, key: string, method?: string, successText?: string) => Promise<boolean>; settingsFeedback?: Feedback; actionFeedback?: Feedback }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const draft = reactive<Settings>({ ...props.item.settings })
const baseline = JSON.stringify(draft)
const dirty = computed(() => JSON.stringify(draft) !== baseline)
const current = computed(() => props.current ?? props.item)
const busy = shallowRef(false)
const activeAction = shallowRef<'settings' | 'day'>('settings')
const feedback = computed(() => activeAction.value === 'settings' ? props.settingsFeedback : props.actionFeedback)
function mayLeave() { return !busy.value && (!dirty.value || window.confirm('还有未保存的提醒设置。放弃这次修改并关闭？')) }
function close() { if (mayLeave()) emit('close') }
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value || busy.value) { event.preventDefault(); event.returnValue = '' } }
async function action(value: LifeAction) {
  if (value === 'stop' && !window.confirm(`停止 ${dateLabel(props.item.date)} 的${props.item.title}？未来仍按长期规则运行。`)) return
  activeAction.value = 'day'
  busy.value = true
  try { await props.execute(`/life/${props.item.kind}/actions`, { date: props.item.date, action: value }, `life:${props.item.kind}:${props.item.date}`, 'POST', value === 'stop' ? '今天的提醒已停止，未来规则继续保留' : value === 'snooze' ? '已安排 30 分钟后提醒' : '今天已确认') }
  finally { busy.value = false }
}
async function save() {
  if (props.item.enabled && !draft.enabled && !window.confirm('长期关闭会停止今天剩余提醒，未来也不再触发。确认关闭？')) return
  activeAction.value = 'settings'
  busy.value = true
  try { if (await props.execute(`/life/${draft.kind}/settings`, { ...draft }, `settings:${draft.kind}`, 'PUT', '生活提醒规则已保存')) emit('saved') }
  finally { busy.value = false }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
defineExpose({ mayLeave })
</script>
<template><ModalShell :title="item.title" subtitle="当天动作与长期安排分开管理。" :busy="busy" @close="close"><section class="detail-section"><h3>{{ dateLabel(item.date) }}</h3><div class="tag-row"><span class="tag">{{ lifeStatusText[current.status] }}</span><span v-if="!current.enabled" class="tag">长期已关闭</span></div><p v-if="current.nextTriggerAt">下次 {{ dateTime(current.nextTriggerAt) }}</p><p v-if="current.lastSentAt">最近发送 {{ dateTime(current.lastSentAt) }}</p><p v-if="current.finishedAt">结束于 {{ dateTime(current.finishedAt) }}</p><p v-if="current.reason" class="muted">{{ current.reason }}</p><p v-if="current.error" class="error">{{ current.error }}</p><div class="actions"><button v-if="current.actions.includes('confirm')" class="primary" :disabled="busy" @click="action('confirm')">{{ lifeConfirmText[item.kind] }}</button><button v-if="current.actions.includes('snooze')" class="outline-button" :disabled="busy" @click="action('snooze')">30 分钟后</button><button v-if="current.actions.includes('stop')" class="text-button danger" :disabled="busy" @click="action('stop')">今天不再提醒</button></div></section><form @submit.prevent="save"><section class="detail-section"><h3>长期提醒规则</h3><label class="switch-field"><span>启用{{ item.title }}</span><input v-model="draft.enabled" type="checkbox" role="switch" :disabled="busy"></label><p class="field-note">关闭会停止当前剩余和未来提醒；重新启用从下一个未来有效时间开始。</p><p class="field-note">修改时间时，今天尚未发送的新实例可重新安排；已发送或从旧记录迁入的实例保留当次剩余节奏，后续日期按新配置执行。</p><template v-if="draft.kind === 'vitamin'"><div class="field-grid"><label class="field">工作日随机窗口 · 从<input v-model="draft.workdayStart" type="time" required :disabled="busy"></label><label class="field">至<input v-model="draft.workdayEnd" type="time" required :disabled="busy"></label></div><label class="field">非工作日固定时间<input v-model="draft.restdayTime" type="time" required :disabled="busy"></label><p class="field-note">按中国工作日日历执行，继续提醒间隔为 30 分钟。未确定时刻前，只显示窗口。</p></template><template v-else-if="draft.kind === 'bus'"><label class="field">中国工作日首次提醒<input v-model="draft.time" type="time" required :disabled="busy"></label><p class="field-note">随后每 2 分钟提醒一次，最多 3 次。</p></template><p v-else class="field-note">随工作日新闻发出；09:59 补提醒，10:00 截止。此处保留现有时间关联。</p></section><p v-if="feedback" :class="feedback.error ? 'error' : 'success'" role="status">{{ feedback.text }}</p><div class="drawer-bottom"><button class="primary full-width" :disabled="busy || !dirty">{{ busy ? '正在保存…' : '保存长期规则' }}</button><p class="muted">北京时间 · UTC+8</p></div></form></ModalShell></template>
