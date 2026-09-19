<script setup lang="ts">
import { computed } from 'vue'
import type { Player } from '../types'
import { playerStatus, time } from '../format'
const props = defineProps<{ players: Player[]; status?: string; search?: string; selected?: number | null }>()
defineEmits<{ select: [entrantId: number]; filter: [value: string]; search: [value: string] }>()
const filtered = computed(() => props.players.filter(player => (!props.status || player.status === props.status) && (!props.search || player.playerName.toLowerCase().includes(props.search.toLowerCase()))))
const statuses = computed(() => [...new Set(props.players.map(player => player.status).filter((status): status is string => status !== null))])
</script>
<template>
  <section class="panel players-panel">
    <div class="section-heading"><h2>我的关注选手</h2><span class="count">{{ players.length }}</span></div>
    <div class="filters"><input aria-label="筛选选手" placeholder="查找关注选手" :value="search" @input="$emit('search', ($event.target as HTMLInputElement).value)"><select aria-label="选手状态" :value="status || ''" @change="$emit('filter', ($event.target as HTMLSelectElement).value)"><option value="">全部状态</option><option v-for="item in statuses" :key="item" :value="item">{{ playerStatus(item) }}</option></select></div>
    <div v-for="player in filtered" :key="player.id" class="player-row" :class="{ selected: selected !== null && selected === player.entrantId }">
      <div class="row-between"><strong><span class="accent">★</span> {{ player.playerName }}</strong><span class="tag">{{ playerStatus(player.status) }}</span></div>
      <div class="meta"><span v-if="player.isPreset">固定关注</span><span v-if="player.placement !== null">{{ player.placementIsFinal ? '最终名次' : '当前名次' }} #{{ player.placement }}</span></div>
      <p v-if="player.lastSetRoundLabel || player.lastSetScoreText" class="player-result">{{ player.lastSetRoundLabel }}<br>{{ player.lastSetScoreText }}</p>
      <div class="row-between meta"><span>采集于 {{ time(player.capturedAt) }}</span><button v-if="player.entrantId !== null" class="text-button" @click="$emit('select', player.entrantId)">已采集对局 →</button></div>
    </div>
    <p v-if="!filtered.length" class="empty">{{ players.length ? '没有符合筛选的选手' : '等待本项目的选手数据' }}</p>
  </section>
</template>
