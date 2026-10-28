<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { HistoryDay, Overview } from '../types'
import { formatDayLabel } from '../utils/time'

const props = defineProps<{ overview: Overview | null }>()
const history = computed(() => props.overview?.history ?? null)

const focused = shallowRef<{ alias: string; day: HistoryDay } | null>(null)

const statusLabel = (online: boolean | null) => (online === null ? '无记录' : online ? '在线' : '离线')
const cellClass = (online: boolean | null) => (online === null ? 'none' : online ? 'online' : 'offline')
const caption = computed(() => {
  const current = focused.value
  if (!current) return '悬停或点按日格查看当天状态'
  return `${formatDayLabel(current.day.date)} · ${current.alias} · ${statusLabel(current.day.online)}`
})

function focus(alias: string, day: HistoryDay) {
  focused.value = { alias, day }
}
</script>

<template>
  <section class="section" aria-labelledby="heading-history">
    <div class="section-head">
      <h2 id="heading-history" class="section-title">近 30 天在线记录</h2>
      <ul class="legend" aria-label="图例">
        <li><span class="swatch online"></span>在线</li>
        <li><span class="swatch offline"></span>离线</li>
        <li><span class="swatch none"></span>无记录</li>
      </ul>
    </div>
    <div class="card history">
      <template v-if="!history">
        <div class="skeleton-row" aria-hidden="true"></div>
        <div class="skeleton-row" aria-hidden="true"></div>
      </template>
      <template v-else>
        <div v-for="row in history" :key="row.alias" class="history-row">
          <span class="history-alias">{{ row.alias }}</span>
          <div class="day-strip">
            <button
              v-for="day in row.days"
              :key="day.date"
              type="button"
              class="day"
              :class="cellClass(day.online)"
              :aria-label="`${formatDayLabel(day.date)} ${row.alias} ${statusLabel(day.online)}`"
              @pointerenter="focus(row.alias, day)"
              @focus="focus(row.alias, day)"
            ></button>
          </div>
        </div>
        <p class="caption">{{ caption }}</p>
      </template>
    </div>
  </section>
</template>
