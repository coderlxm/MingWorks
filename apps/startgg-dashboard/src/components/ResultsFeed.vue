<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { api } from '../api'
import { registerInitialSetsRead } from '../initialBoardRead'
import type { Match, SetsPage } from '../types'
import MatchCard from './MatchCard.vue'
const props = defineProps<{ eventId: number; recent: Match[]; live: Match[]; followedEntrants: number[]; stale: boolean; fixedSource?: string; selectedPlayerName?: string }>()
const route = useRoute()
const router = useRouter()
const panel = useTemplateRef<HTMLElement>('panel')
interface PageState { sets: Match[]; accepted: Match[]; nextCursor: string | null; loading: boolean; loaded: boolean; error: string }
const queries = reactive<Record<string, PageState>>({})
const incoming = computed(() => [...props.recent, ...props.live])
const source = computed(() => props.fixedSource ?? String(route.query.source ?? ''))
const entrantId = computed(() => props.fixedSource ? '' : String(route.query.entrant ?? ''))
const queryKey = computed(() => `${props.eventId}:${source.value}:${entrantId.value}`)
const current = computed(() => queries[queryKey.value])
function newerMatch(current: Match, candidate: Match) {
  return dayjs(candidate.observedAt).isAfter(current.observedAt) ? candidate : current
}
function mergeMatches(matches: Match[]) {
  const latest = new Map<number, Match>()
  for (const match of matches) {
    const previous = latest.get(match.setId)
    latest.set(match.setId, previous ? newerMatch(previous, match) : match)
  }
  return [...latest.values()]
}
function matchesFilter(match: Match) {
  return (!source.value || match.sources.includes(source.value as 'player' | 'seed' | 'final')) && (!entrantId.value || match.slots.some(slot => String(slot.entrantId) === entrantId.value))
}
const scopedIncoming = computed(() => incoming.value.filter(matchesFilter))
const accepted = computed(() => current.value?.accepted ?? scopedIncoming.value)
function queryState() {
  const key = queryKey.value
  if (!queries[key]) queries[key] = { sets: [], accepted: scopedIncoming.value, nextCursor: null, loading: false, loaded: false, error: '' }
  return queries[key]
}
queryState()
const updateNotice = computed(() => {
  let added = 0
  let completed = 0
  for (const match of scopedIncoming.value) {
    const previous = accepted.value.find(item => item.setId === match.setId)
    if (!previous) added += 1
    else if (previous.completedAt === null && match.completedAt !== null && newerMatch(previous, match) === match) completed += 1
  }
  return [added ? `${added} 场新对局` : '', completed ? `${completed} 场对局已结束` : ''].filter(Boolean).join(' · ')
})
const hasNew = computed(() => Boolean(updateNotice.value))
const visible = computed(() => {
  const rows = current.value?.loaded ? [...current.value.sets, ...accepted.value.filter(match => match.completedAt === null)] : accepted.value
  const latest = rows.flatMap(match => {
    const confirmed = accepted.value.find(item => item.setId === match.setId)
    const known = confirmed ? newerMatch(match, confirmed) : match
    const updated = incoming.value.find(item => item.setId === match.setId)
    return updated ? [newerMatch(known, updated)] : known.completedAt !== null ? [known] : []
  })
  return mergeMatches(latest).filter(matchesFilter)
})
function acceptNew() {
  if (current.value?.loading) return
  if (current.value?.loaded || source.value || entrantId.value) void load(true)
  else queryState().accepted = scopedIncoming.value
}
async function load(reset = false) {
  const requestedMatches = scopedIncoming.value
  const state = queryState()
  if (state.loading) return
  state.loading = true
  state.error = ''
  const query = new URLSearchParams()
  if (source.value) query.set('source', source.value)
  if (entrantId.value) query.set('entrantId', entrantId.value)
  if (!reset && state.nextCursor) query.set('cursor', state.nextCursor)
  try {
    const result = await api<SetsPage>(`/events/${props.eventId}/sets?${query}`)
    const firstPage = reset || !state.loaded
    state.sets = firstPage ? result.sets : [...state.sets, ...result.sets]
    state.nextCursor = result.nextCursor
    state.loaded = true
    if (firstPage) state.accepted = mergeMatches([...state.accepted, ...requestedMatches, ...result.sets])
  } catch (cause) { state.error = cause instanceof Error ? cause.message : String(cause) }
  finally { state.loading = false }
}
async function filter(value: string) { await router.replace({ query: { ...route.query, source: value || undefined } }) }
async function clearPlayer() { await router.replace({ query: { ...route.query, entrant: undefined } }) }
function readSelectedFilter() {
  if (String(route.params.eventId) !== String(props.eventId)) return
  const state = queryState()
  if ((source.value || entrantId.value) && !state.loaded && !state.error) return load(true)
}
function reveal() {
  panel.value?.focus({ preventScroll: true })
  panel.value?.scrollIntoView({ block: 'start' })
}
const removeHook = router.afterEach(readSelectedFilter)
onMounted(() => {
  const read = readSelectedFilter()
  if (read && String(route.query.tab ?? 'matches') === (props.fixedSource ? 'final' : 'matches')) registerInitialSetsRead(read)
})
onUnmounted(removeHook)
defineExpose({ reveal })
</script>
<template>
  <section ref="panel" class="panel results-panel" tabindex="-1" :aria-label="selectedPlayerName ? `${selectedPlayerName}的已采集对局` : fixedSource === 'final' ? '最近决赛对局' : '最近对局'">
    <div class="section-heading"><h2>{{ selectedPlayerName ? `${selectedPlayerName}的已采集对局` : fixedSource === 'final' ? '最近决赛对局' : '最近对局' }}</h2><button v-if="hasNew" class="text-button accent" :disabled="current?.loading" @click="acceptNew">{{ updateNotice }} · 点击查看 ↑</button></div>
    <div v-if="!fixedSource" class="filters"><select aria-label="赛果来源" :value="source" @change="filter(($event.target as HTMLSelectElement).value)"><option value="">全部来源</option><option value="player">仅关注选手</option><option value="seed">种子选手</option><option value="final">决赛阶段</option></select><button v-if="entrantId" class="chip" aria-label="取消选手筛选" @click="clearPlayer">{{ selectedPlayerName }} #{{ entrantId }} ×</button></div>
    <p class="meta scope-note">最近结束的对局优先展示，进行中对局一并收录。仅含已采集对局。</p>
    <div class="match-stack"><MatchCard v-for="match in visible" :key="`${match.eventId}:${match.setId}`" :match="match" :followed-entrants="followedEntrants" :stale="stale" compact /></div>
    <p v-if="!visible.length" class="empty">{{ current?.loading ? '正在读取已采集对局…' : hasNew ? '已有新对局，点击上方提示查看' : source || entrantId ? '当前筛选下没有已采集对局' : '尚无已采集对局' }}</p>
    <p v-if="current?.error" class="error" role="alert">{{ current.error }}</p>
    <button v-if="!current?.loaded || current.nextCursor || current.error" class="load-more" :disabled="current?.loading" @click="load()">{{ current?.loading ? '读取中…' : current?.loaded ? '更多已采集赛果' : '浏览已采集赛果' }}</button>
  </section>
</template>
<style scoped>
.results-panel:focus { outline: 2px solid var(--accent); outline-offset: 3px; }
</style>
