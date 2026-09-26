<script setup lang="ts">
import { computed } from 'vue'
import type { Operation, Player } from '../types'

const props = defineProps<{ players: Player[]; canManage: boolean; busy: boolean; operation: Operation | null }>()
defineEmits<{ remove: [id: number] }>()

const removal = computed(() => {
  const operation = props.operation
  return operation && (operation.type === 'remove-player' || /^\/players\/\d+$/.test(operation.type)) ? operation : null
})
const removalMessage = computed(() => {
  const operation = removal.value
  if (!operation) return ''
  if (operation.status === 'queued') return '移除已接受，等待当前任务完成。'
  if (operation.status === 'running') return '正在移除选手关注…'
  if (operation.status === 'failed') return '移除关注失败。'
  const result = operation.result as { id: number; playerName: string }
  return `已取消对 ${result.playerName} 的关注。`
})
</script>

<template>
  <section class="panel">
    <div class="section-heading"><h2>关注选手</h2><span class="count">{{ players.length }}</span></div>
    <div v-if="canManage && removal" class="operation-feedback" :class="{ error: removal.status === 'failed' }" :role="removal.status === 'failed' ? 'alert' : 'status'">
      <strong>{{ removalMessage }}</strong>
      <p v-if="removal.error">{{ removal.error }}</p>
    </div>
    <div v-for="player in players" :key="player.id" class="following-row followed-player">
      <div class="player-identity">
        <strong><span class="accent">★</span> {{ player.playerName }}</strong>
        <span class="tag">{{ player.isPreset ? '预设名单' : '手动添加' }}</span>
      </div>
      <button v-if="canManage" type="button" :disabled="busy" :aria-label="`取消对 ${player.playerName} 的关注`" @click="$emit('remove', player.id)">移除关注</button>
    </div>
    <p v-if="!players.length" class="empty">暂无关注选手</p>
    <p v-if="canManage" class="meta">移除会取消选手关注，已采集赛果保留；该选手仍可能出现在种子或决赛对局中，需要时可以重新添加。</p>
    <p class="meta">新添加选手等待下一次比赛采集。</p>
  </section>
</template>

<style scoped>
.followed-player { align-items: center; flex-wrap: wrap; }
.player-identity { display: flex; align-items: center; flex: 1 1 12rem; flex-wrap: wrap; gap: 8px; min-width: 0; }
.followed-player button, .player-identity .tag { flex-shrink: 0; }
</style>
