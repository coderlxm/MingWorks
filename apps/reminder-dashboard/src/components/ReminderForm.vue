<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, shallowRef } from 'vue'
import { api, ApiError } from '../api'
import { clock, dateTime, dayjs, localDate, now, TIMEZONE, wallTimeIso } from '../format'
import type { Feedback, Preset, ReminderItem, ReminderRecurrenceInput, ReminderRuleInput, ReminderRuleView, RulePreviewResponse } from '../types'
import ModalShell from './ModalShell.vue'
const props = defineProps<{
  mode: 'new' | 'edit' | 'copy' | 'snooze'; kind: 'once' | 'rule'; item?: ReminderItem; rule?: ReminderRuleView; preset?: Preset; copyText?: string
  execute: (path: string, body: unknown, key: string, method?: string, successText?: string) => Promise<boolean>
  feedback?: Feedback
}>()
const emit = defineEmits<{ close: []; saved: []; expired: [] }>()
const zone = props.rule?.timezone ?? props.item?.timezone ?? TIMEZONE
const initialTime = props.mode === 'edit' && props.item ? dayjs(props.item.triggerAt).tz(zone) : now().add(props.preset?.minutes ?? 15, 'minute')
const recurrence = props.rule?.recurrence
const draft = reactive({
  kind: props.kind, text: props.rule?.text ?? props.item?.text ?? props.preset?.reminderText ?? props.copyText ?? '',
  date: initialTime.format('YYYY-MM-DD'), time: props.kind === 'rule' ? recurrence?.time ?? '20:30' : initialTime.format('HH:mm'),
  frequency: recurrence?.calendarFilter === 'china_workday' ? 'workdays' : recurrence?.freq ?? 'DAILY',
  weekdays: [...(recurrence?.byweekday ?? ['MO'])], monthdays: [...(recurrence?.bymonthday ?? [now().date()])],
})
const savedSnapshot = JSON.stringify(draft)
const dirty = computed(() => JSON.stringify(draft) !== savedSnapshot)
const submitting = shallowRef(false)
const previewing = shallowRef(false)
const preview = shallowRef<RulePreviewResponse | null>(null)
const previewKey = shallowRef('')
const error = shallowRef('')
const previewController = new AbortController()
const weekdays = [{ value: 'MO', label: '一' }, { value: 'TU', label: '二' }, { value: 'WE', label: '三' }, { value: 'TH', label: '四' }, { value: 'FR', label: '五' }, { value: 'SA', label: '六' }, { value: 'SU', label: '日' }]
const title = computed(() => props.mode === 'snooze' ? '稍后提醒我' : props.mode === 'edit' ? draft.kind === 'rule' ? '编辑循环规则' : '编辑提醒' : props.mode === 'copy' ? '复制为新提醒' : '新建一条提醒')
function ruleInput(): ReminderRuleInput {
  const frequency = draft.frequency === 'workdays' ? 'DAILY' : draft.frequency as ReminderRecurrenceInput['freq']
  return { text: draft.text.trim(), recurrence: { freq: frequency, byweekday: frequency === 'WEEKLY' ? [...draft.weekdays] : [], bymonthday: frequency === 'MONTHLY' ? [...draft.monthdays].sort((a, b) => a - b) : [], time: draft.time, timezone: zone, calendarFilter: draft.frequency === 'workdays' ? 'china_workday' : null } }
}
const currentRuleKey = computed(() => JSON.stringify(ruleInput()))
const previewCurrent = computed(() => preview.value !== null && previewKey.value === currentRuleKey.value)
const oncePreview = computed(() => draft.date && draft.time ? `${draft.date} ${draft.time} · ${zone === TIMEZONE ? '北京时间' : zone}` : '请选择提醒日期和时间')
function mayLeave() { return !submitting.value && (!dirty.value || window.confirm('还有未保存的内容。放弃这次修改并关闭？')) }
function close() { if (mayLeave()) emit('close') }
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value || submitting.value) { event.preventDefault(); event.returnValue = '' } }
function afterMinutes(minutes: number) { const value = dayjs().tz(zone).add(minutes, 'minute'); draft.date = value.format('YYYY-MM-DD'); draft.time = value.format('HH:mm'); error.value = '' }
async function readPreview(): Promise<boolean> {
  error.value = ''; previewing.value = true
  const input = ruleInput()
  const key = JSON.stringify(input)
  try {
    const value = await api<RulePreviewResponse>('/rules/preview', 'POST', input, previewController.signal)
    if (key !== currentRuleKey.value) return false
    preview.value = value; previewKey.value = key
    return true
  } catch (cause) {
    if (previewController.signal.aborted) return false
    if (cause instanceof ApiError && cause.status === 401) emit('expired')
    else error.value = cause instanceof Error ? cause.message : String(cause)
    return false
  } finally { previewing.value = false }
}
async function submit() {
  if (submitting.value) return
  error.value = ''
  if (draft.kind === 'rule' && !previewCurrent.value) { await readPreview(); return }
  submitting.value = true
  try {
    let saved: boolean
    if (draft.kind === 'rule') {
      const input = ruleInput()
      saved = props.rule && props.mode === 'edit'
        ? await props.execute(`/rules/${props.rule.id}`, { ...input, revision: props.rule.revision }, `rule:${props.rule.id}`, 'PUT', '循环规则已更新，已发生的记录保持原样')
        : await props.execute('/rules', input, 'create', 'POST', '循环规则已创建')
    } else {
      const triggerAt = wallTimeIso(draft.date, draft.time, zone)
      if (!dayjs(triggerAt).isAfter(dayjs())) { error.value = '请选择一个尚未到来的时间。'; return }
      const input = { text: draft.text.trim(), triggerAt }
      if (props.mode === 'snooze') saved = await props.execute(`/items/${props.item!.id}/actions`, { action: 'snooze', triggerAt, revision: props.item!.revision }, props.item!.key, 'POST', `已改为 ${dateTime(triggerAt)} 提醒`)
      else if (props.mode === 'edit') saved = await props.execute(`/items/${props.item!.id}`, { ...input, revision: props.item!.revision }, props.item!.key, 'PUT', '提醒内容与时间已保存')
      else saved = await props.execute('/items', input, 'create', 'POST', '提醒已创建，到点后由 Telegram 提醒你')
    }
    if (saved) emit('saved')
  } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { submitting.value = false }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => { previewController.abort(); window.removeEventListener('beforeunload', beforeUnload) })
