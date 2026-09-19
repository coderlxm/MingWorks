<script setup lang="ts">
import { computed } from 'vue'
import type { EventSummary } from '../types'
import { eventStatus } from '../format'
const props = defineProps<{ events: EventSummary[]; selected: string; pendingCount: number }>()
defineEmits<{ manage: [] }>()
const groups = computed(() => {
  const result = new Map<string, EventSummary[]>()
  const sorted = [...props.events].sort((a, b) => Number(b.liveCount > 0) - Number(a.liveCount > 0) || Number(b.active) - Number(a.active))
  for (const event of sorted) { const rows = result.get(event.tournamentName) ?? []; rows.push(event); result.set(event.tournamentName, rows) }
  return [...result].map(([name, events]) => ({ name, events }))
})
</script>
<template>
  <nav class="event-nav" aria-label="比赛项目">
    <div class="section-label">赛事导航 <span>{{ events.length }}</span></div>
    <RouterLink class="nav-overview" to="/" :class="{ selected: !selected }">全部比赛 <span>→</span></RouterLink>
    <div v-for="group in groups" :key="group.name" class="event-group">
      <h3>{{ group.name }}</h3>
      <template v-for="event in group.events" :key="event.eventSlug">
        <RouterLink v-if="event.eventId !== null" :to="`/events/${event.eventId}`" class="event-link" :class="{ selected: selected === String(event.eventId) }"><strong>{{ event.eventName }}</strong><span><span v-if="event.liveCount" class="live">● {{ event.liveCount }} 场进行中</span><span v-else>{{ eventStatus(event.eventState) }}</span></span></RouterLink>
        <div v-else class="event-link"><strong>{{ event.eventName }}</strong><span>等待解析</span></div>
      </template>
    </div>
    <p v-if="!events.length" class="empty small">还没有已采集的项目</p>
    <button v-if="pendingCount" class="pending-link" @click="$emit('manage')">{{ pendingCount }} 个项目待确认 →</button>
    <div class="nav-note">仅展示已采集范围<br>关注选手 · 种子 · 决赛</div>
  </nav>
</template>
