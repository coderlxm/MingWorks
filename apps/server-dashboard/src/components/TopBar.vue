<script setup lang="ts">
import { computed } from 'vue'
import type { Overview } from '../types'
import { formatCheckedAt } from '../utils/time'

const props = defineProps<{ overview: Overview | null; inspecting: boolean }>()
const emit = defineEmits<{ inspect: [] }>()

const TRIGGER_LABEL = { daily: '每日巡检', manual: '手动' } as const

const latest = computed(() => props.overview?.latest ?? null)
const offlineCount = computed(() => latest.value?.servers.filter(server => !server.online).length ?? 0)
const statusText = computed(() => (offlineCount.value === 0 ? '全部在线' : `${offlineCount.value} 台离线`))
const checkedText = computed(() => {
  const snapshot = latest.value
  if (!snapshot) return '尚未巡检'
  return `${formatCheckedAt(snapshot.checkedAt, snapshot.trigger)} · ${TRIGGER_LABEL[snapshot.trigger]}`
})
</script>

<template>
  <header class="topbar">
    <div class="topbar-main">
      <div class="title-row">
        <h1 class="page-title">服务器</h1>
        <span v-if="latest" class="status-badge" :class="offlineCount === 0 ? 'all-online' : 'has-offline'" role="status">
          <span class="status-dot" aria-hidden="true"></span>{{ statusText }}
        </span>
      </div>
      <p v-if="overview" class="meta">最近巡检：{{ checkedText }}</p>
    </div>
    <button v-if="overview" type="button" class="btn-inspect" :class="{ loading: inspecting }" :disabled="inspecting" @click="emit('inspect')">
      <svg class="icon-refresh" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
      </svg>
      {{ inspecting ? '巡检中…' : '立即巡检' }}
    </button>
  </header>
</template>
