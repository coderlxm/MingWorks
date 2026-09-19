export class ApiError extends Error { constructor(message: string, public status: number) { super(message) } }
export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, credentials: 'same-origin', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new ApiError(data.error ?? data.message ?? `请求失败（${response.status}）`, response.status)
  return data as T
}
export const api = <T>(path: string, method = 'GET', body?: unknown) => request<T>(`/api/startgg${path}`, method, body)
