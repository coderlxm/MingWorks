<script setup lang="ts">
import { computed } from 'vue'
import type { Match } from '../types'
import { sourceLabels, time } from '../format'
const props = defineProps<{ match: Match; stale: boolean; followedEntrants?: number[]; compact?: boolean }>()
const live = computed(() => props.match.startedAt !== null && props.match.completedAt === null)
const currentLive = computed(() => live.value && !props.stale)
</script>
<template>
  <article class="match-card" :class="{ compact, 'is-live': currentLive }">
    <header class="match-heading"><span>{{ match.roundLabel || '轮次未提供' }}</span><span :class="{ live: currentLive }">{{ live ? stale ? '上次采集时进行中' : '● 进行中' : match.completedAt ? '已结束' : '尚未开赛' }}</span></header>
    <div class="opponents">
      <template v-for="(slot, index) in match.slots" :key="index">
        <span v-if="index" class="versus">VS</span>
        <div class="competitor" :class="{ winner: slot.entrantId !== null && slot.entrantId === match.winnerId }">
          <span v-if="slot.entrantId !== null && followedEntrants?.includes(slot.entrantId)" class="accent" aria-label="关注选手">★</span>
          <span>{{ slot.name || '选手待定' }}</span><span v-if="slot.entrantId !== null && slot.entrantId === match.winnerId" class="tag">胜</span>
        </div>
      </template>
      <span v-if="!match.slots.length" class="muted">对阵信息尚未提供</span>
    </div>
    <p class="score">{{ match.displayScore || '比分未提供' }}</p>
    <footer class="match-footer"><span class="tags"><span v-for="source in match.sources" :key="source" class="tag">{{ sourceLabels[source] }}</span></span><span>{{ match.completedAt ? '结束于' : '采集于' }} {{ time(match.completedAt || match.observedAt) }}</span><a :href="match.url" target="_blank" rel="noopener noreferrer">查看对局 ↗</a></footer>
  </article>
</template>
