<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, shallowRef, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDashboard } from './composables/useDashboard'
import { clock } from './format'
import type { LifeAction, LifeItem, Preset, ReminderHistoryItem, ReminderItem, ReminderRuleView } from './types'
import AppIcon from './components/AppIcon.vue'
import LoginGate from './components/LoginGate.vue'
import QuickPanel from './components/QuickPanel.vue'
import ReminderForm from './components/ReminderForm.vue'
import ReminderDetail from './components/ReminderDetail.vue'
import LifeSettings from './components/LifeSettings.vue'
import TodayView from './views/TodayView.vue'
import ReminderListView from './views/ReminderListView.vue'
import RulesView from './views/RulesView.vue'
import LifeView from './views/LifeView.vue'
import HistoryView from './views/HistoryView.vue'

type Panel =
  | { type: 'form'; mode: 'new' | 'edit' | 'copy' | 'snooze'; kind: 'once' | 'rule'; item?: ReminderItem; rule?: ReminderRuleView; preset?: Preset; copyText?: string }
  | { type: 'detail'; item?: ReminderItem; ruleId?: number }
  | { type: 'life'; item: LifeItem }
const overlay = shallowRef<Panel | null>(null)
const overlaySerial = shallowRef(0)
const data = useDashboard(() => { if (overlay.value?.type === 'detail') overlay.value = null }, user => { void reminderDetail.value?.reload(user) })
const route = useRoute()
const router = useRouter()
const topbar = useTemplateRef<HTMLElement>('topbar')
const main = useTemplateRef<HTMLElement>('main')
const reminderForm = useTemplateRef<InstanceType<typeof ReminderForm>>('reminderForm')
const lifeSettings = useTemplateRef<InstanceType<typeof LifeSettings>>('lifeSettings')
const reminderDetail = useTemplateRef<InstanceType<typeof ReminderDetail>>('reminderDetail')
let focusOrigin: HTMLElement | null = null
const links = [{ path: '/', title: '今天', icon: 'sun' }, { path: '/reminders', title: '全部提醒', icon: 'list' }, { path: '/rules', title: '循环规则', icon: 'repeat' }, { path: '/life', title: '生活提醒', icon: 'leaf' }, { path: '/history', title: '历史', icon: 'clock' }]
const mobileLinks = [{ path: '/', title: '今天', icon: 'sun' }, { path: '/reminders', title: '提醒', icon: 'list' }, { path: '/life', title: '生活', icon: 'leaf' }, { path: '/history', title: '历史', icon: 'clock' }]
const pageTitle = computed(() => links.find(item => item.path === route.path)!.title)
const currentError = computed(() => data.readErrors[data.view.value])
const currentLoading = computed(() => data.loading[data.view.value] === true)
const updatedAt = computed(() => data.updated[data.view.value])
const itemKey = computed(() => {
  const panel = overlay.value
  if (!panel) return ''
  if (panel.type === 'life') return `life:${panel.item.kind}:${panel.item.date}`
  if (panel.type === 'detail') return panel.ruleId !== undefined ? `rule:${panel.ruleId}` : panel.item!.key
  return panel.mode === 'new' || panel.mode === 'copy' ? 'create' : panel.rule ? `rule:${panel.rule.id}` : panel.item!.key
})
const selectedLife = computed(() => {
  const panel = overlay.value
  if (panel?.type !== 'life') return undefined
  const source = data.view.value === 'life' ? data.life.value?.items ?? [] : data.calendarLife.value.flatMap(day => day.items)
  return source.find(item => item.kind === panel.item.kind && item.date === panel.item.date)
})
function open(panel: Panel) {
  if (!overlay.value) focusOrigin = document.activeElement instanceof HTMLElement ? document.activeElement : null
  overlaySerial.value += 1
  overlay.value = panel
  delete data.feedback[itemKey.value]
}
async function close() {
  overlay.value = null
  await nextTick()
  if (focusOrigin?.isConnected) focusOrigin.focus({ preventScroll: true })
  else main.value?.focus({ preventScroll: true })
}
function mayLeave() {
  if (overlay.value?.type === 'form') return reminderForm.value!.mayLeave()
  if (overlay.value?.type === 'life') return lifeSettings.value!.mayLeave()
  return true
}
function create(preset?: Preset) { open({ type: 'form', mode: 'new', kind: 'once', preset }) }
function newRule() { open({ type: 'form', mode: 'new', kind: 'rule' }) }
function edit(item: ReminderItem) { open({ type: 'form', mode: 'edit', kind: 'once', item }) }
function editRule(rule: ReminderRuleView) { open({ type: 'form', mode: 'edit', kind: 'rule', rule }) }
function copy(item: ReminderItem | ReminderHistoryItem) { open({ type: 'form', mode: 'copy', kind: 'once', copyText: item.text }) }
function detail(item: ReminderItem) {
  if (item.kind === 'forecast') open({ type: 'detail', ruleId: item.ruleId! })
  else open({ type: 'detail', item })
}
function settings(item: LifeItem) { open({ type: 'life', item }); delete data.feedback[`settings:${item.kind}`] }
async function itemAction(item: ReminderItem, action: 'done' | 'skip' | 'snooze' | 'cancel') {
  if (action === 'snooze') { open({ type: 'form', mode: 'snooze', kind: 'once', item }); return }
  if (action === 'cancel' && !window.confirm('取消这条提醒？它不会继续触发，已有记录将保留。')) return
  const text = action === 'done' ? '已完成这次提醒' : action === 'skip' ? '已跳过本次，后续规则继续运行' : '提醒已取消，历史记录保留'
  await data.execute(`/${item.kind === 'once' ? 'items' : 'runs'}/${item.id}/actions`, { action, revision: item.revision }, item.key, 'POST', text)
}
async function ruleAction(rule: ReminderRuleView, action: 'pause' | 'resume' | 'end') {
  if (action === 'end' && !window.confirm('结束整条循环规则？后续不再触发，已发生的记录和待确认实例会保留。')) return
  const text = action === 'pause' ? '规则已暂停，已发出的提醒仍可处理' : action === 'resume' ? '规则已恢复，从下一个未来时间开始' : '规则已结束，过去记录保留'
  await data.execute(`/rules/${rule.id}/actions`, { action, revision: rule.revision }, `rule:${rule.id}`, 'POST', text)
}
async function lifeAction(item: LifeItem, action: LifeAction) {
  if (action === 'stop' && !window.confirm(`停止 ${item.date} 当天的提醒？未来仍按长期规则运行。`)) return
  await data.execute(`/life/${item.kind}/actions`, { date: item.date, action }, `life:${item.kind}:${item.date}`, 'POST', action === 'confirm' ? '今天已确认' : action === 'snooze' ? '已安排 30 分钟后提醒' : '今天已停止，未来规则保留')
}
async function logout() { if (mayLeave() && await data.logout()) overlay.value = null }
const removeGuard = router.beforeEach((to, from) => {
  if (to.path === from.path) return true
  if (!mayLeave()) return false
  overlay.value = null
  return true
})
const topbarObserver = new ResizeObserver(([entry]) => document.documentElement.style.setProperty('--topbar-height', `${entry!.borderBoxSize[0]!.blockSize}px`))
onMounted(() => topbarObserver.observe(topbar.value!, { box: 'border-box' }))
onUnmounted(() => { topbarObserver.disconnect(); removeGuard(); document.documentElement.style.removeProperty('--topbar-height') })
</script>
<template>
  <div class="private-frame" :class="{ locked: data.authenticated.value !== true }">
    <div class="app-shell"><header ref="topbar" class="topbar"><div class="topbar-inner"><RouterLink to="/" class="brand"><span class="brand-symbol"><AppIcon name="leaf" /></span><span class="brand-name">拾时<span class="brand-en">Reminders</span></span></RouterLink><div class="header-context"><span>{{ pageTitle }}</span><span v-if="updatedAt" class="header-updated">{{ currentError ? '上次读取' : '数据更新于' }} {{ clock(updatedAt) }}</span><span v-else class="header-updated">正在读取日程</span></div><div class="topbar-actions"><details class="account-menu"><summary aria-label="我的账户">我的日程</summary><div><p>北京时间 · UTC+8</p><p>通知发往已配置的个人 Telegram 会话。关闭页面后，Bot 仍继续提醒。</p><button class="text-button" :disabled="data.sessionBusy.value" @click="logout">{{ data.sessionBusy.value ? '退出中…' : '退出登录' }}</button></div></details><button class="primary" @click="create()"><AppIcon name="plus" />新建提醒</button></div></div></header>
      <div class="workspace"><aside class="sidebar"><p class="nav-label">MY LITTLE ROUTINE</p><nav class="nav" aria-label="主导航"><RouterLink v-for="link in links" :key="link.path" :to="link.path" :class="{ active: route.path === link.path }" :aria-current="route.path === link.path ? 'page' : undefined"><AppIcon :name="link.icon" />{{ link.title }}</RouterLink></nav><div class="sidebar-note"><AppIcon name="clock" />北京时间 · UTC+8<br>网页整理日程<br>Telegram 提醒你</div></aside>
        <main ref="main" class="main-content" tabindex="-1"><div v-if="currentError" class="read-error" role="alert"><div><strong>数据尚未更新，自动读取已停止</strong><p>{{ currentError }}</p><p v-if="updatedAt">下方保留 {{ clock(updatedAt) }} 读取的内容。</p></div><button class="outline-button" :disabled="currentLoading" @click="data.refresh">{{ currentLoading ? '正在读取…' : '重新加载' }}</button></div><div v-if="data.notice.value" class="action-notice" :class="{ error: data.notice.value.error }" role="status"><p>{{ data.notice.value.text }}</p><button class="icon-button" aria-label="收起操作提示" @click="data.notice.value = null"><AppIcon name="close" /></button></div>
          <TodayView v-show="data.view.value === 'today'" :board="data.board.value" :life-days="data.calendarLife.value" :days="data.days.value" :pending="data.pending" :feedback="data.feedback" :loading="data.loading.today === true" @days="data.setDays" @create="create()" @detail="detail" @edit="edit" @action="itemAction" @life-action="lifeAction" @settings="settings" />
          <ReminderListView v-show="data.view.value === 'items'" :data="data.items.value" :filters="data.itemFilters" :pending="data.pending" :feedback="data.feedback" :loading="data.loading.items === true" @filter="data.applyFilters('items', $event)" @more="data.more" @create="create()" @detail="detail" @edit="edit" @action="itemAction" />
          <RulesView v-show="data.view.value === 'rules'" :data="data.rules.value" :status="data.ruleFilters.status" :pending="data.pending" :feedback="data.feedback" :loading="data.loading.rules === true" @filter="data.applyFilters('rules', $event)" @create="newRule" @detail="open({ type: 'detail', ruleId: $event.id })" @action="ruleAction" />
          <LifeView v-show="data.view.value === 'life'" :data="data.life.value" :pending="data.pending" :feedback="data.feedback" :loading="data.loading.life === true" @settings="settings" @action="lifeAction" />
          <HistoryView v-show="data.view.value === 'history'" :data="data.history.value" :filters="data.historyFilters" :loading="data.loading.history === true" @filter="data.applyFilters('history', $event)" @more="data.more" @copy="copy" />
          <footer class="page-footer"><span>把要记住的事，轻轻放在这里。</span><button class="text-button" :disabled="currentLoading" @click="data.refresh"><AppIcon name="refresh" />{{ currentLoading ? '正在更新…' : '刷新日程' }}</button></footer>
        </main><QuickPanel :board="data.view.value === 'today' ? data.board.value : null" :life-days="data.view.value === 'today' ? data.calendarLife.value : []" @create="create" /></div>
      <nav class="mobile-nav" aria-label="主导航"><RouterLink v-for="link in mobileLinks" :key="link.path" :to="link.path" :class="{ active: route.path === link.path || (link.path === '/reminders' && route.path === '/rules') }"><AppIcon :name="link.icon" />{{ link.title }}</RouterLink></nav>
    </div>
    <ReminderForm v-if="overlay?.type === 'form'" :key="overlaySerial" ref="reminderForm" :mode="overlay.mode" :kind="overlay.kind" :item="overlay.item" :rule="overlay.rule" :preset="overlay.preset" :copy-text="overlay.copyText" :execute="data.execute" :feedback="data.feedback[itemKey]" @close="close" @saved="close" @expired="data.expire" />
    <ReminderDetail v-else-if="overlay?.type === 'detail'" :key="overlaySerial" ref="reminderDetail" :item="overlay.item" :rule-id="overlay.ruleId" :busy="data.pending[itemKey] === true" :feedback="data.feedback[itemKey]" :pending="data.pending" :action-feedback="data.feedback" @close="close" @detail="detail" @edit="edit" @edit-rule="editRule" @copy="copy" @action="itemAction" @rule-action="ruleAction" @expired="data.expire" />
    <LifeSettings v-else-if="overlay?.type === 'life'" :key="overlaySerial" ref="lifeSettings" :item="overlay.item" :current="selectedLife" :execute="data.execute" :settings-feedback="data.feedback[`settings:${overlay.item.kind}`]" :action-feedback="data.feedback[itemKey]" @close="close" @saved="close" />
  </div>
  <LoginGate v-if="data.authenticated.value !== true && !data.booting.value" :busy="data.sessionBusy.value" :error="data.sessionError.value" :uncertain="data.authenticated.value === null" @login="data.login" @reload="data.checkSession" />
  <div v-if="data.booting.value" class="boot-screen" role="status"><div><AppIcon name="leaf" /><strong>拾时</strong><p>正在展开你的日程…</p></div></div>
</template>
