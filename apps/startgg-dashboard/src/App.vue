<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useRoute } from 'vue-router'
import { useBoardData } from './composables/useBoardData'
import { time } from './format'
import EventNavigator from './components/EventNavigator.vue'
import EventBoard from './components/EventBoard.vue'
import Overview from './components/Overview.vue'
import FollowingPanel from './components/FollowingPanel.vue'
import OperationsDrawer from './components/OperationsDrawer.vue'
const data = useBoardData()
const { authenticated, board, following, details, detailErrors, error, actionError, submitting, operation, busy } = data
const route = useRoute()
const drawer = useTemplateRef<InstanceType<typeof OperationsDrawer>>('drawer')
const password = shallowRef('')
const mobileNav = shallowRef(false)
const eventId = computed(() => String(route.params.eventId ?? ''))
const detail = computed(() => details[eventId.value])
const isFollowing = computed(() => route.path === '/following')
const activeEvents = computed(() => board.value?.events.filter(event => event.active).length ?? 0)
function open(target: string) { drawer.value?.open(target) }
</script>
<template>
  <div class="app-shell">
    <header class="topbar"><RouterLink to="/" class="brand"><span class="brand-mark">F<span>T</span>G</span><span class="brand-caption">比赛看板<span>POWERED BY START.GG</span></span></RouterLink><nav v-if="authenticated" class="main-nav" aria-label="主导航"><RouterLink to="/" :class="{ active: !isFollowing }">比赛总览</RouterLink><RouterLink to="/following" :class="{ active: isFollowing }">关注管理</RouterLink></nav><div class="top-actions"><span class="timezone">北京时间 · UTC+8</span><button v-if="authenticated" class="text-button" @click="data.logout">退出</button><span v-else class="private-label">个人观赛空间</span></div></header>
    <div v-if="authenticated === null" class="session-loading">正在读取会话…</div>
    <main v-else-if="!authenticated" class="login-main"><section class="login-card"><p class="eyebrow">YOUR MATCH. YOUR FOCUS.</p><h1>进入你的赛场</h1><p class="muted">关注的选手、正在进行的对局、最新赛果。<br>在一个安静的比赛看板里，持续跟进。</p><form @submit.prevent="data.login(password)"><label class="field">站点口令<input v-model="password" type="password" required autocomplete="current-password" placeholder="输入本站口令"></label><p v-if="actionError || error" class="error" role="alert">{{ actionError || error }}</p><button v-if="error" type="button" @click="data.loadSession">重新读取会话</button><button class="primary login-submit" :disabled="submitting">{{ submitting ? '登录中…' : '进入比赛看板 →' }}</button></form><p class="meta login-note">独立私人看板 · 与 Telegram 共用关注数据</p></section><div class="login-side"><span class="score-decoration">FTG</span><p>每一轮，都值得关注。</p><span class="meta">关注选手 / 对局 / 赛果</span></div></main>
    <template v-else>
      <div class="runtime-bar"><div class="runtime-summary"><span :class="board?.runtime.pollingEnabled ? 'live' : 'muted'">{{ board ? board.runtime.pollingEnabled ? '● 定时采集已开启' : '○ 监控已暂停或停止' : '读取监控状态…' }}</span><span v-if="board" class="meta">{{ activeEvents }} 个监控项目 · 最近采集 {{ time(board.runtime.lastSuccessAt) }}</span><span v-if="board?.runtime.fastPollingEnabled" class="meta">活跃项目约 2 分钟采集</span></div><div class="actions"><button class="mobile-only" @click="mobileNav = !mobileNav">{{ mobileNav ? '收起赛事' : '选择赛事' }}</button><button @click="open('settings')">监控设置</button><button class="primary" @click="open('discover')">发现赛事</button></div></div>
      <div v-if="error" class="connection-error" role="alert"><div><strong>连接中断，自动读取已停止</strong><span>{{ error }}。现有内容为上次成功读取的数据。</span></div><button @click="data.reconnect">重新连接</button></div>
      <div v-if="board?.runtime.lastError" class="collection-error" role="alert">最近采集失败：{{ board.runtime.lastError }} <button class="text-button" @click="open('settings')">查看采集状态 →</button></div>
      <div v-if="board?.runtime.notificationError" class="collection-error" role="alert">比赛数据已采集，Telegram 通知失败：{{ board.runtime.notificationError }}</div>
      <div v-if="actionError" class="collection-error" role="alert">{{ actionError }}</div>
      <div v-if="operation && (busy || operation.status === 'failed')" class="operation-strip" role="status"><span>{{ operation.status === 'failed' ? `操作失败：${operation.error}` : operation.status === 'queued' ? (operation.type === 'pause' || operation.type === '/monitoring/pause' ? '暂停中，当前采集结束后生效' : '操作已接受，等待当前任务完成') : '正在处理监控操作…' }}</span><button class="text-button" @click="open('settings')">查看详情 →</button></div>
      <div class="workspace"><aside class="sidebar" :class="{ 'mobile-open': mobileNav }" @click="($event.target as HTMLElement).closest('a') && (mobileNav = false)"><EventNavigator :events="board?.events ?? []" :selected="eventId" :pending-count="board?.pendingCount ?? 0" @manage="open('pending')" /></aside><main class="main-content"><FollowingPanel v-if="isFollowing" :following="following" @manage="open('players')" /><template v-else-if="eventId"><p v-if="detailErrors[eventId]" class="empty">{{ detailErrors[eventId] }}<RouterLink to="/">返回比赛总览 →</RouterLink></p><section v-else-if="!detail" class="panel"><h1>比赛项目</h1><p class="empty">正在读取该项目的已采集数据…</p></section></template><Overview v-else :board="board" @discover="open('discover')" /><KeepAlive :max="12"><EventBoard v-if="eventId && detail && !detailErrors[eventId]" :key="eventId" :detail="detail" :seed-count="following?.featuredSeedCount ?? 0" /></KeepAlive><footer class="page-footer"><span>FTG · 专注每一场比赛</span><span>页面每 5 秒读取本地结果 · 上游通常每 15 分钟，活跃时约 2 分钟采集</span><button class="text-button" @click="data.reconnect">重新读取页面数据</button></footer></main></div>
      <OperationsDrawer ref="drawer" :data="data" />
    </template>
  </div>
</template>
