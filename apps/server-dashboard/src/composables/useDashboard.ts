import { shallowRef } from 'vue'
import { ApiError, getOverview, getSession, login as requestLogin, runChecks } from '../api'
import type { Overview } from '../types'

export type Phase = 'checking' | 'locked' | 'ready'

export function useDashboard() {
  const phase = shallowRef<Phase>('checking')
  const overview = shallowRef<Overview | null>(null)
  const error = shallowRef('')
  const loginBusy = shallowRef(false)
  const loginError = shallowRef('')
  const inspecting = shallowRef(false)

  function showError(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) {
      phase.value = 'locked'
      return
    }
    error.value = (cause as Error).message
  }

  async function loadOverview() {
    overview.value = await getOverview()
    phase.value = 'ready'
  }

  async function init() {
    try {
      const session = await getSession()
      if (session.authenticated) await loadOverview()
      else phase.value = 'locked'
    } catch (cause) {
      showError(cause)
    }
  }

  async function login(password: string) {
    loginBusy.value = true
    loginError.value = ''
    try {
      await requestLogin(password)
      await loadOverview()
    } catch (cause) {
      loginError.value = (cause as Error).message
    } finally {
      loginBusy.value = false
    }
  }

  async function inspect() {
    inspecting.value = true
    error.value = ''
    try {
      overview.value = await runChecks()
    } catch (cause) {
      showError(cause)
    } finally {
      inspecting.value = false
    }
  }

  return { phase, overview, error, loginBusy, loginError, inspecting, init, login, inspect }
}
