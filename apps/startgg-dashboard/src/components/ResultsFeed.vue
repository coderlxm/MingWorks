<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import type { Match, SetsPage } from '../types'
import MatchCard from './MatchCard.vue'
const props = defineProps<{ eventId: number; recent: Match[]; followedEntrants: number[]; fixedSource?: string }>()
const route = useRoute()
const router = useRouter()
interface PageState { sets: Match[]; nextCursor: string | null; loading: boolean; loaded: boolean; error: string }
const queries = reactive<Record<string, PageState>>({})
const accepted = shallowRef<Match[]>(props.recent)
const source = computed(() => props.fixedSource ?? String(route.query.source ?? ''))
const entrantId = computed(() => props.fixedSource ? '' : String(route.query.entrant ?? ''))
const queryKey = computed(() => `${props.eventId}:${source.value}:${entrantId.value}`)
const current = computed(() => queries[queryKey.value])
const hasNew = computed(() => accepted.value.length > 0 && props.recent.some(match => !accepted.value.some(item => item.setId === match.setId)))
const visible = computed(() => {
  const rows = current.value?.loaded ? current.value.sets : accepted.value.length ? accepted.value : props.recent
  return rows.map(match => props.recent.find(item => item.setId === match.setId) ?? match).filter(match => (!source.value || match.sources.includes(source.value as 'player' | 'seed' | 'final')) && (!entrantId.value || match.slots.some(slot => String(slot.entrantId) === entrantId.value)))
})
function acceptNew() { accepted.value = props.recent; void load(true) }
async function load(reset = false) {
  const key = queryKey.value
  if (!queries[key]) queries[key] = { sets: [], nextCursor: null, loading: false, loaded: false, error: '' }
  const state = queries[key]
  if (state.loading) return
  state.loading = true
  state.error = ''
  const query = new URLSearchParams()
  if (source.value) query.set('source', source.value)
  if (entrantId.value) query.set('entrantId', entrantId.value)
  if (!reset && state.nextCursor) query.set('cursor', state.nextCursor)
  try {
    const result = await api<SetsPage>(`/events/${props.eventId}/sets?${query}`)
    state.sets = reset || !state.loaded ? result.sets : [...state.sets, ...result.sets]
    state.nextCursor = result.nextCursor
    state.loaded = true
  } catch (cause) { state.error = cause instanceof Error ? cause.message : String(cause) }
  finally { state.loading = false }
}
async function filter(value: string) { await router.replace({ query: { ...route.query, source: value || undefined } }) }
async function clearPlayer() { await router.replace({ query: { ...route.query, entrant: undefined } }) }
function readSelectedFilter() {
  if (String(route.params.eventId) === String(props.eventId) && (source.value || entrantId.value) && !current.value?.loaded && !current.value?.error) void load(true)
}
const removeHook = router.afterEach(readSelectedFilter)
onMounted(readSelectedFilter)
onUnmounted(removeHook)
defineExpose({ load })
</script>
<template>
  <section class="panel results-panel">
    <div class="section-heading"><h2>{{ fixedSource === 'final' ? '已采集决赛赛果' : '最新赛果' }}</h2><button v-if="hasNew" class="text-button accent" @click="acceptNew">有新赛果 · 点击查看 ↑</button></div>
    <div v-if="!fixedSource" class="filters"><select aria-label="赛果来源" :value="source" @change="filter(($event.target as HTMLSelectElement).value)"><option value="">全部来源</option><option value="player">仅关注选手</option><option value="seed">种子选手</option><option value="final">决赛阶段</option></select><button v-if="entrantId" class="chip" @click="clearPlayer">选手 #{{ entrantId }} ×</button></div>
    <p class="meta scope-note">仅含已采集对局，不代表大会全部赛果或完整历史。</p>
    <div class="match-stack"><MatchCard v-for="match in visible" :key="`${match.eventId}:${match.setId}`" :match="match" :followed-entrants="followedEntrants" compact /></div>
    <p v-if="!visible.length" class="empty">{{ current?.loading ? '正在读取已采集赛果…' : recent.length || source || entrantId ? '当前筛选下没有已采集赛果' : '等待首次赛果采集' }}</p>
    <p v-if="current?.error" class="error" role="alert">{{ current.error }}</p>
    <button v-if="!current?.loaded || current.nextCursor || current.error" class="load-more" :disabled="current?.loading" @click="load()">{{ current?.loading ? '读取中…' : current?.loaded ? '更多已采集赛果' : '浏览已采集赛果' }}</button>
  </section>
</template>
