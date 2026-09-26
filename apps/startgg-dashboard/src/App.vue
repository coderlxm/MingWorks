<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, useTemplateRef } from 'vue'
import { useRoute } from 'vue-router'
import { useBoardData } from './composables/useBoardData'
import { isEventSnapshotStale, nextCollectionTime, stopReason, time } from './format'
import AdminLoginDialog from './components/AdminLoginDialog.vue'
import EventNavigator from './components/EventNavigator.vue'
import EventBoard from './components/EventBoard.vue'
import Overview from './components/Overview.vue'
import FollowingPanel from './components/FollowingPanel.vue'
import OperationsDrawer from './components/OperationsDrawer.vue'
const data = useBoardData()
const { authenticated, board, following, details, detailErrors, error, connected, actionError, operation, busy, sessionError, sessionSubmitting, sessionGeneration } = data
const route = useRoute()
const topbar = useTemplateRef<HTMLElement>('topbar')
const topbarObserver = new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty('--topbar-height', `${entry!.borderBoxSize[0]!.blockSize}px`)
})
onMounted(() => topbarObserver.observe(topbar.value!, { box: 'border-box' }))
onUnmounted(() => {
  topbarObserver.disconnect()
  document.documentElement.style.removeProperty('--topbar-height')
})
const drawer = useTemplateRef<InstanceType<typeof OperationsDrawer>>('drawer')
const loginOpen = shallowRef(false)
const mobileNav = shallowRef(false)
const canManage = computed(() => authenticated.value === true)
const eventId = computed(() => String(route.params.eventId ?? ''))
const detail = computed(() => details[eventId.value])
const isFollowing = computed(() => route.path === '/following')
const activeEvents = computed(() => board.value?.events.filter(event => event.active).length ?? 0)
const stale = computed(() => !connected.value || !board.value?.runtime.pollingEnabled || Boolean(board.value?.runtime.lastError))
const monitoringStatus = computed(() => {
  if (error.value) return '页面读取已中断'
  if (!board.value) return '读取监控状态…'
  if (!connected.value) return '正在读取最新状态…'
  const runtime = board.value.runtime
  if (runtime.busy) return '监控任务处理中…'
  if (!runtime.pollingEnabled) return runtime.stopReason ? stopReason(runtime.stopReason) : '监控已停止'
  if (runtime.lastError) return '采集异常，请查看错误信息'
  return runtime.fastPollingEnabled ? '加速监控中 · 等待下次采集' : '定时监控中 · 等待下次采集'
})
function open(target: string) { drawer.value?.open(target) }
function openLogin() { sessionError.value = ''; loginOpen.value = true }
function closeLogin() { loginOpen.value = false; sessionError.value = '' }
</script>
<template>
  <div class="app-shell">
    <header ref="topbar" class="topbar">
      <RouterLink to="/" class="brand"><span class="brand-mark">F<span>T</span>G</span><span class="brand-caption">小明同学的比赛看板<span>POWERED BY START.GG</span></span></RouterLink>
      <nav class="main-nav" aria-label="主导航"><RouterLink to="/" :class="{ active: !isFollowing }">比赛总览</RouterLink><RouterLink to="/following" :class="{ active: isFollowing }">{{ canManage ? '关注管理' : '关注信息' }}</RouterLink></nav>
      <div class="top-actions">
        <span class="timezone">北京时间 · UTC+8</span>
        <button v-if="canManage" class="text-button" :disabled="sessionSubmitting" @click="data.logout">{{ sessionSubmitting ? '退出中…' : '退出管理' }}</button>
        <template v-else><span class="guest-label">访客 · 只读</span><button class="text-button" :disabled="sessionSubmitting" @click="openLogin">{{ sessionSubmitting && !loginOpen ? '退出中…' : '管理登录' }}</button></template>
      </div>
    </header>
    <div class="runtime-bar">
      <div class="runtime-summary"><span :class="stale ? 'muted' : 'accent'" role="status">{{ monitoringStatus }}</span><span v-if="board" class="meta">{{ activeEvents }} 个监控项目 · 最近一轮成功 {{ time(board.runtime.lastSuccessAt) }}</span><span v-if="connected && board?.runtime.pollingEnabled && !board.runtime.busy" class="meta">下次采集 {{ nextCollectionTime(board.runtime) }}</span></div>
      <div class="actions"><button class="mobile-only" @click="mobileNav = !mobileNav">{{ mobileNav ? '收起赛事' : '选择赛事' }}</button><button v-if="canManage" @click="open('settings')">监控设置</button><button v-if="canManage" class="primary" @click="open('discover')">发现赛事</button></div>
    </div>
    <div v-if="sessionError && !loginOpen" class="collection-error" role="alert"><span>{{ sessionError }}</span><button class="text-button" :disabled="sessionSubmitting" @click="data.checkSession">重新读取管理会话</button></div>
    <div v-if="error" class="connection-error" role="alert"><div><strong>连接中断，自动读取已停止</strong><span>{{ error }}。现有内容为上次成功读取的数据。</span></div><button @click="data.reconnect">重新连接</button></div>
    <div v-if="board?.runtime.lastError" class="collection-error" role="alert">最近采集失败：{{ board.runtime.lastError }} <button v-if="canManage" class="text-button" @click="open('settings')">查看采集状态 →</button></div>
    <div v-if="board?.runtime.notificationError" class="collection-error" role="alert">比赛数据已采集，Telegram 通知失败：{{ board.runtime.notificationError }}</div>
    <div v-if="canManage && actionError" class="collection-error" role="alert">{{ actionError }}</div>
    <div v-if="canManage && operation && (busy || operation.status === 'failed')" class="operation-strip" role="status"><span>{{ operation.status === 'failed' ? `操作失败：${operation.error}` : operation.status === 'queued' ? (operation.type === 'pause' || operation.type === '/monitoring/pause' ? '暂停中，当前采集结束后生效' : '操作已接受，等待当前任务完成') : '正在处理监控操作…' }}</span><button class="text-button" @click="open('settings')">查看详情 →</button></div>
    <div class="workspace">
      <aside class="sidebar" :class="{ 'mobile-open': mobileNav }" @click="($event.target as HTMLElement).closest('a') && (mobileNav = false)"><EventNavigator :events="board?.events ?? []" :stale="stale" :selected="eventId" :pending-count="board?.pendingCount ?? 0" :can-manage="canManage" @manage="open('pending')" /></aside>
      <main class="main-content">
        <FollowingPanel v-if="isFollowing" :following="following" :can-manage="canManage" :busy="busy || sessionSubmitting || board?.runtime.busy === true" :operation="operation" @manage="open('players')" @remove-player="data.run(`/players/${$event}`, {}, 'DELETE')" />
        <template v-else-if="eventId"><p v-if="detailErrors[eventId]" class="empty">{{ detailErrors[eventId] }}<RouterLink to="/">返回比赛总览 →</RouterLink></p><section v-else-if="!detail" class="panel"><h1>比赛项目</h1><p class="empty">正在读取该项目的已采集数据…</p></section></template>
        <Overview v-else :board="board" :stale="stale" :can-manage="canManage" @discover="open('discover')" />
        <KeepAlive :max="12"><EventBoard v-if="eventId && detail && !detailErrors[eventId]" :key="eventId" :detail="detail" :stale="isEventSnapshotStale(detail.event, stale)" :seed-count="following?.featuredSeedCount ?? 0" :can-manage="canManage" /></KeepAlive>
        <footer class="page-footer"><span>FTG · 专注每一场比赛</span><span>页面每 5 秒读取本地结果 · 上游通常每 15 分钟，活跃时约 2 分钟采集</span><button class="text-button" @click="data.reconnect">重新读取页面数据</button></footer>
      </main>
    </div>
    <AdminLoginDialog v-if="loginOpen" :login="data.login" :error="sessionError" :submitting="sessionSubmitting" @close="closeLogin" />
    <OperationsDrawer v-if="canManage" :key="sessionGeneration" ref="drawer" :data="data" />
  </div>
</template>
