import { computed, nextTick, onMounted, onUnmounted, reactive, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { api, ApiError, request } from '../api'
import type { Board, Candidate, Detail, Discovered, Following, Operation } from '../types'
import { finishInitialBoardRead } from '../initialBoardRead'

export function useBoardData() {
  const router = useRouter()
  const authenticated = shallowRef<boolean | null>(null)
  const sessionGeneration = shallowRef(0)
  const sessionError = shallowRef('')
  const sessionSubmitting = shallowRef(false)
  const board = shallowRef<Board | null>(null)
  const following = shallowRef<Following | null>(null)
  const details = reactive<Record<string, Detail>>({})
  const detailErrors = reactive<Record<string, string>>({})
  const error = shallowRef('')
  const connected = shallowRef(false)
  const actionError = shallowRef('')
  const submitting = shallowRef(false)
  const operation = shallowRef<Operation | null>(null)
  const discovered = shallowRef<Discovered[] | null>(null)
  const candidates = shallowRef<Candidate[] | null>(null)
  const busy = computed(() => submitting.value || operation.value?.status === 'running' || operation.value?.status === 'queued')
  let timer: ReturnType<typeof setTimeout> | undefined
  let reading = false
  let checkingSession = false
  let disposed = false
  let initialReadPending = true
  let activeOperationId: string | null = null

  function stopTimer() { clearTimeout(timer) }
  function clearManagement() {
    sessionGeneration.value += 1
    submitting.value = false
    operation.value = null
    activeOperationId = null
    discovered.value = null
    candidates.value = null
    actionError.value = ''
    if (board.value) board.value = { ...board.value, operation: null }
  }
  function expireSession() {
    clearManagement()
    authenticated.value = false
    sessionError.value = '管理会话已过期，请重新登录；比赛仍可继续浏览。'
  }
  function showFailure(cause: unknown) {
    connected.value = false
    error.value = cause instanceof Error ? cause.message : String(cause)
    stopTimer()
  }
  async function readDetail(eventId: string) {
    try {
      const value = await api<Detail>(`/events/${encodeURIComponent(eventId)}`)
      if (disposed) return
      details[eventId] = value
      delete detailErrors[eventId]
    } catch (cause) {
      if (disposed) return
      if (cause instanceof ApiError && cause.status === 404) {
        delete details[eventId]
        detailErrors[eventId] = '记录已不存在，可能已在 Telegram 中清空。'
        return
      }
      throw cause
    }
  }
  function acceptOperation(value: Operation | null, applyResult = false) {
    if (!value) return
    operation.value = value
    // Only actions issued in this session populate management choices.
    if (value.status === 'succeeded' && applyResult) {
      const intent = value.type
      if (intent === '/discover' || intent === 'discover') discovered.value = (value.result as { events: Discovered[] }).events
      if (intent === 'resolve-player') candidates.value = (value.result as { candidates: Candidate[] }).candidates
      if ((intent === 'dismiss' || intent === 'start') && discovered.value) {
        const result = value.result as { eventSlug?: string; interest?: Discovered['interest'] }
        discovered.value = discovered.value.map(event => event.eventSlug === result.eventSlug && result.interest ? { ...event, interest: result.interest } : event)
      }
      if (intent === 'remove-player') {
        const { id } = value.result as { id: number }
        if (following.value) following.value = { ...following.value, players: following.value.players.filter(player => player.id !== id) }
        if (board.value) board.value = { ...board.value, players: board.value.players.filter(player => player.id !== id) }
        for (const [eventId, detail] of Object.entries(details)) {
          if (detail.event.active) details[eventId] = { ...detail, players: detail.players.filter(player => player.id !== id) }
        }
      }
    }
    if (value.status === 'succeeded' || value.status === 'failed') activeOperationId = null
  }
  async function readOperation(latest: Operation | null, generation: number) {
    if (authenticated.value !== true || generation !== sessionGeneration.value || actionError.value) return
    const operationId = activeOperationId
    if (!operationId) { acceptOperation(latest); return }
    try {
      const value = await api<Operation>(`/operations/${operationId}`)
      if (disposed || generation !== sessionGeneration.value || operationId !== activeOperationId) return
      acceptOperation(value, true)
    } catch (cause) {
      if (disposed || generation !== sessionGeneration.value || operationId !== activeOperationId) return
      if (cause instanceof ApiError && cause.status === 401) { expireSession(); return }
      if (cause instanceof ApiError && cause.status === 404) {
        activeOperationId = null
        operation.value = null
        actionError.value = '操作结果不可用，请重新读取当前状态；不会自动重放操作。'
      } else actionError.value = cause instanceof Error ? cause.message : String(cause)
    }
  }
  async function refresh() {
    await router.isReady()
    stopTimer()
    if (reading || disposed || error.value || document.hidden) return
    reading = true
    const generation = sessionGeneration.value
    const eventId = String(router.currentRoute.value.params.eventId ?? '')
    if (authenticated.value === true && !sessionError.value) void checkSession()
    try {
      const nextBoard = await api<Board>('/board')
      if (disposed) return
      board.value = { ...nextBoard, operation: authenticated.value === true && generation === sessionGeneration.value ? nextBoard.operation : null }
      const value = await api<Following>('/following')
      if (disposed) return
      following.value = value
      if (eventId) await readDetail(eventId)
      if (!disposed) {
        await readOperation(nextBoard.operation, generation)
        connected.value = true
      }
    } catch (cause) { if (!disposed) showFailure(cause) }
    finally {
      reading = false
      if (!disposed && !error.value && !document.hidden) {
        const changed = generation !== sessionGeneration.value || eventId !== String(router.currentRoute.value.params.eventId ?? '')
        timer = setTimeout(refresh, changed ? 0 : 5000)
      }
      if (initialReadPending && !disposed) {
        await nextTick()
        if (error.value || eventId === String(router.currentRoute.value.params.eventId ?? '')) {
          initialReadPending = false
          await finishInitialBoardRead()
        }
      }
    }
  }
  async function reconnect() { error.value = ''; actionError.value = ''; await refresh() }
  async function run(path: string, body: unknown = {}, method = 'POST') {
    if (authenticated.value !== true) { sessionError.value = '请先管理登录。'; return }
    if (sessionSubmitting.value || submitting.value || (busy.value && path !== '/monitoring/pause')) return
    const generation = sessionGeneration.value
    submitting.value = true
    actionError.value = ''
    try {
      const result = await api<{ operationId: string }>(path, method, body)
      if (disposed || generation !== sessionGeneration.value) return
      activeOperationId = result.operationId
      operation.value = { id: result.operationId, type: path, status: 'queued', createdAt: null, startedAt: null, finishedAt: null, result: null, error: null }
      await refresh()
    } catch (cause) {
      if (disposed || generation !== sessionGeneration.value) return
      if (cause instanceof ApiError && cause.status === 401) expireSession()
      else actionError.value = cause instanceof Error ? cause.message : String(cause)
    } finally { if (generation === sessionGeneration.value) submitting.value = false }
  }
  async function login(password: string): Promise<boolean> {
    if (sessionSubmitting.value) return false
    clearManagement()
    const generation = sessionGeneration.value
    sessionSubmitting.value = true
    sessionError.value = ''
    try {
      const session = await request<{ authenticated: boolean }>('/api/session', 'POST', { password })
      if (disposed || generation !== sessionGeneration.value) return false
      authenticated.value = session.authenticated
      void refresh()
      return session.authenticated
    } catch (cause) {
      if (!disposed && generation === sessionGeneration.value) sessionError.value = cause instanceof Error ? cause.message : String(cause)
      return false
    } finally { if (generation === sessionGeneration.value) sessionSubmitting.value = false }
  }
  async function logout() {
    if (sessionSubmitting.value) return
    clearManagement()
    const generation = sessionGeneration.value
    authenticated.value = null
    sessionSubmitting.value = true
    sessionError.value = ''
    try {
      await request('/api/session', 'DELETE')
      if (!disposed && generation === sessionGeneration.value) authenticated.value = false
    } catch (cause) {
      if (!disposed && generation === sessionGeneration.value) sessionError.value = cause instanceof Error ? cause.message : String(cause)
    } finally { if (generation === sessionGeneration.value) sessionSubmitting.value = false }
  }
  async function checkSession() {
    if (disposed || checkingSession || sessionSubmitting.value) return
    checkingSession = true
    const generation = sessionGeneration.value
    sessionError.value = ''
    try {
      const session = await request<{ authenticated: boolean }>('/api/session')
      if (disposed || generation !== sessionGeneration.value) return
      if (!session.authenticated && authenticated.value === true) expireSession()
      else authenticated.value = session.authenticated
    } catch (cause) {
      if (disposed || generation !== sessionGeneration.value) return
      clearManagement()
      authenticated.value = null
      sessionError.value = cause instanceof Error ? cause.message : String(cause)
    } finally { checkingSession = false }
  }
  function visibility() { if (document.hidden) stopTimer(); else if (!error.value) void refresh() }
  const removeHook = router.afterEach(() => { if (!error.value) void refresh() })
  onMounted(() => {
    document.addEventListener('visibilitychange', visibility)
    void checkSession()
    void refresh()
  })
  onUnmounted(() => { disposed = true; stopTimer(); removeHook(); document.removeEventListener('visibilitychange', visibility) })
  return { authenticated, sessionGeneration, sessionError, sessionSubmitting, board, following, details, detailErrors, error, connected, actionError, submitting, operation, discovered, candidates, busy, reconnect, run, login, logout, checkSession }
}
export type BoardData = ReturnType<typeof useBoardData>
