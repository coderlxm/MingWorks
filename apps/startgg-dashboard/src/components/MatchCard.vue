<script setup lang="ts">
import { computed } from 'vue'
import type { Match } from '../types'
import { slotScores, sourceLabels, time } from '../format'
const props = defineProps<{ match: Match; stale: boolean; followedEntrants?: number[]; compact?: boolean }>()
const live = computed(() => props.match.startedAt !== null && props.match.completedAt === null)
const currentLive = computed(() => live.value && !props.stale)
const scores = computed(() => slotScores(props.match))
const sides = computed(() => props.match.slots.map((slot, index) => {
  const winner = slot.entrantId !== null && slot.entrantId === props.match.winnerId
  return { name: slot.name || '选手待定', winner, loser: props.match.winnerId !== null && !winner, followed: slot.entrantId !== null && props.followedEntrants?.includes(slot.entrantId) === true, score: scores.value?.[index] ?? '–' }
}))
</script>
<template>
  <article class="match-card" :class="{ compact, 'is-live': currentLive }">
    <header class="match-heading"><span class="match-round" :title="match.roundLabel ?? undefined">{{ match.roundLabel || '轮次未提供' }}</span><span :class="{ live: currentLive }">{{ live ? stale ? '上次采集时进行中' : '● 进行中' : match.completedAt ? '已结束' : '尚未开赛' }}</span></header>
    <ol v-if="sides.length" class="scoreboard" :title="match.displayScore ?? undefined">
      <li v-for="(side, index) in sides" :key="index" class="side" :class="{ winner: side.winner, loser: side.loser }">
        <span v-if="side.followed" class="accent" aria-label="关注选手">★</span>
        <span class="side-name" :title="side.name">{{ side.name }}</span>
        <span v-if="side.winner" class="win-tag">胜</span>
        <span class="side-score">{{ side.score }}</span>
      </li>
    </ol>
    <p v-else class="scoreboard muted">对阵信息尚未提供</p>
    <footer class="match-footer"><span class="tags"><span v-for="source in match.sources" :key="source" class="tag">{{ sourceLabels[source] }}</span></span><span class="match-time">{{ match.completedAt ? '结束于' : '采集于' }} {{ time(match.completedAt || match.observedAt) }}</span><a :href="match.url" target="_blank" rel="noopener noreferrer">查看对局 ↗</a></footer>
  </article>
</template>
