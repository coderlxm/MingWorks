<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { Board, Match } from '../types'
import MatchCard from './MatchCard.vue'

const props = defineProps<{ board: Board }>()
const key = (match: Match) => `${match.eventId}:${match.setId}`
const incoming = computed(() => [...props.board.recentSets, ...props.board.liveSets])
const accepted = shallowRef(incoming.value)
const hasNew = computed(() => incoming.value.some(match => !accepted.value.some(old => key(old) === key(match) && old.completedAt === match.completedAt)))
const visible = computed(() => accepted.value.flatMap(match => {
  if (!props.board.events.some(event => event.eventId === match.eventId)) return []
  const latest = incoming.value.find(item => key(item) === key(match))
  return latest ? [latest] : match.completedAt !== null ? [match] : []
}))
const events = computed(() => new Map(props.board.events.map(event => [event.eventId, event])))
function followed(eventId: number) {
  return props.board.players.filter(player => player.eventId === eventId && player.entrantId !== null).map(player => player.entrantId!)
}
</script>

<template>
  <section class="panel">
    <div class="section-heading"><h2>最近对局</h2><button v-if="hasNew" class="text-button accent" @click="accepted = incoming">有新对局或赛果 · 点击查看 ↑</button></div>
    <p class="meta scope-note">最近结束的对局优先展示，进行中对局一并收录。仅含已采集对局。</p>
    <div v-if="visible.length" class="live-grid">
      <div v-for="match in visible" :key="key(match)">
        <RouterLink :to="`/events/${match.eventId}`" class="match-event">{{ events.get(match.eventId)?.tournamentName }} · {{ events.get(match.eventId)?.eventName }} →</RouterLink>
        <MatchCard :match="match" :followed-entrants="followed(match.eventId)" />
      </div>
    </div>
    <p v-else class="empty">{{ hasNew ? '已有新对局，点击上方提示查看' : '尚无已采集对局' }}<span>采集覆盖关注选手、种子与已识别决赛阶段。</span></p>
  </section>
</template>
