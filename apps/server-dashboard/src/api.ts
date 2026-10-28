import type { Overview } from './types'

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method, credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) throw new ApiError(data.error ?? `请求失败（${response.status}）`, response.status)
  return data as T
}

export const getSession = () => request<{ authenticated: boolean }>('/api/session')
export const login = (password: string) => request<{ authenticated: boolean }>('/api/session', 'POST', { password })
export const getOverview = () => request<Overview>('/api/servers/overview')
export const runChecks = () => request<Overview>('/api/servers/checks', 'POST')
