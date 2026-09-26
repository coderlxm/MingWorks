<script setup lang="ts">
import { computed } from 'vue'
import { PRESET_REMINDERS } from '../../../../src/reminders/presets'
import type { LifeDashboard, Preset, ReminderBoardResponse } from '../types'
import { dateTime, dayjs } from '../format'
import AppIcon from './AppIcon.vue'
const props = defineProps<{ board: ReminderBoardResponse | null; lifeDays: LifeDashboard[] }>()
const emit = defineEmits<{ create: [preset: Preset] }>()
const upcoming = computed(() => {
  const rows = (props.board?.upcoming ?? []).map(item => ({ key: item.key, text: item.text, at: item.triggerAt, type: item.kind === 'once' ? '一次性' : '循环' }))
  for (const day of props.lifeDays) for (const item of day.items) {
    const at = item.nextTriggerAt ?? item.firstTriggerAt
    if (at && ['scheduled', 'snoozed'].includes(item.status)) rows.push({ key: `${item.kind}:${item.date}`, text: item.title, at, type: '生活专项' })
  }
  return rows.sort((a, b) => a.at.localeCompare(b.at)).slice(0, 3)
})
const week = computed(() => props.board ? Array.from({ length: 7 }, (_, index) => { const date = dayjs(props.board!.date).startOf('week').add(index, 'day'); return { date: date.format('YYYY-MM-DD'), day: date.format('dd'), number: date.date() } }) : [])
const icons: Record<string, string> = { noodles: 'clock', pomodoro: 'clock', laundry: 'sun', water: 'water', workout: 'leaf', nap: 'clock' }
</script>
<template><aside class="right-rail" aria-label="快捷添加和近期安排"><section v-if="board" class="mini-calendar"><div class="calendar-head"><strong>{{ dayjs(board.date).format('YYYY 年 M 月') }}</strong><span>本周</span></div><div class="week-strip"><div v-for="date in week" :key="date.date" :class="{ selected: date.date === board.date }"><small>{{ date.day }}</small><strong>{{ date.number }}</strong></div></div><p class="calendar-foot">把时间留给重要的小事。</p></section><section class="rail-block"><h2 class="rail-heading">从一件小事开始</h2><div class="template-list"><button v-for="preset in PRESET_REMINDERS" :key="preset.id" class="template-button" @click="emit('create', preset)"><AppIcon :name="icons[preset.id]!" /><span>{{ preset.label }}<small>{{ preset.minutes }} 分钟后</small></span><AppIcon name="plus" /></button></div><p class="rail-caption">模板帮你填写，保存前仍可调整内容和时间。</p></section><section v-if="upcoming.length" class="rail-block"><h2 class="rail-heading">接下来</h2><div v-for="item in upcoming" :key="item.key" class="upcoming-item"><time :datetime="item.at">{{ dateTime(item.at) }}</time><strong>{{ item.text }}</strong><p>{{ item.type }}</p></div></section><div class="quiet-note"><p>不用把每分钟都填满，<br>记住重要的小事就好。</p><small>A LITTLE SPACE FOR YOURSELF</small></div></aside></template>
