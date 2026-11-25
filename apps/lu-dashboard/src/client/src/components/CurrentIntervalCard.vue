<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import type { CurrentInterval } from '../../../shared/dashboard'
import { formatCurrentInterval } from '../analytics'

dayjs.extend(utc)
dayjs.extend(timezone)

const props = defineProps<{ current: CurrentInterval }>()
const lastTime = computed(() => {
  if (!props.current.lastOccurredAt) return null
  const time = dayjs(props.current.lastOccurredAt).tz('Asia/Shanghai')
  return props.current.lastIsAuto
    ? `${time.format('MM 月 DD 日')} · 默认`
    : time.format('MM 月 DD 日 HH:mm')
})
const currentLabel = computed(() => formatCurrentInterval(props.current))
</script>

<template>
  <section class="panel current-hero-card">
    <div class="current-hero-header">
      <div class="live-indicator">
        <span class="live-dot" />
        <span>SINCE LAST · 距上次</span>
      </div>
      <span v-if="lastTime" class="panel-badge">{{ lastTime }}</span>
    </div>
    <div class="current-value mono-number">
      {{ currentLabel }}
    </div>
  </section>
</template>
