<script setup lang="ts">
import { computed } from 'vue'
import type { ServerHealthResult } from '../types'
import { formatGb, formatLoad, formatPercent } from '../utils/format'
import { formatDateTime, formatUptime } from '../utils/time'
import MetricRow from './MetricRow.vue'

const props = defineProps<{ result: ServerHealthResult; lastOnlineAt: string | null }>()

const view = computed(() => {
  const result = props.result
  if (!result.online) return null
  const memUsed = result.memTotal - result.memAvailable
  return {
    hostname: result.hostname,
    uptime: formatUptime(result.uptimeSeconds),
    cores: result.cores,
    loadText: result.load.map(formatLoad).join(' / '),
    loadRatios: result.load.map(value => value / result.cores),
    memText: `${formatGb(memUsed)} / ${formatGb(result.memTotal)}`,
    memRatio: memUsed / result.memTotal,
    diskText: `${formatGb(result.diskUsed)} / ${formatGb(result.diskTotal)}`,
    diskRatio: result.diskUsed / result.diskTotal,
  }
})

const offlineError = computed(() => (props.result.online ? null : props.result.error))
const subline = computed(() => [props.result.target.role, props.result.target.provider, props.result.target.note].filter(Boolean).join(' · '))
</script>

<template>
  <article class="card server-card" :class="{ 'is-offline': !view }" :aria-label="`服务器 ${result.target.alias}`">
    <header class="card-head">
      <div class="title-row">
        <span class="state" :class="view ? 'online' : 'offline'">
          <span class="state-dot" aria-hidden="true"></span>{{ view ? '在线' : '离线' }}
        </span>
        <span class="alias">{{ result.target.alias }}</span>
        <span class="tag">{{ result.target.name }}</span>
      </div>
      <p class="subline">{{ subline }}</p>
    </header>

    <template v-if="view">
      <div class="specs">
        <span class="host">{{ view.hostname }}</span>
        <span class="muted">{{ view.uptime }}</span>
      </div>
      <div class="metrics">
        <MetricRow :label="`负载（${view.cores} 核）`" :value-text="view.loadText" :ratios="view.loadRatios" />
        <MetricRow :label="`内存 ${formatPercent(view.memRatio)}`" :value-text="view.memText" :ratios="[view.memRatio]" />
        <MetricRow :label="`磁盘 ${formatPercent(view.diskRatio)}`" :value-text="view.diskText" :ratios="[view.diskRatio]" />
      </div>
    </template>

    <div v-else class="offline-box">
      <p class="offline-reason">{{ offlineError }}</p>
      <p class="offline-last">最近在线 <strong>{{ formatDateTime(lastOnlineAt) }}</strong></p>
    </div>
  </article>
</template>
