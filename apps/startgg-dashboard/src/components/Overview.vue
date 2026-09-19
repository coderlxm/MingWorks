<script setup lang="ts">
import { computed } from 'vue'
import type { Board } from '../types'
import { eventStatus, playerStatus, time } from '../format'
import RecentMatches from './RecentMatches.vue'
const props = defineProps<{ board: Board | null }>()
defineEmits<{ discover: [] }>()
const events = computed(() => [...(props.board?.events ?? [])].sort((a, b) => b.liveCount - a.liveCount || Number(b.active) - Number(a.active)))
</script>
<template>
  <header class="page-heading"><div><p class="eyebrow">比赛总览</p><h1>现在，打到哪里了。</h1><p class="muted">你关注的赛场，同一个观赛视角。</p></div><span class="scope">北京时间 · UTC+8</span></header>
  <RecentMatches v-if="board && board.recentSets !== undefined" :board="board" /><section v-else class="panel"><div class="section-heading"><h2>最近对局</h2></div><p v-if="board" class="error" role="alert">后端尚未提供最近对局数据，需要发布本次配套的 bot 接口改动。</p><p v-else class="empty">正在读取比赛数据…</p></section>
  <section v-if="board?.players.length" class="panel"><div class="section-heading"><h2>关注选手动态</h2><RouterLink to="/following" class="meta">管理关注 →</RouterLink></div><div class="overview-players"><RouterLink v-for="player in board.players" :key="`${player.eventId}:${player.id}`" :to="{ path: `/events/${player.eventId}`, query: { tab: 'players', q: player.playerName } }" class="overview-player"><div class="row-between"><strong><span class="accent">★</span> {{ player.playerName }}</strong><span class="tag">{{ playerStatus(player.status) }}</span></div><p class="meta">{{ player.eventName }}<span v-if="player.placement !== null"> · {{ player.placementIsFinal ? '最终名次' : '当前名次' }} #{{ player.placement }}</span></p><p v-if="player.lastSetScoreText" class="player-result">{{ player.lastSetScoreText }}</p><span class="meta">采集于 {{ time(player.capturedAt) }}</span></RouterLink></div></section>
  <section class="panel"><div class="section-heading"><h2>比赛项目</h2><span class="count">{{ events.length }}</span></div><div class="event-grid"><article v-for="event in events" :key="event.eventSlug" class="event-tile"><p class="eyebrow">{{ event.tournamentName }}</p><h3>{{ event.eventName }}</h3><p class="meta">{{ event.videogameName }}</p><div class="tags"><span class="tag">{{ eventStatus(event.eventState) }}</span><span v-if="event.liveCount" class="tag live">{{ event.liveCount }} 场进行中</span><span class="tag">{{ event.active ? '纳入监控' : '保留赛果' }}</span></div><p class="meta">采集于 {{ time(event.snapshotAt) }}</p><p v-if="event.lastError" class="error">{{ event.lastError }}</p><RouterLink v-if="event.eventId !== null" class="event-open" :to="`/events/${event.eventId}`">进入项目看板 <span>→</span></RouterLink><span v-else class="meta">等待解析项目身份</span></article></div><div v-if="board && !events.length" class="empty"><strong>还没有进入你的赛场</strong><span>发现赛事，或输入 start.gg 项目链接，完成首次同步后即可查看比赛。</span><button class="primary" @click="$emit('discover')">发现赛事</button></div></section>
</template>
