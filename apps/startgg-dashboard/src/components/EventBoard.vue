<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Detail } from '../types'
import { eventStatus, time } from '../format'
import PlayersPanel from './PlayersPanel.vue'
import ResultsFeed from './ResultsFeed.vue'
const props = defineProps<{ detail: Detail; seedCount: number; canManage: boolean }>()
const route = useRoute()
const router = useRouter()
const results = useTemplateRef<InstanceType<typeof ResultsFeed>>('results')
const tabs = [{ id: 'matches', title: '赛况' }, { id: 'players', title: '关注选手' }, { id: 'seeds', title: '种子' }, { id: 'final', title: '决赛' }]
const tab = computed(() => String(route.query.tab ?? 'matches'))
const followed = computed(() => props.detail.players.flatMap(player => player.entrantId === null ? [] : [player.entrantId]))
const finalMatches = computed(() => props.detail.recentSets.filter(match => match.sources.includes('final')))
const finalLive = computed(() => props.detail.liveSets.filter(match => match.sources.includes('final')))
function query(key: string, value: string) { return router.replace({ query: { ...route.query, [key]: value || undefined } }) }
async function selectPlayer(entrantId: number) {
  await router.replace({ query: { ...route.query, tab: 'matches', entrant: String(entrantId) } })
  await nextTick()
  await results.value?.load(true)
}
</script>
<template>
  <div class="event-board">
    <header class="page-heading"><div><p class="eyebrow">{{ detail.event.tournamentName }}</p><h1>{{ detail.event.eventName }}</h1><div class="meta"><span>{{ detail.event.videogameName }}</span><span>{{ detail.event.interest === 'follow' ? '长期关注游戏' : detail.event.interest === 'event' ? '仅关注本届此项目' : '未关注' }}</span><span>{{ eventStatus(detail.event.eventState) }}</span><span>采集于 {{ time(detail.event.snapshotAt) }}</span></div></div><a class="button" :href="`https://www.start.gg/${detail.event.eventSlug}`" target="_blank" rel="noopener noreferrer">start.gg ↗</a></header>
    <p v-if="detail.event.lastError" class="error" role="alert">本项目采集失败：{{ detail.event.lastError }}。下方保留上次成功数据。</p>
    <p v-if="detail.event.notificationError" class="error" role="alert">比赛数据已采集，Telegram 通知失败：{{ detail.event.notificationError }}</p>
    <nav class="tabs" aria-label="项目内容"><button v-for="item in tabs" :key="item.id" :class="{ active: tab === item.id }" @click="query('tab', item.id)">{{ item.title }}</button></nav>
    <div v-show="tab === 'matches' || tab === 'players'" class="event-columns" :class="{ 'players-only': tab === 'players' }">
      <div v-show="tab === 'matches'" class="match-column">
        <ResultsFeed ref="results" :event-id="detail.event.eventId!" :recent="detail.recentSets" :live="detail.liveSets" :followed-entrants="followed" />
      </div>
      <div class="side-column"><PlayersPanel :players="detail.players" :status="String(route.query.status ?? '')" :search="String(route.query.q ?? '')" :selected="route.query.entrant ? Number(route.query.entrant) : null" @filter="query('status', $event)" @search="query('q', $event)" @select="selectPlayer" /><section v-if="tab === 'matches'" class="panel final-summary"><div class="section-heading"><h2>决赛阶段</h2></div><strong>{{ detail.finalPhase?.name || '尚未识别决赛阶段' }}</strong><p class="muted">{{ detail.finalPhase ? `${detail.finalPhase.numSeeds} 个种子席位 · ${detail.finalPhase.standings.length ? '已获取最终排名' : '等待最终排名'}` : '阶段信息随比赛采集更新' }}</p><button v-if="detail.finalPhase" class="text-button" @click="query('tab', 'final')">打开决赛视图 →</button></section></div>
    </div>
    <section v-show="tab === 'seeds'" class="panel"><div class="section-heading"><h2>种子清单</h2><span class="tag">{{ seedCount ? `全局 Top ${seedCount}` : '全局种子关注已关闭' }}</span></div><p class="meta">种子序号属于对应阶段，不是实时积分或最终名次。采集于 {{ time(detail.event.snapshotAt) }}</p><div class="seed-grid"><div v-for="seed in detail.seeds" :key="`${seed.phaseId}:${seed.entrantId}`" class="seed-row"><span class="seed-number">{{ String(seed.seedNum).padStart(2, '0') }}</span><div><strong>{{ seed.entrantName }}</strong><p class="meta">{{ seed.phaseName }}</p></div><span v-if="followed.includes(seed.entrantId)" class="accent">★ 关注</span></div></div><p v-if="!detail.seeds.length" class="empty">{{ seedCount ? '等待本项目种子名单同步' : canManage ? '可在监控设置中开启 Top 16 / Top 32 种子关注' : '种子关注尚未开启，当前没有已采集的种子名单' }}</p></section>
    <section v-show="tab === 'final'" class="panel"><div class="section-heading"><h2>{{ detail.finalPhase?.name || '决赛阶段' }}</h2><span v-if="detail.finalPhase" class="tag">{{ detail.finalPhase.numSeeds }} 个种子席位</span></div><template v-if="detail.finalPhase"><h3>阶段入围名单</h3><div class="tags"><span v-for="entrant in detail.finalPhase.entrants" :key="entrant.entrantId" class="chip">{{ entrant.entrantName }}</span></div><template v-if="detail.finalPhase.standings.length"><h3>官方最终排名</h3><div class="standings"><div v-for="standing in detail.finalPhase.standings" :key="standing.entrantId" class="standing"><span class="rank">{{ standing.placement === 1 ? '01 冠军' : `#${standing.placement}` }}</span><strong>{{ standing.entrantName }}</strong></div></div></template><p v-else class="meta">尚无最终排名；按官方名次保留并列。</p><ResultsFeed :event-id="detail.event.eventId!" :recent="finalMatches" :live="finalLive" :followed-entrants="followed" fixed-source="final" /></template><p v-else class="empty">尚未识别决赛阶段。此处显示实际阶段，不推测晋级关系。</p></section>
  </div>
</template>
