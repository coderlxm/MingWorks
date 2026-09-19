import { computed, onMounted, onUnmounted, reactive, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { api, ApiError, request } from '../api'
import type { Board, Candidate, Detail, Discovered, Following, Operation } from '../types'

export function useBoardData() {
  const router = useRouter()
  const authenticated = shallowRef<boolean | null>(null)
  const board = shallowRef<Board | null>(null)
  const following = shallowRef<Following | null>(null)
  const details = reactive<Record<string, Detail>>({})
  const detailErrors = reactive<Record<string, string>>({})
  const error = shallowRef('')
  const actionError = shallowRef('')
  const submitting = shallowRef(false)
  const operation = shallowRef<Operation | null>(null)
  const discovered = shallowRef<Discovered[] | null>(null)
  const candidates = shallowRef<Candidate[] | null>(null)
  const busy = computed(() => submitting.value || operation.value?.status === 'running' || operation.value?.status === 'queued')
  let timer: ReturnType<typeof setTimeout> | undefined
  let reading = false
  let disposed = false
  let activeOperationId: string | null = null
  let sessionGeneration = 0
  let handledOperationId: string | null = null

  function stopTimer() { clearTimeout(timer) }
  function showFailure(cause: unknown) {
    error.value = cause instanceof Error ? cause.message : String(cause)
    if (cause instanceof ApiError && cause.status === 401) {
      sessionGeneration += 1
      authenticated.value = false
      submitting.value = false
      operation.value = null
      activeOperationId = null
    }
    stopTimer()
  }
  async function readDetail(eventId: string, generation: number) {
    try {
      const value = await api<Detail>(`/events/${encodeURIComponent(eventId)}`)
      if (generation !== sessionGeneration) return
      details[eventId] = value
      delete detailErrors[eventId]
    } catch (cause) {
      if (generation !== sessionGeneration) return
      if (cause instanceof ApiError && cause.status === 404) {
        delete details[eventId]
        detailErrors[eventId] = '记录已不存在，可能已在 Telegram 中清空。'
        return
      }
      throw cause
    }
  }
  function acceptOperation(value: Operation | null) {
    if (!value) return
    operation.value = value
    if (value.status === 'succeeded' && handledOperationId !== value.id) {
      handledOperationId = value.id
      const intent = value.type
      if (intent === '/discover' || intent === 'discover') discovered.value = (value.result as { events: Discovered[] }).events
      if (intent === 'resolve-player') candidates.value = (value.result as { candidates: Candidate[] }).candidates
      if ((intent === 'dismiss' || intent === 'start') && discovered.value) {
        const result = value.result as { eventSlug?: string; interest?: Discovered['interest'] }
        discovered.value = discovered.value.map(event => event.eventSlug === result.eventSlug && result.interest ? { ...event, interest: result.interest } : event)
      }
    }
    if (value.status === 'succeeded' || value.status === 'failed') activeOperationId = null
  }
  async function refresh() {
    stopTimer()
    if (reading || disposed || authenticated.value !== true || error.value || document.hidden) return
    reading = true
    const generation = sessionGeneration
    const eventId = String(router.currentRoute.value.params.eventId ?? '')
    try {
      const nextBoard = await api<Board>('/board')
      if (generation !== sessionGeneration) return
      board.value = nextBoard
      if (activeOperationId) {
        try {
          const value = await api<Operation>(`/operations/${activeOperationId}`)
          if (generation !== sessionGeneration) return
          acceptOperation(value)
        } catch (cause) {
          if (generation !== sessionGeneration) return
          if (cause instanceof ApiError && cause.status === 404) {
            activeOperationId = null
            operation.value = null
            actionError.value = '操作结果不可用，请重新读取当前状态；不会自动重放操作。'
          } else throw cause
        }
      } else acceptOperation(nextBoard.operation)
      const value = await api<Following>('/following')
      if (generation !== sessionGeneration) return
      following.value = value
      if (eventId) await readDetail(eventId, generation)
    } catch (cause) { if (generation === sessionGeneration) showFailure(cause) }
    finally {
      reading = false
      if (!disposed && !error.value && authenticated.value && !document.hidden) {
        const changed = generation !== sessionGeneration || eventId !== String(router.currentRoute.value.params.eventId ?? '')
        timer = setTimeout(refresh, changed ? 0 : 5000)
      }
    }
  }
  async function reconnect() { error.value = ''; await refresh() }
  async function run(path: string, body: unknown = {}, method = 'POST') {
    if (submitting.value || (busy.value && path !== '/monitoring/pause')) return
    const generation = sessionGeneration
    submitting.value = true
    actionError.value = ''
    try {
      const result = await api<{ operationId: string }>(path, method, body)
      if (generation !== sessionGeneration) return
      activeOperationId = result.operationId
      operation.value = { id: result.operationId, type: path, status: 'queued', createdAt: null, startedAt: null, finishedAt: null, result: null, error: null }
      await refresh()
    } catch (cause) {
      if (generation !== sessionGeneration) return
      actionError.value = cause instanceof Error ? cause.message : String(cause)
      if (cause instanceof ApiError && cause.status === 401) showFailure(cause)
    } finally { if (generation === sessionGeneration) submitting.value = false }
  }
  async function login(password: string) {
    const generation = ++sessionGeneration
    submitting.value = true
    actionError.value = ''
    try {
      const session = await request<{ authenticated: boolean }>('/api/session', 'POST', { password })
      if (generation !== sessionGeneration) return
      authenticated.value = session.authenticated
      error.value = ''
      await refresh()
    } catch (cause) { if (generation === sessionGeneration) actionError.value = cause instanceof Error ? cause.message : String(cause) }
    finally { if (generation === sessionGeneration) submitting.value = false }
  }
  async function logout() {
    const generation = ++sessionGeneration
    stopTimer()
    try {
      await request('/api/session', 'DELETE')
      if (generation !== sessionGeneration) return
      stopTimer()
      authenticated.value = false
      submitting.value = false
      board.value = null
      following.value = null
      operation.value = null
      activeOperationId = null
      discovered.value = null
      candidates.value = null
      error.value = ''
      actionError.value = ''
      for (const key of Object.keys(details)) delete details[key]
    } catch (cause) { if (generation === sessionGeneration) showFailure(cause) }
  }
  function visibility() { if (document.hidden) stopTimer(); else if (!error.value) void refresh() }
  const removeHook = router.afterEach(() => { if (!error.value) void refresh() })
  async function loadSession() {
    const generation = ++sessionGeneration
    error.value = ''
    try {
      const session = await request<{ authenticated: boolean }>('/api/session')
      if (generation !== sessionGeneration) return
      authenticated.value = session.authenticated
      await refresh()
    } catch (cause) { if (generation === sessionGeneration) { showFailure(cause); authenticated.value = false } }
  }
  onMounted(() => { document.addEventListener('visibilitychange', visibility); void loadSession() })
  onUnmounted(() => { disposed = true; stopTimer(); removeHook(); document.removeEventListener('visibilitychange', visibility) })
  return { authenticated, board, following, details, detailErrors, error, actionError, submitting, operation, discovered, candidates, busy, reconnect, run, login, logout, loadSession }
}
export type BoardData = ReturnType<typeof useBoardData>
