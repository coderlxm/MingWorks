<script setup lang="ts">
import { computed } from 'vue'
import type { Overview } from '../types'
import { formatDateTime } from '../utils/time'

const props = defineProps<{ overview: Overview | null }>()
const backups = computed(() => props.overview?.latest?.backups ?? null)
</script>

<template>
  <section class="section" aria-labelledby="heading-backups">
    <h2 id="heading-backups" class="section-title">数据备份</h2>
    <div class="card list">
      <template v-if="!overview">
        <div class="skeleton-row" aria-hidden="true"></div>
        <div class="skeleton-row" aria-hidden="true"></div>
      </template>
      <p v-else-if="!backups" class="empty">尚未巡检</p>
      <template v-else>
        <div v-for="backup in backups" :key="backup.target.alias + backup.target.name" class="backup-row">
          <div class="backup-main">
            <span class="backup-name">{{ backup.target.name }}</span>
            <span class="tag">{{ backup.target.alias }}</span>
            <span class="pill" :class="backup.healthy ? 'success' : 'fail'">{{ backup.healthy ? '成功' : '失败' }}</span>
          </div>
          <p class="backup-meta">
            <span>最近完成 {{ formatDateTime(backup.exitAt ?? null) }}</span>
            <span>定时器 {{ backup.timerState ?? '未知' }}（{{ backup.timerSubState ?? '未知' }}）</span>
          </p>
          <p v-if="backup.error" class="backup-error">{{ backup.error }}</p>
        </div>
      </template>
    </div>
  </section>
</template>
