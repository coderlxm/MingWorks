<script setup lang="ts">
import { computed } from 'vue'
import type { Overview } from '../types'
import ServerCard from './ServerCard.vue'

const props = defineProps<{ overview: Overview | null; inspecting: boolean }>()
const servers = computed(() => props.overview?.latest?.servers ?? null)
</script>

<template>
  <section class="section" aria-labelledby="heading-servers">
    <h2 id="heading-servers" class="section-title">节点状态</h2>
    <div class="server-grid" :class="{ inspecting }" :aria-busy="inspecting">
      <template v-if="!overview">
        <div v-for="n in 4" :key="n" class="card skeleton" aria-hidden="true"></div>
      </template>
      <p v-else-if="!servers" class="card empty">尚未巡检，点击「立即巡检」获取状态。</p>
      <template v-else>
        <ServerCard
          v-for="server in servers"
          :key="server.target.alias"
          :result="server"
          :last-online-at="overview.lastOnlineAt[server.target.alias] ?? null"
        />
      </template>
    </div>
  </section>
</template>
