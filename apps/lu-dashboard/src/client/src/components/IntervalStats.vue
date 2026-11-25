<script setup lang="ts">
import { computed } from 'vue'
import type { CurrentInterval, DashboardIntervals } from '../../../shared/dashboard'
import { formatCurrentInterval, formatDuration } from '../analytics'

const props = defineProps<{ current: CurrentInterval; intervals: DashboardIntervals }>()

const currentLabel = computed(() => (
  props.current.lastOccurredAt ? formatCurrentInterval(props.current) : '数据不足'
))
const medianLabel = computed(() => formatDuration(props.intervals.medianMinutes))
const longestLabel = computed(() => formatDuration(props.intervals.longestMinutes))
</script>

<template>
  <section class="panel interval-panel">
    <div class="panel-header">
      <h2>间隔统计 INTERVAL METRICS</h2>
      <span class="panel-badge">EXACT PAIRS</span>
    </div>
    <div class="interval-stats-grid">
      <div class="stat-box">
        <span class="label">当前间隔</span>
        <span class="value mono-number">{{ currentLabel }}</span>
      </div>
      <div class="stat-box">
        <span class="label">中位间隔</span>
        <span class="value mono-number">{{ medianLabel }}</span>
      </div>
      <div class="stat-box">
        <span class="label">最长间隔</span>
        <span class="value mono-number">{{ longestLabel }}</span>
      </div>
    </div>
  </section>
</template>
