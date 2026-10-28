<script setup lang="ts">
import { onMounted } from 'vue'
import { useDashboard } from './composables/useDashboard'
import BackupList from './components/BackupList.vue'
import HistoryStrip from './components/HistoryStrip.vue'
import LoginGate from './components/LoginGate.vue'
import ServerCards from './components/ServerCards.vue'
import TopBar from './components/TopBar.vue'

const { phase, overview, error, loginBusy, loginError, inspecting, init, login, inspect } = useDashboard()
onMounted(init)
</script>

<template>
  <main class="page">
    <TopBar :overview="overview" :inspecting="inspecting" @inspect="inspect" />
    <LoginGate v-if="phase === 'locked'" :busy="loginBusy" :error="loginError" @login="login" />
    <template v-else>
      <p v-if="error" class="notice" role="alert">{{ error }}</p>
      <ServerCards :overview="overview" :inspecting="inspecting" />
      <BackupList :overview="overview" />
      <HistoryStrip :overview="overview" />
    </template>
  </main>
</template>
