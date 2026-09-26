<script setup lang="ts">
import type { Following, Operation } from '../types'
import FollowedPlayers from './FollowedPlayers.vue'
defineProps<{ following: Following | null; canManage: boolean; busy: boolean; operation: Operation | null }>()
defineEmits<{ manage: []; removePlayer: [id: number] }>()
</script>
<template>
  <header class="page-heading"><div><p class="eyebrow">看板观赛范围</p><h1>{{ canManage ? '关注管理' : '关注信息' }}</h1><p class="muted">与 Telegram 共用选手、游戏偏好和本届关注。</p></div><button v-if="canManage" class="primary" @click="$emit('manage')">添加与设置</button></header>
  <p v-if="!following" class="empty">正在读取关注信息…</p>
  <div v-else class="following-grid"><FollowedPlayers :players="following.players" :can-manage="canManage" :busy="busy" :operation="operation" @remove="$emit('removePlayer', $event)" /><div class="stack"><section class="panel"><div class="section-heading"><h2>长期关注游戏</h2></div><div class="tags"><span v-for="preference in following.preferences" :key="preference.videogameId" class="chip">{{ preference.videogameName }}</span></div><p v-if="!following.preferences.length" class="empty small">暂无长期关注游戏</p><p class="meta">允许后续发现的该游戏项目；监控暂停时不会持续发现。</p></section><section class="panel"><div class="section-heading"><h2>本届项目关注</h2></div><div v-for="interest in following.eventInterests" :key="interest.eventSlug" class="interest-row"><a :href="`https://www.start.gg/${interest.eventSlug}`" target="_blank" rel="noopener noreferrer">{{ interest.eventSlug }} ↗</a><p class="meta">持续关注至本项目实际完赛</p></div><p v-if="!following.eventInterests.length" class="empty small">暂无有效的本届项目关注</p></section><section class="panel"><div class="section-heading"><h2>全局种子关注</h2><span class="tag">{{ following.featuredSeedCount ? `Top ${following.featuredSeedCount}` : '关闭' }}</span></div><p class="meta">影响全部当前监控项目，历史已采集赛果继续保留。</p><button v-if="canManage" class="text-button" @click="$emit('manage')">调整档位 →</button></section></div></div>
</template>
