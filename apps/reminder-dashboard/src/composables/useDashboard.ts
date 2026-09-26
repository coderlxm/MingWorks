import { computed, nextTick, onMounted, onUnmounted, reactive, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, ApiError, request } from '../api'
import { dayjs, now } from '../format'
import { viewFromPath, type Feedback, type LifeDashboard, type ReminderApiError, type ReminderBoardResponse, type ReminderHistoryResponse, type ReminderItem, type ReminderListResponse, type ReminderMutationResponse, type ReminderRulesResponse, type ReminderRuleView, type ViewName } from '../types'

export function useDashboard(onExpired: () => void, onRead: (user: boolean) => void) {
  const route = useRoute()
  const router = useRouter()
  const view = computed(() => viewFromPath(route.path))
  const authenticated = shallowRef<boolean | null>(null)
  const booting = shallowRef(true)
  const sessionBusy = shallowRef(false)
  const sessionError = shallowRef('')
  const board = shallowRef<ReminderBoardResponse | null>(null)
  const calendarLife = shallowRef<LifeDashboard[]>([])
  const items = shallowRef<ReminderListResponse | null>(null)
  const rules = shallowRef<ReminderRulesResponse | null>(null)
  const life = shallowRef<LifeDashboard | null>(null)
  const history = shallowRef<ReminderHistoryResponse | null>(null)
  const days = shallowRef<1 | 7>(1)
  const itemFilters = reactive({ q: '', status: 'active', from: '', to: '' })
  const ruleFilters = reactive({ status: 'active' })
  const historyFilters = reactive({ from: now().subtract(6, 'day').format('YYYY-MM-DD'), to: now().format('YYYY-MM-DD'), kind: 'all' })
  const loading = reactive<Record<string, boolean>>({})
  const readErrors = reactive<Record<string, string>>({})
  const updated = reactive<Record<string, string>>({})
  const pending = reactive<Record<string, boolean>>({})
  const feedback = reactive<Record<string, Feedback>>({})
  const notice = shallowRef<Feedback | null>(null)
  const controllers = new Map<ViewName, AbortController>()
  const activeReads = new Map<ViewName, Promise<void>>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  let sessionVersion = 0

  function stopTimer() { clearTimeout(timer) }
  function cancelReads() {
    for (const [name, controller] of controllers) { controller.abort(); loading[name] = false }
    controllers.clear()
    activeReads.clear()
    stopTimer()
  }
  function clearPrivateData() {
    board.value = null; calendarLife.value = []; items.value = null; rules.value = null; life.value = null; history.value = null
    for (const name of Object.keys(updated)) delete updated[name]
    for (const name of Object.keys(readErrors)) delete readErrors[name]
    for (const key of Object.keys(feedback)) delete feedback[key]
    notice.value = null
  }
  function expire() {
    sessionVersion += 1
    cancelReads()
    clearPrivateData()
    authenticated.value = false
    sessionError.value = '登录已过期，请重新输入口令。未保存的表单不会自动提交。'
    onExpired()
  }
  function schedule() {
    stopTimer()
    if (!disposed && authenticated.value === true && !document.hidden && !readErrors[view.value]) timer = setTimeout(() => { void readView(view.value) }, 15000)
  }
  async function listPage<T extends ReminderListResponse | ReminderHistoryResponse>(path: string, filters: Record<string, string>, previous: T | null, more: boolean, signal: AbortSignal): Promise<T> {
    const selectedFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''))
    if (more) {
      const query = new URLSearchParams({ ...selectedFilters, offset: String(previous!.nextOffset), limit: '30' })
      const response = await api<T>(`${path}?${query}`, 'GET', undefined, signal)
      return { ...response, items: [...previous!.items, ...response.items] } as T
    }
    const target = Math.max(30, previous?.items.length ?? 0)
    let offset = 0
    let result: T | null = null
    do {
      const query = new URLSearchParams({ ...selectedFilters, offset: String(offset), limit: String(Math.min(200, target - offset)) })
      const response = await api<T>(`${path}?${query}`, 'GET', undefined, signal)
      result = result ? { ...response, items: [...result.items, ...response.items] } as T : response
      if (response.nextOffset === null) break
      offset = response.nextOffset
    } while (offset < target)
    return result!
  }
  function readView(name: ViewName, options: { user?: boolean; restart?: boolean; more?: boolean } = {}): Promise<void> {
    if (authenticated.value !== true || disposed || (document.hidden && !options.user)) return Promise.resolve()
    if (readErrors[name] && !options.user) return Promise.resolve()
    if (options.restart) { controllers.get(name)?.abort(); activeReads.delete(name) }
    const existing = activeReads.get(name)
    if (existing) return existing
    stopTimer()
    const controller = new AbortController()
    controllers.set(name, controller)
    const version = sessionVersion
    loading[name] = true
    if (options.user) delete readErrors[name]
    const today = now().format('YYYY-MM-DD')
    const count = days.value
    const selectedItemFilters = { ...itemFilters }
    const selectedHistoryFilters = { ...historyFilters }
    const selectedRuleStatus = ruleFilters.status
    const previousItems = items.value
    const previousHistory = history.value
    const current = () => !disposed && !controller.signal.aborted && version === sessionVersion
    const promise = (async () => {
      try {
        if (name === 'today') {
          const [nextBoard, nextLife] = await Promise.all([
            api<ReminderBoardResponse>(`/board?date=${today}&days=${count}`, 'GET', undefined, controller.signal),
            Promise.all(Array.from({ length: count }, (_, index) => api<LifeDashboard>(`/life?date=${dayjs(today).add(index, 'day').format('YYYY-MM-DD')}`, 'GET', undefined, controller.signal))),
          ])
          if (!current()) return
          board.value = nextBoard; calendarLife.value = nextLife
        } else if (name === 'items') {
          const response = await listPage('/items', selectedItemFilters, previousItems, Boolean(options.more), controller.signal)
          if (!current()) return
          items.value = response
        } else if (name === 'rules') {
          const response = await api<ReminderRulesResponse>(`/rules?status=${selectedRuleStatus}`, 'GET', undefined, controller.signal)
          if (!current()) return
          rules.value = response
        } else if (name === 'life') {
          const response = await api<LifeDashboard>(`/life?date=${today}`, 'GET', undefined, controller.signal)
          if (!current()) return
          life.value = response
        } else {
          const response = await listPage('/history', selectedHistoryFilters, previousHistory, Boolean(options.more), controller.signal)
          if (!current()) return
          history.value = response
        }
        updated[name] = now().toISOString()
        delete readErrors[name]
        if (name === view.value) onRead(Boolean(options.user))
      } catch (cause) {
        if (!current()) return
        if (cause instanceof ApiError && cause.status === 401) expire()
        else readErrors[name] = cause instanceof Error ? cause.message : String(cause)
      } finally {
        if (controllers.get(name) === controller) {
          controllers.delete(name); activeReads.delete(name); loading[name] = false
          if (name === view.value) schedule()
        }
      }
    })()
    activeReads.set(name, promise)
    return promise
  }
  function applyItem(item: ReminderItem) {
    if (items.value) items.value = { ...items.value, items: items.value.items.map(row => row.key === item.key ? item : row) }
    if (!board.value) return
    const next = { ...board.value }
    for (const key of ['pending', 'upcoming', 'handled', 'issues'] as const) next[key] = next[key].filter(row => row.key !== item.key)
    if (item.status === 'awaiting') next.pending = [...next.pending, item]
    else if (['failed', 'missed', 'unknown'].includes(item.status)) next.issues = [...next.issues, item]
    else {
      const group = ['scheduled', 'snoozed'].includes(item.status) ? 'upcoming' : 'handled'
      const groupDate = group === 'handled' && item.actedAt ? dayjs(item.actedAt).tz('Asia/Shanghai').format('YYYY-MM-DD') : item.date
      if (groupDate >= next.date && groupDate <= dayjs(next.date).add(days.value - 1, 'day').format('YYYY-MM-DD')) next[group] = [...next[group], item].sort((a, b) => a.triggerAt.localeCompare(b.triggerAt))
    }
    board.value = next
  }
  function applyRule(rule: ReminderRuleView) {
    if (rules.value) rules.value = { ...rules.value, rules: rules.value.rules.map(row => row.id === rule.id ? rule : row) }
  }
  async function execute(path: string, body: unknown, key: string, method = 'POST', successText = '操作已完成'): Promise<boolean> {
    if (pending[key]) return false
    pending[key] = true
    delete feedback[key]
    const version = sessionVersion
    try {
      const result = await api<ReminderMutationResponse | LifeDashboard>(path, method, body)
      if (version !== sessionVersion || disposed) return false
      cancelReads()
      if ('ok' in result) {
        if (result.item) applyItem(result.item)
        if (result.rule) applyRule(result.rule)
      } else {
        if (life.value?.date === result.date) life.value = result
        calendarLife.value = calendarLife.value.map(day => day.date === result.date ? result : day)
      }
      feedback[key] = { text: successText, error: false }
      notice.value = feedback[key]
      await readView(view.value, { user: true })
      return true
    } catch (cause) {
      if (version !== sessionVersion || disposed) return false
      if (cause instanceof ApiError && cause.status === 401) { expire(); return false }
      const applied = cause instanceof ApiError && (cause.payload as ReminderApiError).applied === true
      const message = cause instanceof Error ? cause.message : String(cause)
      const failure = { text: applied ? `状态已更新，但后续处理失败：${message}` : message, error: true }
      if (applied || (cause instanceof ApiError && cause.status === 409)) { cancelReads(); await readView(view.value, { user: true }) }
      feedback[key] = failure
      notice.value = failure
      return applied
    } finally { pending[key] = false }
  }
  async function finishBoot() {
    await nextTick()
    booting.value = false
    document.getElementById('boot')?.remove()
  }
  async function checkSession() {
    sessionBusy.value = true; sessionError.value = ''
    try {
      const session = await request<{ authenticated: boolean }>('/api/session')
      authenticated.value = session.authenticated
      if (session.authenticated) await readView(view.value, { user: true })
    } catch (cause) { sessionError.value = cause instanceof Error ? cause.message : String(cause) }
    finally { sessionBusy.value = false; await finishBoot() }
  }
  async function login(password: string) {
    sessionBusy.value = true; sessionError.value = ''
    try {
      await request('/api/session', 'POST', { password })
      sessionVersion += 1
      booting.value = true
      authenticated.value = true
      await readView(view.value, { user: true, restart: true })
    } catch (cause) { sessionError.value = cause instanceof Error ? cause.message : String(cause) }
    finally { sessionBusy.value = false; await finishBoot() }
  }
  async function logout(): Promise<boolean> {
    sessionBusy.value = true
    try {
      await request('/api/session', 'DELETE')
      sessionVersion += 1; cancelReads(); clearPrivateData(); authenticated.value = false
      sessionError.value = ''
      return true
    } catch (cause) { notice.value = { text: cause instanceof Error ? cause.message : String(cause), error: true }; return false }
    finally { sessionBusy.value = false }
  }
  function refresh() { return readView(view.value, { user: true, restart: true }) }
  function setDays(value: 1 | 7) { days.value = value; void readView('today', { user: true, restart: true }) }
  function applyFilters(name: 'items' | 'rules' | 'history', value: Record<string, string>) {
    Object.assign(name === 'items' ? itemFilters : name === 'rules' ? ruleFilters : historyFilters, value)
    if (name === 'items' && items.value) items.value = { ...items.value, nextOffset: null }
    if (name === 'history' && history.value) history.value = { ...history.value, nextOffset: null }
    void readView(name, { user: true, restart: true })
  }
  function more() { return readView(view.value, { user: true, more: true }) }
  function visibility() { if (document.hidden) stopTimer(); else if (authenticated.value === true && !readErrors[view.value]) void readView(view.value) }
  const removeRouteHook = router.afterEach((to, from) => { if (to.path !== from.path) void readView(viewFromPath(to.path)) })
  onMounted(async () => { await router.isReady(); document.addEventListener('visibilitychange', visibility); await checkSession() })
  onUnmounted(() => { disposed = true; cancelReads(); removeRouteHook(); document.removeEventListener('visibilitychange', visibility) })
  return { view, authenticated, booting, sessionBusy, sessionError, board, calendarLife, items, rules, life, history, days, itemFilters, ruleFilters, historyFilters, loading, readErrors, updated, pending, feedback, notice, execute, refresh, setDays, applyFilters, more, login, logout, checkSession, expire }
}
export type DashboardData = ReturnType<typeof useDashboard>
