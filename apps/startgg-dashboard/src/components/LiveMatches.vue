<script setup lang="ts">
import type { EventSummary, Match } from '../types'
import MatchCard from './MatchCard.vue'
const props = defineProps<{ matches: Match[]; stale: (match: Match) => boolean; followed: (match: Match) => number[]; events?: EventSummary[] }>()
function eventLabel(match: Match) {
  const event = props.events?.find(item => item.eventId === match.eventId)
  return `${event?.tournamentName} · ${event?.eventName}`
}
</script>
<template>
  <section v-if="matches.length" class="panel live-panel">
    <div class="section-heading"><h2>正在进行</h2><span class="count live">{{ matches.length }}</span></div>
    <div :class="events ? 'live-grid' : 'match-stack'">
      <div v-for="match in matches" :key="`${match.eventId}:${match.setId}`" class="match-cell">
        <RouterLink v-if="events" :to="`/events/${match.eventId}`" class="match-event" :title="eventLabel(match)">{{ eventLabel(match) }} →</RouterLink>
        <MatchCard :match="match" :stale="stale(match)" :followed-entrants="followed(match)" :compact="!events" />
      </div>
    </div>
  </section>
</template>