defineExpose({ mayLeave })
</script>
<template>
  <ModalShell :title="title" subtitle="选一个时间，记下一件小事。" :busy="submitting" @close="close"><form class="reminder-form" @submit.prevent="submit"><label class="field">提醒内容<textarea v-model="draft.text" required maxlength="1000" rows="3" placeholder="比如：出门前带上雨伞" autofocus :disabled="submitting || mode === 'snooze'"></textarea></label><fieldset v-if="mode === 'new' || mode === 'copy'" class="choice-field"><legend>提醒类型</legend><div class="segmented"><button type="button" :class="{ active: draft.kind === 'once' }" :disabled="submitting" @click="draft.kind = 'once'">一次性</button><button type="button" :class="{ active: draft.kind === 'rule' }" :disabled="submitting" @click="draft.kind = 'rule'">循环提醒</button></div></fieldset>
      <template v-if="draft.kind === 'once'"><div class="quick-times"><button v-for="minutes in [5, 15, 30, 60]" :key="minutes" class="outline-button" type="button" :disabled="submitting" @click="afterMinutes(minutes)">{{ minutes }} 分钟后</button></div><div class="field-grid"><label class="field">提醒日期<input v-model="draft.date" type="date" :min="localDate(now().toISOString(), zone)" required :disabled="submitting"></label><label class="field">提醒时间<input v-model="draft.time" type="time" required :disabled="submitting"></label></div><div class="rule-preview"><p class="eyebrow">这次安排</p><p>{{ oncePreview }}</p><p v-if="mode === 'snooze'" class="muted">修改后等待新时间触发，不沿用上一次发送状态。</p></div></template>
      <template v-else><label class="field">重复方式<select v-model="draft.frequency" :disabled="submitting"><option value="DAILY">每天</option><option value="WEEKLY">每周指定星期</option><option value="MONTHLY">每月指定日期</option><option value="workdays">中国工作日</option></select></label><fieldset v-if="draft.frequency === 'WEEKLY'" class="choice-field"><legend>星期</legend><div class="choice-grid"><label v-for="day in weekdays" :key="day.value"><input v-model="draft.weekdays" type="checkbox" :value="day.value" :disabled="submitting"><span>周{{ day.label }}</span></label></div></fieldset><fieldset v-if="draft.frequency === 'MONTHLY'" class="choice-field"><legend>每月日期</legend><div class="choice-grid monthdays"><label v-for="date in 31" :key="date"><input v-model="draft.monthdays" type="checkbox" :value="date" :disabled="submitting"><span>{{ date }}</span></label></div><p class="muted">选择 29、30、31 日时，没有这个日期的月份不会触发。</p></fieldset><label class="field">提醒时间<input v-model="draft.time" type="time" required :disabled="submitting"></label><p v-if="zone !== TIMEZONE" class="notice">这条既有规则使用 {{ zone }}，本次编辑保留原时区。</p><button class="outline-button full-width" type="button" :disabled="previewing || submitting || !draft.text.trim()" @click="readPreview">{{ previewing ? '正在计算下一次…' : '查看下一次提醒时间' }}</button><div v-if="previewCurrent && preview" class="rule-preview"><p class="eyebrow">规则预览</p><p>{{ preview.summary }}</p><p>下一次 {{ dateTime(preview.nextTriggerAt, preview.timezone) }}</p><p class="muted">时区 {{ preview.timezone }}</p></div><p v-else class="field-note">先查看下一次提醒时间，再确认保存；预览由 Bot 按真实日历计算。</p><p v-if="mode === 'edit'" class="field-note">修改只影响后续安排。已发出的当次提醒保留原内容与时间。</p></template>
      <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="feedback?.error" class="error" role="alert">{{ feedback.text }}</p><div class="drawer-bottom"><button class="primary full-width" :disabled="submitting || previewing">{{ submitting ? '正在保存…' : draft.kind === 'rule' && !previewCurrent ? '预览下一次时间' : mode === 'snooze' ? '确认改期' : '保存提醒' }}</button><p class="muted">{{ zone === TIMEZONE ? '北京时间 · UTC+8' : zone }} · 通知发往已配置的 Telegram 会话</p></div></form></ModalShell>
</template>
